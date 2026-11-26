import * as THREE from 'three';
import type { PropBuildResult } from '../assets/environments/ControlRoomAssets';
import {
  createBillyBookcase,
  createCheckoutLane,
  createCoffeeTable,
  createFlatbedCart,
  createForklift,
  createKallaxUnit,
  createKitchenDisplay,
  createLowPolyTree,
  createMalmBed,
  createParkedCar,
  createPoangChair,
  createProductPlacard,
  createRestaurantCounter,
  createRestaurantTable,
  createRug,
  createShoppingCart,
  createSofa,
  createStreetLamp,
  createWarehouseRack,
} from '../assets/environments/IkeaFurnitureAssets';
import type { MaterialPalette } from '../assets/materials/Palette';
import { WORLD_ZONES } from '../config/constants';
import type { CollisionManager } from './CollisionManager';

function addBox(
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
  options?: { castShadow?: boolean; receiveShadow?: boolean; blocksCamera?: boolean },
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = options?.castShadow ?? true;
  mesh.receiveShadow = options?.receiveShadow ?? true;
  parent.add(mesh);

  const half = new THREE.Vector3(w / 2, h / 2, d / 2);
  const center = new THREE.Vector3(x, y, z);
  collision.addBox(id, center.clone().sub(half), center.clone().add(half), options?.blocksCamera ?? true);
  return mesh;
}

function addWallSegment(
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
  if (withStripe && baseY === 0) {
    // Inset dado bands strictly inside wall span and separate vertically from floor/each other
    const spanX = w >= d;
    const bandW = spanX ? Math.max(0.1, w - 0.36) : w + 0.024;
    const bandD = spanX ? d + 0.024 : Math.max(0.1, d - 0.36);
    const band = new THREE.Mesh(new THREE.BoxGeometry(bandW, 0.88, bandD), palette.ikeaBlue);
    band.position.set(x, 0.445, z);
    band.receiveShadow = true;

    const lineW = spanX ? Math.max(0.1, w - 0.36) : w + 0.03;
    const lineD = spanX ? d + 0.03 : Math.max(0.1, d - 0.36);
    const line = new THREE.Mesh(new THREE.BoxGeometry(lineW, 0.09, lineD), palette.ikeaYellow);
    line.position.set(x, 0.94, z);
    line.receiveShadow = false;
    parent.add(band, line);
  }
}

function placeProp(
  parent: THREE.Group,
  collision: CollisionManager,
  id: string,
  prop: PropBuildResult,
  x: number,
  z: number,
  rotY = 0,
): void {
  prop.group.position.set(x, 0, z);
  prop.group.rotation.y = rotY;
  parent.add(prop.group);

  if (prop.colliderSize && prop.colliderOffset) {
    const size = prop.colliderSize.clone();
    if (Math.abs(Math.sin(rotY)) > 0.707) {
      const tmp = size.x;
      size.x = size.z;
      size.z = tmp;
    }
    const center = new THREE.Vector3(x, 0, z).add(prop.colliderOffset);
    const half = size.multiplyScalar(0.5);
    collision.addBox(id, center.clone().sub(half), center.clone().add(half), true);
  }
}

/**
 * Builds the connected IKEA Showroom + Restaurant, Self-Serve Warehouse,
 * Checkout Hall, and Outdoor Parking Lot with IKEA Store Facade.
 */
export function buildStoreWorld(
  palette: MaterialPalette,
  collision: CollisionManager,
): THREE.Group {
  const worldGroup = new THREE.Group();
  worldGroup.name = 'IkeaStoreWorld';

  buildShowroomAndRestaurant(worldGroup, palette, collision);
  buildWarehouse(worldGroup, palette, collision);
  buildCheckoutHall(worldGroup, palette, collision);
  buildParkingLot(worldGroup, palette, collision);

  return worldGroup;
}

