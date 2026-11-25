import * as THREE from 'three';

export interface ColliderBox {
  id: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
  blocksCamera: boolean;
}

export interface MovementResult {
  position: THREE.Vector3;
  grounded: boolean;
  hitCeiling: boolean;
  hitWall: boolean;
}

const STEP_CLEARANCE = 0.05;
const GROUND_EPSILON = 0.015;

/**
 * Deterministic AABB collision & raycast manager.
 * Resolves cylinder/capsule-like player movement against solid AABBs using
 * Circle-vs-AABB separation (enabling smooth wall sliding and corner handling)
 * plus vertical floor/ceiling resolution.
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
    });
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

    // 1. Horizontal XZ resolution using Circle-vs-AABB minimum separation.
    // Substep large horizontal deltas so fast movement never tunnels through thin walls.
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
          if (!this.overlapsY(nextPos.y + STEP_CLEARANCE, nextPos.y + height - STEP_CLEARANCE, box)) {
            continue;
          }
          const closestX = Math.max(box.min.x, Math.min(nextPos.x, box.max.x));
          const closestZ = Math.max(box.min.z, Math.min(nextPos.z, box.max.z));
          const dx = nextPos.x - closestX;
          const dz = nextPos.z - closestZ;
          const distSq = dx * dx + dz * dz;

          if (distSq >= radius * radius) {
            continue;
          }

          hitWall = true;
          if (distSq > 1e-10) {
            const dist = Math.sqrt(distSq);
            const overlap = radius - dist;
            nextPos.x += (dx / dist) * overlap;
            nextPos.z += (dz / dist) * overlap;
          } else {
            // Center is inside box: push out through the nearest face
            const penLeft = nextPos.x - box.min.x;
            const penRight = box.max.x - nextPos.x;
            const penBack = nextPos.z - box.min.z;
            const penFront = box.max.z - nextPos.z;
            const minPen = Math.min(penLeft, penRight, penBack, penFront);

            if (minPen === penLeft) {
              nextPos.x = box.min.x - radius;
            } else if (minPen === penRight) {
              nextPos.x = box.max.x + radius;
            } else if (minPen === penBack) {
              nextPos.z = box.min.z - radius;
            } else {
              nextPos.z = box.max.z + radius;
            }
          }
        }
      }
    }

    // 2. Vertical Y resolution
    nextPos.y += desiredDelta.y;
    for (const box of this.colliders) {
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
   * Raycasts from camera pivot toward ideal camera position using slab intersection.
   * Clamps camera in front of obstacles so it never clips through walls.
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
      if (!box.blocksCamera) continue;
      const hitDist = this.intersectRayAABB(origin, dir, totalDist, box.min, box.max);
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

  private overlapsY(minY: number, maxY: number, box: ColliderBox): boolean {
    return maxY > box.min.y && minY < box.max.y;
  }

  private overlapsCircleXZ(cx: number, cz: number, radius: number, box: ColliderBox): boolean {
    const closestX = Math.max(box.min.x, Math.min(cx, box.max.x));
    const closestZ = Math.max(box.min.z, Math.min(cz, box.max.z));
    const dx = cx - closestX;
    const dz = cz - closestZ;
    return dx * dx + dz * dz < radius * radius;
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
