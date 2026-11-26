import * as THREE from 'three';

export type WatchVisualRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export interface WatchModelRig {
  group: THREE.Group;
  sparkles: THREE.Object3D[];
}

const RARITY_PALETTES: Record<
  WatchVisualRarity,
  {
    caseColor: number;
    bezelColor: number;
    dialColor: number;
    handColor: number;
    strapColor: number;
    strapSecondary: number;
    markerColor: number;
    accentGlow: number;
  }
> = {
  // Brushed steel case, cream dial, stitched dark leather strap
  Common: {
    caseColor: 0x9aa5b4,
    bezelColor: 0xb8c2cf,
    dialColor: 0xf4f1ea,
    handColor: 0x1e293b,
    strapColor: 0x4b2e1e,
    strapSecondary: 0x2c1a10,
    markerColor: 0x334155,
    accentGlow: 0x38bdf8,
  },
  // Silver diver case with crown guards, notched navy bezel, 3-link steel bracelet
  Rare: {
    caseColor: 0xcbd5e1,
    bezelColor: 0x1e3a8a,
    dialColor: 0x0b1630,
    handColor: 0x60a5fa,
    strapColor: 0x94a3b8,
    strapSecondary: 0x64748b,
    markerColor: 0xe0f2fe,
    accentGlow: 0x60a5fa,
  },
  // Cushion sport case, dark tachymeter bezel, 3 sub-dials, dual pushers, ribbed rubber strap
  Epic: {
    caseColor: 0x3f3a5c,
    bezelColor: 0x1f1638,
    dialColor: 0x141029,
    handColor: 0xe879f9,
    strapColor: 0x26213d,
    strapSecondary: 0x7c3aed,
    markerColor: 0xc084fc,
    accentGlow: 0xc084fc,
  },
  // Octagonal 18k gold case, fluted bezel, skeleton obsidian dial with gold gear, two-tone jubilee bracelet
  Legendary: {
    caseColor: 0xf0c239,
    bezelColor: 0xffda1a,
    dialColor: 0x090d16,
    handColor: 0xffda1a,
    strapColor: 0x475569,
    strapSecondary: 0xeab308,
    markerColor: 0xfef08a,
    accentGlow: 0xfbbf24,
  },
};

function createMaterial(
  color: number,
  roughness: number,
  metalness: number,
  emissive = 0x000000,
  emissiveIntensity = 0,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    flatShading: true,
  });
}

