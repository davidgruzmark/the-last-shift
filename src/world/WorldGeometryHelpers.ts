import * as THREE from 'three';
import type { PropBuildResult } from '../assets/environments/ControlRoomAssets';
import type { MaterialPalette } from '../assets/materials/Palette';
import type { CollisionManager, SurfaceMeta } from './CollisionManager';

export function addBox(
  parent: THREE.Group,
  collision: CollisionManager,
  id: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  options?: {
    castShadow?: boolean;
    receiveShadow?: boolean;
    blocksCamera?: boolean;
    surfaceMeta?: SurfaceMeta;
  },
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = options?.castShadow ?? true;
  mesh.receiveShadow = options?.receiveShadow ?? true;
  parent.add(mesh);

  const half = new THREE.Vector3(w / 2, h / 2, d / 2);
  const center = new THREE.Vector3(x, y, z);
  collision.addBox(
    id,
    center.clone().sub(half),
    center.clone().add(half),
    options?.blocksCamera ?? true,
    options?.surfaceMeta,
  );
  return mesh;
}

export function addWallSegment(
  parent: THREE.Group,
  collision: CollisionManager,
  id: string,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  material: THREE.Material,
  palette: MaterialPalette,
  baseY = 0,
  withStripe = true,
): void {
  addBox(parent, collision, id, x, baseY + h / 2, z, w, h, d, material);
  if (withStripe && (baseY === 0 || baseY === 5.8)) {
    const spanX = w >= d;
    const bandW = spanX ? Math.max(0.1, w - 0.36) : w + 0.024;
    const bandD = spanX ? d + 0.024 : Math.max(0.1, d - 0.36);
    const band = new THREE.Mesh(new THREE.BoxGeometry(bandW, 0.88, bandD), palette.ikeaBlue);
    band.position.set(x, baseY + 0.445, z);
    band.receiveShadow = true;

    const lineW = spanX ? Math.max(0.1, w - 0.36) : w + 0.03;
    const lineD = spanX ? d + 0.03 : Math.max(0.1, d - 0.36);
    const line = new THREE.Mesh(new THREE.BoxGeometry(lineW, 0.09, lineD), palette.ikeaYellow);
    line.position.set(x, baseY + 0.94, z);
    line.receiveShadow = false;
    parent.add(band, line);
  }
}

export function placeProp(
  parent: THREE.Group,
  collision: CollisionManager,
  id: string,
  prop: PropBuildResult,
  x: number,
  z: number,
  rotY = 0,
  baseY = 0,
): void {
  prop.group.position.set(x, baseY, z);
  prop.group.rotation.y = rotY;
  parent.add(prop.group);

  if (prop.colliderSize && prop.colliderOffset) {
    const size = prop.colliderSize.clone();
    if (Math.abs(Math.sin(rotY)) > 0.707) {
      const tmp = size.x;
      size.x = size.z;
      size.z = tmp;
    }
    const center = new THREE.Vector3(x, baseY, z).add(prop.colliderOffset);
    const half = size.multiplyScalar(0.5);
    collision.addBox(id, center.clone().sub(half), center.clone().add(half), true);
  }
}