function buildShowroomAndRestaurant(
  root: THREE.Group,
  palette: MaterialPalette,
  collision: CollisionManager,
): void {
  const group = new THREE.Group();
  group.name = 'ShowroomAndRestaurant';
  const { minX, maxX, minZ, maxZ, height } = WORLD_ZONES.showroom;
  const w = maxX - minX; // 28
  const d = maxZ - minZ; // 28
  const cx = (minX + maxX) / 2; // 21
  const cz = (minZ + maxZ) / 2; // 0

  // Floor & Ceiling
  addBox(group, collision, 'showroom-floor', cx, -0.5, cz, w, 1.0, d, palette.showroomFloor, {
    castShadow: false,
  });
  addBox(group, collision, 'showroom-ceiling', cx, height + 0.5, cz, w, 1.0, d, palette.ceiling, {
    castShadow: false,
    receiveShadow: false,
  });

  // Ceiling lights
  [-8, 0, 8].forEach((z) => {
    [13, 21, 29].forEach((x) => {
      const light = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.6), palette.lightPanel);
      light.position.set(x, height - 0.04, z);
      group.add(light);
    });
  });

  // East wall (solid)
  addWallSegment(group, collision, 'showroom-wall-east', maxX + 0.15, cz, 0.3, d, height, palette.wall, palette);

  // West wall: Control Room sits at z [-6.3, +6.3]; keep showroom west segments strictly clear of Control Room walls
  addWallSegment(group, collision, 'showroom-wall-west-n', minX - 0.15, -10.15, 0.3, 7.68, height, palette.wall, palette); // [-13.99, -6.31]
  addWallSegment(group, collision, 'showroom-wall-west-s', minX - 0.15, 10.15, 0.3, 7.68, height, palette.wall, palette); // [+6.31, +13.99]

  // North partition (z = -14) to Warehouse with wide central passage [17, 25]
  addWallSegment(group, collision, 'showroom-north-w', 12, minZ - 0.15, 10, 0.3, height, palette.wall, palette); // [7, 17]
  addWallSegment(group, collision, 'showroom-north-e', 30, minZ - 0.15, 10, 0.3, height, palette.wall, palette); // [25, 35]
  addWallSegment(group, collision, 'showroom-north-lintel', 21, minZ - 0.15, 7.98, 0.3, height - 3.4, palette.wall, palette, 3.4, false);

  const whSign = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.0, 0.14), palette.warehouseSign);
  whSign.position.set(21, 4.1, minZ + 0.12);
  group.add(whSign);

  // South partition (z = +14) to Checkout with wide central passage [16, 26]
  addWallSegment(group, collision, 'showroom-south-w', 11.5, maxZ + 0.15, 9, 0.3, height, palette.wall, palette); // [7, 16]
  addWallSegment(group, collision, 'showroom-south-e', 30.5, maxZ + 0.15, 9, 0.3, height, palette.wall, palette); // [26, 35]
  addWallSegment(group, collision, 'showroom-south-lintel', 21, maxZ + 0.15, 9.98, 0.3, height - 3.4, palette.wall, palette, 3.4, false);

  const chkSign = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.0, 0.14), palette.checkoutSign);
  chkSign.position.set(21, 4.1, maxZ - 0.12);
  group.add(chkSign);

  // Showroom entrance sign near Control Room exit
  const srSign = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 4.4), palette.showroomSign);
  srSign.position.set(minX + 0.2, 4.1, 3.6);
  group.add(srSign);

  // Floor navigation arrows (IKEA showroom path)
  const addArrow = (x: number, z: number, rotY: number): void => {
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), palette.floorArrow);
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = rotY;
    arrow.position.set(x, 0.025, z);
    arrow.receiveShadow = true;
    group.add(arrow);
  };
  addArrow(9.5, 3.6, -Math.PI / 2); // Point East out of Control Room
  addArrow(17.5, 3.6, 0); // Point North toward Warehouse
  addArrow(21, -7.5, 0); // Point North toward Warehouse
  addArrow(21, 10.5, Math.PI); // Point South toward Checkout

  // --- Living Room Vignette (South-West Showroom) ---
  const livingRug = createRug(5.2, 4.2, palette.rugBeige);
  livingRug.position.set(12.2, 0.02, 8.6);
  group.add(livingRug);
  placeProp(group, collision, 'sr-sofa', createSofa(palette), 12.2, 6.9, 0);
  placeProp(group, collision, 'sr-coffee-table', createCoffeeTable(palette), 12.2, 8.7, 0);
  placeProp(group, collision, 'sr-poang', createPoangChair(palette), 14.3, 8.8, -Math.PI * 0.65);
  placeProp(group, collision, 'sr-kallax', createKallaxUnit(palette), 9.6, 8.7, Math.PI / 2);
  const poangTag = createProductPlacard(palette, 'POÄNG');
  poangTag.position.set(15.2, 0, 9.8);
  group.add(poangTag);
  const kallaxTag = createProductPlacard(palette, 'KALLAX');
  kallaxTag.position.set(9.8, 0, 10.5);
  group.add(kallaxTag);

  // --- Bedroom Vignette (North-West Showroom) ---
  const bedRug = createRug(4.8, 4.4, palette.ikeaBlue);
  bedRug.position.set(12.4, 0.02, -8.5);
  group.add(bedRug);
  placeProp(group, collision, 'sr-malm-bed', createMalmBed(palette), 12.2, -9.2, 0);
  placeProp(group, collision, 'sr-billy', createBillyBookcase(palette), 9.0, -8.8, Math.PI / 2);
  const malmTag = createProductPlacard(palette, 'MALM');
  malmTag.position.set(14.6, 0, -7.2);
  group.add(malmTag);
  const billyTag = createProductPlacard(palette, 'BILLY');
  billyTag.position.set(9.4, 0, -6.7);
  group.add(billyTag);

  // --- Kitchen Vignette (East-South Showroom) ---
  placeProp(group, collision, 'sr-kitchen', createKitchenDisplay(palette), 31.2, 8.5, -Math.PI / 2);

  // --- IKEA Restaurant Corner (North-East Showroom: x [25, 35], z [-14, -2]) ---
  const restFloor = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.02, 11.4), palette.floor);
  restFloor.position.set(30.0, 0.022, -8.0);
  restFloor.receiveShadow = true;
  group.add(restFloor);

  const restSign = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.0, 0.14), palette.restaurantSign);
  restSign.position.set(30.0, 4.0, -13.6);
  group.add(restSign);

  placeProp(group, collision, 'rest-counter', createRestaurantCounter(palette), 30.2, -12.4, 0);
  placeProp(group, collision, 'rest-table-1', createRestaurantTable(palette), 27.6, -8.6, 0);
  placeProp(group, collision, 'rest-table-2', createRestaurantTable(palette), 31.8, -8.6, 0);
  placeProp(group, collision, 'rest-table-3', createRestaurantTable(palette), 27.6, -4.6, 0);
  placeProp(group, collision, 'rest-table-4', createRestaurantTable(palette), 31.8, -4.6, 0);

  root.add(group);
}