function addWatchStrapLoop(
  watchRoot: THREE.Group,
  rarity: WatchVisualRarity,
  strapMat: THREE.MeshStandardMaterial,
  secondaryMat: THREE.MeshStandardMaterial,
  buckleMat: THREE.MeshStandardMaterial,
): void {
  const strapGroup = new THREE.Group();
  strapGroup.name = 'WatchStrapLoop';

  // Continuous, physically connected elliptical bracelet/strap anchored between lugs and clasp
  const segmentCount = 20;
  const loopCenterZ = -0.01;
  const loopRadiusY = 0.162;
  const loopRadiusZ = 0.152;
  const startAngle = 0.56;
  const endAngle = Math.PI * 2 - 0.56;
  const segLen = 0.056;
  const pinMat = createMaterial(0x1f2937, 0.45, 0.7);

  for (let i = 0; i < segmentCount; i++) {
    const angle = startAngle + (i / (segmentCount - 1)) * (endAngle - startAngle);
    const py = Math.sin(angle) * loopRadiusY;
    const pz = loopCenterZ + Math.cos(angle) * loopRadiusZ;
    // Exact ellipse tangent orientation so local Y runs smoothly along the strap arc
    const rotX = Math.atan2(-loopRadiusZ * Math.sin(angle), loopRadiusY * Math.cos(angle));

    const linkGroup = new THREE.Group();
    linkGroup.name = `WatchStrapLink_${i}`;
    linkGroup.position.set(0, py, pz);
    linkGroup.rotation.x = rotX;
    linkGroup.userData.segmentLength = segLen;

    const isMetalBracelet = rarity === 'Rare' || rarity === 'Legendary';
    if (isMetalBracelet) {
      const outer = new THREE.Mesh(
        new THREE.BoxGeometry(0.168, segLen, 0.032),
        strapMat,
      );
      const centerLink = new THREE.Mesh(
        new THREE.BoxGeometry(0.074, segLen * 1.04, 0.038),
        secondaryMat,
      );
      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.172, 6),
        pinMat,
      );
      pin.rotation.z = Math.PI / 2;
      pin.position.y = segLen * 0.42;
      linkGroup.add(outer, centerLink, pin);
    } else if (rarity === 'Epic') {
      const bandCore = new THREE.Mesh(
        new THREE.BoxGeometry(0.166, segLen, 0.026),
        strapMat,
      );
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.174, segLen * 0.55, 0.034),
        i % 2 === 0 ? strapMat : secondaryMat,
      );
      linkGroup.add(bandCore, rib);
    } else {
      const leatherSeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.158, segLen, 0.026),
        strapMat,
      );
      const stitchL = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, segLen * 0.7, 0.029),
        secondaryMat,
      );
      stitchL.position.x = -0.056;
      const stitchR = stitchL.clone();
      stitchR.position.x = 0.056;
      linkGroup.add(leatherSeg, stitchL, stitchR);
    }

    strapGroup.add(linkGroup);
  }

  // Lug end-links bridging the top/bottom strap ends cleanly into the case lugs
  [-1, 1].forEach((signY) => {
    const endPiece = new THREE.Mesh(
      new THREE.BoxGeometry(0.156, 0.068, 0.044),
      rarity === 'Common' ? strapMat : buckleMat,
    );
    endPiece.position.set(0, signY * 0.118, 0.114);
    endPiece.rotation.x = signY * -0.58;
    strapGroup.add(endPiece);
  });

  // Case lugs connecting the strap cleanly to top & bottom of the watch case
  [-0.068, 0.068].forEach((lx) => {
    [-0.145, 0.145].forEach((ly) => {
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.055, 0.052), buckleMat);
      lug.position.set(lx, ly, 0.115);
      strapGroup.add(lug);
    });
  });

  // Metal buckle / deployment clasp seated flush at the back of the loop
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.178, 0.072, 0.046), buckleMat);
  clasp.name = 'WatchClasp';
  clasp.position.set(0, 0, loopCenterZ - loopRadiusZ);
  strapGroup.add(clasp);

  watchRoot.add(strapGroup);
}

/**
 * Creates a detailed, distinct low-poly 3D wristwatch per rarity tier featuring
 * proper cases, lugs, bezels, dials, hands, glass crystals, crowns, and articulated straps.
 */
