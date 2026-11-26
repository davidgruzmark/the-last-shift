import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/constants';
import type { InputState } from '../core/InputManager';
import type { CollisionManager } from '../world/CollisionManager';

/**
 * Third-person orbital camera with smooth target tracking, mouse yaw/pitch control,
 * and wall-collision raycasting to prevent clipping through walls.
 */
export class ThirdPersonCamera {
  readonly camera: THREE.PerspectiveCamera;
  private yaw = 0; // Starts behind Kfir looking toward -Z (the CCTV console)
  private pitch = 0.24;
  private currentDistance: number = CAMERA_CONFIG.distance;
  private activeDistanceLimit: number = CAMERA_CONFIG.distance;
  private activePivotHeight: number = CAMERA_CONFIG.pivotHeight;
  private readonly smoothedPivot = new THREE.Vector3();
  private initialized = false;

  private readonly collision: CollisionManager;

  constructor(aspect: number, collision: CollisionManager) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.2, 120);
    this.collision = collision;
  }

  getYaw(): number {
    return this.yaw;
  }

  getCurrentDistance(): number {
    return this.currentDistance;
  }

  getGazeRay(): { origin: THREE.Vector3; direction: THREE.Vector3 } {
    this.camera.updateMatrixWorld();
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    return {
      origin: this.camera.position.clone(),
      direction,
    };
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, playerPosition: THREE.Vector3, input: InputState): void {
    // Rotate camera from mouse deltas
    this.yaw -= input.lookDeltaX * CAMERA_CONFIG.sensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + input.lookDeltaY * CAMERA_CONFIG.sensitivity,
      CAMERA_CONFIG.minPitch,
      CAMERA_CONFIG.maxPitch,
    );

    const modeBlend = 1 - Math.exp(-8 * dt);
    this.activeDistanceLimit += (CAMERA_CONFIG.distance - this.activeDistanceLimit) * modeBlend;
    this.activePivotHeight += (CAMERA_CONFIG.pivotHeight - this.activePivotHeight) * modeBlend;

    this.applyCameraFrame(dt, playerPosition, this.activePivotHeight, this.activeDistanceLimit);
  }

  /**
   * Dedicated third-person driving camera that follows smoothly behind the vehicle,
   * adjusts naturally during turns, allows optional mouse look, and prevents wall clipping.
   */
  updateDriving(
    dt: number,
    vehiclePosition: THREE.Vector3,
    vehicleYaw: number,
    vehicleSpeed: number,
    input: InputState,
  ): void {
    const manualLook = Math.abs(input.lookDeltaX) > 0.01 || Math.abs(input.lookDeltaY) > 0.01;
    if (manualLook) {
      this.yaw -= input.lookDeltaX * CAMERA_CONFIG.sensitivity;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + input.lookDeltaY * CAMERA_CONFIG.sensitivity,
        -0.1,
        0.75,
      );
    } else {
      // Gently align behind the vehicle (+PI offsets from +Z vehicle heading to camera behind car)
      const desiredYaw = vehicleYaw + Math.PI;
      let diff = desiredYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const alignRate = Math.abs(vehicleSpeed) > 0.6 ? 5.2 : 3.2;
      this.yaw += diff * (1 - Math.exp(-alignRate * dt));

      const targetPitch = 0.27;
      this.pitch += (targetPitch - this.pitch) * (1 - Math.exp(-5.0 * dt));
    }

    const modeBlend = 1 - Math.exp(-7 * dt);
    const speedZoom = Math.min(1.1, Math.abs(vehicleSpeed) * 0.05);
    const targetDist = 6.7 + speedZoom;
    this.activeDistanceLimit += (targetDist - this.activeDistanceLimit) * modeBlend;
    this.activePivotHeight += (1.75 - this.activePivotHeight) * modeBlend;

    this.applyCameraFrame(dt, vehiclePosition, this.activePivotHeight, this.activeDistanceLimit);
  }

  private applyCameraFrame(
    dt: number,
    targetPosition: THREE.Vector3,
    pivotHeight: number,
    desiredDistance: number,
  ): void {
    const targetPivot = new THREE.Vector3(
      targetPosition.x,
      targetPosition.y + pivotHeight,
      targetPosition.z,
    );

    if (!this.initialized) {
      this.smoothedPivot.copy(targetPivot);
      this.initialized = true;
    } else {
      const followBlend = 1 - Math.exp(-CAMERA_CONFIG.followSmoothness * dt);
      this.smoothedPivot.lerp(targetPivot, followBlend);
    }

    // Offset from pivot: behind player along +Z when yaw = 0
    const horizDist = desiredDistance * Math.cos(this.pitch);
    const vertOffset = desiredDistance * Math.sin(this.pitch);

    const idealPos = new THREE.Vector3(
      this.smoothedPivot.x + Math.sin(this.yaw) * horizDist,
      this.smoothedPivot.y + vertOffset,
      this.smoothedPivot.z + Math.cos(this.yaw) * horizDist,
    );

    const clampedPos = this.collision.raycastCamera(
      this.smoothedPivot,
      idealPos,
      CAMERA_CONFIG.collisionPadding,
      CAMERA_CONFIG.minDistance,
    );

    const targetDist = clampedPos.distanceTo(this.smoothedPivot);
    const speed =
      targetDist < this.currentDistance
        ? CAMERA_CONFIG.inwardSnapSpeed
        : CAMERA_CONFIG.outwardRecoverSpeed;
    const distBlend = 1 - Math.exp(-speed * dt);
    this.currentDistance += (targetDist - this.currentDistance) * distBlend;

    const dir = idealPos.clone().sub(this.smoothedPivot).normalize();
    this.camera.position.copy(this.smoothedPivot).addScaledVector(dir, this.currentDistance);
    this.camera.lookAt(this.smoothedPivot);
  }
}
