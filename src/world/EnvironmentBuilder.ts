import * as THREE from 'three';
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
  createRug,
  createShoppingCart,
  createSofa,
  createStreetLamp,
} from '../assets/environments/IkeaFurnitureAssets';
import type { MaterialPalette } from '../assets/materials/Palette';
import { WORLD_ZONES } from '../config/constants';
import type { CollisionManager } from './CollisionManager';
import { addBox, addWallSegment, placeProp } from './WorldGeometryHelpers';

const FLOOR2_HEIGHT = 5.8;
const STORE_TWO_STORY_HEIGHT = 10.6;

/**
 * Builds the connected F1 IKEA Rishon LeZion store world:
 * - F1 Market Hall (x [7..45], z [-14..14]) & Central Atrium Vertical Hub
 *   (Up Escalator, Down Escalator, Wide Staircase to Floor 2 Y = 5.8m)
 * - High-Bay Self-Serve Warehouse (9m ceiling, InstancedMesh racking, clear M01/M02/M04/M06 aisle)
 * - Checkout Hall (x [7..45], z [14..24]) & Outdoor Parking Lot
 */
export function buildStoreWorld(
  palette: MaterialPalette,
  collision: CollisionManager,
): THREE.Group {
  const worldGroup = new THREE.Group();
  worldGroup.name = 'IkeaStoreWorld';

  buildMarketHallAndAtrium(worldGroup, palette, collision);
  buildWarehouse(worldGroup, palette, collision);
  buildCheckoutHall(worldGroup, palette, collision);
  buildParkingLot(worldGroup, palette, collision);

  return worldGroup;
}

