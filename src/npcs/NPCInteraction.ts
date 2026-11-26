import * as THREE from 'three';
import { createNpcModel, type NpcModelResult, type NpcVisualConfig } from '../assets/characters/NpcModel';
import type { MaterialPalette } from '../assets/materials/Palette';
import { CONTROL_ROOM_BOUNDS } from '../config/constants';
import { i18n } from '../i18n/LocalizationManager';
import type { Interactable } from '../interaction/Interactable';
import type { DoorInteraction } from '../interaction/DoorInteraction';
import type { CollisionManager } from '../world/CollisionManager';
import type { DialogueLine, DialogueManager } from './DialogueManager';

export interface NpcDefinition {
  id: string;
  name: string;
  nameKey?: string;
  position: THREE.Vector3;
  facingYaw: number;
  visual?: NpcVisualConfig;
  lines: DialogueLine[];
  patrolPoints?: THREE.Vector3[];
  patrolSpeed?: number;
  allowControlRoomEntry?: boolean;
}

export type DialogueLinesOrResolver = DialogueLine[] | (() => DialogueLine[]);

const CONTROL_ROOM_MIN_CLEAR_X =
  CONTROL_ROOM_BOUNDS.width / 2 + CONTROL_ROOM_BOUNDS.wallThickness + 0.55;

/**
 * Interactive IKEA employee NPC supporting proximity talk prompts,
 * dynamic mission/ambient dialogue resolvers, articulated walk/idle/sit animations,
 * NavGraph path-following, door passage requests, and collision registration.
 */
export class NPCInteraction implements Interactable {
  readonly id: string;
  readonly type = 'npc' as const;
  readonly radius = 2.6;
  readonly colliderIds: readonly string[];
  readonly meshGroup: THREE.Group;

  private readonly rig: NpcModelResult;
  private readonly npcName: string;
  private readonly npcNameKey?: string;
  private readonly defaultLines: DialogueLine[];
  private missionLines: DialogueLinesOrResolver | null = null;
  private ambientResolver: (() => DialogueLine[]) | null = null;
  private onTalkFinished: ((npcId: string) => void) | null = null;
  private controlRoomAuthorized: boolean;
  private readonly dialogue: DialogueManager;
  private readonly collision: CollisionManager;
  private readonly highlightRing: THREE.Mesh;
  private readonly worldPos: THREE.Vector3;
  private readonly patrolPoints: THREE.Vector3[] | null;
  private readonly patrolSpeed: number;
  private patrolIdx = 1;
  private patrolPause = 0;
  private idleTime = Math.random() * Math.PI * 2;
  private walkCycle = 0;
  private seated = false;
  private seatedYaw = 0;
  private activePath: THREE.Vector3[] = [];
  private pathIdx = 0;
  private pathSpeed = 2.15;
  private onPathArrive: (() => void) | null = null;
  private navDoors: readonly DoorInteraction[] = [];
  private stallTimer = 0;

  constructor(
    def: NpcDefinition,
    palette: MaterialPalette,
    collision: CollisionManager,
    dialogue: DialogueManager,
  ) {
    this.id = def.id;
    this.npcName = def.name;
    this.npcNameKey = def.nameKey;
    this.defaultLines = def.lines;
    this.controlRoomAuthorized = def.allowControlRoomEntry ?? false;
    this.dialogue = dialogue;
    this.collision = collision;
    this.worldPos = def.position.clone();
    this.patrolPoints =
      def.patrolPoints && def.patrolPoints.length >= 2
        ? def.patrolPoints.map((p) => p.clone())
        : null;
    this.patrolSpeed = def.patrolSpeed ?? 1.5;

    this.rig = createNpcModel(palette, def.visual);
    this.meshGroup = this.rig.root;
    this.highlightRing = this.rig.highlightRing;
    this.meshGroup.name = `NPC_${def.id}`;
    this.meshGroup.position.copy(def.position);
    this.meshGroup.rotation.y = def.facingYaw;

    const colliderId = `npc-col-${def.id}`;
    this.colliderIds = [colliderId];

    collision.addBox(
      colliderId,
      new THREE.Vector3(def.position.x - 0.34, def.position.y, def.position.z - 0.34),
      new THREE.Vector3(def.position.x + 0.34, def.position.y + 1.8, def.position.z + 0.34),
      false,
    );
  }

  setNavigationDoors(doors: readonly DoorInteraction[]): void {
    this.navDoors = doors;
  }

  setPath(points: readonly THREE.Vector3[], onArrive?: () => void, speed = 2.15): void {
    this.seated = false;
    this.activePath = points.map((p) => p.clone());
    this.pathIdx = 0;
    this.pathSpeed = speed;
    this.onPathArrive = onArrive ?? null;
    this.stallTimer = 0;
  }

  hasActivePath(): boolean {
    return this.activePath.length > 0 && this.pathIdx < this.activePath.length;
  }

  clearPath(): void {
    this.activePath = [];
    this.pathIdx = 0;
    this.onPathArrive = null;
  }

