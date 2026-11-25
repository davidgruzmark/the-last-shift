import * as THREE from 'three';
import {
  createExitDoor,
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
    // Swap X/Z bounds when rotated 90 degrees
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
 * props, and collision bounds for Phase 1.
 */
export function buildControlRoom(
  assets: AssetManager,
  collision: CollisionManager,
): ControlRoomResult {
  const palette = createPalette(assets);
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
    'floor',
    new THREE.Vector3(0, -0.5, 0),
    new THREE.Vector3(width + 2, 1.0, depth + 2),
    true,
  );

  // Ceiling
  const ceilingMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), palette.ceiling);
  ceilingMesh.position.set(0, height + 0.1, 0);
  group.add(ceilingMesh);
  registerBoxCollider(
    collision,
    'ceiling',
    new THREE.Vector3(0, height + 0.5, 0),
    new THREE.Vector3(width + 2, 1.0, depth + 2),
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
  ): void => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), palette.wall);
    wall.position.set(x, height / 2, z);
    wall.receiveShadow = true;
    wall.castShadow = true;
    group.add(wall);

    // IKEA blue dado band + yellow pinstripe inside room
    const bandW = stripeAxis === 'x' ? w : d + 0.03;
    const bandD = stripeAxis === 'x' ? d + 0.03 : d;
    const blueBand = new THREE.Mesh(
      new THREE.BoxGeometry(stripeAxis === 'x' ? bandW : w + 0.03, 0.9, bandD),
      palette.ikeaBlue,
    );
    blueBand.position.set(x, 0.45, z);
    blueBand.receiveShadow = true;
    group.add(blueBand);

    const yellowLine = new THREE.Mesh(
      new THREE.BoxGeometry(stripeAxis === 'x' ? bandW : w + 0.04, 0.1, stripeAxis === 'x' ? d + 0.04 : d),
      palette.ikeaYellow,
    );
    yellowLine.position.set(x, 0.94, z);
    group.add(yellowLine);

    registerBoxCollider(
      collision,
      id,
      new THREE.Vector3(x, height / 2, z),
      new THREE.Vector3(w, height, d),
      true,
    );
  };

  addWall('wall-north', 0, -halfD - wallThickness / 2, width + wallThickness * 2, wallThickness, 'x');
  addWall('wall-south', 0, halfD + wallThickness / 2, width + wallThickness * 2, wallThickness, 'x');
  addWall('wall-west', -halfW - wallThickness / 2, 0, wallThickness, depth, 'z');
  addWall('wall-east', halfW + wallThickness / 2, 0, wallThickness, depth, 'z');

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

  // Storage Shelves along East wall
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
    new THREE.Vector3(halfW - 0.5, 0, 0.6),
    -Math.PI / 2,
  );

  // Low-poly IKEA sample crate near South-West corner to test jumping/collision
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

  // Exit Door on East-South wall (anchor for Phase 2)
  const exitDoor = createExitDoor(palette);
  exitDoor.group.position.set(halfW - 0.05, 0, 3.8);
  exitDoor.group.rotation.y = -Math.PI / 2;
  group.add(exitDoor.group);

  // Fire Extinguisher next to Exit Door
  const extinguisher = createFireExtinguisher(palette);
  extinguisher.position.set(halfW - 0.3, 0, 2.5);
  group.add(extinguisher);

  // Lighting: HemisphereLight + tightly-bounded DirectionalLight + subtle console glow
  const hemiLight = new THREE.HemisphereLight(0xdceeff, 0x8b7e74, 0.9);
  hemiLight.position.set(0, height, 0);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff8eb, 1.25);
  sunLight.position.set(4.5, 9.0, 5.5);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 24;
  sunLight.shadow.camera.left = -9;
  sunLight.shadow.camera.right = 9;
  sunLight.shadow.camera.top = 9;
  sunLight.shadow.camera.bottom = -9;
  sunLight.shadow.bias = -0.0008;
  sunLight.shadow.normalBias = 0.02;
  group.add(sunLight);

  const monitorFill = new THREE.PointLight(0x6ec1ff, 1.4, 7.5, 1.6);
  monitorFill.position.set(0, 1.85, -2.8);
  group.add(monitorFill);

  return { group, palette, sunLight };
}
