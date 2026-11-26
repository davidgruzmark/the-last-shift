import * as THREE from 'three';
import type { PropBuildResult } from './ControlRoomAssets';
import type { MaterialPalette, ProductName } from '../materials/Palette';

function setShadows(obj: THREE.Object3D, cast = true, receive = true): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

export function createProductPlacard(
  palette: MaterialPalette,
  product: ProductName,
): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.35, 6), palette.metalDark);
  pole.position.y = 0.675;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.52, 0.04), palette.productSigns[product]);
  board.position.y = 1.45;
  group.add(pole, board);
  setShadows(group);
  return group;
}

/** Stylized Low-Poly 3-seater IKEA sofa. */
export function createSofa(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.34, 0.92), palette.sofaBlue);
  base.position.y = 0.25;
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.56, 0.22), palette.sofaBlue);
  back.position.set(0, 0.64, -0.35);
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.92), palette.sofaBlue);
  leftArm.position.set(-1.04, 0.46, 0);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.92), palette.sofaBlue);
  rightArm.position.set(1.04, 0.46, 0);

  // Throw pillow (IKEA yellow accent)
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.14), palette.ikeaYellow);
  pillow.position.set(-0.68, 0.58, -0.14);
  pillow.rotation.z = 0.18;

  group.add(base, back, leftArm, rightArm, pillow);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(2.35, 0.95, 0.95),
    colliderOffset: new THREE.Vector3(0, 0.47, 0),
  };
}

/** Iconic POÄNG bentwood armchair. */
export function createPoangChair(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.78), palette.wood);
  frameL.position.set(-0.34, 0.34, 0);
  const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.78), palette.wood);
  frameR.position.set(0.34, 0.34, 0);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.66), palette.terracotta);
  seat.position.set(0, 0.38, 0.04);
  seat.rotation.x = -0.12;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.68, 0.12), palette.terracotta);
  back.position.set(0, 0.72, -0.26);
  back.rotation.x = -0.22;

  group.add(frameL, frameR, seat, back);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(0.8, 1.05, 0.82),
    colliderOffset: new THREE.Vector3(0, 0.52, 0),
  };
}

/** Low-poly LACK coffee table. */
export function createCoffeeTable(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.75), palette.wood);
  top.position.y = 0.42;
  const legGeo = new THREE.BoxGeometry(0.08, 0.4, 0.08);
  [
    [-0.56, -0.3],
    [0.56, -0.3],
    [-0.56, 0.3],
    [0.56, 0.3],
  ].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, palette.wood);
    leg.position.set(x, 0.2, z);
    group.add(leg);
  });
  group.add(top);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(1.3, 0.5, 0.75),
    colliderOffset: new THREE.Vector3(0, 0.25, 0),
  };
}

/** Flat decorative rug (no collision). */
export function createRug(width: number, depth: number, material: THREE.MeshStandardMaterial): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.02, depth), material);
  mesh.position.y = 0.01;
  mesh.receiveShadow = true;
  return mesh;
}

/** MALM bed with headboard, mattress & IKEA pillows. */
export function createMalmBed(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.32, 2.35), palette.darkWood);
  frame.position.y = 0.16;
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.05, 0.14), palette.darkWood);
  headboard.position.set(0, 0.525, -1.1);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.22, 2.15), palette.white);
  mattress.position.set(0, 0.38, 0.02);
  const duvet = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.12, 1.45), palette.ikeaBlue);
  duvet.position.set(0, 0.46, 0.38);
  const pillowL = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.42), palette.ikeaYellow);
  pillowL.position.set(-0.5, 0.54, -0.78);
  const pillowR = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.42), palette.ikeaYellow);
  pillowR.position.set(0.5, 0.54, -0.78);

  group.add(frame, headboard, mattress, duvet, pillowL, pillowR);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(2.12, 1.05, 2.38),
    colliderOffset: new THREE.Vector3(0, 0.52, 0),
  };
}

