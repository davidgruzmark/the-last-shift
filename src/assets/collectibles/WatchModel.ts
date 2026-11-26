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
  // Common — Casio G-Shock DW-5600E (Matte black octagonal shock resin + dark LCD dial + red trim)
  Common: {
    caseColor: 0x1f242d,
    bezelColor: 0x14171d,
    dialColor: 0x263238,
    handColor: 0x94e2d5,
    strapColor: 0x181b22,
    strapSecondary: 0xef4444,
    markerColor: 0xe2e8f0,
    accentGlow: 0x38bdf8,
  },
  // Rare — Omega Seamaster Diver 300M (Brushed steel, notched navy ceramic bezel, wave-blue dial, steel bracelet)
  Rare: {
    caseColor: 0xcbd5e1,
    bezelColor: 0x1e3a8a,
    dialColor: 0x0b1f44,
    handColor: 0xe0f2fe,
    strapColor: 0x94a3b8,
    strapSecondary: 0x64748b,
    markerColor: 0xf8fafc,
    accentGlow: 0x60a5fa,
  },
  // Epic — TAG Heuer Carrera Chronograph (Polished steel lugs, black tachymeter bezel, 3 sub-dials, racing strap)
  Epic: {
    caseColor: 0xdbe2ea,
    bezelColor: 0x111827,
    dialColor: 0x151822,
    handColor: 0xf43f5e,
    strapColor: 0x1e222b,
    strapSecondary: 0xdc2626,
    markerColor: 0xf8fafc,
    accentGlow: 0xc084fc,
  },
  // Legendary — 18k Yellow Gold Rolex Cosmograph Daytona Ref. 126508 (Gold Oyster case, gold tachymeter bezel, 3 sub-dials, gold Oyster bracelet)
  Legendary: {
    caseColor: 0xf5c542,
    bezelColor: 0xffda2a,
    dialColor: 0x12100d,
    handColor: 0xffea75,
    strapColor: 0xd4a017,
    strapSecondary: 0xfde047,
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
    const rotX = Math.atan2(-loopRadiusZ * Math.sin(angle), loopRadiusY * Math.cos(angle));

    const linkGroup = new THREE.Group();
    linkGroup.name = `WatchStrapLink_${i}`;
    linkGroup.position.set(0, py, pz);
    linkGroup.rotation.x = rotX;
    linkGroup.userData.segmentLength = segLen;

    const isMetalBracelet = rarity === 'Rare' || rarity === 'Legendary';
    if (isMetalBracelet) {
      // 3-link Oyster / Seamaster steel or 18k gold bracelet
      const outer = new THREE.Mesh(new THREE.BoxGeometry(0.168, segLen, 0.032), strapMat);
      const centerLink = new THREE.Mesh(
        new THREE.BoxGeometry(0.076, segLen * 1.04, 0.038),
        secondaryMat,
      );
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.172, 6), pinMat);
      pin.rotation.z = Math.PI / 2;
      pin.position.y = segLen * 0.42;
      linkGroup.add(outer, centerLink, pin);
    } else if (rarity === 'Epic') {
      // Perforated dark racing strap for TAG Heuer Carrera
      const bandCore = new THREE.Mesh(new THREE.BoxGeometry(0.162, segLen, 0.026), strapMat);
      const perf = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, segLen * 0.35, 0.031),
        i % 2 === 0 ? strapMat : secondaryMat,
      );
      linkGroup.add(bandCore, perf);
    } else {
      // Ribbed matte resin shock strap for Casio G-Shock
      const resinSeg = new THREE.Mesh(new THREE.BoxGeometry(0.164, segLen, 0.028), strapMat);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.17, segLen * 0.45, 0.034), strapMat);
      linkGroup.add(resinSeg, ridge);
    }

    strapGroup.add(linkGroup);
  }

  // Lug end-links bridging strap ends cleanly into the case lugs
  [-1, 1].forEach((signY) => {
    const endPiece = new THREE.Mesh(
      new THREE.BoxGeometry(0.156, 0.068, 0.044),
      rarity === 'Common' ? strapMat : buckleMat,
    );
    endPiece.position.set(0, signY * 0.118, 0.114);
    endPiece.rotation.x = signY * -0.58;
    strapGroup.add(endPiece);
  });

  // Case lugs connecting the strap cleanly to top & bottom of watch case
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
 * Creates 4 detailed, recognizable real-world low-poly 3D wristwatches:
 * - Common: Casio G-Shock DW-5600E
 * - Rare: Omega Seamaster Diver 300M (10-o'clock helium valve, navy dive bezel, 3-link steel)
 * - Epic: TAG Heuer Carrera Chronograph (racing bezel, 3 sub-dials, dual pushers)
 * - Legendary: 18k Yellow Gold Rolex Cosmograph Daytona Ref. 126508 (3 sub-dials, tachymeter bezel, gold Oyster bracelet)
 */
export function createWatchModel(rarity: WatchVisualRarity): WatchModelRig {
  const p = RARITY_PALETTES[rarity];
  const group = new THREE.Group();
  group.name = `WatchModel_${rarity}`;

  const watchRoot = new THREE.Group();
  watchRoot.name = 'WatchAssembly';
  watchRoot.position.y = 0.27;
  watchRoot.rotation.x = -0.22;
  group.add(watchRoot);

  const isGoldDaytona = rarity === 'Legendary';
  const caseMat = createMaterial(
    p.caseColor,
    isGoldDaytona ? 0.2 : rarity === 'Common' ? 0.72 : 0.28,
    rarity === 'Common' ? 0.15 : 0.88,
    isGoldDaytona ? 0x6b4700 : 0x000000,
    isGoldDaytona ? 0.2 : 0,
  );
  const bezelMat = createMaterial(
    p.bezelColor,
    isGoldDaytona ? 0.18 : 0.25,
    rarity === 'Common' ? 0.18 : 0.86,
    isGoldDaytona ? 0x855a00 : 0x000000,
    isGoldDaytona ? 0.28 : 0,
  );
  const dialMat = createMaterial(p.dialColor, 0.35, 0.25);
  const markerMat = createMaterial(p.markerColor, 0.25, 0.75);
  const handMat = createMaterial(
    p.handColor,
    0.22,
    0.45,
    rarity === 'Common' ? 0x000000 : p.accentGlow,
    rarity === 'Common' ? 0 : 0.55,
  );
  const strapMat = createMaterial(
    p.strapColor,
    rarity === 'Common' || rarity === 'Epic' ? 0.78 : 0.34,
    rarity === 'Common' || rarity === 'Epic' ? 0.12 : 0.78,
  );
  const strapSecMat = createMaterial(
    p.strapSecondary,
    rarity === 'Legendary' ? 0.18 : 0.35,
    rarity === 'Legendary' ? 0.92 : 0.72,
  );
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.28,
    roughness: 0.08,
    metalness: 0.15,
    depthWrite: false,
  });

  // 1. Continuous Connected Strap / Bracelet Loop & Lugs
  addWatchStrapLoop(watchRoot, rarity, strapMat, strapSecMat, caseMat);

  // 2. Distinct Case & Bezel Architecture
  const faceZ = 0.14;
  if (rarity === 'Legendary') {
    // 18k Gold Rolex Daytona Ref. 126508: round Oyster case + engraved gold tachymeter bezel + gold crown guards
    const oysterCase = new THREE.Mesh(new THREE.CylinderGeometry(0.156, 0.156, 0.072, 16), caseMat);
    oysterCase.name = 'WatchCase';
    oysterCase.rotation.x = Math.PI / 2;
    oysterCase.position.set(0, 0, faceZ);

    const tachBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.158, 0.03, 16), bezelMat);
    tachBezel.rotation.x = Math.PI / 2;
    tachBezel.position.set(0, 0, faceZ + 0.038);

    const gTop = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 0.045), caseMat);
    gTop.position.set(0.158, 0.026, faceZ);
    const gBot = gTop.clone();
    gBot.position.y = -0.026;

    watchRoot.add(oysterCase, tachBezel, gTop, gBot);
  } else if (rarity === 'Epic') {
    // TAG Heuer Carrera Chronograph: steel case + black tachymeter racing bezel
    const carreraCase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 14), caseMat);
    carreraCase.name = 'WatchCase';
    carreraCase.rotation.x = Math.PI / 2;
    carreraCase.position.set(0, 0, faceZ);

    const tachBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.144, 0.15, 0.028, 14), bezelMat);
    tachBezel.rotation.x = Math.PI / 2;
    tachBezel.position.set(0, 0, faceZ + 0.036);
    watchRoot.add(carreraCase, tachBezel);
  } else if (rarity === 'Rare') {
    // Omega Seamaster Diver 300M: brushed steel diver case + notched navy bezel + 10-o'clock helium valve + crown guards
    const diverCase = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.072, 14), caseMat);
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

    // 10-o'clock Helium Escape Valve
    const heValve = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 8), caseMat);
    heValve.rotation.z = Math.PI / 3;
    heValve.position.set(-0.142, 0.084, faceZ);

    watchRoot.add(diverCase, diverBezel, pip, guardTop, guardBot, heValve);
  } else {
    // Casio G-Shock DW-5600E: matte black octagonal shock case
    const gshockCase = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.076, 8), caseMat);
    gshockCase.name = 'WatchCase';
    gshockCase.rotation.x = Math.PI / 2;
    gshockCase.rotation.y = Math.PI / 8;
    gshockCase.position.set(0, 0, faceZ);

    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.15, 0.026, 8), bezelMat);
    bezel.rotation.x = Math.PI / 2;
    bezel.rotation.y = Math.PI / 8;
    bezel.position.set(0, 0, faceZ + 0.038);

    const redStripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.016, 0.012), strapSecMat);
    redStripe.position.set(0, 0.105, faceZ + 0.052);
    watchRoot.add(gshockCase, bezel, redStripe);
  }

  // 3. Dial + Cardinal Indices + Chronograph Sub-dials
  const dialRadius = rarity === 'Common' ? 0.112 : 0.122;
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(dialRadius, dialRadius, 0.016, 16), dialMat);
  dial.name = 'WatchDial';
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0, 0, faceZ + 0.046);
  watchRoot.add(dial);

  if (rarity === 'Common') {
    // Rectangular LCD digital window on G-Shock
    const lcd = new THREE.Mesh(
      new THREE.BoxGeometry(0.135, 0.085, 0.01),
      createMaterial(0x88b09b, 0.5, 0.05),
    );
    lcd.position.set(0, 0, faceZ + 0.056);
    watchRoot.add(lcd);
  } else {
    // Cardinal baton hour markers (12, 3, 6, 9)
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
  }

  if (rarity === 'Epic' || rarity === 'Legendary') {
    // 3 Chronograph sub-dials (classic 3, 6, 9 Daytona / Carrera layout)
    const subMat = isGoldDaytona
      ? createMaterial(0xe6be53, 0.25, 0.72)
      : createMaterial(0x283044, 0.3, 0.5);
    [
      [-0.048, 0.006],
      [0.048, 0.006],
      [0, -0.052],
    ].forEach(([sx, sy]) => {
      const subDial = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.009, 12), subMat);
      subDial.name = isGoldDaytona ? 'DaytonaSubdial' : 'ChronoSubdial';
      subDial.rotation.x = Math.PI / 2;
      subDial.position.set(sx, sy, faceZ + 0.056);
      watchRoot.add(subDial);
    });
  }

  // 4. Hour & Minute Hands + Center Pinion (skipped on digital LCD G-Shock? keep subtle indicator bars)
  if (rarity !== 'Common') {
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
  }

  // 5. Right-Side Winding Crown / Mode Button (+ Screw-Down Chronograph Pushers for Daytona & Carrera)
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.038, 8), bezelMat);
  crown.name = 'WatchCrown';
  crown.rotation.z = Math.PI / 2;
  crown.position.set(rarity === 'Common' ? 0.155 : 0.168, 0, faceZ);
  watchRoot.add(crown);

  if (rarity === 'Epic' || rarity === 'Legendary') {
    [-0.062, 0.062].forEach((py) => {
      const pusher = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.034, 8), caseMat);
      pusher.rotation.z = Math.PI / 2;
      pusher.position.set(0.164, py, faceZ);
      watchRoot.add(pusher);
    });
  }

  // 6. Protective Translucent Crystal Glass
  const crystal = new THREE.Mesh(
    new THREE.CylinderGeometry(dialRadius + 0.01, dialRadius + 0.01, 0.012, 16),
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
