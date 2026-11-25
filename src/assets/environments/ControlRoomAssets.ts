import * as THREE from 'three';
import type { MaterialPalette } from '../materials/Palette';

export interface PropBuildResult {
  group: THREE.Group;
  colliderSize?: THREE.Vector3;
  colliderOffset?: THREE.Vector3;
}

function setShadows(obj: THREE.Object3D, cast = true, receive = true): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

/** Main security control desk with 4 glowing CCTV monitors, keyboard, mug & desk phone. */
export function createSecurityDesk(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  group.name = 'SecurityDesk';

  // Desk tabletop & legs
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 1.15), palette.wood);
  top.position.y = 0.78;
  group.add(top);

  const frontModesty = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.65, 0.08), palette.darkNavy);
  frontModesty.position.set(0, 0.4, 0.5);
  group.add(frontModesty);

  const legGeo = new THREE.BoxGeometry(0.1, 0.75, 1.0);
  const leftLeg = new THREE.Mesh(legGeo, palette.metalDark);
  leftLeg.position.set(-1.78, 0.375, 0);
  const rightLeg = new THREE.Mesh(legGeo, palette.metalDark);
  rightLeg.position.set(1.78, 0.375, 0);
  group.add(leftLeg, rightLeg);

  // Monitor riser shelf
  const riser = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.14, 0.34), palette.metalDark);
  riser.position.set(0, 0.9, -0.32);
  group.add(riser);

  // 4 CCTV Monitors arranged in a slight arc
  const xOffsets = [-1.18, -0.4, 0.4, 1.18];
  xOffsets.forEach((x, idx) => {
    const monitorGroup = new THREE.Group();
    monitorGroup.position.set(x, 1.24, -0.32);
    monitorGroup.rotation.y = -x * 0.14;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.44, 0.05), palette.metalDark);
    monitorGroup.add(frame);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.36),
      palette.cctvScreens[idx % palette.cctvScreens.length],
    );
    screen.position.z = 0.027;
    monitorGroup.add(screen);

    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.08), palette.metalGrey);
    stand.position.set(0, -0.26, -0.02);
    monitorGroup.add(stand);

    group.add(monitorGroup);
  });

  // Keyboard & mouse
  const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.18), palette.metalDark);
  keyboard.position.set(-0.2, 0.845, 0.16);
  group.add(keyboard);

  const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.12), palette.metalGrey);
  mouse.position.set(0.22, 0.845, 0.16);
  group.add(mouse);

  // IKEA yellow coffee mug
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 8), palette.ikeaYellow);
  mug.position.set(0.85, 0.885, 0.14);
  group.add(mug);

  // Desk phone
  const phoneBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.22), palette.metalDark);
  phoneBase.position.set(-1.1, 0.86, 0.15);
  group.add(phoneBase);
  const handset = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.22), palette.ikeaBlue);
  handset.position.set(-1.16, 0.91, 0.15);
  group.add(handset);

  setShadows(group);

  return {
    group,
    colliderSize: new THREE.Vector3(3.8, 1.5, 1.15),
    colliderOffset: new THREE.Vector3(0, 0.75, 0),
  };
}

/** Swivel security chair. */
export function createOfficeChair(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  group.name = 'OfficeChair';

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.06, 6), palette.metalDark);
  base.position.y = 0.05;
  group.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.38, 6), palette.metalGrey);
  stem.position.y = 0.26;
  group.add(stem);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.54), palette.darkNavy);
  seat.position.y = 0.48;
  group.add(seat);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.58, 0.1), palette.ikeaBlue);
  backrest.position.set(0, 0.8, -0.23);
  group.add(backrest);

  setShadows(group);

  return {
    group,
    colliderSize: new THREE.Vector3(0.65, 1.1, 0.65),
    colliderOffset: new THREE.Vector3(0, 0.55, 0),
  };
}