/** Tall BILLY bookcase with colorful low-poly books & decor. */
export function createBillyBookcase(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.1, 0.06), palette.white);
  back.position.set(0, 1.05, -0.16);
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 0.36), palette.white);
  sideL.position.set(-0.72, 1.05, 0);
  const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 0.36), palette.white);
  sideR.position.set(0.72, 1.05, 0);
  group.add(back, sideL, sideR);

  [0.06, 0.58, 1.1, 1.6, 2.07].forEach((y) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 0.35), palette.white);
    shelf.position.set(0, y, 0);
    group.add(shelf);
  });

  // Low-poly books
  const book1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.24), palette.ikeaBlue);
  book1.position.set(-0.38, 0.74, 0.02);
  const book2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.24), palette.accentRed);
  book2.position.set(0.25, 1.28, 0.02);
  const decor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), palette.ikeaYellow);
  decor.position.set(-0.3, 1.74, 0.02);
  group.add(book1, book2, decor);

  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(1.52, 2.1, 0.42),
    colliderOffset: new THREE.Vector3(0, 1.05, 0),
  };
}

/** 4x4 KALLAX cube shelf unit. */
export function createKallaxUnit(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const outerW = 1.6;
  const outerH = 1.6;
  const depth = 0.42;

  // Frame
  const top = new THREE.Mesh(new THREE.BoxGeometry(outerW, 0.07, depth), palette.wood);
  top.position.y = outerH - 0.035;
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(outerW, 0.07, depth), palette.wood);
  bottom.position.y = 0.035;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.07, outerH, depth), palette.wood);
  left.position.set(-outerW / 2 + 0.035, outerH / 2, 0);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.07, outerH, depth), palette.wood);
  right.position.set(outerW / 2 - 0.035, outerH / 2, 0);
  group.add(top, bottom, left, right);

  // Inner grid dividers
  [-0.38, 0, 0.38].forEach((offset) => {
    const vDiv = new THREE.Mesh(new THREE.BoxGeometry(0.035, outerH - 0.08, depth - 0.02), palette.wood);
    vDiv.position.set(offset, outerH / 2, 0);
    const hDiv = new THREE.Mesh(new THREE.BoxGeometry(outerW - 0.08, 0.035, depth - 0.02), palette.wood);
    hDiv.position.set(0, outerH / 2 + offset, 0);
    group.add(vDiv, hDiv);
  });

  // Colored storage inserts
  const insert1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.36), palette.ikeaBlue);
  insert1.position.set(-0.57, 0.24, 0);
  const insert2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.36), palette.ikeaYellow);
  insert2.position.set(0.19, 0.61, 0);
  const insert3 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.36), palette.terracotta);
  insert3.position.set(0.57, 1.0, 0);
  group.add(insert1, insert2, insert3);

  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(outerW, outerH, depth),
    colliderOffset: new THREE.Vector3(0, outerH / 2, 0),
  };
}

/** Showroom kitchen vignette with stove + skillet (future Steak Emergency anchor). */
export function createKitchenDisplay(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const baseCab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 0.85), palette.white);
  baseCab.position.y = 0.45;
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.06, 0.9), palette.wood);
  counterTop.position.y = 0.93;
  const stoveTop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.65), palette.metalDark);
  stoveTop.position.set(0.5, 0.97, 0);
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.06, 8), palette.metalDark);
  pan.position.set(0.45, 1.01, 0.05);
  const panHandle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.04), palette.metalGrey);
  panHandle.position.set(0.7, 1.02, 0.05);

  const upperCab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.75, 0.45), palette.ikeaBlue);
  upperCab.position.set(0, 2.0, -0.2);

  group.add(baseCab, counterTop, stoveTop, pan, panHandle, upperCab);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(3.24, 2.35, 0.92),
    colliderOffset: new THREE.Vector3(0, 1.15, 0),
  };
}

/** IKEA Restaurant table with 4 chairs and Swedish meatball trays! */
export function createRestaurantTable(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 1.0), palette.wood);
  top.position.y = 0.76;
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.74, 0.14), palette.metalDark);
  leg.position.y = 0.37;
  group.add(top, leg);

  // Chairs
  [
    [-0.45, -0.68],
    [0.45, -0.68],
    [-0.45, 0.68],
    [0.45, 0.68],
  ].forEach(([x, z]) => {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), palette.ikeaBlue);
    seat.position.set(x, 0.45, z);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.06), palette.ikeaBlue);
    back.position.set(x, 0.68, z + (z > 0 ? 0.18 : -0.18));
    group.add(seat, back);
  });

  // Food tray with Swedish meatballs
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.32), palette.ikeaYellow);
  tray.position.set(-0.25, 0.81, 0);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.02, 8), palette.white);
  plate.position.set(-0.25, 0.83, 0);
  const ball1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.032, 0), palette.meatballBrown);
  ball1.position.set(-0.28, 0.86, -0.02);
  const ball2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.032, 0), palette.meatballBrown);
  ball2.position.set(-0.22, 0.86, 0.02);
  group.add(tray, plate, ball1, ball2);

  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(1.65, 1.0, 1.65),
    colliderOffset: new THREE.Vector3(0, 0.5, 0),
  };
}

