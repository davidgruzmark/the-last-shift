import * as THREE from 'three';

export interface ColliderBox {
  id: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
  blocksCamera: boolean;
  enabled: boolean;
  rotationY?: number;
  center?: THREE.Vector3;
  halfExtents?: THREE.Vector3;
}

export interface MovementResult {
  position: THREE.Vector3;
  grounded: boolean;
  hitCeiling: boolean;
  hitWall: boolean;
}

export interface VehicleMovementResult {
  position: THREE.Vector3;
  hitWall: boolean;
  hitNormal: THREE.Vector3;
  grounded: boolean;
}

const STEP_CLEARANCE = 0.05;
const GROUND_EPSILON = 0.015;

/**
 * Deterministic AABB & Y-oriented OBB collision + raycast manager.
 * Resolves cylinder/capsule-like player movement against solid boxes using
 * Circle-vs-Box separation (including rotating doors) plus vertical floor/ceiling support.
 */
export class CollisionManager {
  private colliders: ColliderBox[] = [];

  addBox(
    id: string,
    min: THREE.Vector3,
    max: THREE.Vector3,
    blocksCamera = true,
  ): void {
    this.colliders.push({
      id,
      min: min.clone(),
      max: max.clone(),
      blocksCamera,
      enabled: true,
    });
  }

  addOrientedBox(
    id: string,
    center: THREE.Vector3,
    halfExtents: THREE.Vector3,
    rotationY: number,
    blocksCamera = true,
  ): void {
    const box: ColliderBox = {
      id,
      min: new THREE.Vector3(),
      max: new THREE.Vector3(),
      blocksCamera,
      enabled: true,
      rotationY,
      center: center.clone(),
      halfExtents: halfExtents.clone(),
    };
    this.syncOrientedBounds(box);
    this.colliders.push(box);
  }

  updateBox(id: string, min: THREE.Vector3, max: THREE.Vector3): void {
    for (const box of this.colliders) {
      if (box.id === id) {
        box.min.copy(min);
        box.max.copy(max);
        box.rotationY = undefined;
        box.center = undefined;
        box.halfExtents = undefined;
      }
    }
  }

  updateOrientedBox(
    id: string,
    center: THREE.Vector3,
    halfExtents: THREE.Vector3,
    rotationY: number,
  ): void {
    for (const box of this.colliders) {
      if (box.id === id) {
        box.center = (box.center ?? new THREE.Vector3()).copy(center);
        box.halfExtents = (box.halfExtents ?? new THREE.Vector3()).copy(halfExtents);
        box.rotationY = rotationY;
        this.syncOrientedBounds(box);
      }
    }
  }

  setColliderEnabled(id: string, enabled: boolean): void {
    for (const box of this.colliders) {
      if (box.id === id) {
        box.enabled = enabled;
      }
    }
  }

  getColliders(): readonly ColliderBox[] {
    return this.colliders;
  }

  clear(): void {
    this.colliders = [];
  }

