import * as THREE from 'three';

export type PerfumeVariant =
  | 'jpg-le-male'
  | 'armani-code'
  | 'dior-sauvage'
  | 'jimmy-choo-man';

export interface PerfumeBottleRig {
  group: THREE.Group;
  sparkles: THREE.Object3D[];
}

interface BottleStyle {
  glassColor: number;
  emissiveColor: number;
  coreColor: number;
  accentHex: string;
  accentColor: number;
  capColor: number;
  sparkleColor: number;
  titleLine1: string;
  titleLine2: string;
  subtitle: string;
  silhouette: 'torso' | 'tall-rounded' | 'cylinder-ribbed' | 'smoked-flask';
}

const BOTTLE_STYLES: Record<PerfumeVariant, BottleStyle> = {
  'jpg-le-male': {
    glassColor: 0x161922,
    emissiveColor: 0x0b0e16,
    coreColor: 0x090b10,
    accentHex: '#e6be53',
    accentColor: 0xf4c430,
    capColor: 0x1f2430,
    sparkleColor: 0xfbbf24,
    titleLine1: 'LE MALE',
    titleLine2: 'LE PARFUM',
    subtitle: 'JEAN PAUL GAULTIER',
    silhouette: 'torso',
  },
  'armani-code': {
    glassColor: 0x101319,
    emissiveColor: 0x0b101b,
    coreColor: 0x06080d,
    accentHex: '#e2e8f0',
    accentColor: 0xcbd5e1,
    capColor: 0x181c24,
    sparkleColor: 0x34d399,
    titleLine1: 'ARMANI',
    titleLine2: 'CODE',
    subtitle: 'GIORGIO ARMANI · PARFUM',
    silhouette: 'tall-rounded',
  },
  'dior-sauvage': {
    glassColor: 0x0c2448,
    emissiveColor: 0x0a1c3a,
    coreColor: 0x070d18,
    accentHex: '#93c5fd',
    accentColor: 0xdbeafe,
    capColor: 0x0f172a,
    sparkleColor: 0x60a5fa,
    titleLine1: 'DIOR',
    titleLine2: 'SAUVAGE',
    subtitle: 'EAU DE PARFUM',
    silhouette: 'cylinder-ribbed',
  },
  'jimmy-choo-man': {
    glassColor: 0x64748b,
    emissiveColor: 0x334155,
    coreColor: 0x1e293b,
    accentHex: '#e2e8f0',
    accentColor: 0xcbd5e1,
    capColor: 0x1e222b,
    sparkleColor: 0x38bdf8,
    titleLine1: 'JIMMY CHOO',
    titleLine2: 'MAN',
    subtitle: 'EAU DE TOILETTE',
    silhouette: 'smoked-flask',
  },
};

function createBottleLabelTexture(style: BottleStyle): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = style.accentHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = style.accentHex;
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(style.titleLine1, canvas.width / 2, 68);
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(style.titleLine2, canvas.width / 2, 108);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(style.subtitle, canvas.width / 2, 136);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Builds any of the 4 recognizable real-world stylized low-poly 3D perfume bottles:
 * - Jean Paul Gaultier Le Male Le Parfum (matte black ribbed sailor torso + gold collar)
 * - Armani Code Parfum (tall matte-black architectural flacon + silver accent cap)
 * - Dior Sauvage EDP (heavy midnight-blue/charcoal glass cylinder + ribbed black magnetic cap)
 * - Jimmy Choo Man EDT (smoked-grey rectangular glass flask + brushed silver trim)
 */