/** Restaurant serving counter. */
export function createRestaurantCounter(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.96, 1.05), palette.ikeaBlue);
  base.position.y = 0.48;
  const top = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.08, 1.12), palette.wood);
  top.position.y = 1.0;
  const sneezeGuard = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.45, 0.04), palette.glass);
  sneezeGuard.position.set(0, 1.26, 0.35);
  group.add(base, top, sneezeGuard);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(5.7, 1.5, 1.15),
    colliderOffset: new THREE.Vector3(0, 0.75, 0),
  };
}

/** Checkout lane with conveyor belt and register. */
export function createCheckoutLane(palette: MaterialPalette, laneNumber: number): PropBuildResult {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.88, 2.8), palette.ikeaBlue);
  body.position.y = 0.44;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 2.4), palette.metalDark);
  belt.position.set(0, 0.9, 0.1);
  const register = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.32), palette.metalGrey);
  register.position.set(0.18, 1.04, -0.55);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), palette.metalGrey);
  pole.position.set(-0.35, 1.58, -0.8);
  const numBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.32, 0.12),
    laneNumber % 2 === 0 ? palette.ikeaYellow : palette.ikeaBlue,
  );
  numBox.position.set(-0.35, 2.32, -0.8);
  group.add(body, belt, register, pole, numBox);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(1.0, 1.3, 2.85),
    colliderOffset: new THREE.Vector3(0, 0.65, 0),
  };
}

/** Stylized Low-Poly IKEA shopping cart with blue FRAKTA bag. */
export function createShoppingCart(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.95), palette.metalGrey);
  frame.position.y = 0.18;
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.44, 0.82), palette.metalGrey);
  basket.position.set(0, 0.64, 0.04);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), palette.ikeaYellow);
  handle.position.set(0, 0.95, -0.42);
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.35, 0.55), palette.ikeaBlue);
  bag.position.set(0, 0.68, 0.06);
  group.add(frame, basket, handle, bag);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(0.68, 1.0, 1.0),
    colliderOffset: new THREE.Vector3(0, 0.5, 0),
  };
}

/** Tall 5.2m IKEA Warehouse rack (blue uprights + orange crossbeams, 3 tiers). */
export function createWarehouseRack(palette: MaterialPalette, length = 6.4): PropBuildResult {
  const group = new THREE.Group();
  const depth = 1.4;
  const height = 5.2;

  const postGeo = new THREE.BoxGeometry(0.14, height, 0.14);
  const halfL = length / 2 - 0.1;
  const halfD = depth / 2 - 0.1;
  [
    [-halfL, -halfD],
    [halfL, -halfD],
    [-halfL, halfD],
    [halfL, halfD],
    [0, -halfD],
    [0, halfD],
  ].forEach(([x, z]) => {
    const post = new THREE.Mesh(postGeo, palette.ikeaBlue);
    post.position.set(x, height / 2, z);
    group.add(post);
  });

  const beamGeo = new THREE.BoxGeometry(length, 0.14, 0.08);
  const deckGeo = new THREE.BoxGeometry(length - 0.15, 0.05, depth - 0.15);
  [1.4, 3.0, 4.6].forEach((y) => {
    const frontBeam = new THREE.Mesh(beamGeo, palette.rackOrange);
    frontBeam.position.set(0, y, halfD);
    const backBeam = new THREE.Mesh(beamGeo, palette.rackOrange);
    backBeam.position.set(0, y, -halfD);
    const deck = new THREE.Mesh(deckGeo, palette.metalGrey);
    deck.position.set(0, y + 0.06, 0);
    group.add(frontBeam, backBeam, deck);
  });

  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(length, height, depth),
    colliderOffset: new THREE.Vector3(0, height / 2, 0),
  };
}