  resolvePlayerMovement(
    currentPos: THREE.Vector3,
    desiredDelta: THREE.Vector3,
    radius: number,
    height: number,
  ): MovementResult {
    const nextPos = currentPos.clone();
    let hitWall = false;
    let hitCeiling = false;
    let grounded = false;

    // 1. Horizontal XZ resolution using Circle-vs-Box minimum separation.
    const horizDist = Math.hypot(desiredDelta.x, desiredDelta.z);
    const maxStep = Math.max(0.05, radius * 0.5);
    const substeps = Math.max(1, Math.ceil(horizDist / maxStep));
    const stepX = desiredDelta.x / substeps;
    const stepZ = desiredDelta.z / substeps;

    for (let step = 0; step < substeps; step++) {
      nextPos.x += stepX;
      nextPos.z += stepZ;

      for (let pass = 0; pass < 2; pass++) {
        for (const box of this.colliders) {
          if (!box.enabled) continue;
          if (!this.overlapsY(nextPos.y + STEP_CLEARANCE, nextPos.y + height - STEP_CLEARANCE, box)) {
            continue;
          }

          if (box.center && box.halfExtents && box.rotationY !== undefined) {
            if (this.resolveCircleOBB(nextPos, radius, box.center, box.halfExtents, box.rotationY)) {
              hitWall = true;
            }
            continue;
          }

          if (this.resolveCircleAABB(nextPos, radius, box)) {
            hitWall = true;
          }
        }
      }
    }

    // 2. Vertical Y resolution
    nextPos.y += desiredDelta.y;
    for (const box of this.colliders) {
      if (!box.enabled) continue;
      if (!this.overlapsCircleXZ(nextPos.x, nextPos.z, radius * 0.92, box)) {
        continue;
      }
      if (nextPos.y < box.max.y && nextPos.y + height > box.min.y) {
        if (desiredDelta.y <= 0 && currentPos.y >= box.max.y - STEP_CLEARANCE) {
          nextPos.y = box.max.y;
          grounded = true;
        } else if (desiredDelta.y > 0 && currentPos.y + height <= box.min.y + STEP_CLEARANCE) {
          nextPos.y = box.min.y - height;
          hitCeiling = true;
        }
      }
    }

    // Also mark grounded if standing flush on a surface even with 0 vertical delta
    if (!grounded && desiredDelta.y <= 0) {
      for (const box of this.colliders) {
        if (!box.enabled) continue;
        if (!this.overlapsCircleXZ(nextPos.x, nextPos.z, radius * 0.92, box)) {
          continue;
        }
        if (Math.abs(nextPos.y - box.max.y) <= GROUND_EPSILON) {
          nextPos.y = box.max.y;
          grounded = true;
          break;
        }
      }
    }

    return { position: nextPos, grounded, hitCeiling, hitWall };
  }

  /**
   * Resolves oriented vehicle XZ motion using substepped multi-circle separation against
   * world AABBs and OBBs, plus terrain grounding so vehicles never pass through walls or floors.
   */
  resolveVehicleMovement(
    currentPos: THREE.Vector3,
    desiredDelta: THREE.Vector3,
    halfExtents: THREE.Vector3,
    rotationY: number,
    ignoreColliderIds?: readonly string[],
  ): VehicleMovementResult {
    const nextPos = currentPos.clone();
    let hitWall = false;
    const hitNormal = new THREE.Vector3();

    const circleRadius = Math.min(halfExtents.x, halfExtents.z);
    const span = Math.max(0, halfExtents.z - circleRadius);
    const offsets = span > 0.05 ? [-span, 0, span] : [0];
    const sinY = Math.sin(rotationY);
    const cosY = Math.cos(rotationY);

    const horizDist = Math.hypot(desiredDelta.x, desiredDelta.z);
    const substeps = Math.max(1, Math.ceil(horizDist / 0.25));
    const stepX = desiredDelta.x / substeps;
    const stepZ = desiredDelta.z / substeps;
    const samplePos = new THREE.Vector3();

    for (let step = 0; step < substeps; step++) {
      nextPos.x += stepX;
      nextPos.z += stepZ;

      for (let pass = 0; pass < 3; pass++) {
        for (const zOff of offsets) {
          for (const box of this.colliders) {
            if (!box.enabled) continue;
            if (ignoreColliderIds && ignoreColliderIds.includes(box.id)) continue;
            // Ignore flat floor slabs (max.y <= 0.15) while colliding against walls, props & curbs
            if (box.max.y <= 0.15) continue;
            if (!this.overlapsY(0.15, halfExtents.y * 2, box)) continue;

            const cx = nextPos.x + sinY * zOff;
            const cz = nextPos.z + cosY * zOff;
            samplePos.set(cx, nextPos.y, cz);
            const startX = samplePos.x;
            const startZ = samplePos.z;
            let collided = false;

            if (box.center && box.halfExtents && box.rotationY !== undefined) {
              collided = this.resolveCircleOBB(
                samplePos,
                circleRadius,
                box.center,
                box.halfExtents,
                box.rotationY,
              );
            } else {
              collided = this.resolveCircleAABB(samplePos, circleRadius, box);
            }

            if (collided) {
              const pushX = samplePos.x - startX;
              const pushZ = samplePos.z - startZ;
              nextPos.x += pushX;
              nextPos.z += pushZ;
              hitNormal.x += pushX;
              hitNormal.z += pushZ;
              hitWall = true;
            }
          }
        }
      }
    }

    if (hitNormal.lengthSq() > 1e-8) {
      hitNormal.normalize();
    }

    // Clamp onto supporting ground surface
    let grounded = false;
    for (const box of this.colliders) {
      if (!box.enabled) continue;
      if (ignoreColliderIds && ignoreColliderIds.includes(box.id)) continue;
      if (!this.overlapsCircleXZ(nextPos.x, nextPos.z, circleRadius * 0.6, box)) continue;
      if (box.max.y <= 0.25 && box.max.y >= -0.25) {
        nextPos.y = Math.max(0, box.max.y);
        grounded = true;
        break;
      }
    }
    if (!grounded) {
      nextPos.y = Math.max(0, currentPos.y);
    }

    return { position: nextPos, hitWall, hitNormal, grounded };
  }

