import * as THREE from 'three';
import {
  createFireExtinguisher,
  createOfficeChair,
  createSecurityDesk,
  createSecurityLocker,
  createStorageShelf,
  type PropBuildResult,
} from '../assets/environments/ControlRoomAssets';
import { createPalette, type MaterialPalette } from '../assets/materials/Palette';
import { CONTROL_ROOM_BOUNDS } from '../config/constants';
import type { AssetManager } from '../core/AssetManager';
import type { CollisionManager } from './CollisionManager';

export interface ControlRoomResult {
  group: THREE.Group;
  palette: MaterialPalette;
  sunLight: THREE.DirectionalLight;
}

function registerBoxCollider(
  collision: CollisionManager,
  id: string,
  center: THREE.Vector3,
  size: THREE.Vector3,
  blocksCamera = true,
): void {
  const half = size.clone().multiplyScalar(0.5);
  collision.addBox(id, center.clone().sub(half), center.clone().add(half), blocksCamera);
}

function placeProp(
  parent: THREE.Group,
  collision: CollisionManager,
  id: string,
  prop: PropBuildResult,
  pos: THREE.Vector3,
  rotY = 0,
): void {
  prop.group.position.copy(pos);
  prop.group.rotation.y = rotY;
  parent.add(prop.group);

  if (prop.colliderSize && prop.colliderOffset) {
    const size = prop.colliderSize.clone();
    if (Math.abs(Math.sin(rotY)) > 0.707) {
      const tmp = size.x;
      size.x = size.z;
      size.z = tmp;
    }
    const worldCenter = pos.clone().add(prop.colliderOffset);
    registerBoxCollider(collision, id, worldCenter, size, true);
  }
}

/**
 * Builds the IKEA Security Control Room (14m x 12m x 4.2m), lighting,
 * props, and collision bounds with an open East doorway leading to the Showroom.
 */