export function createPerfumeBottle(variant: PerfumeVariant): PerfumeBottleRig {
  const style = BOTTLE_STYLES[variant];
  const group = new THREE.Group();
  group.name = `PerfumeBottle_${variant}`;

  const isOpaqueTorso = style.silhouette === 'torso';
  const glassMat = new THREE.MeshStandardMaterial({
    color: style.glassColor,
    roughness: isOpaqueTorso ? 0.55 : 0.16,
    metalness: isOpaqueTorso ? 0.15 : 0.28,
    emissive: style.emissiveColor,
    emissiveIntensity: 0.25,
    transparent: !isOpaqueTorso,
    opacity: isOpaqueTorso ? 1.0 : style.silhouette === 'smoked-flask' ? 0.78 : 0.92,
    flatShading: true,
  });

  const darkCoreMat = new THREE.MeshStandardMaterial({
    color: style.coreColor,
    roughness: 0.32,
    metalness: 0.42,
    flatShading: true,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: style.accentColor,
    roughness: 0.22,
    metalness: 0.88,
    emissive: style.accentColor,
    emissiveIntensity: 0.18,
    flatShading: true,
  });

  const capMat = new THREE.MeshStandardMaterial({
    color: style.capColor,
    roughness: 0.26,
    metalness: 0.55,
    flatShading: true,
  });

  if (style.silhouette === 'torso') {
    // JPG Le Male Le Parfum: iconic ribbed sailor torso + gold collar & mariniere stripes
    const baseFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.05, 8), darkCoreMat);
    baseFoot.position.y = 0.025;
    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.12, 8), glassMat);
    hips.position.y = 0.11;
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.108, 0.2, 8), glassMat);
    chest.scale.set(1.08, 1.0, 0.78);
    chest.position.y = 0.265;

    // Gold horizontal sailor stripes
    [0.14, 0.21, 0.28, 0.34].forEach((sy, idx) => {
      const r = idx === 0 ? 0.116 : idx === 1 ? 0.122 : 0.142;
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.98, 0.016, 8), trimMat);
      stripe.scale.set(1.06, 1.0, 0.79);
      stripe.position.y = sy;
      group.add(stripe);
    });

    const goldCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.088, 0.05, 8), trimMat);
    goldCollar.position.y = 0.39;
    const nozzleNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.065, 8), trimMat);
    nozzleNeck.position.y = 0.445;
    const nozzleHead = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.045, 8), capMat);
    nozzleHead.position.y = 0.495;

    group.add(baseFoot, hips, chest, goldCollar, nozzleNeck, nozzleHead);
  } else if (style.silhouette === 'cylinder-ribbed') {
    // Dior Sauvage EDP: heavy dark-blue cylinder + metallic neck + vertically ribbed black cap
    const baseGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.138, 0.065, 14), darkCoreMat);
    baseGlass.position.y = 0.032;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.29, 14), glassMat);
    body.position.y = 0.21;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.24, 12), darkCoreMat);
    core.position.y = 0.21;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.142, 0.055, 14), glassMat);
    shoulder.position.y = 0.382;
    const silverNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.04, 12), trimMat);
    silverNeck.position.y = 0.425;
    const magneticCap = new THREE.Mesh(new THREE.CylinderGeometry(0.084, 0.084, 0.125, 12), capMat);
    magneticCap.position.y = 0.505;
    // Vertical cap ribs
    for (let r = 0; r < 8; r++) {
      const a = (r / 8) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.115, 0.014), darkCoreMat);
      rib.position.set(Math.cos(a) * 0.084, 0.505, Math.sin(a) * 0.084);
      group.add(rib);
    }
    group.add(baseGlass, body, core, shoulder, silverNeck, magneticCap);
  } else if (style.silhouette === 'smoked-flask') {
    // Jimmy Choo Man EDT: crisp rectangular smoked-grey glass flask + silver collar + textured black cap
    const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.045, 0.16), darkCoreMat);
    baseTrim.position.y = 0.022;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.33, 0.15), glassMat);
    body.position.y = 0.21;
    const innerTint = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.25, 0.1), darkCoreMat);
    innerTint.position.y = 0.21;
    const silverBand = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.155), trimMat);
    silverBand.position.y = 0.38;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.045, 8), trimMat);
    neck.position.y = 0.42;
    const rectCap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.115), capMat);
    rectCap.position.y = 0.495;
    group.add(baseTrim, body, innerTint, silverBand, neck, rectCap);
  } else {
    // Armani Code Parfum: tall rounded-square matte-black architectural flacon + silver cap/band
    const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.17), trimMat);
    baseTrim.position.y = 0.022;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.13, 0.37, 8), glassMat);
    body.scale.set(1.0, 1.0, 0.68);
    body.position.y = 0.23;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.1, 0.31, 8), darkCoreMat);
    core.scale.set(1.0, 1.0, 0.68);
    core.position.y = 0.23;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.05, 8), glassMat);
    shoulder.scale.set(1.0, 1.0, 0.68);
    shoulder.position.y = 0.435;
    const silverCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.03, 10), trimMat);
    silverCollar.position.y = 0.475;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.074, 0.11, 10), capMat);
    cap.position.y = 0.545;
    group.add(baseTrim, body, core, shoulder, silverCollar, cap);
  }

  // Brand plate texture mounted cleanly on front/back
  const labelTex = createBottleLabelTexture(style);
  const labelMat = new THREE.MeshStandardMaterial({
    color: labelTex ? 0xffffff : style.accentColor,
    ...(labelTex ? { map: labelTex } : {}),
    roughness: 0.35,
    metalness: 0.2,
  });
  const labelZ =
    style.silhouette === 'cylinder-ribbed'
      ? 0.148
      : style.silhouette === 'torso'
        ? 0.116
        : style.silhouette === 'smoked-flask'
          ? 0.078
          : 0.095;
  const frontLabel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.01), labelMat);
  frontLabel.position.set(0, 0.21, labelZ);
  const backLabel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.01), labelMat);
  backLabel.position.set(0, 0.21, -labelZ);
  group.add(frontLabel, backLabel);

  const sparkles: THREE.Object3D[] = [];
  const sparkleMat = new THREE.MeshBasicMaterial({
    color: style.sparkleColor,
    transparent: true,
    opacity: 0.85,
  });
  const sparkleGeo = new THREE.OctahedronGeometry(0.035, 0);
  const sparkleOffsets: Array<[number, number, number]> = [
    [0.24, 0.3, 0.12],
    [-0.24, 0.42, -0.1],
    [0.18, 0.55, -0.18],
    [-0.2, 0.18, 0.18],
  ];
  for (const [sx, sy, sz] of sparkleOffsets) {
    const mote = new THREE.Mesh(sparkleGeo, sparkleMat.clone());
    mote.position.set(sx, sy, sz);
    group.add(mote);
    sparkles.push(mote);
  }

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && !sparkles.includes(obj)) {
      obj.castShadow = true;
    }
  });

  return { group, sparkles };
}

/** Builds the Mission 05 Jean Paul Gaultier Le Male Le Parfum flacon. */
export function createJpgLeMaleBottle(): PerfumeBottleRig {
  const rig = createPerfumeBottle('jpg-le-male');
  rig.group.name = 'JpgLeMaleBottle';
  return rig;
}