  /**
   * Checks whether a standing cylinder fits cleanly without colliding with world obstacles
   * and while standing on supported floor geometry (safe vehicle exit check).
   */
  isPositionClear(
    pos: THREE.Vector3,
    radius: number,
    height: number,
    ignoreColliderIds?: readonly string[],
  ): boolean {
    let hasFloor = false;
    for (const box of this.colliders) {
      if (!box.enabled) continue;
      if (ignoreColliderIds && ignoreColliderIds.includes(box.id)) continue;

      if (
        this.overlapsCircleXZ(pos.x, pos.z, radius * 0.5, box) &&
        Math.abs(pos.y - box.max.y) <= 0.15
      ) {
        hasFloor = true;
      }

      if (!this.overlapsY(pos.y + 0.08, pos.y + height - 0.05, box)) {
        continue;
      }
      if (this.overlapsCircleXZ(pos.x, pos.z, radius, box)) {
        return false;
      }
    }
    return hasFloor;
  }

  /**
   * Raycasts from camera pivot toward ideal camera position using slab intersection.
   * Clamps camera in front of obstacles (including oriented doors) so it never clips.
   */
  raycastCamera(
    origin: THREE.Vector3,
    target: THREE.Vector3,
    padding: number,
    minDistance = 0.6,
  ): THREE.Vector3 {
    const dir = target.clone().sub(origin);
    const totalDist = dir.length();
    if (totalDist < 1e-5) return target.clone();
    dir.divideScalar(totalDist);

    let closestHit = totalDist;

    for (const box of this.colliders) {
      if (!box.enabled || !box.blocksCamera) continue;

      let hitDist: number | null;
      if (box.center && box.halfExtents && box.rotationY !== undefined) {
        hitDist = this.intersectRayOBB(
          origin,
          dir,
          totalDist,
          box.center,
          box.halfExtents,
          box.rotationY,
        );
      } else {
        hitDist = this.intersectRayAABB(origin, dir, totalDist, box.min, box.max);
      }

      if (hitDist !== null && hitDist < closestHit) {
        closestHit = hitDist;
      }
    }

    if (closestHit < totalDist) {
      const clampedDist = Math.max(minDistance, closestHit - padding);
      return origin.clone().addScaledVector(dir, clampedDist);
    }

    return target.clone();
  }