/** Stylized Low-Poly Forklift (static warehouse prop in Phase 2). */
export function createForklift(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 2.0), palette.forkliftYellow);
  body.position.set(0, 0.62, -0.15);
  const counterweight = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.68, 0.5), palette.metalDark);
  counterweight.position.set(0, 0.64, -1.05);
  const cage = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 1.1), palette.metalDark);
  cage.position.set(0, 1.55, -0.2);

  // Mast & Forks
  const mastL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.14), palette.metalDark);
  mastL.position.set(-0.36, 1.25, 0.95);
  const mastR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.14), palette.metalDark);
  mastR.position.set(0.36, 1.25, 0.95);
  const forkL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 1.1), palette.metalGrey);
  forkL.position.set(-0.32, 0.16, 1.52);
  const forkR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 1.1), palette.metalGrey);
  forkR.position.set(0.32, 0.16, 1.52);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 8);
  wheelGeo.rotateZ(Math.PI / 2);
  [
    [-0.68, 0.28, 0.65],
    [0.68, 0.28, 0.65],
    [-0.68, 0.28, -0.82],
    [0.68, 0.28, -0.82],
  ].forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, palette.metalDark);
    wheel.position.set(x, y, z);
    group.add(wheel);
  });

  group.add(body, counterweight, cage, mastL, mastR, forkL, forkR);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(1.5, 2.2, 2.7),
    colliderOffset: new THREE.Vector3(0, 1.1, 0.2),
  };
}

/** Warehouse flatbed cart. */
export function createFlatbedCart(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.8), palette.ikeaBlue);
  deck.position.y = 0.28;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.95, 0.08), palette.metalGrey);
  handle.position.set(0, 0.72, -0.85);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 1.2), palette.boxLabel);
  box.position.set(0, 0.6, 0.1);
  group.add(deck, handle, box);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(1.15, 1.15, 1.85),
    colliderOffset: new THREE.Vector3(0, 0.58, 0),
  };
}

/** Stylized Low-Poly Sedan / Hatchback for the parking lot. */
export function createParkedCar(
  palette: MaterialPalette,
  colorMat: THREE.MeshStandardMaterial,
): PropBuildResult {
  const group = new THREE.Group();

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 4.1), colorMat);
  chassis.position.y = 0.58;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.6, 2.1), colorMat);
  cabin.position.set(0, 1.18, -0.15);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.46, 2.16), palette.glass);
  windshield.position.set(0, 1.16, -0.15);

  // Bumpers & lights
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.22, 0.14), palette.metalDark);
  frontBumper.position.set(0, 0.34, 2.05);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.22, 0.14), palette.metalDark);
  rearBumper.position.set(0, 0.34, -2.05);

  const headLightGeo = new THREE.BoxGeometry(0.32, 0.14, 0.06);
  const hlL = new THREE.Mesh(headLightGeo, palette.ikeaYellow);
  hlL.position.set(-0.62, 0.62, 2.05);
  const hlR = new THREE.Mesh(headLightGeo, palette.ikeaYellow);
  hlR.position.set(0.62, 0.62, 2.05);

  const tailL = new THREE.Mesh(headLightGeo, palette.accentRed);
  tailL.position.set(-0.62, 0.64, -2.05);
  const tailR = new THREE.Mesh(headLightGeo, palette.accentRed);
  tailR.position.set(0.62, 0.64, -2.05);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8);
  wheelGeo.rotateZ(Math.PI / 2);
  [
    [-0.92, 0.32, 1.25],
    [0.92, 0.32, 1.25],
    [-0.92, 0.32, -1.25],
    [0.92, 0.32, -1.25],
  ].forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, palette.metalDark);
    wheel.position.set(x, y, z);
    group.add(wheel);
  });

  group.add(chassis, cabin, windshield, frontBumper, rearBumper, hlL, hlR, tailL, tailR);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(1.96, 1.5, 4.2),
    colliderOffset: new THREE.Vector3(0, 0.75, 0),
  };
}

/** Parking lot streetlight. */
export function createStreetLamp(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.2, 6), palette.metalDark);
  pole.position.y = 2.6;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.12), palette.metalDark);
  arm.position.set(0.45, 5.15, 0);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.24), palette.lightPanel);
  lamp.position.set(0.85, 5.06, 0);
  group.add(pole, arm, lamp);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(0.3, 5.2, 0.3),
    colliderOffset: new THREE.Vector3(0, 2.6, 0),
  };
}

/** Low-poly stylized tree for parking perimeter. */
export function createLowPolyTree(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.6, 6), palette.darkWood);
  trunk.position.y = 0.8;
  const crown1 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.1, 6), palette.foliage);
  crown1.position.y = 2.4;
  const crown2 = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.6, 6), palette.grass);
  crown2.position.y = 3.4;
  group.add(trunk, crown1, crown2);
  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(0.7, 3.5, 0.7),
    colliderOffset: new THREE.Vector3(0, 1.75, 0),
  };
}
