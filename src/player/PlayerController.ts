import * as THREE from 'three';
import { PLAYER_CONFIG } from '../config/constants';
import type { EventBus, GameEvents, PlayerAnimState } from '../core/EventBus';
import type { InputState } from '../core/InputManager';
import type { CollisionManager, FloorId } from '../world/CollisionManager';

export interface FloorState {
  committedFloor: FloorId;
  onTransition: boolean;
  lastGroundedPos: THREE.Vector3;
  lastGroundedFloor: FloorId;
  supportingSurfaceId: string | null;
}

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Pure gameplay controller for Kfir: camera-relative movement, walk/run/sprint,
 * jump + gravity, smooth turning, and collision resolution with actual-speed tracking.
 */
export class PlayerController {
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  facingYaw = Math.PI; // Faces -Z (toward the CCTV desk on spawn)
  grounded = true;
  animState: PlayerAnimState = 'idle';

  private actualHorizontalSpeed = 0;
  private sprintHoldTime = 0;
  private readonly lastConveyorVelocity = new THREE.Vector3();
  private readonly floorState: FloorState;
  private readonly collision: CollisionManager;
  private readonly eventBus?: EventBus<GameEvents>;

  constructor(
    spawnPosition: THREE.Vector3,
    collision: CollisionManager,
    eventBus?: EventBus<GameEvents>,
    initialFloor: FloorId = 1,
  ) {
    this.position = spawnPosition.clone();
    this.collision = collision;
    this.eventBus = eventBus;
    this.floorState = {
      committedFloor: initialFloor,
      onTransition: false,
      lastGroundedPos: spawnPosition.clone(),
      lastGroundedFloor: initialFloor,
      supportingSurfaceId: null,
    };
  }

  getFloorState(): FloorState {
    return {
      committedFloor: this.floorState.committedFloor,
      onTransition: this.floorState.onTransition,
      lastGroundedPos: this.floorState.lastGroundedPos.clone(),
      lastGroundedFloor: this.floorState.lastGroundedFloor,
      supportingSurfaceId: this.floorState.supportingSurfaceId,
    };
  }

  update(dt: number, input: InputState, cameraYaw: number): void {
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

    // Track sustained Shift+movement for smooth Run -> Sprint energy ramp
    if (hasMoveInput && input.sprint && this.grounded) {
      this.sprintHoldTime += dt;
    } else if (!input.sprint || !hasMoveInput) {
      this.sprintHoldTime = 0;
    }

    let targetSpeed = 0;
    if (hasMoveInput) {
      if (input.sprint) {
        const sprintRamp = THREE.MathUtils.clamp(
          (this.sprintHoldTime - PLAYER_CONFIG.sprintRampDelay) / 0.45,
          0,
          1,
        );
        targetSpeed = THREE.MathUtils.lerp(
          PLAYER_CONFIG.runSpeed,
          PLAYER_CONFIG.sprintSpeed,
          sprintRamp,
        );
      } else {
        targetSpeed = PLAYER_CONFIG.walkSpeed;
      }
    }

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

    // Resolve movement against world colliders (plus escalator conveyor assist) and measure actual ground displacement
    const prevX = this.position.x;
    const prevZ = this.position.z;
    const desiredDelta = this.velocity.clone().multiplyScalar(dt);
    if (this.grounded && this.lastConveyorVelocity.lengthSq() > 1e-4) {
      desiredDelta.x += this.lastConveyorVelocity.x * dt;
      desiredDelta.z += this.lastConveyorVelocity.z * dt;
    }
    const result = this.collision.resolvePlayerMovement(
      this.position,
      desiredDelta,
      PLAYER_CONFIG.radius,
      PLAYER_CONFIG.height,
    );

    this.position.copy(result.position);
    this.grounded = result.grounded;

    if (result.conveyorVelocity) {
      this.lastConveyorVelocity.copy(result.conveyorVelocity);
    } else {
      this.lastConveyorVelocity.set(0, 0, 0);
    }

    // Surface-aware floor state tracking (holds committedFloor during stairs/transitions and jumps)
    this.floorState.supportingSurfaceId = result.supportingSurfaceId;
    if (result.grounded) {
      if (result.supportingFloor === 1 || result.supportingFloor === 2) {
        this.floorState.committedFloor = result.supportingFloor;
        this.floorState.onTransition = false;
        this.floorState.lastGroundedFloor = result.supportingFloor;
        this.floorState.lastGroundedPos.copy(this.position);
      } else if (result.supportingFloor === 'transition') {
        this.floorState.onTransition = true;
      } else {
        this.floorState.onTransition = false;
        this.floorState.lastGroundedPos.copy(this.position);
      }
    }

    // Safety net against extreme out-of-bounds falls without using Y thresholds for normal floor changes
    if (this.position.y < -2.0) {
      this.position.copy(this.floorState.lastGroundedPos);
      this.velocity.set(0, 0, 0);
      this.grounded = true;
      this.floorState.committedFloor = this.floorState.lastGroundedFloor;
      this.floorState.onTransition = false;
    }

    const resolvedDx = this.position.x - prevX;
    const resolvedDz = this.position.z - prevZ;
    this.actualHorizontalSpeed = dt > 1e-6 ? Math.hypot(resolvedDx, resolvedDz) / dt : 0;

    if (result.grounded && this.velocity.y < 0) {
      this.velocity.y = 0;
    }
    if (result.hitCeiling && this.velocity.y > 0) {
      this.velocity.y = 0;
    }

    // Smoothly rotate Kfir toward movement input direction
    const cmdSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (hasMoveInput && cmdSpeed > 0.25) {
      const targetYaw = Math.atan2(wishX, wishZ);
      const diff = normalizeAngle(targetYaw - this.facingYaw);
      const turnBlend = 1 - Math.exp(-PLAYER_CONFIG.turnSpeed * dt);
      this.facingYaw = normalizeAngle(this.facingYaw + diff * turnBlend);
    }

    // Derive animation state from actual resolved ground speed (prevents running-in-place)
    let nextState: PlayerAnimState = 'idle';
    if (!this.grounded) {
      nextState = 'jump';
    } else if (this.actualHorizontalSpeed > PLAYER_CONFIG.runSpeed + 0.6) {
      nextState = 'sprint';
    } else if (
      input.sprint &&
      this.actualHorizontalSpeed > PLAYER_CONFIG.walkSpeed + 0.8
    ) {
      nextState = 'run';
    } else if (this.actualHorizontalSpeed > 0.35) {
      nextState = 'walk';
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
    return this.actualHorizontalSpeed;
  }
}
