import * as THREE from 'three';
import { PLAYER_CONFIG } from '../config/constants';
import type { EventBus, GameEvents, PlayerAnimState } from '../core/EventBus';
import type { InputState } from '../core/InputManager';
import type { CollisionManager } from '../world/CollisionManager';

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Pure gameplay controller for Kfir: camera-relative movement, walk/run,
 * jump + gravity, smooth turning, and collision resolution.
 */
export class PlayerController {
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  facingYaw = Math.PI; // Faces -Z (toward the CCTV desk on spawn)
  grounded = true;
  animState: PlayerAnimState = 'idle';

  private readonly collision: CollisionManager;
  private readonly eventBus?: EventBus<GameEvents>;

  constructor(
    spawnPosition: THREE.Vector3,
    collision: CollisionManager,
    eventBus?: EventBus<GameEvents>,
  ) {
    this.position = spawnPosition.clone();
    this.collision = collision;
    this.eventBus = eventBus;
  }

  update(dt: number, input: InputState, cameraYaw: number): void {
    // Camera-relative forward & right vectors projected onto XZ plane.
    // Camera sits behind player at (+sin(yaw), +cos(yaw)), so forward view is (-sin(yaw), -cos(yaw)).
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);

    let wishX = forwardX * input.moveZ + rightX * input.moveX;
    let wishZ = forwardZ * input.moveZ + rightZ * input.moveX;
    const wishLen = Math.hypot(wishX, wishZ);
    const hasMoveInput = wishLen > 0.001;

    if (hasMoveInput) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    const targetSpeed = hasMoveInput
      ? input.sprint
        ? PLAYER_CONFIG.runSpeed
        : PLAYER_CONFIG.walkSpeed
      : 0;

    const targetVelX = wishX * targetSpeed;
    const targetVelZ = wishZ * targetSpeed;
    const accelRate = hasMoveInput ? PLAYER_CONFIG.acceleration : PLAYER_CONFIG.deceleration;
    const blend = 1 - Math.exp(-accelRate * dt);

    this.velocity.x += (targetVelX - this.velocity.x) * blend;
    this.velocity.z += (targetVelZ - this.velocity.z) * blend;

    if (!hasMoveInput && Math.hypot(this.velocity.x, this.velocity.z) < 0.02) {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // Jump when grounded
    if (input.jumpPressed && this.grounded) {
      this.velocity.y = PLAYER_CONFIG.jumpVelocity;
      this.grounded = false;
    }

    // Apply gravity
    this.velocity.y += PLAYER_CONFIG.gravity * dt;

    // Resolve movement against world colliders
    const desiredDelta = this.velocity.clone().multiplyScalar(dt);
    const result = this.collision.resolvePlayerMovement(
      this.position,
      desiredDelta,
      PLAYER_CONFIG.radius,
      PLAYER_CONFIG.height,
    );

    this.position.copy(result.position);
    this.grounded = result.grounded;

    if (result.grounded && this.velocity.y < 0) {
      this.velocity.y = 0;
    }
    if (result.hitCeiling && this.velocity.y > 0) {
      this.velocity.y = 0;
    }

    // Smoothly rotate Kfir toward horizontal movement direction
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (hasMoveInput && horizontalSpeed > 0.25) {
      const targetYaw = Math.atan2(wishX, wishZ);
      const diff = normalizeAngle(targetYaw - this.facingYaw);
      const turnBlend = 1 - Math.exp(-PLAYER_CONFIG.turnSpeed * dt);
      this.facingYaw = normalizeAngle(this.facingYaw + diff * turnBlend);
    }

    // Derive animation state
    let nextState: PlayerAnimState = 'idle';
    if (!this.grounded) {
      nextState = 'jump';
    } else if (horizontalSpeed > 0.4) {
      nextState = input.sprint && horizontalSpeed > PLAYER_CONFIG.walkSpeed + 0.8 ? 'run' : 'walk';
    }

    if (nextState !== this.animState) {
      this.animState = nextState;
      this.eventBus?.emit('player:stateChanged', {
        state: nextState,
        grounded: this.grounded,
      });
    }
  }

  getHorizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }
}