function buildWarehouse(
  root: THREE.Group,
  palette: MaterialPalette,
  collision: CollisionManager,
): void {
  const group = new THREE.Group();
  group.name = 'SelfServeWarehouse';
  const { minX, maxX, minZ, maxZ, height } = WORLD_ZONES.warehouse;
  const w = maxX - minX; // 28
  const d = maxZ - minZ; // 24
  const cx = (minX + maxX) / 2; // 21
  const cz = (minZ + maxZ) / 2; // -26

  // Floor & High Industrial Ceiling
  addBox(group, collision, 'wh-floor', cx, -0.5, cz, w, 1.0, d, palette.warehouseFloor, {
    castShadow: false,
  });
  addBox(group, collision, 'wh-ceiling', cx, height + 0.5, cz, w, 1.0, d, palette.ceiling, {
    castShadow: false,
    receiveShadow: false,
  });

  // High bay lights
  [-32, -26, -20].forEach((z) => {
    [13, 21, 29].forEach((x) => {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.7), palette.lightPanel);
      fixture.position.set(x, height - 0.06, z);
      group.add(fixture);
    });
  });

  // Perimeter walls (South wall already shared with Showroom North partition)
  addWallSegment(group, collision, 'wh-wall-north', cx, minZ - 0.15, w - 0.02, 0.3, height, palette.wall, palette);
  addWallSegment(group, collision, 'wh-wall-west', minX - 0.15, cz, 0.3, d - 0.02, height, palette.wall, palette);
  addWallSegment(group, collision, 'wh-wall-east', maxX + 0.15, cz, 0.3, d - 0.02, height, palette.wall, palette);

  // Loading dock shutter doors & hazard stripes on North wall
  [14, 28].forEach((x) => {
    const shutter = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.8, 0.12), palette.metalGrey);
    shutter.position.set(x, 1.9, minZ + 0.08);
    const hazard = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 0.14), palette.hazardStripe);
    hazard.position.set(x, 3.98, minZ + 0.09);
    group.add(shutter, hazard);
  });

  // Hazard stripe across warehouse entrance floor
  const entranceStripe = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 0.65), palette.hazardStripe);
  entranceStripe.rotation.x = -Math.PI / 2;
  entranceStripe.position.set(21, 0.025, maxZ - 0.4);
  group.add(entranceStripe);

  // Warehouse Racks arranged in 3 aisles (rotated along Z)
  const rackSpots: Array<{ id: string; x: number; z: number }> = [
    { id: 'wh-rack-w1', x: 11.0, z: -21.0 },
    { id: 'wh-rack-w2', x: 11.0, z: -29.0 },
    { id: 'wh-rack-c1', x: 21.0, z: -23.5 },
    { id: 'wh-rack-c2', x: 21.0, z: -31.0 },
    { id: 'wh-rack-e1', x: 31.0, z: -21.0 },
    { id: 'wh-rack-e2', x: 31.0, z: -29.0 },
  ];

  rackSpots.forEach((r) => {
    placeProp(group, collision, r.id, createWarehouseRack(palette, 6.2), r.x, r.z, Math.PI / 2);
  });

  // InstancedMesh for Warehouse cardboard boxes & wooden pallets across all rack levels!
  const boxTransforms: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = [];
  const palletTransforms: Array<{ x: number; y: number; z: number }> = [];

  rackSpots.forEach((r) => {
    [1.46, 3.06, 4.66].forEach((tierY) => {
      [-1.9, 0, 1.9].forEach((dz, idx) => {
        palletTransforms.push({ x: r.x, y: tierY + 0.06, z: r.z + dz });
        boxTransforms.push({
          x: r.x,
          y: tierY + 0.5,
          z: r.z + dz,
          sx: 0.92 + (idx % 2) * 0.14,
          sy: 0.74 + ((idx + 1) % 2) * 0.16,
          sz: 1.35,
        });
      });
    });
  });

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const instancedBoxes = new THREE.InstancedMesh(boxGeo, palette.boxLabel, boxTransforms.length);
  instancedBoxes.castShadow = true;
  instancedBoxes.receiveShadow = true;
  const dummy = new THREE.Object3D();

  boxTransforms.forEach((b, i) => {
    dummy.position.set(b.x, b.y, b.z);
    dummy.scale.set(b.sx, b.sy, b.sz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    instancedBoxes.setMatrixAt(i, dummy.matrix);
  });
  instancedBoxes.instanceMatrix.needsUpdate = true;
  group.add(instancedBoxes);

  const palletGeo = new THREE.BoxGeometry(1.15, 0.12, 1.5);
  const instancedPallets = new THREE.InstancedMesh(palletGeo, palette.wood, palletTransforms.length);
  instancedPallets.castShadow = true;
  instancedPallets.receiveShadow = true;
  palletTransforms.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    instancedPallets.setMatrixAt(i, dummy.matrix);
  });
  instancedPallets.instanceMatrix.needsUpdate = true;
  group.add(instancedPallets);

  // Forklifts & Flatbed carts in aisles
  placeProp(group, collision, 'wh-forklift-1', createForklift(palette), 16.0, -25.0, Math.PI * 0.12);
  placeProp(group, collision, 'wh-forklift-2', createForklift(palette), 26.2, -33.5, -Math.PI * 0.75);
  placeProp(group, collision, 'wh-cart-1', createFlatbedCart(palette), 15.6, -18.5, Math.PI / 3);
  placeProp(group, collision, 'wh-cart-2', createFlatbedCart(palette), 26.4, -20.0, -Math.PI / 4);

  root.add(group);
}