/** Tall IKEA security locker cabinet. */
export function createSecurityLocker(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  group.name = 'SecurityLocker';

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.1, 0.6), palette.ikeaBlue);
  body.position.y = 1.05;
  group.add(body);

  // Two locker doors + vents + handles
  [-0.36, 0.36].forEach((x) => {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.94, 0.04), palette.metalGrey);
    door.position.set(x, 1.05, 0.3);
    group.add(door);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), palette.ikeaYellow);
    handle.position.set(x + 0.22, 1.08, 0.33);
    group.add(handle);
  });

  setShadows(group);

  return {
    group,
    colliderSize: new THREE.Vector3(1.5, 2.1, 0.64),
    colliderOffset: new THREE.Vector3(0, 1.05, 0),
  };
}

/** IKEA-inspired metal storage rack with labeled cardboard boxes. */
export function createStorageShelf(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  group.name = 'StorageShelf';

  const width = 2.2;
  const depth = 0.7;
  const height = 2.15;

  // 4 corner posts
  const postGeo = new THREE.BoxGeometry(0.07, height, 0.07);
  [
    [-width / 2 + 0.04, -depth / 2 + 0.04],
    [width / 2 - 0.04, -depth / 2 + 0.04],
    [-width / 2 + 0.04, depth / 2 - 0.04],
    [width / 2 - 0.04, depth / 2 - 0.04],
  ].forEach(([x, z]) => {
    const post = new THREE.Mesh(postGeo, palette.metalDark);
    post.position.set(x, height / 2, z);
    group.add(post);
  });

  // 3 shelves
  const shelfGeo = new THREE.BoxGeometry(width, 0.06, depth);
  [0.25, 1.0, 1.75].forEach((y) => {
    const shelf = new THREE.Mesh(shelfGeo, palette.metalGrey);
    shelf.position.y = y;
    group.add(shelf);
  });

  // Labeled IKEA boxes
  const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.44, 0.52), palette.boxLabel);
  box1.position.set(-0.55, 0.5, 0);
  const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.38, 0.48), palette.cardboard);
  box2.position.set(0.48, 0.47, 0);
  const box3 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.46, 0.5), palette.boxLabel);
  box3.position.set(0.25, 1.26, 0);
  const blueBin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.34, 0.46), palette.ikeaBlue);
  blueBin.position.set(-0.6, 1.2, 0);
  const yellowBin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.42), palette.ikeaYellow);
  yellowBin.position.set(-0.35, 1.93, 0);

  group.add(box1, box2, box3, blueBin, yellowBin);

  setShadows(group);

  return {
    group,
    colliderSize: new THREE.Vector3(width, height, depth),
    colliderOffset: new THREE.Vector3(0, height / 2, 0),
  };
}

/** Exit door leading to Showroom (locked anchor for Phase 2). */
export function createExitDoor(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  group.name = 'ExitDoor';

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.45, 0.16), palette.metalDark);
  frame.position.y = 1.225;
  group.add(frame);

  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.26, 2.3, 0.1), palette.ikeaBlue);
  leaf.position.set(0, 1.15, 0.04);
  group.add(leaf);

  const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.65, 0.12), palette.lightPanel);
  windowGlass.position.set(0, 1.62, 0.04);
  group.add(windowGlass);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.12), palette.ikeaYellow);
  handle.position.set(0.45, 1.05, 0.1);
  group.add(handle);

  const exitSign = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.32, 0.08), palette.exitSign);
  exitSign.position.set(0, 2.7, 0.04);
  group.add(exitSign);

  setShadows(group);

  return { group };
}

/** Fire extinguisher mounted near exit. */
export function createFireExtinguisher(palette: MaterialPalette): THREE.Group {
  const group = new THREE.Group();
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.52, 8), palette.accentRed);
  tank.position.y = 0.26;
  const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), palette.metalDark);
  nozzle.position.set(0.04, 0.56, 0);
  group.add(tank, nozzle);
  setShadows(group);
  return group;
}
