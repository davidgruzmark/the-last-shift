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
  private readonly smoothedPivot = new THREE.Vector3();
  private initialized = false;

  private readonly collision: CollisionManager;

  constructor(aspect: number, collision: CollisionManager) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 120);
    this.collision = collision;
  }

  getYaw(): number {
    return this.yaw;
  }

  getCurrentDistance(): number {
    return this.currentDistance;
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

    const targetPivot = new THREE.Vector3(
      playerPosition.x,
      playerPosition.y + CAMERA_CONFIG.pivotHeight,
      playerPosition.z,
    );

    if (!this.initialized) {
      this.smoothedPivot.copy(targetPivot);
      this.initialized = true;
    } else {
      const followBlend = 1 - Math.exp(-CAMERA_CONFIG.followSmoothness * dt);
      this.smoothedPivot.lerp(targetPivot, followBlend);
    }

    // Offset from pivot: behind player along +Z when yaw = 0
    const horizDist = CAMERA_CONFIG.distance * Math.cos(this.pitch);
    const vertOffset = CAMERA_CONFIG.distance * Math.sin(this.pitch);

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