function buildCheckoutHall(
  root: THREE.Group,
  palette: MaterialPalette,
  collision: CollisionManager,
): void {
  const group = new THREE.Group();
  group.name = 'CheckoutHall';
  const { minX, maxX, minZ, maxZ, height } = WORLD_ZONES.checkout;
  const w = maxX - minX; // 28
  const d = maxZ - minZ; // 10
  const cx = (minX + maxX) / 2; // 21
  const cz = (minZ + maxZ) / 2; // 19

  addBox(group, collision, 'chk-floor', cx, -0.5, cz, w, 1.0, d, palette.floor, { castShadow: false });
  addBox(group, collision, 'chk-ceiling', cx, height + 0.5, cz, w, 1.0, d, palette.ceiling, {
    castShadow: false,
    receiveShadow: false,
  });

  // Lights
  [12, 21, 30].forEach((x) => {
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.6), palette.lightPanel);
    fixture.position.set(x, height - 0.04, cz);
    group.add(fixture);
  });

  // West & East walls (inset slightly from z=14 and z=24 partitions to avoid coplanar caps)
  addWallSegment(group, collision, 'chk-wall-west', minX - 0.15, cz, 0.3, d - 0.02, height, palette.wall, palette);
  addWallSegment(group, collision, 'chk-wall-east', maxX + 0.15, cz, 0.3, d - 0.02, height, palette.wall, palette);

  // South exterior store facade wall (z = +24) with wide open Main Entrance x in [18, 24]
  addWallSegment(group, collision, 'chk-front-w', 12.5, maxZ + 0.15, 11, 0.3, height, palette.ikeaBlue, palette, 0, false); // [7, 18]
  addWallSegment(group, collision, 'chk-front-e', 29.5, maxZ + 0.15, 11, 0.3, height, palette.ikeaBlue, palette, 0, false); // [24, 35]
  addWallSegment(group, collision, 'chk-front-lintel', 21, maxZ + 0.15, 5.98, 0.3, height - 3.6, palette.ikeaBlue, palette, 3.6, false);

  // 4 Checkout lanes with clear walkthrough aisles between them
  [12.0, 16.5, 25.5, 30.0].forEach((x, idx) => {
    placeProp(group, collision, `chk-lane-${idx + 1}`, createCheckoutLane(palette, idx + 1), x, 19.0, 0);
  });

  // Shopping carts near entrance
  placeProp(group, collision, 'chk-cart-1', createShoppingCart(palette), 9.2, 21.5, 0.2);
  placeProp(group, collision, 'chk-cart-2', createShoppingCart(palette), 9.2, 22.6, 0.2);
  placeProp(group, collision, 'chk-cart-3', createShoppingCart(palette), 33.2, 21.5, -0.2);

  root.add(group);
}

