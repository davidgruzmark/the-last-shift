import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CollectibleManager } from '../src/collectibles/CollectibleManager';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { type Interactable } from '../src/interaction/Interactable';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { MissionManager } from '../src/missions/MissionManager';
import type { MissionDefinition } from '../src/missions/MissionObjectives';
import { ObjectiveMarker } from '../src/missions/ObjectiveMarker';
import { DialogueManager } from '../src/npcs/DialogueManager';
import { PlayerController } from '../src/player/PlayerController';
import { PhoneManager } from '../src/ui/PhoneManager';
import { CollisionManager, type FloorId } from '../src/world/CollisionManager';
import { NavGraph } from '../src/world/NavGraph';
import { resolveFloorRegion, WORLD_ANCHORS } from '../src/world/WorldAnchors';

class MockInteractable implements Interactable {
  constructor(
    readonly id: string,
    readonly pos: THREE.Vector3,
    readonly floor?: FloorId,
  ) {}
  readonly type = 'interact' as const;
  readonly radius = 3.0;
  getWorldPosition(): THREE.Vector3 {
    return this.pos;
  }
  getPromptText(): string {
    return `Interact ${this.id}`;
  }
  canInteract(): boolean {
    return true;
  }
  onInteract(): void {}
}

describe('Phase 2B.1 Multi-Floor Core Infrastructure', () => {
  it('climbs slopes cleanly onto Floor 2 and holds committedFloor steady during transitions & jumps', () => {
    const collision = new CollisionManager();

    // Floor 1 landing slab (Y = 0)
    collision.addBox(
      'floor1-slab',
      new THREE.Vector3(-5, -0.5, -5),
      new THREE.Vector3(5, 0, 5),
      true,
      { floor: 1, zoneId: 'Showroom' },
    );

    // Ramp / staircase from z=4 (Y=0) to z=12 (Y=5.8)
    collision.addSlope({
      id: 'main-stair-slope',
      minX: -1.5,
      maxX: 1.5,
      minZ: 4,
      maxZ: 12,
      axis: 'z',
      yLow: 0,
      yHigh: 5.8,
      lowSide: 'min',
      surfaceMeta: { floor: 'transition', fromFloor: 1, toFloor: 2 },
    });

    // Floor 2 landing slab (Y = 5.8, slab thickness 0.4) ending cleanly after z=12
    collision.addBox(
      'floor2-slab',
      new THREE.Vector3(-5, 5.4, 12),
      new THREE.Vector3(5, 5.8, 22),
      true,
      { floor: 2, zoneId: 'Showroom F2' },
    );

    const player = new PlayerController(new THREE.Vector3(0, 0, 2), collision);
    expect(player.getFloorState().committedFloor).toBe(1);
    expect(player.getFloorState().onTransition).toBe(false);

    // Move +Z up the ramp toward Floor 2 (cameraYaw = Math.PI -> camera looking +Z so moveZ: +1 moves +Z)
    const walkForwardInput = {
      moveX: 0,
      moveZ: 1,
      sprint: true,
      jumpPressed: false,
      lookDeltaX: 0,
      lookDeltaY: 0,
    };

    let observedTransitionHeldFloor1 = false;
    for (let i = 0; i < 95; i++) {
      player.update(1 / 60, walkForwardInput, Math.PI);
      const fs = player.getFloorState();
      if (fs.onTransition && player.position.y > 3.5) {
        // Specifically verify NO global Y=3.2 threshold flips floor mid-staircase!
        expect(fs.committedFloor).toBe(1);
        observedTransitionHeldFloor1 = true;
      }
      if (player.position.z >= 14.5) break;
    }

    expect(observedTransitionHeldFloor1).toBe(true);
    expect(player.position.z).toBeGreaterThanOrEqual(13.0);
    expect(player.position.y).toBeCloseTo(5.8, 1);
    expect(player.grounded).toBe(true);
    expect(player.getFloorState().committedFloor).toBe(2);
    expect(player.getFloorState().onTransition).toBe(false);

    // Jumping while on Floor 2 preserves Floor 2 state while airborne
    player.update(1 / 60, { ...walkForwardInput, moveZ: 0, jumpPressed: true }, Math.PI);
    expect(player.grounded).toBe(false);
    expect(player.getFloorState().committedFloor).toBe(2);
  });

  it('prevents cross-floor InteractionManager targeting and ObjectiveMarker / reach_location false triggers', () => {
    const bus = new EventBus<GameEvents>();
    const collision = new CollisionManager();
    collision.addBox('f1', new THREE.Vector3(-4, -0.5, -4), new THREE.Vector3(4, 0, 4), true, { floor: 1 });
    collision.addBox('f2', new THREE.Vector3(-4, 5.4, -4), new THREE.Vector3(4, 5.8, 4), true, { floor: 2 });

    const interactions = new InteractionManager(bus, collision);
    const floor2Item = new MockInteractable('f2-prop', new THREE.Vector3(0, 5.8, -1.0), 2);
    interactions.register(floor2Item);

    // Player standing directly underneath Floor 2 item on Floor 1 must NOT target it
    const f1State = {
      committedFloor: 1 as FloorId,
      onTransition: false,
      lastGroundedPos: new THREE.Vector3(0, 0, 0),
      lastGroundedFloor: 1 as FloorId,
      supportingSurfaceId: 'f1',
    };
    interactions.update(0.016, new THREE.Vector3(0, 0, 0), Math.PI, true, undefined, f1State);
    expect(interactions.getActiveTarget()).toBeNull();

    // Standing on Floor 2 targets it cleanly
    const f2State = {
      committedFloor: 2 as FloorId,
      onTransition: false,
      lastGroundedPos: new THREE.Vector3(0, 5.8, 0),
      lastGroundedFloor: 2 as FloorId,
      supportingSurfaceId: 'f2',
    };
    interactions.update(0.016, new THREE.Vector3(0, 5.8, 0), Math.PI, true, undefined, f2State);
    expect(interactions.getActiveTarget()?.id).toBe('f2-prop');

    // MissionManager reach_location on Floor 2 must NOT complete from Floor 1 underneath
    const testMissions: MissionDefinition[] = [
      {
        id: 'test-f2',
        number: 1,
        title: 'Test Floor 2',
        description: 'Reach upstairs',
        objectives: [
          {
            id: 'obj-upstairs',
            type: 'reach_location',
            title: 'Go upstairs',
            targetPos: new THREE.Vector3(0, 5.8, 0),
            floor: 2,
            radius: 2.5,
          },
        ],
        reward: { money: 100 },
        completionMessage: 'Done',
      },
    ];
    const mm = new MissionManager(
      testMissions,
      bus,
      new DialogueManager(bus),
      new PhoneManager(bus, false),
      new CollectibleManager(bus),
    );
    mm.startCampaign(0);
    mm.update(0.016, new THREE.Vector3(0, 0, 0), f1State);
    expect(mm.getStatus()).toBe('active');
    mm.update(0.016, new THREE.Vector3(0, 5.8, 0), f2State);
    expect(mm.getStatus()).toBe('completed_screen');

    // ObjectiveMarker keeps true 3D height pos.y instead of clamping to y=0
    const marker = new ObjectiveMarker();
    marker.setTarget(new THREE.Vector3(2, 5.8, -3));
    expect(marker.group.position.y).toBeCloseTo(5.8);
    const nav = marker.computeScreenNav(
      new THREE.PerspectiveCamera(60, 16 / 9, 0.2, 100),
      new THREE.Vector3(2, 0, 2),
      1280,
      720,
    );
    expect(nav.verticalHint).toBe('up');
  });

  it('routes NavGraph A* paths across directed escalators, stairs, and authorization-gated doors', () => {
    const graph = new NavGraph();
    graph.addNode({ id: 'control', position: new THREE.Vector3(-2, 0, 0), floor: 1, kind: 'floor' });
    graph.addNode({
      id: 'ctrl-door',
      position: new THREE.Vector3(6, 0, 0),
      floor: 1,
      kind: 'door',
      doorId: 'control-room-exit',
    });
    graph.addNode({ id: 'lobby', position: new THREE.Vector3(12, 0, 0), floor: 1, kind: 'floor' });
    graph.addNode({ id: 'esc-up-b', position: new THREE.Vector3(18, 0, 2), floor: 1, kind: 'escalator' });
    graph.addNode({ id: 'esc-up-t', position: new THREE.Vector3(18, 5.8, 12), floor: 2, kind: 'escalator' });
    graph.addNode({ id: 'f2-showroom', position: new THREE.Vector3(24, 5.8, 12), floor: 2, kind: 'floor' });
    graph.addNode({ id: 'stair-b', position: new THREE.Vector3(14, 0, -4), floor: 1, kind: 'stair_entry' });
    graph.addNode({ id: 'stair-t', position: new THREE.Vector3(14, 5.8, -12), floor: 2, kind: 'stair_exit' });

    graph.addEdge({ from: 'control', to: 'ctrl-door', kind: 'door', requiresAuth: true });
    graph.addEdge({ from: 'ctrl-door', to: 'lobby', kind: 'walk', requiresAuth: true });
    graph.addEdge({ from: 'lobby', to: 'esc-up-b', kind: 'walk' });
    graph.addEdge({ from: 'esc-up-b', to: 'esc-up-t', kind: 'escalator', directed: true });
    graph.addEdge({ from: 'esc-up-t', to: 'f2-showroom', kind: 'walk' });
    graph.addEdge({ from: 'lobby', to: 'stair-b', kind: 'walk' });
    graph.addEdge({ from: 'stair-b', to: 'stair-t', kind: 'stair' });
    graph.addEdge({ from: 'stair-t', to: 'f2-showroom', kind: 'walk' });

    // Unauthorized NPC cannot path into Control Room
    expect(
      graph.findPath('lobby', 'control', { authorizedForControlRoom: false }),
    ).toHaveLength(0);

    // Authorized guard can path from Control Room up the directed Up Escalator to Floor 2
    const upPath = graph.findPath('control', 'f2-showroom', { authorizedForControlRoom: true });
    expect(upPath.map((n) => n.id)).toContain('esc-up-t');
    expect(upPath[upPath.length - 1].floor).toBe(2);

    // Coming back DOWN from Floor 2 must NOT reverse down the directed Up Escalator -> takes stairs!
    const downPath = graph.findPath('f2-showroom', 'lobby', { authorizedForControlRoom: false });
    const downIds = downPath.map((n) => n.id);
    expect(downIds).toContain('stair-b');
    expect(downIds).not.toContain('esc-up-b');

    // Sanity check anchors & regions resolve cleanly
    expect(resolveFloorRegion(WORLD_ANCHORS.controlRoom.computer.position)?.zone).toBe('Control Room');
  });
});