  setPositionImmediate(pos: THREE.Vector3, facingYaw?: number): void {
    this.worldPos.copy(pos);
    this.meshGroup.position.copy(pos);
    if (facingYaw !== undefined) {
      this.meshGroup.rotation.y = facingYaw;
    }
    this.syncCollider();
  }

  setSeated(seated: boolean, seatPos?: THREE.Vector3, facingYaw?: number): void {
    this.seated = seated;
    if (seated) {
      this.clearPath();
      if (seatPos) this.worldPos.copy(seatPos);
      if (facingYaw !== undefined) {
        this.seatedYaw = facingYaw;
        this.meshGroup.rotation.y = facingYaw;
      }
      this.meshGroup.position.copy(this.worldPos);
      this.syncCollider();
    }
  }

  isSeated(): boolean {
    return this.seated;
  }

  setMissionDialogue(
    lines: DialogueLinesOrResolver | null,
    onTalkFinished?: ((npcId: string) => void) | null,
  ): void {
    this.missionLines = lines;
    this.onTalkFinished = onTalkFinished ?? null;
  }

  setAmbientDialogueResolver(resolver: (() => DialogueLine[]) | null): void {
    this.ambientResolver = resolver;
  }

  setControlRoomAuthorized(allowed: boolean): void {
    this.controlRoomAuthorized = allowed;
  }

  isControlRoomAuthorized(): boolean {
    return this.controlRoomAuthorized;
  }

  getWorldPosition(): THREE.Vector3 {
    return this.worldPos;
  }

  canInteract(): boolean {
    return !this.dialogue.isActive();
  }

  getPromptText(): string {
    const name = this.npcNameKey ? i18n.t(this.npcNameKey) : this.npcName;
    return i18n.t('prompt.talkNpc', { name: name.toUpperCase() });
  }

  getPriority(): number {
    return this.missionLines ? 1.2 : 0;
  }

  setHighlighted(active: boolean): void {
    this.highlightRing.visible = active;
  }

  onInteract(): void {
    const resolvedMission =
      typeof this.missionLines === 'function' ? this.missionLines() : this.missionLines;
    const activeLines = resolvedMission ?? this.ambientResolver?.() ?? this.defaultLines;
    const cb = this.onTalkFinished;
    this.dialogue.start(this.npcName, activeLines, () => {
      cb?.(this.id);
    });
  }

  private clampOutsideControlRoom(pos: THREE.Vector3): void {
    if (this.controlRoomAuthorized) return;
    const halfW = CONTROL_ROOM_BOUNDS.width / 2;
    const halfD = CONTROL_ROOM_BOUNDS.depth / 2;
    if (
      pos.x < CONTROL_ROOM_MIN_CLEAR_X &&
      pos.x > -halfW - 0.5 &&
      pos.z > -halfD - 0.5 &&
      pos.z < halfD + 0.5
    ) {
      pos.x = CONTROL_ROOM_MIN_CLEAR_X;
    }
  }

