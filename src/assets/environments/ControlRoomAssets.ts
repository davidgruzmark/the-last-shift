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

/**
 * Wide curved dual-operator security command console for Station A (Kfir) & Station B (Staff),
 * paired with a dramatic 9-monitor (3x3) CCTV display wall binding live GPU feed textures.
 */
export function createCinematicSecurityConsole(
  palette: MaterialPalette,
  wallFeedTextures: readonly THREE.Texture[] = [],
): PropBuildResult {
  const group = new THREE.Group();
  group.name = 'CinematicSecurityConsole';

  const darkConsoleMat = new THREE.MeshStandardMaterial({
    color: 0x1e2634,
    roughness: 0.45,
    metalness: 0.55,
  });
  const tabletopMat = new THREE.MeshStandardMaterial({
    color: 0x263142,
    roughness: 0.4,
    metalness: 0.35,
  });
  const screenBezelMat = new THREE.MeshStandardMaterial({
    color: 0x0f141d,
    roughness: 0.42,
    metalness: 0.65,
  });

  // Main center console + angled wings for Kfir (Left/Center) & Rotating Operator (Right)
  const centerTop = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.1, 1.15), tabletopMat);
  centerTop.position.set(0, 0.78, 0);
  const pedestalL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.74, 0.95), darkConsoleMat);
  pedestalL.position.set(-2.1, 0.37, 0);
  const pedestalM = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.74, 0.92), darkConsoleMat);
  pedestalM.position.set(0.15, 0.37, 0);
  const pedestalR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.74, 0.95), darkConsoleMat);
  pedestalR.position.set(2.1, 0.37, 0);
  const modesty = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.65, 0.08), palette.darkNavy);
  modesty.position.set(0, 0.4, -0.48);
  group.add(centerTop, pedestalL, pedestalM, pedestalR, modesty);

  // LED under-lip strip along front edge of command desk
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.9,
    roughness: 0.25,
  });
  const deskLed = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.035, 0.04), stripMat);
  deskLed.position.set(0, 0.75, 0.57);
  group.add(deskLed);

  // Station A (x = -1.05): Kfir keyboard, mouse, PTZ camera joystick, coffee mug, desk phone
  const kbA = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.18), screenBezelMat);
  kbA.position.set(-1.1, 0.845, 0.22);
  const mouseA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.12), palette.metalGrey);
  mouseA.position.set(-0.7, 0.845, 0.22);
  const joyBase = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.2), darkConsoleMat);
  joyBase.position.set(-0.42, 0.855, 0.2);
  const joyStick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.14, 8), screenBezelMat);
  joyStick.position.set(-0.42, 0.94, 0.2);
  const joyKnob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), palette.accentRed);
  joyKnob.position.set(-0.42, 1.01, 0.2);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 8), palette.ikeaYellow);
  mug.position.set(-1.62, 0.885, 0.24);
  const phoneBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.22), screenBezelMat);
  phoneBase.position.set(-1.86, 0.86, 0.12);
  group.add(kbA, mouseA, joyBase, joyStick, joyKnob, mug, phoneBase);

  // Station B (x = +1.35): Co-worker illuminated control pad, keyboard, clipboard
  const kbB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.18), screenBezelMat);
  kbB.position.set(1.35, 0.845, 0.22);
  const mouseB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.12), palette.metalGrey);
  mouseB.position.set(1.74, 0.845, 0.22);
  const btnColors = [0x22c55e, 0x38bdf8, 0xf59e0b, 0xef4444];
  btnColors.forEach((hex, idx) => {
    const btn = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.025, 0.05),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.9 }),
    );
    btn.position.set(0.76 + idx * 0.09, 0.845, 0.16);
    group.add(btn);
  });
  group.add(kbB, mouseB);

  // Dual local desk monitors on riser shelf
  const riser = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 0.34), screenBezelMat);
  riser.position.set(0, 0.9, -0.32);
  group.add(riser);

  [-1.05, 1.35].forEach((mx, idx) => {
    const deskMon = new THREE.Group();
    deskMon.position.set(mx, 1.24, -0.34);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.48, 0.05), screenBezelMat);
    const tex = wallFeedTextures[idx];
    const screenMat = tex
      ? new THREE.MeshStandardMaterial({
          map: tex,
          emissiveMap: tex,
          emissive: new THREE.Color(0xdbeafe),
          emissiveIntensity: 0.72,
          roughness: 0.25,
        })
      : palette.cctvScreens[idx % palette.cctvScreens.length];
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.4), screenMat);
    screen.position.z = 0.028;
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.08), palette.metalGrey);
    stand.position.set(0, -0.28, -0.02);
    deskMon.add(frame, screen, stand);
    group.add(deskMon);
  });

  // 9-Monitor (3x3) Large Cinematic CCTV Display Wall behind the console (z = -0.82 local)
  const wallMountFrame = new THREE.Mesh(new THREE.BoxGeometry(5.1, 2.55, 0.12), screenBezelMat);
  wallMountFrame.position.set(0, 2.48, -0.88);
  group.add(wallMountFrame);

  const cols = [-1.58, 0, 1.58];
  const rows = [3.22, 2.46, 1.7];
  let screenIdx = 0;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      const mGroup = new THREE.Group();
      mGroup.name = `CCTVWallMonitor_${screenIdx}`;
      mGroup.position.set(cols[c], rows[r], -0.78);
      mGroup.rotation.y = -cols[c] * 0.05;

      const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.68, 0.06), screenBezelMat);
      const tex =
        screenIdx < wallFeedTextures.length ? wallFeedTextures[screenIdx] : undefined;
      const panelMat = tex
        ? new THREE.MeshStandardMaterial({
            map: tex,
            emissiveMap: tex,
            emissive: new THREE.Color(0xe0f2fe),
            emissiveIntensity: 0.82,
            roughness: 0.25,
          })
        : palette.cctvScreens[screenIdx % palette.cctvScreens.length];
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.58), panelMat);
      screen.position.z = 0.033;
      mGroup.add(bezel, screen);
      group.add(mGroup);
      screenIdx++;
    }
  }

  setShadows(group);

  return {
    group,
    colliderSize: new THREE.Vector3(4.8, 1.6, 1.25),
    colliderOffset: new THREE.Vector3(0, 0.8, 0),
  };
}