function buildParkingLot(
  root: THREE.Group,
  palette: MaterialPalette,
  collision: CollisionManager,
): void {
  const group = new THREE.Group();
  group.name = 'OutdoorParkingLot';
  const { minX, maxX, minZ, maxZ } = WORLD_ZONES.parkingLot;
  const w = maxX - minX; // 58
  const d = maxZ - minZ; // 28
  const cx = (minX + maxX) / 2; // 17
  const cz = (minZ + maxZ) / 2; // 38

  // Asphalt surface
  addBox(group, collision, 'parking-asphalt', cx, -0.5, cz, w, 1.0, d, palette.asphalt, {
    castShadow: false,
  });

  // Store sidewalk apron along z [24, 27.5]
  const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(36, 0.08, 3.5), palette.sidewalk);
  sidewalk.position.set(21, 0.04, 25.75);
  sidewalk.receiveShadow = true;
  group.add(sidewalk);

  // Iconic IKEA Store Exterior Facade (non-overlapping vertical stack above y = 5.5)
  const yellowBand = new THREE.Mesh(new THREE.BoxGeometry(28.6, 0.44, 0.36), palette.ikeaYellow);
  yellowBand.position.set(21, 5.72, minZ + 0.15);
  group.add(yellowBand);

  const facadeTop = new THREE.Mesh(new THREE.BoxGeometry(28.6, 3.0, 0.36), palette.ikeaBlue);
  facadeTop.position.set(21, 7.44, minZ + 0.15);
  facadeTop.castShadow = true;
  group.add(facadeTop);

  const logoSign = new THREE.Mesh(new THREE.BoxGeometry(9.6, 2.7, 0.18), palette.ikeaFacadeLogo);
  logoSign.position.set(21, 7.45, minZ + 0.43);
  group.add(logoSign);

  // Entrance canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.26, 2.8), palette.ikeaYellow);
  canopy.position.set(21, 3.7, minZ + 1.4);
  canopy.castShadow = true;
  group.add(canopy);

  // InstancedMesh for painted parking bay lines
  const bayXs = [-4, 0, 4, 8, 12, 28, 32, 36, 40];
  const lineGeo = new THREE.BoxGeometry(0.16, 0.02, 5.2);
  const lineMesh = new THREE.InstancedMesh(lineGeo, palette.parkingLine, bayXs.length * 2);
  lineMesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let idx = 0;
  [33.5, 43.5].forEach((z) => {
    bayXs.forEach((x) => {
      dummy.position.set(x, 0.015, z);
      dummy.updateMatrix();
      lineMesh.setMatrixAt(idx++, dummy.matrix);
    });
  });
  lineMesh.instanceMatrix.needsUpdate = true;
  group.add(lineMesh);

  // Parked Low-Poly Cars (Kfir's personal drivable car is spawned dynamically by VehicleManager at 14, 0, 33.5)
  placeProp(group, collision, 'car-2', createParkedCar(palette, palette.carColors[1]), 2.0, 33.5, Math.PI);
  placeProp(group, collision, 'car-3', createParkedCar(palette, palette.carColors[2]), 30.0, 33.5, 0);
  placeProp(group, collision, 'car-4', createParkedCar(palette, palette.carColors[3]), 38.0, 33.5, Math.PI);
  placeProp(group, collision, 'car-5', createParkedCar(palette, palette.carColors[4]), 6.0, 43.5, 0);
  placeProp(group, collision, 'car-6', createParkedCar(palette, palette.carColors[5]), 34.0, 43.5, Math.PI);

  // Streetlights & Low-Poly Trees along perimeter
  [0, 17, 34].forEach((x, i) => {
    placeProp(group, collision, `lamp-${i}`, createStreetLamp(palette), x, 38.5, 0);
  });

  [
    [-9.5, 26.5],
    [-9.5, 36.0],
    [-9.5, 46.5],
    [43.5, 26.5],
    [43.5, 36.0],
    [43.5, 46.5],
  ].forEach(([x, z], i) => {
    placeProp(group, collision, `tree-${i}`, createLowPolyTree(palette), x, z, i * 0.7);
  });

  // Green perimeter border & invisible boundary walls so player cannot walk off the map
  const grassStrip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 2.2), palette.grass);
  grassStrip.position.set(cx, 0.03, maxZ - 1.1);
  grassStrip.receiveShadow = true;
  group.add(grassStrip);

  addBox(group, collision, 'parking-bound-s', cx, 1.5, maxZ + 0.25, w, 3, 0.5, palette.metalDark);
  addBox(group, collision, 'parking-bound-w', minX - 0.25, 1.5, cz, 0.5, 3, d, palette.metalDark);
  addBox(group, collision, 'parking-bound-e', maxX + 0.25, 1.5, cz, 0.5, 3, d, palette.metalDark);
  // North boundary wings outside the store building (x < 7 and x > 35 at z = 24)
  addBox(group, collision, 'parking-bound-nw', -2.5, 1.5, minZ - 0.25, 19, 3, 0.5, palette.grass);
  addBox(group, collision, 'parking-bound-ne', 40.5, 1.5, minZ - 0.25, 11, 3, 0.5, palette.grass);

  root.add(group);
}