  /**
   * Returns true if the line segment from origin to target is unobstructed by enabled colliders.
   */
  hasLineOfSight(
    origin: THREE.Vector3,
    target: THREE.Vector3,
    ignoreColliderIds?: readonly string[],
  ): boolean {
    const dir = target.clone().sub(origin);
    const totalDist = dir.length();
    if (totalDist < 1e-4) return true;
    dir.divideScalar(totalDist);

    const maxCheckDist = Math.max(0.01, totalDist - 0.15);

    for (const box of this.colliders) {
      if (!box.enabled) continue;
      if (ignoreColliderIds && ignoreColliderIds.includes(box.id)) continue;

      let hitDist: number | null;
      if (box.center && box.halfExtents && box.rotationY !== undefined) {
        hitDist = this.intersectRayOBB(
          origin,
          dir,
          maxCheckDist,
          box.center,
          box.halfExtents,
          box.rotationY,
        );
      } else {
        hitDist = this.intersectRayAABB(origin, dir, maxCheckDist, box.min, box.max);
      }

      if (hitDist !== null && hitDist < maxCheckDist) {
        return false;
      }
    }

    return true;
  }

  isCircleOverlappingAABB(
    cx: number,
    cz: number,
    radius: number,
    min: THREE.Vector3,
    max: THREE.Vector3,
  ): boolean {
    const closestX = Math.max(min.x, Math.min(cx, max.x));
    const closestZ = Math.max(min.z, Math.min(cz, max.z));
    const dx = cx - closestX;
    const dz = cz - closestZ;
    return dx * dx + dz * dz < radius * radius;
  }

  isCircleOverlappingOBB(
    cx: number,
    cz: number,
    radius: number,
    center: THREE.Vector3,
    half: THREE.Vector3,
    rotationY: number,
  ): boolean {
    const relX = cx - center.x;
    const relZ = cz - center.z;
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    const localX = relX * cos - relZ * sin;
    const localZ = relX * sin + relZ * cos;

    const closestX = Math.max(-half.x, Math.min(localX, half.x));
    const closestZ = Math.max(-half.z, Math.min(localZ, half.z));
    const dx = localX - closestX;
    const dz = localZ - closestZ;
    return dx * dx + dz * dz < radius * radius;
  }

  private resolveCircleAABB(pos: THREE.Vector3, radius: number, box: ColliderBox): boolean {
    const closestX = Math.max(box.min.x, Math.min(pos.x, box.max.x));
    const closestZ = Math.max(box.min.z, Math.min(pos.z, box.max.z));
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq >= radius * radius) {
      return false;
    }

