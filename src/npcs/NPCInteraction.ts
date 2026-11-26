import * as THREE from 'three';
import { createNpcModel, type NpcVisualConfig } from '../assets/characters/NpcModel';
import type { MaterialPalette } from '../assets/materials/Palette';
import { CONTROL_ROOM_BOUNDS } from '../config/constants';
import { i18n } from '../i18n/LocalizationManager';
import type { Interactable } from '../interaction/Interactable';
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
 * dynamic mission/ambient dialogue resolvers, subtle idle animation,
 * Control Room access enforcement, and collision registration.
 */
export class NPCInteraction implements Interactable {
  readonly id: string;
  readonly type = 'npc' as const;
  readonly radius = 2.6;
  readonly colliderIds: readonly string[];
  readonly meshGroup: THREE.Group;

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

    const model = createNpcModel(palette, def.visual);
    this.meshGroup = model.root;
    this.highlightRing = model.highlightRing;
    this.meshGroup.name = `NPC_${def.id}`;
    this.meshGroup.position.copy(def.position);
    this.meshGroup.rotation.y = def.facingYaw;

    const colliderId = `npc-col-${def.id}`;
    this.colliderIds = [colliderId];

    collision.addBox(
      colliderId,
      new THREE.Vector3(def.position.x - 0.34, 0, def.position.z - 0.34),
      new THREE.Vector3(def.position.x + 0.34, 1.8, def.position.z + 0.34),
      false,
    );
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
      Math.hypot(playerPos.x - this.worldPos.x, playerPos.z - this.worldPos.z) < 3.0;

    if (this.patrolPoints && !this.dialogue.isActive() && !playerNearby) {
      if (this.patrolPause > 0) {
        this.patrolPause = Math.max(0, this.patrolPause - dt);
        this.idleTime += dt * 2.0;
        this.meshGroup.position.y = Math.sin(this.idleTime) * 0.012;
        return;
      }

      const target = this.patrolPoints[this.patrolIdx].clone();
      this.clampOutsideControlRoom(target);
      const dx = target.x - this.worldPos.x;
      const dz = target.z - this.worldPos.z;
      const dist = Math.hypot(dx, dz);

      if (dist <= this.patrolSpeed * dt + 0.04) {
        this.worldPos.copy(target);
        this.patrolIdx = (this.patrolIdx + 1) % this.patrolPoints.length;
        this.patrolPause = 0.7;
      } else {
        this.worldPos.x += (dx / dist) * this.patrolSpeed * dt;
        this.worldPos.z += (dz / dist) * this.patrolSpeed * dt;
        this.clampOutsideControlRoom(this.worldPos);
        const targetYaw = Math.atan2(dx, dz);
        let diff = targetYaw - this.meshGroup.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.meshGroup.rotation.y += diff * Math.min(1, dt * 8);
      }

      this.idleTime += dt * 7.5;
      this.meshGroup.position.set(
        this.worldPos.x,
        Math.abs(Math.sin(this.idleTime)) * 0.045,
        this.worldPos.z,
      );

      this.collision.updateBox(
        this.colliderIds[0],
        new THREE.Vector3(this.worldPos.x - 0.34, 0, this.worldPos.z - 0.34),
        new THREE.Vector3(this.worldPos.x + 0.34, 1.8, this.worldPos.z + 0.34),
      );
      return;
    }

    this.idleTime += dt * 2.0;
    this.meshGroup.position.y = Math.sin(this.idleTime) * 0.012;
  }
}