function buildMarketHallAndAtrium(
  root: THREE.Group,
  palette: MaterialPalette,
  collision: CollisionManager,
): void {
  const group = new THREE.Group();
  group.name = 'MarketHallAndAtrium';
  const { minX, maxX, minZ, maxZ } = WORLD_ZONES.showroom;
  const w = maxX - minX; // 38 (x [7..45])
  const d = maxZ - minZ; // 28 (z [-14..14])
  const cx = (minX + maxX) / 2; // 26
  const cz = (minZ + maxZ) / 2; // 0

  // Floor 1 Market Hall slab (Y = 0) with explicit Floor 1 SurfaceMeta
  // Note: Floor 2 slabs at Y = 5.4..5.8 form the F1 ceiling everywhere outside the Central Atrium opening.
  addBox(group, collision, 'showroom-floor', cx, -0.5, cz, w, 1.0, d, palette.showroomFloor, {
    castShadow: false,
    surfaceMeta: { floor: 1, zoneId: 'Market Hall' },
  });

  // Under-F2 F1 recessed lights (avoid Central Atrium void x [19.8..30.2], z [2..12.6])
  [-8, -1, 10].forEach((z) => {
    [13, 37].forEach((x) => {
      const light = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 0.65), palette.lightPanel);
      light.position.set(x, 5.34, z);
      group.add(light);
    });
  });

  // Full two-story East exterior wall (x = 45)
  addWallSegment(
    group,
    collision,
    'showroom-wall-east',
    maxX + 0.15,
    cz,
    0.3,
    d,
    STORE_TWO_STORY_HEIGHT,
    palette.wall,
    palette,
  );

  // Full two-story West wall segments flanking Control Room & Staff Break Room (x = 7)
  // Note: Keep z in [-6.3, 6.3] open on F1 for Control Room doorway, and upper wall baseY=4.6..10.6 encloses F2 West side.
  addWallSegment(
    group,
    collision,
    'showroom-wall-west-n',
    minX - 0.15,
    -10.15,
    0.3,
    7.68,
    STORE_TWO_STORY_HEIGHT,
    palette.wall,
    palette,
  );
  addWallSegment(
    group,
    collision,
    'showroom-wall-west-s',
    minX - 0.15,
    10.15,
    0.3,
    7.68,
    STORE_TWO_STORY_HEIGHT,
    palette.wall,
    palette,
  );
  addWallSegment(
    group,
    collision,
    'showroom-wall-west-upper',
    minX - 0.15,
    0,
    0.3,
    12.6,
    STORE_TWO_STORY_HEIGHT - 4.6,
    palette.wall,
    palette,
    4.6,
    false,
  );

  // North partition (z = -14) to High-Bay Warehouse with wide passage x [17, 25]
  addWallSegment(
    group,
    collision,
    'showroom-north-w',
    12,
    minZ - 0.15,
    10,
    0.3,
    STORE_TWO_STORY_HEIGHT,
    palette.wall,
    palette,
  ); // [7..17]
  addWallSegment(
    group,
    collision,
    'showroom-north-e',
    35,
    minZ - 0.15,
    20,
    0.3,
    STORE_TWO_STORY_HEIGHT,
    palette.wall,
    palette,
  ); // [25..45]
  addWallSegment(
    group,
    collision,
    'showroom-north-lintel',
    21,
    minZ - 0.15,
    7.98,
    0.3,
    STORE_TWO_STORY_HEIGHT - 3.4,
    palette.wall,
    palette,
    3.4,
    false,
  );

  const whSign = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.0, 0.14), palette.warehouseSign);
  whSign.position.set(21, 4.1, minZ + 0.12);
  group.add(whSign);

  // South F1 partition (z = +14) to Checkout ending at F2 underside (5.4m), passage x [15.5, 26.5]
  addWallSegment(group, collision, 'showroom-south-w', 11.25, maxZ + 0.15, 8.5, 0.3, 5.4, palette.wall, palette); // [7..15.5]
  addWallSegment(group, collision, 'showroom-south-e', 35.75, maxZ + 0.15, 18.5, 0.3, 5.4, palette.wall, palette); // [26.5..45]
  addWallSegment(
    group,
    collision,
    'showroom-south-lintel',
    21,
    maxZ + 0.15,
    10.98,
    0.3,
    5.4 - 3.6,
    palette.wall,
    palette,
    3.6,
    false,
  );

  const chkSign = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.0, 0.14), palette.checkoutSign);
  chkSign.position.set(21, 4.1, maxZ - 0.12);
  group.add(chkSign);

  const srSign = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 4.4), palette.showroomSign);
  srSign.position.set(minX + 0.2, 4.1, 3.6);
  group.add(srSign);

  // Floor navigation arrows (F1 Market Hall flow around Central Atrium)
  const addArrow = (x: number, z: number, rotY: number): void => {
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), palette.floorArrow);
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = rotY;
    arrow.position.set(x, 0.025, z);
    arrow.receiveShadow = true;
    group.add(arrow);
  };
  addArrow(9.5, 3.6, -Math.PI / 2); // Point East out of Control Room
  addArrow(17.5, 3.6, 0); // North toward Warehouse corridor
  addArrow(21.0, -7.5, 0); // North toward Warehouse
  addArrow(18.2, 10.5, Math.PI); // South toward Checkout (clear West of Atrium)
  addArrow(33.5, 6.0, -Math.PI / 2); // East into Market Hall Lighting & Kitchens wing

  // Central Atrium Vertical Circulation Hub (Escalator Up, Escalator Down, Wide Staircase)
  buildVerticalHub(group, palette, collision);

  // --- Market Hall Vignettes (West side kept west of x=16, East side placed x in [32..43]) ---
  const livingRug = createRug(5.0, 4.0, palette.rugBeige);
  livingRug.position.set(11.8, 0.02, 8.6);
  group.add(livingRug);
  placeProp(group, collision, 'sr-sofa', createSofa(palette), 11.8, 6.9, 0);
  placeProp(group, collision, 'sr-coffee-table', createCoffeeTable(palette), 11.8, 8.7, 0);
  placeProp(group, collision, 'sr-poang', createPoangChair(palette), 14.0, 8.8, -Math.PI * 0.65);
  placeProp(group, collision, 'sr-kallax', createKallaxUnit(palette), 9.2, 8.7, Math.PI / 2);
  const poangTag = createProductPlacard(palette, 'POÄNG');
  poangTag.position.set(14.9, 0, 9.8);
  const kallaxTag = createProductPlacard(palette, 'KALLAX');
  kallaxTag.position.set(9.4, 0, 10.5);
  group.add(poangTag, kallaxTag);

  const bedRug = createRug(4.8, 4.4, palette.ikeaBlue);
  bedRug.position.set(12.2, 0.02, -8.5);
  group.add(bedRug);
  placeProp(group, collision, 'sr-malm-bed', createMalmBed(palette), 12.2, -9.2, 0);
  placeProp(group, collision, 'sr-billy', createBillyBookcase(palette), 9.0, -8.8, Math.PI / 2);
  const malmTag = createProductPlacard(palette, 'MALM');
  malmTag.position.set(14.6, 0, -7.2);
  const billyTag = createProductPlacard(palette, 'BILLY');
  billyTag.position.set(9.4, 0, -6.7);
  group.add(malmTag, billyTag);

  // East Market Hall Kitchen & Storage Bestsellers Wing (x [32..43])
  placeProp(group, collision, 'sr-kitchen', createKitchenDisplay(palette), 40.5, 8.2, -Math.PI / 2);
  placeProp(group, collision, 'sr-east-kallax-1', createKallaxUnit(palette), 35.5, -5.5, 0);
  placeProp(group, collision, 'sr-east-kallax-2', createKallaxUnit(palette), 41.0, -5.5, Math.PI);
  placeProp(group, collision, 'sr-east-billy', createBillyBookcase(palette), 42.8, -1.5, -Math.PI / 2);

  root.add(group);
}