export function buildControlRoom(
  assets: AssetManager,
  collision: CollisionManager,
  sharedPalette?: MaterialPalette,
): ControlRoomResult {
  const palette = sharedPalette ?? createPalette(assets);
  const group = new THREE.Group();
  group.name = 'ControlRoom';

  const { width, depth, height, wallThickness } = CONTROL_ROOM_BOUNDS;
  const halfW = width / 2;
  const halfD = depth / 2;

  // Floor
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), palette.floor);
  floorMesh.position.set(0, -0.1, 0);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);
  registerBoxCollider(
    collision,
    'control-floor',
    new THREE.Vector3(0, -0.5, 0),
    new THREE.Vector3(width, 1.0, depth),
    true,
  );

  // Ceiling
  const ceilingMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), palette.ceiling);
  ceilingMesh.position.set(0, height + 0.1, 0);
  group.add(ceilingMesh);
  registerBoxCollider(
    collision,
    'control-ceiling',
    new THREE.Vector3(0, height + 0.5, 0),
    new THREE.Vector3(width, 1.0, depth),
    true,
  );

  // Ceiling fluorescent light bars
  [-2.6, 2.2].forEach((z) => {
    [-3.2, 3.2].forEach((x) => {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.45), palette.lightPanel);
      fixture.position.set(x, height - 0.04, z);
      group.add(fixture);
    });
  });

  // Perimeter walls + IKEA blue/yellow accent bands
  const addWall = (
    id: string,
    x: number,
    z: number,
    w: number,
    d: number,
    stripeAxis: 'x' | 'z',
    wallH: number = height,
    baseY = 0,
    includeStripe = true,
  ): void => {
    const centerY = baseY + wallH / 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), palette.wall);
    wall.position.set(x, centerY, z);
    wall.receiveShadow = true;
    wall.castShadow = true;
    group.add(wall);

    if (includeStripe) {
      // Inset dado bands clear of perpendicular walls & separate vertically from floor/each other
      const bandW = stripeAxis === 'x' ? Math.max(0.1, w - (wallThickness + 0.06) * 2) : w + 0.024;
      const bandD = stripeAxis === 'x' ? d + 0.024 : Math.max(0.1, d - 0.06);
      const blueBand = new THREE.Mesh(new THREE.BoxGeometry(bandW, 0.88, bandD), palette.ikeaBlue);
      blueBand.position.set(x, 0.445, z);
      blueBand.receiveShadow = true;
      group.add(blueBand);

      const lineW = stripeAxis === 'x' ? Math.max(0.1, w - (wallThickness + 0.06) * 2) : w + 0.03;
      const lineD = stripeAxis === 'x' ? d + 0.03 : Math.max(0.1, d - 0.06);
      const yellowLine = new THREE.Mesh(
        new THREE.BoxGeometry(lineW, 0.09, lineD),
        palette.ikeaYellow,
      );
      yellowLine.position.set(x, 0.94, z);
      yellowLine.receiveShadow = false;
      group.add(yellowLine);
    }

    registerBoxCollider(
      collision,
      id,
      new THREE.Vector3(x, centerY, z),
      new THREE.Vector3(w, wallH, d),
      true,
    );
  };

  addWall('wall-north', 0, -halfD - wallThickness / 2, width + wallThickness * 2, wallThickness, 'x');
  addWall('wall-south', 0, halfD + wallThickness / 2, width + wallThickness * 2, wallThickness, 'x');
  addWall('wall-west', -halfW - wallThickness / 2, 0, wallThickness, depth, 'z');

  // East wall split around open 2.8m doorway to Showroom: z in [2.2, 5.0], height 2.8m
  const eastX = halfW + wallThickness / 2;
  addWall('wall-east-north', eastX, -1.9, wallThickness, 8.2, 'z'); // z: [-6.0, +2.2]
  addWall('wall-east-south', eastX, 5.5, wallThickness, 1.0, 'z'); // z: [+5.0, +6.0]
  addWall('wall-east-lintel', eastX, 3.6, wallThickness, 2.8, 'z', 1.4, 2.8, false);

  // Doorway frame inset strictly clear of adjacent wall faces and lintel
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.79, 0.11), palette.metalDark);
  frameL.position.set(eastX, 1.395, 2.265);
  const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.79, 0.11), palette.metalDark);
  frameR.position.set(eastX, 1.395, 4.935);
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 2.55), palette.metalDark);
  frameTop.position.set(eastX, 2.735, 3.6);
  group.add(frameL, frameR, frameTop);

  const exitSign = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 1.5), palette.exitSign);
  exitSign.position.set(halfW - 0.05, 3.15, 3.6);
  group.add(exitSign);

  // IKEA SECURITY CONTROL sign on North wall above CCTV console
  const signMesh = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.05, 0.08), palette.controlSign);
  signMesh.position.set(0, 2.95, -halfD + 0.06);
  group.add(signMesh);

  // Main Security Desk + Chair near North wall
  placeProp(
    group,
    collision,
    'security-desk',
    createSecurityDesk(palette),
    new THREE.Vector3(0, 0, -3.5),
    0,
  );
  placeProp(
    group,
    collision,
    'office-chair',
    createOfficeChair(palette),
    new THREE.Vector3(0, 0, -2.35),
    Math.PI,
  );

  // Security Lockers along West wall
  placeProp(
    group,
    collision,
    'locker-1',
    createSecurityLocker(palette),
    new THREE.Vector3(-halfW + 0.45, 0, -2.5),
    Math.PI / 2,
  );
  placeProp(
    group,
    collision,
    'locker-2',
    createSecurityLocker(palette),
    new THREE.Vector3(-halfW + 0.45, 0, -0.7),
    Math.PI / 2,
  );

  // Storage Shelves along East-North wall
  placeProp(
    group,
    collision,
    'shelf-1',
    createStorageShelf(palette),
    new THREE.Vector3(halfW - 0.5, 0, -2.2),
    -Math.PI / 2,
  );
  placeProp(
    group,
    collision,
    'shelf-2',
    createStorageShelf(palette),
    new THREE.Vector3(halfW - 0.5, 0, 0.4),
    -Math.PI / 2,
  );

  // Low-poly IKEA sample crate near South-West corner
  const crateMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 1.1), palette.boxLabel);
  crateMesh.position.set(-4.5, 0.325, 3.8);
  crateMesh.castShadow = true;
  crateMesh.receiveShadow = true;
  group.add(crateMesh);
  registerBoxCollider(
    collision,
    'sample-crate',
    new THREE.Vector3(-4.5, 0.325, 3.8),
    new THREE.Vector3(1.1, 0.65, 1.1),
    true,
  );

  // Fire Extinguisher next to doorway
  const extinguisher = createFireExtinguisher(palette);
  extinguisher.position.set(halfW - 0.32, 0, 1.8);
  group.add(extinguisher);

  // Local CCTV glow light (main directional & hemisphere lights live in WorldManager)
  const monitorFill = new THREE.PointLight(0x6ec1ff, 1.35, 8.0, 1.5);
  monitorFill.position.set(0, 1.85, -2.8);
  group.add(monitorFill);

  // Placeholder DirectionalLight reference for compatibility if used standalone
  const sunLight = new THREE.DirectionalLight(0xfff8eb, 0);

  return { group, palette, sunLight };
}
