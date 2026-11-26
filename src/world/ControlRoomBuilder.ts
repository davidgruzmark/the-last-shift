import * as THREE from 'three';
import {
  createCinematicSecurityConsole,
  createExecutiveChair,
  createFireExtinguisher,
  createSecurityLocker,
  createServerRack,
  createStorageShelf,
  type PropBuildResult,
} from '../assets/environments/ControlRoomAssets';
import { createPalette, type MaterialPalette } from '../assets/materials/Palette';
import { CONTROL_ROOM_BOUNDS } from '../config/constants';
import type { AssetManager } from '../core/AssetManager';
import type { CollisionManager, SurfaceMeta } from './CollisionManager';

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
  surfaceMeta?: SurfaceMeta,
): void {
  const half = size.clone().multiplyScalar(0.5);
  collision.addBox(
    id,
    center.clone().sub(half),
    center.clone().add(half),
    blocksCamera,
    surfaceMeta,
  );
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
 * Builds the cinematic IKEA Security Control Room (14m x 12m x 4.6m) with
 * dark acoustic walls, dimmed ceiling fixtures, cool monitor-glow lighting,
 * 9-monitor live CCTV wall, dual executive operator stations, blinking server rack,
 * and connected South Staff Break & Locker Room.
 */
export function buildControlRoom(
  assets: AssetManager,
  collision: CollisionManager,
  sharedPalette?: MaterialPalette,
  wallFeedTextures: readonly THREE.Texture[] = [],
): ControlRoomResult {
  const palette = sharedPalette ?? createPalette(assets);
  const group = new THREE.Group();
  group.name = 'ControlRoom';

  const { width, depth, wallThickness } = CONTROL_ROOM_BOUNDS;
  const height = 4.6;
  const halfW = width / 2; // 7
  const halfD = depth / 2; // 6

  const darkFloorMat = new THREE.MeshStandardMaterial({
    color: 0x161c26,
    roughness: 0.78,
    metalness: 0.14,
  });
  const darkWallMat = new THREE.MeshStandardMaterial({
    color: 0x222b3a,
    roughness: 0.88,
    metalness: 0.08,
  });
  const dimFixtureMat = new THREE.MeshStandardMaterial({
    color: 0x7ca7cc,
    emissive: 0x3874a8,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });

  // Control Room Floor & Ceiling
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), darkFloorMat);
  floorMesh.position.set(0, -0.1, 0);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);
  registerBoxCollider(
    collision,
    'control-floor',
    new THREE.Vector3(0, -0.5, 0),
    new THREE.Vector3(width, 1.0, depth),
    true,
    { floor: 1, zoneId: 'Control Room' },
  );

  const ceilingMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), darkWallMat);
  ceilingMesh.position.set(0, height + 0.1, 0);
  group.add(ceilingMesh);
  registerBoxCollider(
    collision,
    'control-ceiling',
    new THREE.Vector3(0, height + 0.5, 0),
    new THREE.Vector3(width, 1.0, depth),
    true,
  );

  // Dimmed recessed ceiling strips
  [-2.4, 2.2].forEach((z) => {
    [-3.2, 3.2].forEach((x) => {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.36), dimFixtureMat);
      fixture.position.set(x, height - 0.03, z);
      group.add(fixture);
    });
  });

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
    mat: THREE.Material = darkWallMat,
  ): void => {
    const centerY = baseY + wallH / 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), mat);
    wall.position.set(x, centerY, z);
    wall.receiveShadow = true;
    wall.castShadow = true;
    group.add(wall);

    if (includeStripe) {
      const bandW = stripeAxis === 'x' ? Math.max(0.1, w - (wallThickness + 0.06) * 2) : w + 0.024;
      const bandD = stripeAxis === 'x' ? d + 0.024 : Math.max(0.1, d - 0.06);
      const blueBand = new THREE.Mesh(new THREE.BoxGeometry(bandW, 0.88, bandD), palette.ikeaBlue);
      blueBand.position.set(x, 0.445, z);
      blueBand.receiveShadow = true;
      group.add(blueBand);

      const lineW = stripeAxis === 'x' ? Math.max(0.1, w - (wallThickness + 0.06) * 2) : w + 0.03;
      const lineD = stripeAxis === 'x' ? d + 0.03 : Math.max(0.1, d - 0.06);
      const yellowLine = new THREE.Mesh(
        new THREE.BoxGeometry(lineW, 0.08, lineD),
        palette.ikeaYellow,
      );
      yellowLine.position.set(x, 0.94, z);
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
  addWall('wall-west', -halfW - wallThickness / 2, 0, wallThickness, depth, 'z');

  // South wall split around 1.8m Staff Break Room doorway at x in [-3.9, -2.1]
  const southZ = halfD + wallThickness / 2;
  addWall('wall-south-west', -5.55, southZ, 3.2, wallThickness, 'x'); // x: [-7.15, -3.95]
  addWall('wall-south-east', 2.525, southZ, 9.25, wallThickness, 'x'); // x: [-2.1, +7.15]
  addWall('wall-south-lintel', -3.025, southZ, 1.85, wallThickness, 'x', height - 2.65, 2.65, false);

  // East wall split around 2.8m Showroom doorway at z in [2.2, 5.0]
  const eastX = halfW + wallThickness / 2;
  addWall('wall-east-north', eastX, -1.9, wallThickness, 8.2, 'z');
  addWall('wall-east-south', eastX, 5.5, wallThickness, 1.0, 'z');
  addWall('wall-east-lintel', eastX, 3.6, wallThickness, 2.8, 'z', height - 2.8, 2.8, false);

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

  // IKEA SECURITY CONTROL sign on North wall above 9-monitor CCTV wall
  const signMesh = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.72, 0.08), palette.controlSign);
  signMesh.position.set(0, 4.15, -halfD + 0.06);
  group.add(signMesh);

  // Dual-Operator Cinematic Security Console + 9-Monitor Live CCTV Wall
  placeProp(
    group,
    collision,
    'security-desk',
    createCinematicSecurityConsole(palette, wallFeedTextures),
    new THREE.Vector3(0, 0, -4.15),
    0,
  );

  // Two Executive Chairs (Station A for Kfir at x=-1.05, Station B for Rotating Guard at x=+1.35)
  placeProp(
    group,
    collision,
    'ctrl-chair-a',
    createExecutiveChair(palette),
    new THREE.Vector3(-1.05, 0, -2.55),
    Math.PI,
  );
  placeProp(
    group,
    collision,
    'ctrl-chair-b',
    createExecutiveChair(palette),
    new THREE.Vector3(1.35, 0, -2.55),
    Math.PI,
  );

  // Blinking Server Rack + Cable Floor Conduits
  placeProp(
    group,
    collision,
    'server-rack-1',
    createServerRack(palette),
    new THREE.Vector3(-6.2, 0, -4.8),
    Math.PI * 0.25,
  );
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x0b0f17, roughness: 0.7 });
  const conduitMain = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 1.4), cableMat);
  conduitMain.position.set(-2.6, 0.012, -4.6);
  const conduitRear = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.025, 0.16), cableMat);
  conduitRear.position.set(-4.3, 0.012, -4.8);
  group.add(conduitMain, conduitRear);

  // Security Lockers along West wall (clear of VIP Perfume pedestal at -5.2, -4.6)
  placeProp(
    group,
    collision,
    'locker-1',
    createSecurityLocker(palette),
    new THREE.Vector3(-halfW + 0.45, 0, -2.1),
    Math.PI / 2,
  );
  placeProp(
    group,
    collision,
    'locker-2',
    createSecurityLocker(palette),
    new THREE.Vector3(-halfW + 0.45, 0, -0.3),
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

  // Sample crate & Fire Extinguisher
  const crateMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 1.1), palette.boxLabel);
  crateMesh.position.set(4.5, 0.325, 4.6);
  crateMesh.castShadow = true;
  crateMesh.receiveShadow = true;
  group.add(crateMesh);
  registerBoxCollider(
    collision,
    'sample-crate',
    new THREE.Vector3(4.5, 0.325, 4.6),
    new THREE.Vector3(1.1, 0.65, 1.1),
    true,
  );

  const extinguisher = createFireExtinguisher(palette);
  extinguisher.position.set(halfW - 0.32, 0, 1.8);
  group.add(extinguisher);

  // Atmospheric cool cyan/blue monitor glow lighting inside Control Room
  const monitorGlowMain = new THREE.PointLight(0x38bdf8, 2.2, 11.0, 1.4);
  monitorGlowMain.position.set(0, 2.1, -2.7);
  const monitorGlowSide = new THREE.PointLight(0x60a5fa, 1.35, 8.5, 1.5);
  monitorGlowSide.position.set(1.6, 1.9, -2.5);
  const serverAmber = new THREE.PointLight(0xf59e0b, 0.55, 4.5, 1.6);
  serverAmber.position.set(-5.6, 1.5, -4.3);
  group.add(monitorGlowMain, monitorGlowSide, serverAmber);

  // Connected Staff Break & Locker Room South of Control Room (x in [-7, 7], z in [6.3, 12.0])
  const staffFloor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, 6.0), palette.showroomFloor);
  staffFloor.position.set(0, -0.1, 9.0);
  staffFloor.receiveShadow = true;
  group.add(staffFloor);
  registerBoxCollider(
    collision,
    'staff-break-floor',
    new THREE.Vector3(0, -0.5, 9.0),
    new THREE.Vector3(width, 1.0, 6.0),
    true,
    { floor: 1, zoneId: 'Staff Break Room' },
  );
  const staffCeiling = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, 6.0), palette.ceiling);
  staffCeiling.position.set(0, height + 0.1, 9.0);
  group.add(staffCeiling);
  registerBoxCollider(
    collision,
    'staff-break-ceiling',
    new THREE.Vector3(0, height + 0.5, 9.0),
    new THREE.Vector3(width, 1.0, 6.0),
    true,
  );

  addWall('staff-wall-west', -halfW - wallThickness / 2, 9.0, wallThickness, 6.0, 'z', height, 0, true, palette.wall);
  addWall('staff-wall-east', halfW - 0.45, 9.15, wallThickness, 5.7, 'z', height, 0, true, palette.wall);
  addWall('staff-wall-south', 0, 12.0 + wallThickness / 2, width + wallThickness * 2, wallThickness, 'x', height, 0, true, palette.wall);

  // Break room table, coffee counter & lockers (clear of walking lanes around x = -3.0)
  const breakTable = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.76, 1.1), palette.wood);
  breakTable.position.set(2.2, 0.38, 9.4);
  breakTable.castShadow = true;
  group.add(breakTable);
  registerBoxCollider(collision, 'staff-break-table', new THREE.Vector3(2.2, 0.38, 9.4), new THREE.Vector3(2.2, 0.76, 1.1), true);

  placeProp(
    group,
    collision,
    'staff-locker-1',
    createSecurityLocker(palette),
    new THREE.Vector3(-halfW + 0.45, 0, 9.5),
    Math.PI / 2,
  );

  const staffLight = new THREE.PointLight(0xfff1d6, 1.1, 10, 1.5);
  staffLight.position.set(0, 3.6, 9.0);
  group.add(staffLight);

  const sunLight = new THREE.DirectionalLight(0xfff8eb, 0);
  return { group, palette, sunLight };
}