  update(dt: number, playerPos?: THREE.Vector3): void {
    const playerNearby =
      playerPos !== undefined &&
      Math.abs(playerPos.y - this.worldPos.y) < 2.2 &&
      Math.hypot(playerPos.x - this.worldPos.x, playerPos.z - this.worldPos.z) < 2.6;

    if (this.seated) {
      this.idleTime += dt * 3.0;
      this.meshGroup.position.copy(this.worldPos);
      this.meshGroup.rotation.y = this.seatedYaw;
      this.applyArticulatedPose('sit', dt, 0);
      return;
    }

    // Priority 1: Scripted multi-waypoint NavGraph path following (e.g., shift rotation)
    if (this.hasActivePath() && !this.dialogue.isActive()) {
      const target = this.activePath[this.pathIdx];
      // Check physical door passage before crossing closed doorways
      for (const door of this.navDoors) {
        const passage = door.requestNpcPassage(this.worldPos, this.controlRoomAuthorized);
        if (passage === 'opening' || passage === 'blocked') {
          this.applyArticulatedPose('idle', dt, 0);
          return;
        }
      }

      const dx = target.x - this.worldPos.x;
      const dy = target.y - this.worldPos.y;
      const dz = target.z - this.worldPos.z;
      const dist = Math.hypot(dx, dy, dz);

      // Polite yield if player stands directly in path (< 0.95m ahead)
      const horizDist = Math.hypot(dx, dz);
      const blockedByPlayer =
        playerPos !== undefined &&
        Math.abs(playerPos.y - this.worldPos.y) < 1.8 &&
        Math.hypot(playerPos.x - this.worldPos.x, playerPos.z - this.worldPos.z) < 0.95;
      if (blockedByPlayer) {
        this.stallTimer += dt;
        this.applyArticulatedPose('idle', dt, 0);
        return;
      }
      this.stallTimer = 0;

      const step = this.pathSpeed * dt;
      if (dist <= step + 0.05) {
        this.worldPos.copy(target);
        this.pathIdx += 1;
        if (this.pathIdx >= this.activePath.length) {
          const cb = this.onPathArrive;
          this.clearPath();
          this.meshGroup.position.copy(this.worldPos);
          this.syncCollider();
          this.applyArticulatedPose('idle', dt, 0);
          cb?.();
          return;
        }
      } else {
        this.worldPos.x += (dx / dist) * step;
        this.worldPos.y += (dy / dist) * step;
        this.worldPos.z += (dz / dist) * step;
        if (horizDist > 0.02) {
          this.rotateToward(Math.atan2(dx, dz), dt);
        }
      }

      this.meshGroup.position.copy(this.worldPos);
      this.syncCollider();
      this.applyArticulatedPose('walk', dt, this.pathSpeed);
      return;
    }

    if (this.patrolPoints && !this.dialogue.isActive() && !playerNearby) {
      if (this.patrolPause > 0) {
        this.patrolPause = Math.max(0, this.patrolPause - dt);
        this.meshGroup.position.copy(this.worldPos);
        this.applyArticulatedPose('idle', dt, 0);
        return;
      }

      const target = this.patrolPoints[this.patrolIdx].clone();
      this.clampOutsideControlRoom(target);
      const dx = target.x - this.worldPos.x;
      const dy = target.y - this.worldPos.y;
      const dz = target.z - this.worldPos.z;
      const dist = Math.hypot(dx, dy, dz);

      if (dist <= this.patrolSpeed * dt + 0.04) {
        this.worldPos.copy(target);
        this.patrolIdx = (this.patrolIdx + 1) % this.patrolPoints.length;
        this.patrolPause = 0.7;
      } else {
        this.worldPos.x += (dx / dist) * this.patrolSpeed * dt;
        this.worldPos.y += (dy / dist) * this.patrolSpeed * dt;
        this.worldPos.z += (dz / dist) * this.patrolSpeed * dt;
        this.clampOutsideControlRoom(this.worldPos);
        this.rotateToward(Math.atan2(dx, dz), dt);
      }

      this.meshGroup.position.copy(this.worldPos);
      this.syncCollider();
      this.applyArticulatedPose('walk', dt, this.patrolSpeed);
      return;
    }

    this.meshGroup.position.copy(this.worldPos);
    this.applyArticulatedPose('idle', dt, 0);
  }

  private rotateToward(targetYaw: number, dt: number): void {
    let diff = targetYaw - this.meshGroup.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.meshGroup.rotation.y += diff * Math.min(1, dt * 8);
  }

  private syncCollider(): void {
    this.collision.updateBox(
      this.colliderIds[0],
      new THREE.Vector3(this.worldPos.x - 0.34, this.worldPos.y, this.worldPos.z - 0.34),
      new THREE.Vector3(this.worldPos.x + 0.34, this.worldPos.y + 1.8, this.worldPos.z + 0.34),
    );
  }

  private applyArticulatedPose(mode: 'idle' | 'walk' | 'sit', dt: number, speed: number): void {
    const k = 1 - Math.exp(-14 * dt);
    if (mode === 'sit') {
      const typing = Math.sin(this.idleTime * 2.4) * 0.08;
      this.rig.hips.position.y += (0.56 - this.rig.hips.position.y) * k;
      this.rig.leftLeg.rotation.x += (-1.22 - this.rig.leftLeg.rotation.x) * k;
      this.rig.rightLeg.rotation.x += (-1.22 - this.rig.rightLeg.rotation.x) * k;
      this.rig.leftArm.rotation.x += (-0.82 + typing - this.rig.leftArm.rotation.x) * k;
      this.rig.rightArm.rotation.x += (-0.82 - typing - this.rig.rightArm.rotation.x) * k;
      return;
    }

    if (mode === 'walk') {
      this.walkCycle += speed * dt * 4.2;
      const swing = Math.sin(this.walkCycle);
      const bob = Math.abs(Math.cos(this.walkCycle)) * 0.04;
      this.rig.hips.position.y += (0.78 + bob - this.rig.hips.position.y) * k;
      this.rig.leftLeg.rotation.x += (swing * 0.58 - this.rig.leftLeg.rotation.x) * k;
      this.rig.rightLeg.rotation.x += (-swing * 0.58 - this.rig.rightLeg.rotation.x) * k;
      this.rig.leftArm.rotation.x += (-swing * 0.45 - this.rig.leftArm.rotation.x) * k;
      this.rig.rightArm.rotation.x += (swing * 0.45 - this.rig.rightArm.rotation.x) * k;
      return;
    }

    this.idleTime += dt * 2.0;
    const breath = Math.sin(this.idleTime) * 0.012;
    this.rig.hips.position.y += (0.78 + breath - this.rig.hips.position.y) * k;
    this.rig.leftLeg.rotation.x += (0 - this.rig.leftLeg.rotation.x) * k;
    this.rig.rightLeg.rotation.x += (0 - this.rig.rightLeg.rotation.x) * k;
    this.rig.leftArm.rotation.x += (0.04 + breath - this.rig.leftArm.rotation.x) * k;
    this.rig.rightArm.rotation.x += (-0.04 - breath - this.rig.rightArm.rotation.x) * k;
  }
}