/** High-back executive security operator swivel chair with armrests. */
export function createExecutiveChair(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  group.name = 'ExecutiveSecurityChair';

  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.68 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.06, 6), palette.metalDark);
  base.position.y = 0.05;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.38, 6), palette.metalGrey);
  stem.position.y = 0.26;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.11, 0.58), leatherMat);
  seat.position.y = 0.48;
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.11), leatherMat);
  backrest.position.set(0, 0.9, -0.25);
  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.12), palette.ikeaBlue);
  headrest.position.set(0, 1.36, -0.25);
  group.add(base, stem, seat, backrest, headrest);

  [-0.33, 0.33].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), palette.metalGrey);
    post.position.set(x, 0.59, -0.02);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.38), leatherMat);
    arm.position.set(x, 0.71, -0.02);
    group.add(post, arm);
  });

  setShadows(group);

  return {
    group,
    colliderSize: new THREE.Vector3(0.58, 1.3, 0.58),
    colliderOffset: new THREE.Vector3(0, 0.65, 0),
  };
}

/** Blinking security server rack cabinet & cable conduit for Control Room atmosphere. */
export function createServerRack(palette: MaterialPalette): PropBuildResult {
  const group = new THREE.Group();
  group.name = 'SecurityServerRack';

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.25, 0.75), palette.metalDark);
  body.position.y = 1.125;
  group.add(body);

  const ledColors = [0x22c55e, 0x38bdf8, 0x22c55e, 0xf59e0b, 0x22c55e];
  ledColors.forEach((hex, idx) => {
    const bay = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.16, 0.03), palette.darkNavy);
    bay.position.set(0, 0.45 + idx * 0.34, 0.38);
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.035, 0.02),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 1.0 }),
    );
    led.position.set(-0.26, 0.45 + idx * 0.34, 0.4);
    group.add(bay, led);
  });

  setShadows(group);
  return {
    group,
    colliderSize: new THREE.Vector3(0.95, 2.25, 0.8),
    colliderOffset: new THREE.Vector3(0, 1.125, 0),
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
