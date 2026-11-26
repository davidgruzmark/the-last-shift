import * as THREE from 'three';
import { IKEA_COLORS } from '../config/constants';
import type { DoorInteraction } from '../interaction/DoorInteraction';
import type { CollisionManager } from '../world/CollisionManager';
import { NavGraph } from '../world/NavGraph';
import type { DialogueManager } from './DialogueManager';
import type { NpcDefinition, NPCInteraction } from './NPCInteraction';

export type StaffingPhase =
  | 'staffed'
  | 'standing'
  | 'departing'
  | 'relief_en_route'
  | 'seating';

export const SECURITY_ROSTER_DEFS: readonly NpcDefinition[] = [
  {
    id: 'guard-avi',
    name: 'Avi',
    nameKey: 'npc.GuardAvi',
    position: new THREE.Vector3(1.35, 0, -2.55),
    facingYaw: Math.PI,
    allowControlRoomEntry: true,
    visual: { skinColor: 0xe6baa0, hairColor: 0x2c2018, shirtColor: IKEA_COLORS.securityShirt },
    lines: [
      {
        speaker: 'AVI (SECURITY)',
        speakerKey: 'speaker.AVI (SECURITY)',
        text: 'Monitoring cameras 01 through 06 with you, Kfir. Station B is holding steady.',
        textKey: 'ambient.avi.1',
      },
      {
        speaker: 'KFIR',
        speakerKey: 'speaker.KFIR',
        text: 'Appreciate the backup, Avi. Let me know when you rotate out.',
        textKey: 'ambient.avi.2',
      },
    ],
  },
  {
    id: 'guard-omer',
    name: 'Omer',
    nameKey: 'npc.GuardOmer',
    position: new THREE.Vector3(4.5, 0, 8.8),
    facingYaw: -Math.PI * 0.5,
    allowControlRoomEntry: true,
    visual: { skinColor: 0xdcb094, hairColor: 0x4b3120, shirtColor: IKEA_COLORS.securityShirt },
    lines: [
      {
        speaker: 'OMER (SECURITY)',
        speakerKey: 'speaker.OMER (SECURITY)',
        text: 'Just finishing my break in the staff room—ready to take Station B whenever Avi steps out.',
        textKey: 'ambient.omer.1',
      },
      {
        speaker: 'KFIR',
        speakerKey: 'speaker.KFIR',
        text: 'Sounds good, Omer. Coffee pot is still warm.',
        textKey: 'ambient.omer.2',
      },
    ],
  },
];

export function createControlRoomStaffNavGraph(): NavGraph {
  const g = new NavGraph();
  g.addNode({ id: 'seat-b', position: new THREE.Vector3(1.35, 0, -2.55), floor: 1, kind: 'chair_seat' });
  g.addNode({ id: 'approach-b', position: new THREE.Vector3(1.35, 0, -1.65), floor: 1, kind: 'chair_approach' });
  g.addNode({ id: 'ctrl-center', position: new THREE.Vector3(-0.8, 0, 1.5), floor: 1, kind: 'floor' });
  g.addNode({ id: 'staff-door-in', position: new THREE.Vector3(-3.0, 0, 4.8), floor: 1, kind: 'door', doorId: 'staff-break-door' });
  g.addNode({ id: 'staff-door-out', position: new THREE.Vector3(-3.0, 0, 7.6), floor: 1, kind: 'door', doorId: 'staff-break-door' });
  g.addNode({ id: 'staff-rest-a', position: new THREE.Vector3(-1.2, 0, 9.2), floor: 1, kind: 'floor' });
  g.addNode({ id: 'staff-rest-b', position: new THREE.Vector3(4.5, 0, 8.8), floor: 1, kind: 'floor' });

  g.addEdge({ from: 'seat-b', to: 'approach-b', kind: 'walk', requiresAuth: true });
  g.addEdge({ from: 'approach-b', to: 'ctrl-center', kind: 'walk', requiresAuth: true });
  g.addEdge({ from: 'ctrl-center', to: 'staff-door-in', kind: 'walk', requiresAuth: true });
  g.addEdge({ from: 'staff-door-in', to: 'staff-door-out', kind: 'door', requiresAuth: true });
  g.addEdge({ from: 'staff-door-out', to: 'staff-rest-a', kind: 'walk' });
  g.addEdge({ from: 'staff-rest-a', to: 'staff-rest-b', kind: 'walk' });
  return g;
}

/**
 * Reusable physical Control Room shift-rotation coordinator.
 * Guards walk out through the Staff Break Door, rest off-duty, and walk back
 * to Station B executive chair with zero teleportation or chair clipping.
 */