function buildVerticalHub(
  parent: THREE.Group,
  palette: MaterialPalette,
  collision: CollisionManager,
): void {
  const hub = new THREE.Group();
  hub.name = 'CentralAtriumVerticalHub';

  const minZ = 2.0;
  const maxZ = 12.0;
  const run = maxZ - minZ; // 10.0m
  const rise = FLOOR2_HEIGHT; // 5.8m
  const slopeAngle = Math.atan2(rise, run);
  const hyp = Math.hypot(run, rise);
  const centerZ = (minZ + maxZ) / 2; // 7.0
  const centerY = rise / 2; // 2.9

  // Walkable slopes: Up Escalator (x 20.5..22.7), Down Escalator (x 23.3..25.5), Wide Stairs (x 26.2..29.6)
  collision.addSlope({
    id: 'atrium-escalator-up',
    minX: 20.5,
    maxX: 22.7,
    minZ,
    maxZ,
    axis: 'z',
    yLow: 0,
    yHigh: rise,
    lowSide: 'max',
    conveyorVelocity: new THREE.Vector3(0, 0, -1.8),
    surfaceMeta: { floor: 'transition', fromFloor: 1, toFloor: 2 },
  });

  collision.addSlope({
    id: 'atrium-escalator-down',
    minX: 23.3,
    maxX: 25.5,
    minZ,
    maxZ,
    axis: 'z',
    yLow: 0,
    yHigh: rise,
    lowSide: 'max',
    conveyorVelocity: new THREE.Vector3(0, 0, 1.8),
    surfaceMeta: { floor: 'transition', fromFloor: 1, toFloor: 2 },
  });

  collision.addSlope({
    id: 'atrium-wide-stairs',
    minX: 26.2,
    maxX: 29.6,
    minZ,
    maxZ,
    axis: 'z',
    yLow: 0,
    yHigh: rise,
    lowSide: 'max',
    surfaceMeta: { floor: 'transition', fromFloor: 1, toFloor: 2 },
  });

  // Solid side guardrails flanking each lane cleanly inside [2.15, 11.85] so entrances remain wide open
  const railXs = [20.32, 23.0, 25.85, 29.78];
  railXs.forEach((rx, idx) => {
    addBox(hub, collision, `atrium-rail-col-${idx}`, rx, 3.45, centerZ, 0.24, 6.9, 9.7, palette.metalDark, {
      castShadow: false,
      blocksCamera: false,
    });
    const glassBalustrade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, hyp), palette.glass);
    glassBalustrade.position.set(rx, centerY + 0.58, centerZ);
    glassBalustrade.rotation.x = slopeAngle;
    const capRail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, hyp), palette.metalDark);
    capRail.position.set(rx, centerY + 1.14, centerZ);
    capRail.rotation.x = slopeAngle;
    hub.add(glassBalustrade, capRail);
  });

  // Escalator Visual Trusses & Treads (Up + Down)
  [21.6, 24.4].forEach((ex, i) => {
    const truss = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.36, hyp), palette.metalDark);
    truss.position.set(ex, centerY - 0.19, centerZ);
    truss.rotation.x = slopeAngle;
    hub.add(truss);

    // Individual ribbed tread steps along incline
    const stepCount = 24;
    for (let s = 0; s < stepCount; s++) {
      const t = (s + 0.5) / stepCount;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.09, 0.44), palette.metalGrey);
      tread.position.set(ex, t * rise - 0.02, maxZ - t * run);
      tread.receiveShadow = true;
      hub.add(tread);
    }

    // Glowing directional floor plate at F1 entry / F2 top
    const plateColor = i === 0 ? 0x22c55e : 0x3b82f6;
    const plateMat = new THREE.MeshStandardMaterial({
      color: plateColor,
      emissive: plateColor,
      emissiveIntensity: 0.7,
      roughness: 0.4,
    });
    const bottomPlate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.45), plateMat);
    bottomPlate.position.set(ex, 0.02, maxZ + 0.25);
    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.45), plateMat);
    topPlate.position.set(ex, rise + 0.02, minZ - 0.25);
    hub.add(bottomPlate, topPlate);
  });

  // Wide Architectural Staircase Visual Treads (x = 27.9)
  const stringer = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.32, hyp), palette.darkWood);
  stringer.position.set(27.9, centerY - 0.18, centerZ);
  stringer.rotation.x = slopeAngle;
  hub.add(stringer);

  const stairCount = 22;
  for (let s = 0; s < stairCount; s++) {
    const t = (s + 0.5) / stairCount;
    const step = new THREE.Mesh(new THREE.BoxGeometry(3.25, rise / stairCount, run / stairCount + 0.06), palette.wood);
    step.position.set(27.9, t * rise - (rise / stairCount) * 0.45, maxZ - t * run);
    step.receiveShadow = true;
    step.castShadow = true;
    hub.add(step);
  }

  parent.add(hub);
}

