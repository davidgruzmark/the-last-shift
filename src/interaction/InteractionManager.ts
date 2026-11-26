import * as THREE from 'three';
import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { CollisionManager } from '../world/CollisionManager';
import type { Interactable } from './Interactable';

const INTERACT_COOLDOWN = 0.18;
const MIN_FACING_DOT = 0.1;
const CLOSE_FACING_DOT = -0.25;
const MIN_GAZE_RAY_DOT = 0.86;
const MIN_GAZE_VIEW_DOT = 0.35;
const TARGET_HYSTERESIS_BONUS = 0.16;

export interface GazeRay {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
}

/**
 * Reusable proximity + camera gaze targeting + line-of-sight interaction manager.
 * Guarantees at most one unobstructed target within range that the player is looking at
 * can be triggered without forcing Kfir's body to rotate first.
 */
export class InteractionManager {
  private interactables: Interactable[] = [];
  private activeTarget: Interactable | null = null;
  private cooldown = 0;
  private readonly eventBus?: EventBus<GameEvents>;
  private readonly collision?: CollisionManager;

  constructor(eventBus?: EventBus<GameEvents>, collision?: CollisionManager) {
    this.eventBus = eventBus;
    this.collision = collision;
    i18n.onChange(() => {
      if (this.activeTarget) {
        this.emitPrompt(this.activeTarget.getPromptText(), this.activeTarget.id);
      }
    });
  }

  register(item: Interactable): void {
    if (!this.interactables.includes(item)) {
      this.interactables.push(item);
    }
  }

  unregister(id: string): void {
    if (this.activeTarget?.id === id) {
      this.activeTarget.setHighlighted?.(false);
      this.activeTarget = null;
      this.emitPrompt(null, null);
    }
    this.interactables = this.interactables.filter((item) => item.id !== id);
  }

  getActiveTarget(): Interactable | null {
    return this.activeTarget;
  }

  clearActiveTarget(): void {
    if (this.activeTarget) {
      this.activeTarget.setHighlighted?.(false);
      this.activeTarget = null;
      this.emitPrompt(null, null);
    }
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    facingYaw: number,
    enabled = true,
    gaze?: GazeRay,
  ): void {
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt);
    }

    for (const item of this.interactables) {
      item.update?.(dt, playerPos);
    }

    if (!enabled) {
      this.clearActiveTarget();
      return;
    }

    const fwdX = Math.sin(facingYaw);
    const fwdZ = Math.cos(facingYaw);
    const gazeDir = gaze ? gaze.direction.clone().normalize() : null;
    const gazeHorizLen = gazeDir ? Math.hypot(gazeDir.x, gazeDir.z) : 0;
    const gazeFwdX = gazeDir && gazeHorizLen > 1e-4 ? gazeDir.x / gazeHorizLen : fwdX;
    const gazeFwdZ = gazeDir && gazeHorizLen > 1e-4 ? gazeDir.z / gazeHorizLen : fwdZ;

    // Collect NPC colliders so mobile NPC bodies never block line-of-sight to objects
    const npcColliderIds: string[] = [];
    for (const candidate of this.interactables) {
      if (candidate.type === 'npc' && candidate.colliderIds) {
        for (const colId of candidate.colliderIds) {
          npcColliderIds.push(colId);
        }
      }
    }

    let best: Interactable | null = null;
    let bestScore = -Infinity;

    for (const item of this.interactables) {
      if (!item.canInteract()) continue;

      const targetPos = item.getWorldPosition();
      const dx = targetPos.x - playerPos.x;
      const dz = targetPos.z - playerPos.z;
      const dist = Math.hypot(dx, dz);

      if (dist > item.radius) continue;

      let alignment = 1;
      if (gaze && gazeDir) {
        // Evaluate closest point on the target's vertical silhouette against the camera center ray
        const minY = targetPos.y + 0.25;
        const maxY = targetPos.y + 1.65;
        const toHorizDistSq =
          (targetPos.x - gaze.origin.x) * gazeDir.x + (targetPos.z - gaze.origin.z) * gazeDir.z;
        if (toHorizDistSq < 0) continue;

        const approxT =
          (targetPos.x - gaze.origin.x) * gazeDir.x +
          (targetPos.y + 1.0 - gaze.origin.y) * gazeDir.y +
          (targetPos.z - gaze.origin.z) * gazeDir.z;
        const clampedY = THREE.MathUtils.clamp(gaze.origin.y + gazeDir.y * approxT, minY, maxY);
        const aimVec = new THREE.Vector3(
          targetPos.x - gaze.origin.x,
          clampedY - gaze.origin.y,
          targetPos.z - gaze.origin.z,
        );
        const aimLen = aimVec.length();
        if (aimLen <= 1e-4) continue;
        const rayDot = aimVec.divideScalar(aimLen).dot(gazeDir);

        const viewDot = dist > 0.45 ? (dx / dist) * gazeFwdX + (dz / dist) * gazeFwdZ : 1;
        if (dist > 0.65 && viewDot < MIN_GAZE_VIEW_DOT) continue;
        if (rayDot < MIN_GAZE_RAY_DOT && dist > 0.85) continue;
        if (rayDot < 0.76) continue;
        alignment = rayDot * 1.45 + Math.max(0, viewDot) * 0.45;
      } else if (dist > 0.7) {
        alignment = (dx / dist) * fwdX + (dz / dist) * fwdZ;
        const minDot = dist > 1.0 ? MIN_FACING_DOT : CLOSE_FACING_DOT;
        if (alignment < minDot) continue;
      }

      // Prevent interacting through walls or solid geometry (ignoring self and dynamic NPCs)
      if (this.collision) {
        const origin = new THREE.Vector3(playerPos.x, playerPos.y + 1.15, playerPos.z);
        const target = new THREE.Vector3(targetPos.x, Math.max(1.15, targetPos.y + 0.9), targetPos.z);
        const ignoreIds =
          item.colliderIds && item.colliderIds.length > 0
            ? [...item.colliderIds, ...npcColliderIds]
            : npcColliderIds;
        if (!this.collision.hasLineOfSight(origin, target, ignoreIds)) {
          continue;
        }
      }

      const proximityScore = 1 - dist / item.radius;
      const priorityBonus = item.getPriority?.() ?? 0;
      const hysteresis = item === this.activeTarget ? TARGET_HYSTERESIS_BONUS : 0;
      const score = proximityScore * 1.2 + alignment + priorityBonus + hysteresis;
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    const prevId = this.activeTarget?.id ?? null;
    const nextId = best?.id ?? null;

    if (prevId !== nextId) {
      this.activeTarget?.setHighlighted?.(false);
      this.activeTarget = best;
      this.activeTarget?.setHighlighted?.(true);
    }

    const nextPrompt = best ? best.getPromptText() : null;
    this.emitPrompt(nextPrompt, nextId);
  }

  interact(): boolean {
    if (this.cooldown > 0 || !this.activeTarget || !this.activeTarget.canInteract()) {
      return false;
    }
    this.cooldown = INTERACT_COOLDOWN;
    this.activeTarget.onInteract();
    return true;
  }

  private lastPrompt: string | null = null;
  private lastTargetId: string | null = null;

  private emitPrompt(prompt: string | null, targetId: string | null): void {
    if (prompt === this.lastPrompt && targetId === this.lastTargetId) return;
    this.lastPrompt = prompt;
    this.lastTargetId = targetId;
    this.eventBus?.emit('interaction:promptChanged', { prompt, targetId });
  }
}