export function createWatchModel(rarity: WatchVisualRarity): WatchModelRig {
  const p = RARITY_PALETTES[rarity];
  const group = new THREE.Group();
  group.name = `WatchModel_${rarity}`;

  const watchRoot = new THREE.Group();
  watchRoot.name = 'WatchAssembly';
  watchRoot.position.y = 0.27;
  // Tilt slightly toward player camera for clear iconic wristwatch silhouette while bobbing
  watchRoot.rotation.x = -0.22;
  group.add(watchRoot);

  const caseMat = createMaterial(
    p.caseColor,
    0.26,
    0.85,
    rarity === 'Legendary' ? 0x6b4700 : 0x000000,
    rarity === 'Legendary' ? 0.22 : 0,
  );
  const bezelMat = createMaterial(
    p.bezelColor,
    0.22,
    0.88,
    rarity === 'Legendary' ? 0x7c5300 : 0x000000,
    rarity === 'Legendary' ? 0.3 : 0,
  );
  const dialMat = createMaterial(p.dialColor, 0.35, 0.25);
  const markerMat = createMaterial(p.markerColor, 0.25, 0.75);
  const handMat = createMaterial(
    p.handColor,
    0.22,
    0.45,
    rarity === 'Common' ? 0x000000 : p.accentGlow,
    rarity === 'Common' ? 0 : 0.65,
  );
  const strapMat = createMaterial(p.strapColor, rarity === 'Common' ? 0.82 : 0.42, rarity === 'Common' ? 0.08 : 0.65);
  const strapSecMat = createMaterial(p.strapSecondary, 0.35, 0.72);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.28,
    roughness: 0.08,
    metalness: 0.15,
    depthWrite: false,
  });

  // 1. Strap / Bracelet Loop & Lugs
  addWatchStrapLoop(watchRoot, rarity, strapMat, strapSecMat, caseMat);

  // 2. Case & Bezel (distinct geometry per rarity!)
  const faceZ = 0.14;
  if (rarity === 'Epic') {
    // Tonneau / cushion racing chronograph case
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.068), caseMat);
    cushion.name = 'WatchCase';
    cushion.position.set(0, 0, faceZ);
    const tachBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.145, 0.028, 12), bezelMat);
    tachBezel.rotation.x = Math.PI / 2;
    tachBezel.position.set(0, 0, faceZ + 0.036);
    watchRoot.add(cushion, tachBezel);
  } else if (rarity === 'Legendary') {
    // Octagonal luxury gold case with fluted inner bezel ring
    const octCase = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.072, 8), caseMat);
    octCase.name = 'WatchCase';
    octCase.rotation.x = Math.PI / 2;
    octCase.rotation.y = Math.PI / 8;
    octCase.position.set(0, 0, faceZ);
    const flutedBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.158, 0.03, 16), bezelMat);
    flutedBezel.rotation.x = Math.PI / 2;
    flutedBezel.position.set(0, 0, faceZ + 0.038);
    watchRoot.add(octCase, flutedBezel);
  } else if (rarity === 'Rare') {
    // Rugged Silver Guard diver case + notched rotating bezel + crown guards
    const diverCase = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.072, 12), caseMat);
    diverCase.name = 'WatchCase';
    diverCase.rotation.x = Math.PI / 2;
    diverCase.position.set(0, 0, faceZ);
    const diverBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.148, 0.152, 0.03, 12), bezelMat);
    diverBezel.rotation.x = Math.PI / 2;
    diverBezel.position.set(0, 0, faceZ + 0.038);
    const pip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.018), markerMat);
    pip.position.set(0, 0.132, faceZ + 0.052);
    const guardTop = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.032, 0.048), caseMat);
    guardTop.position.set(0.158, 0.038, faceZ);
    const guardBot = guardTop.clone();
    guardBot.position.y = -0.038;
    watchRoot.add(diverCase, diverBezel, pip, guardTop, guardBot);
  } else {
    // Classic stepped round field watch case
    const fieldCase = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.06, 16), caseMat);
    fieldCase.name = 'WatchCase';
    fieldCase.rotation.x = Math.PI / 2;
    fieldCase.position.set(0, 0, faceZ);
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.142, 0.022, 16), bezelMat);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(0, 0, faceZ + 0.032);
    watchRoot.add(fieldCase, bezel);
  }

  // 3. Dial + Cardinal Indices + Rarity Complications (Sub-dials / Tourbillon)
  const dialRadius = rarity === 'Common' ? 0.116 : 0.122;
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(dialRadius, dialRadius, 0.016, 16), dialMat);
  dial.name = 'WatchDial';
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0, 0, faceZ + 0.046);
  watchRoot.add(dial);

  // Cardinal hour markers (12, 3, 6, 9)
  [
    [0, 0.095, 0.018, 0.032],
    [0, -0.095, 0.018, 0.026],
    [0.095, 0, 0.026, 0.016],
    [-0.095, 0, 0.026, 0.016],
  ].forEach(([mx, my, mw, mh]) => {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, 0.008), markerMat);
    marker.position.set(mx, my, faceZ + 0.056);
    watchRoot.add(marker);
  });

  if (rarity === 'Epic') {
    // 3 Chronograph sub-dials
    const subMat = createMaterial(0x2e1f5e, 0.3, 0.5);
    [
      [-0.046, 0.028],
      [0.046, 0.028],
      [0, -0.048],
    ].forEach(([sx, sy]) => {
      const subDial = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 10), subMat);
      subDial.rotation.x = Math.PI / 2;
      subDial.position.set(sx, sy, faceZ + 0.056);
      watchRoot.add(subDial);
    });
  } else if (rarity === 'Legendary') {
    // Visible open-heart gold tourbillon gear on the obsidian dial
    const tourbRing = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 12), bezelMat);
    tourbRing.name = 'TourbillonWheel';
    tourbRing.position.set(0, -0.036, faceZ + 0.057);
    const tourbBridge = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.012, 0.01), caseMat);
    tourbBridge.position.set(0, -0.036, faceZ + 0.059);
    watchRoot.add(tourbRing, tourbBridge);
  }

  // 4. Hour & Minute Hands + Center Pinion
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.016, 0.008), handMat);
  hourHand.position.set(-0.024, 0.012, faceZ + 0.062);
  hourHand.rotation.z = -0.35;
  const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.088, 0.008), handMat);
  minuteHand.position.set(0.022, 0.034, faceZ + 0.064);
  minuteHand.rotation.z = -0.52;
  const pinion = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 8), markerMat);
  pinion.rotation.x = Math.PI / 2;
  pinion.position.set(0, 0, faceZ + 0.066);
  watchRoot.add(hourHand, minuteHand, pinion);

  // 5. Right-Side Winding Crown (+ Dual Pushers for Epic & Legendary)
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.038, 8), bezelMat);
  crown.name = 'WatchCrown';
  crown.rotation.z = Math.PI / 2;
  crown.position.set(rarity === 'Common' ? 0.155 : 0.168, 0, faceZ);
  watchRoot.add(crown);

  if (rarity === 'Epic' || rarity === 'Legendary') {
    [-0.062, 0.062].forEach((py) => {
      const pusher = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.032, 8), caseMat);
      pusher.rotation.z = Math.PI / 2;
      pusher.position.set(0.162, py, faceZ);
      watchRoot.add(pusher);
    });
  }

  // 6. Protective Translucent Crystal Glass
  const crystal = new THREE.Mesh(
    new THREE.CylinderGeometry(dialRadius + 0.008, dialRadius + 0.008, 0.012, 16),
    glassMat,
  );
  crystal.name = 'WatchCrystal';
  crystal.rotation.x = Math.PI / 2;
  crystal.position.set(0, 0, faceZ + 0.072);
  watchRoot.add(crystal);

  // 7. Ambient Rarity Sparkles (Epic & Legendary)
  const sparkles: THREE.Object3D[] = [];
  if (rarity === 'Epic' || rarity === 'Legendary') {
    const moteGeo = new THREE.OctahedronGeometry(0.034, 0);
    const moteMat = new THREE.MeshBasicMaterial({
      color: p.accentGlow,
      transparent: true,
      opacity: 0.9,
    });
    const offsets: Array<[number, number, number]> = [
      [0.24, 0.38, 0.1],
      [-0.24, 0.28, -0.1],
      [0.14, 0.48, -0.2],
      [-0.14, 0.14, 0.2],
    ];
    for (const [x, y, z] of offsets) {
      const m = new THREE.Mesh(moteGeo, moteMat.clone());
      m.position.set(x, y, z);
      group.add(m);
      sparkles.push(m);
    }
  }

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj !== crystal && !sparkles.includes(obj)) {
      obj.castShadow = true;
    }
  });

  return { group, sparkles };
}