export class ControlRoomStaffingSystem {
  private readonly guards: readonly NPCInteraction[];
  private readonly navGraph: NavGraph;
  private readonly collision: CollisionManager;
  private readonly dialogue: DialogueManager;
  private readonly shiftDurationSec: number;

  private activeGuardIdx = 0;
  private reliefGuardIdx = 1;
  private phase: StaffingPhase = 'staffed';
  private timer = 0;
  private transitionProgress = 0;

  private readonly seatPos = new THREE.Vector3(1.35, 0, -2.55);
  private readonly approachPos = new THREE.Vector3(1.35, 0, -1.65);

  constructor(options: {
    guards: readonly NPCInteraction[];
    staffDoor: DoorInteraction;
    collision: CollisionManager;
    dialogue: DialogueManager;
    navGraph?: NavGraph;
    shiftDurationSec?: number;
  }) {
    this.guards = options.guards;
    this.collision = options.collision;
    this.dialogue = options.dialogue;
    this.navGraph = options.navGraph ?? createControlRoomStaffNavGraph();
    this.shiftDurationSec = options.shiftDurationSec ?? 45;

    for (const guard of this.guards) {
      guard.setControlRoomAuthorized(true);
      guard.setNavigationDoors([options.staffDoor]);
    }

    if (this.guards.length >= 2) {
      this.guards[0].setSeated(true, this.seatPos, Math.PI);
      this.guards[1].setPositionImmediate(new THREE.Vector3(4.5, 0, 8.8), -Math.PI * 0.5);
    }
  }

  getPhase(): StaffingPhase {
    return this.phase;
  }

  getActiveGuard(): NPCInteraction | undefined {
    return this.guards[this.activeGuardIdx];
  }

  getReliefGuard(): NPCInteraction | undefined {
    return this.guards[this.reliefGuardIdx];
  }

  /** Immediately begins a natural physical shift handover without teleporting anyone. */
  triggerShiftChangeNow(): void {
    if (this.guards.length < 2 || this.phase !== 'staffed') return;
    this.phase = 'standing';
    this.transitionProgress = 0;
    this.collision.setColliderEnabled('ctrl-chair-b', false);
    this.guards[this.activeGuardIdx].setSeated(false);
  }

  update(dt: number): void {
    if (this.guards.length < 2) return;
    if (this.dialogue.isActive()) return;

    const outgoing = this.guards[this.activeGuardIdx];
    const incoming = this.guards[this.reliefGuardIdx];

    if (this.phase === 'staffed') {
      this.timer += dt;
      if (this.timer >= this.shiftDurationSec) {
        this.timer = 0;
        this.triggerShiftChangeNow();
      }
      return;
    }

    if (this.phase === 'standing') {
      this.transitionProgress = Math.min(1, this.transitionProgress + dt / 0.45);
      const slide = new THREE.Vector3().lerpVectors(
        this.seatPos,
        this.approachPos,
        this.transitionProgress,
      );
      outgoing.setPositionImmediate(slide, 0);

      if (this.transitionProgress >= 1) {
        this.collision.setColliderEnabled('ctrl-chair-b', true);
        this.phase = 'departing';
        const restGoal =
          this.activeGuardIdx === 0 ? 'staff-rest-b' : 'staff-rest-a';
        const nodes = this.navGraph.findPath('approach-b', restGoal, {
          authorizedForControlRoom: true,
        });
        outgoing.setPath(
          nodes.map((n) => n.position),
          () => {
            this.phase = 'relief_en_route';
            const arrivalNodes = this.navGraph.findPath(
              incoming.getWorldPosition(),
              'approach-b',
              { authorizedForControlRoom: true, startFloorHint: 1, goalFloorHint: 1 },
            );
            incoming.setPath(
              arrivalNodes.map((n) => n.position),
              () => {
                this.phase = 'seating';
                this.transitionProgress = 0;
                this.collision.setColliderEnabled('ctrl-chair-b', false);
              },
              2.25,
            );
          },
          2.25,
        );
      }
      return;
    }

    if (this.phase === 'seating') {
      this.transitionProgress = Math.min(1, this.transitionProgress + dt / 0.45);
      const slide = new THREE.Vector3().lerpVectors(
        this.approachPos,
        this.seatPos,
        this.transitionProgress,
      );
      incoming.setPositionImmediate(slide, Math.PI);

      if (this.transitionProgress >= 1) {
        incoming.setSeated(true, this.seatPos, Math.PI);
        this.collision.setColliderEnabled('ctrl-chair-b', true);
        const prevActive = this.activeGuardIdx;
        this.activeGuardIdx = this.reliefGuardIdx;
        this.reliefGuardIdx = prevActive;
        this.phase = 'staffed';
        this.timer = 0;
      }
    }
  }
}