    if (distSq > 1e-10) {
      const dist = Math.sqrt(distSq);
      const overlap = radius - dist;
      pos.x += (dx / dist) * overlap;
      pos.z += (dz / dist) * overlap;
    } else {
      const penLeft = pos.x - box.min.x;
      const penRight = box.max.x - pos.x;
      const penBack = pos.z - box.min.z;
      const penFront = box.max.z - pos.z;
      const minPen = Math.min(penLeft, penRight, penBack, penFront);

      if (minPen === penLeft) {
        pos.x = box.min.x - radius;
      } else if (minPen === penRight) {
        pos.x = box.max.x + radius;
      } else if (minPen === penBack) {
        pos.z = box.min.z - radius;
      } else {
        pos.z = box.max.z + radius;
      }
    }
    return true;
  }

  private resolveCircleOBB(
    pos: THREE.Vector3,
    radius: number,
    center: THREE.Vector3,
    half: THREE.Vector3,
    rotationY: number,
  ): boolean {
    const relX = pos.x - center.x;
    const relZ = pos.z - center.z;
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);

    // World -> local space (Three.js rotation.y: x' = x*cos - z*sin, z' = x*sin + z*cos)
    const localX = relX * cos - relZ * sin;
    const localZ = relX * sin + relZ * cos;

    const closestX = Math.max(-half.x, Math.min(localX, half.x));
    const closestZ = Math.max(-half.z, Math.min(localZ, half.z));
    const dx = localX - closestX;
    const dz = localZ - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq >= radius * radius) {
      return false;
    }

    let pushLocalX = 0;
    let pushLocalZ = 0;

    if (distSq > 1e-10) {
      const dist = Math.sqrt(distSq);
      const overlap = radius - dist;
      pushLocalX = (dx / dist) * overlap;
      pushLocalZ = (dz / dist) * overlap;
    } else {
      const penLeft = localX + half.x;
      const penRight = half.x - localX;
      const penBack = localZ + half.z;
      const penFront = half.z - localZ;
      const minPen = Math.min(penLeft, penRight, penBack, penFront);

      if (minPen === penLeft) {
        pushLocalX = -half.x - radius - localX;
      } else if (minPen === penRight) {
        pushLocalX = half.x + radius - localX;
      } else if (minPen === penBack) {
        pushLocalZ = -half.z - radius - localZ;
      } else {
        pushLocalZ = half.z + radius - localZ;
      }
    }

    // Rotate push delta back to world space (transpose rotation)
    pos.x += pushLocalX * cos + pushLocalZ * sin;
    pos.z += -pushLocalX * sin + pushLocalZ * cos;
    return true;
  }

  private syncOrientedBounds(box: ColliderBox): void {
    if (!box.center || !box.halfExtents || box.rotationY === undefined) return;
    const c = Math.abs(Math.cos(box.rotationY));
    const s = Math.abs(Math.sin(box.rotationY));
    const extentX = box.halfExtents.x * c + box.halfExtents.z * s;
    const extentZ = box.halfExtents.x * s + box.halfExtents.z * c;
    box.min.set(
      box.center.x - extentX,
      box.center.y - box.halfExtents.y,
      box.center.z - extentZ,
    );
    box.max.set(
      box.center.x + extentX,
      box.center.y + box.halfExtents.y,
      box.center.z + extentZ,
    );
  }

  private overlapsY(minY: number, maxY: number, box: ColliderBox): boolean {
    return maxY > box.min.y && minY < box.max.y;
  }

  private overlapsCircleXZ(cx: number, cz: number, radius: number, box: ColliderBox): boolean {
    if (box.center && box.halfExtents && box.rotationY !== undefined) {
      const relX = cx - box.center.x;
      const relZ = cz - box.center.z;
      const cos = Math.cos(box.rotationY);
      const sin = Math.sin(box.rotationY);
      const localX = relX * cos - relZ * sin;
      const localZ = relX * sin + relZ * cos;
      const closestX = Math.max(-box.halfExtents.x, Math.min(localX, box.halfExtents.x));
      const closestZ = Math.max(-box.halfExtents.z, Math.min(localZ, box.halfExtents.z));
      const dx = localX - closestX;
      const dz = localZ - closestZ;
      return dx * dx + dz * dz < radius * radius;
    }

    const closestX = Math.max(box.min.x, Math.min(cx, box.max.x));
    const closestZ = Math.max(box.min.z, Math.min(cz, box.max.z));
    const dx = cx - closestX;
    const dz = cz - closestZ;
    return dx * dx + dz * dz < radius * radius;
  }

  private intersectRayOBB(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
    center: THREE.Vector3,
    half: THREE.Vector3,
    rotationY: number,
  ): number | null {
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);

    const ox = origin.x - center.x;
    const oz = origin.z - center.z;
    const localOrigin = new THREE.Vector3(
      ox * cos - oz * sin,
      origin.y - center.y,
      ox * sin + oz * cos,
    );
    const localDir = new THREE.Vector3(
      dir.x * cos - dir.z * sin,
      dir.y,
      dir.x * sin + dir.z * cos,
    );

    const min = new THREE.Vector3(-half.x, -half.y, -half.z);
    const max = new THREE.Vector3(half.x, half.y, half.z);
    return this.intersectRayAABB(localOrigin, localDir, maxDist, min, max);
  }

  private intersectRayAABB(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
    min: THREE.Vector3,
    max: THREE.Vector3,
  ): number | null {
    let tmin = 0;
    let tmax = maxDist;

    const axes: Array<['x' | 'y' | 'z']> = [['x'], ['y'], ['z']];
    for (const [axis] of axes) {
      const d = dir[axis];
      const o = origin[axis];
      const bmin = min[axis];
      const bmax = max[axis];

      if (Math.abs(d) < 1e-8) {
        if (o < bmin || o > bmax) return null;
      } else {
        let t1 = (bmin - o) / d;
        let t2 = (bmax - o) / d;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }

    return tmin > 0 ? tmin : null;
  }
}