function buildWarehouse(
  root: THREE.Group,
  palette: MaterialPalette,
  collision: CollisionManager,
): void {
  const group = new THREE.Group();
  group.name = 'SelfServeWarehouse';
  const { minX, maxX, minZ, maxZ, height } = WORLD_ZONES.warehouse;
  const w = maxX - minX; // 38 (x [7..45])
  const d = maxZ - minZ; // 30 (z [-44..-14])
  const cx = (minX + maxX) / 2; // 26
  const cz = (minZ + maxZ) / 2; // -29

  addBox(group, collision, 'wh-floor', cx, -0.5, cz, w, 1.0, d, palette.warehouseFloor, {
    castShadow: false,
    surfaceMeta: { floor: 1, zoneId: 'Warehouse' },
  });
  addBox(group, collision, 'wh-ceiling', cx, height + 0.5, cz, w, 1.0, d, palette.ceiling, {
    castShadow: false,
    receiveShadow: false,
  });

  // High-bay luminaire grid (3 rows x 3 cols)
  [-38, -29, -20].forEach((z) => {
    [13, 22, 34].forEach((x) => {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 0.75), palette.lightPanel);
      fixture.position.set(x, height - 0.08, z);
      group.add(fixture);
    });
  });

  // Perimeter walls (South partition already shared with Market Hall/Showroom at z = -14)
  addWallSegment(group, collision, 'wh-wall-north', cx, minZ - 0.15, w - 0.02, 0.3, height, palette.wall, palette);
  addWallSegment(group, collision, 'wh-wall-west', minX - 0.15, cz, 0.3, d - 0.02, height, palette.wall, palette);
  addWallSegment(group, collision, 'wh-wall-east', maxX + 0.15, cz, 0.3, d - 0.02, height, palette.wall, palette);

  // Loading dock shutters on North wall
  [14, 28, 39].forEach((x) => {
    const shutter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.2, 0.12), palette.metalGrey);
    shutter.position.set(x, 2.1, minZ + 0.08);
    const hazard = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.36, 0.14), palette.hazardStripe);
    hazard.position.set(x, 4.38, minZ + 0.09);
    group.add(shutter, hazard);
  });

  // Hazard stripe at Warehouse South entrance
  const entranceStripe = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 0.65), palette.hazardStripe);
  entranceStripe.rotation.x = -Math.PI / 2;
  entranceStripe.position.set(21, 0.025, maxZ - 0.4);
  group.add(entranceStripe);

  // Expanded High-Bay Racks using InstancedMesh batching, leaving x in [13.5, 25.5] wide clear central corridor!
  const rackSpots: Array<{ id: string; x: number; z: number }> = [
    { id: 'wh-rack-w1', x: 10.5, z: -20.0 },
    { id: 'wh-rack-w2', x: 10.5, z: -28.0 },
    { id: 'wh-rack-w3', x: 10.5, z: -36.0 },
    { id: 'wh-rack-m1', x: 29.0, z: -20.0 },
    { id: 'wh-rack-m2', x: 29.0, z: -28.0 },
    { id: 'wh-rack-m3', x: 29.0, z: -36.0 },
    { id: 'wh-rack-e1', x: 39.5, z: -20.0 },
    { id: 'wh-rack-e2', x: 39.5, z: -28.0 },
    { id: 'wh-rack-e3', x: 39.5, z: -36.0 },
  ];

  // Register solid collision footprint for every rack bay (1.6m x 7.4m x 6.2m)
  rackSpots.forEach((r) => {
    collision.addBox(
      r.id,
      new THREE.Vector3(r.x - 0.82, 0, r.z - 3.15),
      new THREE.Vector3(r.x + 0.82, 7.2, r.z + 3.15),
      true,
    );
  });

  // 1) Instanced Rack Uprights (6 posts per rack = 54 instances)
  const dummy = new THREE.Object3D();
  const rackHeight = 6.9;
  const uprightGeo = new THREE.BoxGeometry(0.12, rackHeight, 0.12);
  const instancedUprights = new THREE.InstancedMesh(uprightGeo, palette.metalGrey, rackSpots.length * 6);
  instancedUprights.castShadow = true;
  instancedUprights.receiveShadow = true;
  let uIdx = 0;
  rackSpots.forEach((r) => {
    [-0.72, 0.72].forEach((dx) => {
      [-3.0, 0, 3.0].forEach((dz) => {
        dummy.position.set(r.x + dx, rackHeight / 2, r.z + dz);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        instancedUprights.setMatrixAt(uIdx++, dummy.matrix);
      });
    });
  });
  instancedUprights.instanceMatrix.needsUpdate = true;
  group.add(instancedUprights);

  // 2) Instanced Orange Cross-Beams (4 tiers x 2 rails per bay = 72 instances)
  const tiers = [1.46, 3.06, 4.66, 6.26];
  const beamGeo = new THREE.BoxGeometry(0.1, 0.14, 6.18);
  const instancedBeams = new THREE.InstancedMesh(beamGeo, palette.rackOrange, rackSpots.length * tiers.length * 2);
  instancedBeams.castShadow = true;
  instancedBeams.receiveShadow = true;
  let bIdx = 0;
  rackSpots.forEach((r) => {
    tiers.forEach((tierY) => {
      [-0.72, 0.72].forEach((dx) => {
        dummy.position.set(r.x + dx, tierY, r.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instancedBeams.setMatrixAt(bIdx++, dummy.matrix);
      });
    });
  });
  instancedBeams.instanceMatrix.needsUpdate = true;
  group.add(instancedBeams);

  // 3) Instanced Pallets & Cardboard Boxes (9 racks x 4 tiers x 3 slots = 108 instances each)
  const slotCount = rackSpots.length * tiers.length * 3;
  const palletGeo = new THREE.BoxGeometry(1.15, 0.12, 1.5);
  const instancedPallets = new THREE.InstancedMesh(palletGeo, palette.wood, slotCount);
  instancedPallets.castShadow = true;
  instancedPallets.receiveShadow = true;

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const instancedBoxes = new THREE.InstancedMesh(boxGeo, palette.boxLabel, slotCount);
  instancedBoxes.castShadow = true;
  instancedBoxes.receiveShadow = true;

  let sIdx = 0;
  rackSpots.forEach((r) => {
    tiers.forEach((tierY) => {
      [-1.9, 0, 1.9].forEach((dz, slotIdx) => {
        dummy.position.set(r.x, tierY + 0.06, r.z + dz);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instancedPallets.setMatrixAt(sIdx, dummy.matrix);

        dummy.position.set(r.x, tierY + 0.5, r.z + dz);
        dummy.scale.set(0.92 + (slotIdx % 2) * 0.14, 0.74 + ((slotIdx + 1) % 2) * 0.16, 1.35);
        dummy.updateMatrix();
        instancedBoxes.setMatrixAt(sIdx, dummy.matrix);
        sIdx++;
      });
    });
  });
  instancedPallets.instanceMatrix.needsUpdate = true;
  instancedBoxes.instanceMatrix.needsUpdate = true;
  group.add(instancedPallets, instancedBoxes);

  // Forklifts & Flatbed carts parked clearly outside M01/M04 active lanes
  placeProp(group, collision, 'wh-forklift-1', createForklift(palette), 15.8, -25.0, Math.PI * 0.12);
  placeProp(group, collision, 'wh-forklift-2', createForklift(palette), 34.2, -33.5, -Math.PI * 0.75);
  placeProp(group, collision, 'wh-cart-1', createFlatbedCart(palette), 15.6, -18.5, Math.PI / 3);
  placeProp(group, collision, 'wh-cart-2', createFlatbedCart(palette), 34.0, -19.5, -Math.PI / 4);

  root.add(group);
}

