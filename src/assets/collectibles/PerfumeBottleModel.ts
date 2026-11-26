import * as THREE from 'three';

export type PerfumeVariant =
  | 'midnight-noir'
  | 'ocean-king'
  | 'royal-essence'
  | 'the-boss'
  | 'kfir-signature';

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
  silhouette: 'tall' | 'wide' | 'royal' | 'flask' | 'signature';
}

const BOTTLE_STYLES: Record<PerfumeVariant, BottleStyle> = {
  'midnight-noir': {
    glassColor: 0x0c162d,
    emissiveColor: 0x0d1b38,
    coreColor: 0x070b14,
    accentHex: '#d4af37',
    accentColor: 0xe6be53,
    capColor: 0x111827,
    sparkleColor: 0xffda1a,
    titleLine1: 'MIDNIGHT',
    titleLine2: 'NOIR',
    subtitle: 'EAU DE PARFUM',
    silhouette: 'tall',
  },
  'ocean-king': {
    glassColor: 0x0891b2,
    emissiveColor: 0x0e7490,
    coreColor: 0x164e63,
    accentHex: '#7dd3fc',
    accentColor: 0xe2e8f0,
    capColor: 0x0f172a,
    sparkleColor: 0x38bdf8,
    titleLine1: 'OCEAN',
    titleLine2: 'KING',
    subtitle: 'MARINE EXTRACT',
    silhouette: 'wide',
  },
  'royal-essence': {
    glassColor: 0x6b21a8,
    emissiveColor: 0x581c87,
    coreColor: 0x3b0764,
    accentHex: '#f5d0fe',
    accentColor: 0xf4c430,
    capColor: 0x4c1d95,
    sparkleColor: 0xc084fc,
    titleLine1: 'ROYAL',
    titleLine2: 'ESSENCE',
    subtitle: 'RESERVE BLEND',
    silhouette: 'royal',
  },
  'the-boss': {
    glassColor: 0x451a03,
    emissiveColor: 0x78350f,
    coreColor: 0x1c1917,
    accentHex: '#fbbf24',
    accentColor: 0xf59e0b,
    capColor: 0x1f2937,
    sparkleColor: 0xfbbf24,
    titleLine1: 'THE',
    titleLine2: 'BOSS',
    subtitle: 'INTENSE ROAST',
    silhouette: 'flask',
  },
  'kfir-signature': {
    glassColor: 0x065f46,
    emissiveColor: 0x047857,
    coreColor: 0x022c22,
    accentHex: '#ffda1a',
    accentColor: 0xffda1a,
    capColor: 0x0058a3,
    sparkleColor: 0x34d399,
    titleLine1: 'KFIR',
    titleLine2: 'SIGNATURE',
    subtitle: 'SECURITY EDITION',
    silhouette: 'signature',
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
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(style.titleLine1, canvas.width / 2, 70);
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(style.titleLine2, canvas.width / 2, 110);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(style.subtitle, canvas.width / 2, 136);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Builds any of the 5 stylized low-poly 3D perfume bottles with unique silhouette,
 * palette, metallic trim, readable label, and orbital sparkle motes.
 */
export function createPerfumeBottle(variant: PerfumeVariant): PerfumeBottleRig {
  const style = BOTTLE_STYLES[variant];
  const group = new THREE.Group();
  group.name = `PerfumeBottle_${variant}`;

  const glassMat = new THREE.MeshStandardMaterial({
    color: style.glassColor,
    roughness: 0.16,
    metalness: 0.28,
    emissive: style.emissiveColor,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.92,
    flatShading: true,
  });

  const darkCoreMat = new THREE.MeshStandardMaterial({
    color: style.coreColor,
    roughness: 0.3,
    metalness: 0.42,
    flatShading: true,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: style.accentColor,
    roughness: 0.24,
    metalness: 0.85,
    emissive: style.accentColor,
    emissiveIntensity: 0.18,
    flatShading: true,
  });

  const capMat = new THREE.MeshStandardMaterial({
    color: style.capColor,
    roughness: 0.25,
    metalness: 0.55,
    flatShading: true,
  });

  const bodyW = style.silhouette === 'wide' ? 0.36 : style.silhouette === 'flask' ? 0.33 : 0.3;
  const bodyH = style.silhouette === 'tall' || style.silhouette === 'signature' ? 0.36 : 0.31;
  const bodyD = style.silhouette === 'royal' ? 0.24 : 0.18;

  const baseTrim = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW + 0.02, 0.05, bodyD + 0.02),
    trimMat,
  );
  baseTrim.position.y = 0.025;

  const core = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW - 0.06, bodyH - 0.06, bodyD - 0.06),
    darkCoreMat,
  );
  core.position.y = 0.05 + (bodyH - 0.06) / 2;

  const bodyGeo =
    style.silhouette === 'royal'
      ? new THREE.CylinderGeometry(bodyW * 0.5, bodyW * 0.46, bodyH, 8)
      : new THREE.BoxGeometry(bodyW, bodyH, bodyD);
  const body = new THREE.Mesh(bodyGeo, glassMat);
  body.position.y = 0.05 + bodyH / 2;

  const shoulderY = 0.05 + bodyH + 0.03;
  const shoulder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, bodyW * 0.44, 0.07, 6),
    glassMat,
  );
  shoulder.position.y = shoulderY;

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.065, 8), trimMat);
  neck.position.y = shoulderY + 0.06;

  const capSegments = style.silhouette === 'signature' ? 8 : 6;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.072, 0.125, capSegments),
    capMat,
  );
  cap.position.y = shoulderY + 0.145;

  const capRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.088, 0.022, capSegments),
    trimMat,
  );
  capRing.position.y = shoulderY + 0.095;

  const labelTex = createBottleLabelTexture(style);
  const labelMat = new THREE.MeshStandardMaterial({
    color: labelTex ? 0xffffff : style.accentColor,
    ...(labelTex ? { map: labelTex } : {}),
    roughness: 0.35,
    metalness: 0.2,
  });
  const labelZ = style.silhouette === 'royal' ? bodyW * 0.48 : bodyD / 2 + 0.006;
  const frontLabel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.01), labelMat);
  frontLabel.position.set(0, 0.05 + bodyH * 0.52, labelZ);
  const backLabel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.01), labelMat);
  backLabel.position.set(0, 0.05 + bodyH * 0.52, -labelZ);

  group.add(baseTrim, core, body, shoulder, neck, cap, capRing, frontLabel, backLabel);

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

/** Preserved helper returning the Midnight Noir flacon for Mission 05. */
export function createMidnightNoirBottle(): PerfumeBottleRig {
  const rig = createPerfumeBottle('midnight-noir');
  rig.group.name = 'MidnightNoirBottle';
  return rig;
}