function buildCheckoutHall(
  root: THREE.Group,
  palette: MaterialPalette,
  collision: CollisionManager,
): void {
  const group = new THREE.Group();
  group.name = 'CheckoutHall';
  const { minX, maxX, minZ, maxZ } = WORLD_ZONES.checkout;
  const w = maxX - minX; // 38 (x [7..45])
  const d = maxZ - minZ; // 10 (z [14..24])
  const cx = (minX + maxX) / 2; // 26
  const cz = (minZ + maxZ) / 2; // 19

  addBox(group, collision, 'chk-floor', cx, -0.5, cz, w, 1.0, d, palette.floor, {
    castShadow: false,
    surfaceMeta: { floor: 1, zoneId: 'Checkout' },
  });

  // Lights suspended under Floor 2 slab (y = 5.4)
  [12, 21, 31, 40].forEach((x) => {
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.6), palette.lightPanel);
    fixture.position.set(x, 5.34, cz);
    group.add(fixture);
  });

  // Two-story West & East enclosure walls
  addWallSegment(group, collision, 'chk-wall-west', minX - 0.15, cz, 0.3, d - 0.02, STORE_TWO_STORY_HEIGHT, palette.wall, palette);
  addWallSegment(group, collision, 'chk-wall-east', maxX + 0.15, cz, 0.3, d - 0.02, STORE_TWO_STORY_HEIGHT, palette.wall, palette);

  // Two-story South exterior facade (z = +24) with wide open Main Entrance x in [18, 24]
  addWallSegment(group, collision, 'chk-front-w', 12.5, maxZ + 0.15, 11, 0.3, STORE_TWO_STORY_HEIGHT, palette.ikeaBlue, palette, 0, false); // [7..18]
  addWallSegment(group, collision, 'chk-front-e', 34.5, maxZ + 0.15, 21, 0.3, STORE_TWO_STORY_HEIGHT, palette.ikeaBlue, palette, 0, false); // [24..45]
  addWallSegment(
    group,
    collision,
    'chk-front-lintel',
    21,
    maxZ + 0.15,
    5.98,
    0.3,
    STORE_TWO_STORY_HEIGHT - 3.6,
    palette.ikeaBlue,
    palette,
    3.6,
    false,
  );

  // 6 Checkout lanes spanning Checkout Hall with wide central entrance promenade [16.5, 24.5]
  [10.2, 14.2, 26.8, 31.2, 35.8, 40.2].forEach((x, idx) => {
    placeProp(group, collision, `chk-lane-${idx + 1}`, createCheckoutLane(palette, idx + 1), x, 19.0, 0);
  });

  placeProp(group, collision, 'chk-cart-1', createShoppingCart(palette), 8.8, 21.5, 0.2);
  placeProp(group, collision, 'chk-cart-2', createShoppingCart(palette), 8.8, 22.6, 0.2);
  placeProp(group, collision, 'chk-cart-3', createShoppingCart(palette), 42.8, 21.5, -0.2);

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
  const w = maxX - minX; // 74 (x [-18..56])
  const d = maxZ - minZ; // 50 (z [24..74])
  const cx = (minX + maxX) / 2; // 19
  const cz = (minZ + maxZ) / 2; // 49

  addBox(group, collision, 'parking-asphalt', cx, -0.5, cz, w, 1.0, d, palette.asphalt, {
    castShadow: false,
    surfaceMeta: { floor: 1, zoneId: 'Parking Lot' },
  });

  // Store sidewalk apron along z [24, 27.5]
  const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(38, 0.08, 3.5), palette.sidewalk);
  sidewalk.position.set(26, 0.04, 25.75);
  sidewalk.receiveShadow = true;
  group.add(sidewalk);

  // Iconic IKEA Rishon LeZion Facade + Upper Floor 2 Glazed Curtain Windows
  const yellowBand = new THREE.Mesh(new THREE.BoxGeometry(38.6, 0.44, 0.36), palette.ikeaYellow);
  yellowBand.position.set(26, 10.82, minZ + 0.15);
  group.add(yellowBand);

  const facadeTop = new THREE.Mesh(new THREE.BoxGeometry(38.6, 2.8, 0.36), palette.ikeaBlue);
  facadeTop.position.set(26, 12.44, minZ + 0.15);
  facadeTop.castShadow = true;
  group.add(facadeTop);

  // Upper floor architectural curtain glass spans flanking entrance canopy
  [
    { x: 12.5, w: 7.4 },
    { x: 34.5, w: 15.0 },
  ].forEach((win) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(win.w + 0.3, 3.4, 0.12), palette.metalDark);
    frame.position.set(win.x, 7.8, minZ + 0.24);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(win.w, 3.1, 0.08), palette.glass);
    pane.position.set(win.x, 7.8, minZ + 0.29);
    group.add(frame, pane);
  });

  const logoSign = new THREE.Mesh(new THREE.BoxGeometry(10.4, 2.5, 0.18), palette.ikeaFacadeLogo);
  logoSign.position.set(21, 12.4, minZ + 0.43);
  group.add(logoSign);

  // Main Entrance canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.28, 3.1), palette.ikeaYellow);
  canopy.position.set(21, 3.7, minZ + 1.5);
  canopy.castShadow = true;
  group.add(canopy);

  // Steel safety bollards across Main Entrance (z = 25.0): passable on foot (gaps ~1.45m), impassable by cars
  [18.8, 20.25, 21.75, 23.2].forEach((bx, i) => {
    addBox(group, collision, `entrance-bollard-${i}`, bx, 0.45, 25.0, 0.28, 0.9, 0.28, palette.metalGrey);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 10), palette.ikeaYellow);
    tip.position.set(bx, 0.92, 25.0);
    group.add(tip);
  });

  // InstancedMesh for painted parking bay lines (Row A z=33.5, Row B z=43.0 west, Row C z=54.5 west — leaves [29..39, 42..54] open for Football Pitch)
  const rowABays = [-4, 0, 4, 8, 12, 16, 28, 32, 36, 40];
  const rowBaysWest = [-4, 0, 4, 8, 12, 16, 20, 24];
  const lineEntries: Array<{ x: number; z: number }> = [];
  rowABays.forEach((x) => lineEntries.push({ x, z: 33.5 }));
  rowBaysWest.forEach((x) => {
    lineEntries.push({ x, z: 43.0 });
    lineEntries.push({ x, z: 54.5 });
  });

  const lineGeo = new THREE.BoxGeometry(0.16, 0.02, 5.2);
  const lineMesh = new THREE.InstancedMesh(lineGeo, palette.parkingLine, lineEntries.length);
  lineMesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  lineEntries.forEach((b, i) => {
    dummy.position.set(b.x, 0.015, b.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    lineMesh.setMatrixAt(i, dummy.matrix);
  });
  lineMesh.instanceMatrix.needsUpdate = true;
  group.add(lineMesh);

  // Connected 2-Lane Access Road Loop (South boulevard z [62..72], West lane x [-16..-9], East lane x [47..54])
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.88, flatShading: true });
  const southRoad = new THREE.Mesh(new THREE.BoxGeometry(70, 0.014, 10), roadMat);
  southRoad.position.set(19, 0.008, 67.0);
  southRoad.receiveShadow = true;
  const westRoad = new THREE.Mesh(new THREE.BoxGeometry(7, 0.014, 42), roadMat);
  westRoad.position.set(-12.5, 0.008, 45.0);
  westRoad.receiveShadow = true;
  const eastRoad = new THREE.Mesh(new THREE.BoxGeometry(7, 0.014, 42), roadMat);
  eastRoad.position.set(50.5, 0.008, 45.0);
  eastRoad.receiveShadow = true;
  group.add(southRoad, westRoad, eastRoad);

  // Dashed yellow centerline markings along 2-lane loop (InstancedMesh)
  const dashGeoX = new THREE.BoxGeometry(2.6, 0.02, 0.18);
  const southDashes = new THREE.InstancedMesh(dashGeoX, palette.ikeaYellow, 11);
  for (let i = 0; i < 11; i++) {
    dummy.position.set(-11 + i * 6.0, 0.02, 67.0);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    southDashes.setMatrixAt(i, dummy.matrix);
  }
  southDashes.instanceMatrix.needsUpdate = true;

  const dashGeoZ = new THREE.BoxGeometry(0.18, 0.02, 2.6);
  const sideDashes = new THREE.InstancedMesh(dashGeoZ, palette.ikeaYellow, 14);
  for (let i = 0; i < 7; i++) {
    const zPos = 29.0 + i * 5.8;
    dummy.position.set(-12.5, 0.02, zPos);
    dummy.updateMatrix();
    sideDashes.setMatrixAt(i, dummy.matrix);

    dummy.position.set(50.5, 0.02, zPos);
    dummy.updateMatrix();
    sideDashes.setMatrixAt(7 + i, dummy.matrix);
  }
  sideDashes.instanceMatrix.needsUpdate = true;
  group.add(southDashes, sideDashes);

  // Concrete median islands between Parking Lot and South Access Road (wide driveways open at x [2..20.5] & [28.5..37])
  [
    { id: 'road-curb-sw', x: -2.0, w: 8.0 },
    { id: 'road-curb-sc', x: 24.5, w: 8.0 },
    { id: 'road-curb-se', x: 41.5, w: 9.0 },
  ].forEach((c) => {
    addBox(group, collision, c.id, c.x, 0.09, 61.5, c.w, 0.18, 0.7, palette.sidewalk, {
      castShadow: false,
      blocksCamera: false,
    });
  });

  // Parked Low-Poly Customer Cars (Kfir's personal car spawns at 14, 0, 33.5; central z=46..51 promenade kept open)
  placeProp(group, collision, 'car-2', createParkedCar(palette, palette.carColors[1]), 2.0, 33.5, Math.PI);
  placeProp(group, collision, 'car-3', createParkedCar(palette, palette.carColors[2]), 30.0, 33.5, 0);
  placeProp(group, collision, 'car-4', createParkedCar(palette, palette.carColors[3]), 38.0, 33.5, Math.PI);
  placeProp(group, collision, 'car-5', createParkedCar(palette, palette.carColors[4]), 2.0, 55.0, 0);
  placeProp(group, collision, 'car-6', createParkedCar(palette, palette.carColors[5]), 14.0, 55.0, Math.PI);
  placeProp(group, collision, 'car-7', createParkedCar(palette, palette.carColors[1]), 22.0, 55.0, 0);

  // Parking & Boulevard Street Lamps
  [0, 17, 34].forEach((x, i) => {
    placeProp(group, collision, `lamp-${i}`, createStreetLamp(palette), x, 38.5, 0);
  });
  [-6, 16, 40].forEach((x, i) => {
    placeProp(group, collision, `road-lamp-${i}`, createStreetLamp(palette), x, 61.5, Math.PI);
  });

  // Landscaping trees around outer verge
  [
    [-16.8, 28.0],
    [-16.8, 46.0],
    [-16.8, 62.0],
    [54.8, 28.0],
    [54.8, 46.0],
    [54.8, 62.0],
  ].forEach(([x, z], i) => {
    placeProp(group, collision, `tree-${i}`, createLowPolyTree(palette), x, z, i * 0.7);
  });

  const grassStrip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 1.8), palette.grass);
  grassStrip.position.set(cx, 0.03, maxZ - 0.9);
  grassStrip.receiveShadow = true;
  group.add(grassStrip);

  addBox(group, collision, 'parking-bound-s', cx, 1.5, maxZ + 0.25, w, 3, 0.5, palette.metalDark);
  addBox(group, collision, 'parking-bound-w', minX - 0.25, 1.5, cz, 0.5, 3, d, palette.metalDark);
  addBox(group, collision, 'parking-bound-e', maxX + 0.25, 1.5, cz, 0.5, 3, d, palette.metalDark);
  // North boundary wings outside store building (x < 7 and x > 45 at z = 24)
  addBox(group, collision, 'parking-bound-nw', -5.5, 1.5, minZ - 0.25, 25, 3, 0.5, palette.grass);
  addBox(group, collision, 'parking-bound-ne', 50.5, 1.5, minZ - 0.25, 11, 3, 0.5, palette.grass);

  root.add(group);
}
