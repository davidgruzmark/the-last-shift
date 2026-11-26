import * as THREE from 'three';
import { IKEA_COLORS } from '../../config/constants';
import type { AssetManager } from '../../core/AssetManager';

export type ProductName = 'BILLY' | 'KALLAX' | 'MALM' | 'POÄNG';

export interface MaterialPalette {
  floor: THREE.MeshStandardMaterial;
  showroomFloor: THREE.MeshStandardMaterial;
  warehouseFloor: THREE.MeshStandardMaterial;
  asphalt: THREE.MeshStandardMaterial;
  sidewalk: THREE.MeshStandardMaterial;
  wall: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  ikeaBlue: THREE.MeshStandardMaterial;
  ikeaYellow: THREE.MeshStandardMaterial;
  darkNavy: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  darkWood: THREE.MeshStandardMaterial;
  metalGrey: THREE.MeshStandardMaterial;
  metalDark: THREE.MeshStandardMaterial;
  cardboard: THREE.MeshStandardMaterial;
  accentRed: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  terracotta: THREE.MeshStandardMaterial;
  sofaBlue: THREE.MeshStandardMaterial;
  rugBeige: THREE.MeshStandardMaterial;
  forkliftYellow: THREE.MeshStandardMaterial;
  rackOrange: THREE.MeshStandardMaterial;
  meatballBrown: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  parkingLine: THREE.MeshStandardMaterial;
  lightPanel: THREE.MeshStandardMaterial;
  controlSign: THREE.MeshStandardMaterial;
  exitSign: THREE.MeshStandardMaterial;
  kfirBadge: THREE.MeshStandardMaterial;
  cctvScreens: THREE.MeshStandardMaterial[];
  boxLabel: THREE.MeshStandardMaterial;
  ikeaFacadeLogo: THREE.MeshStandardMaterial;
  showroomSign: THREE.MeshStandardMaterial;
  warehouseSign: THREE.MeshStandardMaterial;
  checkoutSign: THREE.MeshStandardMaterial;
  restaurantSign: THREE.MeshStandardMaterial;
  hazardStripe: THREE.MeshStandardMaterial;
  floorArrow: THREE.MeshStandardMaterial;
  productSigns: Record<ProductName, THREE.MeshStandardMaterial>;
  carColors: THREE.MeshStandardMaterial[];
}

function lowPolyMat(
  color: number,
  options?: {
    roughness?: number;
    metalness?: number;
    emissive?: number;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
  },
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options?.roughness ?? 0.82,
    metalness: options?.metalness ?? 0.06,
    flatShading: true,
    emissive: options?.emissive ?? 0x000000,
    emissiveIntensity: options?.emissiveIntensity ?? 0,
    transparent: options?.transparent ?? false,
    opacity: options?.opacity ?? 1,
  });
}

function createDepartmentSignMat(
  assets: AssetManager,
  key: string,
  title: string,
  subtitle: string,
  bgColor = '#0058A3',
  fgColor = '#FFDA1A',
): THREE.MeshStandardMaterial {
  const tex = assets.getOrCreateCanvasTexture(key, 512, 128, (ctx, w, h) => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fgColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = fgColor;
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, w / 2, h / 2 - 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(subtitle, w / 2, h / 2 + 28);
  });
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
}

function createProductSignMat(
  assets: AssetManager,
  name: ProductName,
  subtitle: string,
  price: string,
): THREE.MeshStandardMaterial {
  const tex = assets.getOrCreateCanvasTexture(`product-${name}`, 256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0058A3';
    ctx.fillRect(0, 0, w, 46);
    ctx.fillStyle = '#FFDA1A';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 14, 24);
    ctx.fillStyle = '#162436';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(subtitle, 14, 76);
    ctx.fillStyle = '#FFDA1A';
    ctx.fillRect(14, 102, 118, 42);
    ctx.fillStyle = '#162436';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(price, 24, 124);
  });
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
}

export function createPalette(assets: AssetManager): MaterialPalette {
  const floorTex = assets.getOrCreateCanvasTexture(
    'floor-concrete',
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#CFD6DE';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(70, 88, 110, 0.16)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(8, 8, w * 0.45, h * 0.45);
    },
    { repeatX: 7, repeatY: 6 },
  );

  const showroomFloorTex = assets.getOrCreateCanvasTexture(
    'floor-showroom',
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#DECBB2';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(130, 100, 70, 0.16)';
      ctx.lineWidth = 3;
      for (let y = 0; y < h; y += 64) {
        ctx.strokeRect(0, y, w, 64);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(0, 64, w, 64);
      ctx.fillRect(0, 192, w, 64);
    },
    { repeatX: 12, repeatY: 12 },
  );

  const warehouseFloorTex = assets.getOrCreateCanvasTexture(
    'floor-warehouse',
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#AEB8C4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(40, 52, 68, 0.22)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    },
    { repeatX: 12, repeatY: 10 },
  );

  const controlSignTex = assets.getOrCreateCanvasTexture(
    'sign-control-room',
    512,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#0058A3';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#FFDA1A';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, w - 16, h - 16);

      ctx.fillStyle = '#FFDA1A';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('IKEA SECURITY CONTROL', w / 2, h / 2 - 14);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('SECTOR 01 — AUTHORIZED STAFF ONLY', w / 2, h / 2 + 24);
    },
  );

  const exitSignTex = assets.getOrCreateCanvasTexture('sign-exit-showroom', 384, 96, (ctx, w, h) => {
    ctx.fillStyle = '#157F3D';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT → SHOWROOM', w / 2, h / 2);
  });

  const badgeTex = assets.getOrCreateCanvasTexture('kfir-badge', 128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#0058A3';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FFDA1A';
    ctx.fillRect(0, 0, w, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KFIR', w / 2, h / 2 + 6);
  });

  const boxLabelTex = assets.getOrCreateCanvasTexture('ikea-box-label', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#C89F6D';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0058A3';
    ctx.fillRect(16, 18, w - 32, 34);
    ctx.fillStyle = '#FFDA1A';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('IKEA  KALLAX / BILLY', 24, 35);
    ctx.fillStyle = '#1F2D3D';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('AISLE 04 · BIN 12', 20, 86);
  });

  const ikeaFacadeTex = assets.getOrCreateCanvasTexture('ikea-facade-logo', 512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#0058A3';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FFDA1A';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.44, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0058A3';
    ctx.font = '900 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('IKEA', w / 2, h / 2 + 4);
  });

  const hazardTex = assets.getOrCreateCanvasTexture(
    'hazard-stripe',
    256,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = '#FFDA1A';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1B1E23';
      for (let x = -64; x < w + 64; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 24, 0);
        ctx.lineTo(x + 56, h);
        ctx.lineTo(x + 32, h);
        ctx.closePath();
        ctx.fill();
      }
    },
    { repeatX: 4, repeatY: 1 },
  );

  const arrowTex = assets.getOrCreateCanvasTexture('floor-arrow', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0058A3';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FFDA1A';
    ctx.beginPath();
    ctx.moveTo(w / 2, 18);
    ctx.lineTo(w - 22, 66);
    ctx.lineTo(w * 0.66, 66);
    ctx.lineTo(w * 0.66, 110);
    ctx.lineTo(w * 0.34, 110);
    ctx.lineTo(w * 0.34, 66);
    ctx.lineTo(22, 66);
    ctx.closePath();
    ctx.fill();
  });

  const camLabels = [
    { name: 'CAM 01 - SHOWROOM', accent: '#1E90FF' },
    { name: 'CAM 02 - CHECKOUT', accent: '#2ECC71' },
    { name: 'CAM 03 - PARKING', accent: '#FFDA1A' },
    { name: 'CAM 04 - WAREHOUSE', accent: '#FF5A5F' },
  ];

  const cctvScreens = camLabels.map((cam, idx) => {
    const tex = assets.getOrCreateCanvasTexture(`cctv-${idx}`, 256, 160, (ctx, w, h) => {
      ctx.fillStyle = '#0A1929';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = cam.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(24, 40, w - 48, h - 62);
      ctx.beginPath();
      ctx.moveTo(24, 40);
      ctx.lineTo(64, 68);
      ctx.lineTo(w - 64, 68);
      ctx.lineTo(w - 24, 40);
      ctx.moveTo(64, 68);
      ctx.lineTo(64, h - 22);
      ctx.moveTo(w - 64, 68);
      ctx.lineTo(w - 64, h - 22);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let y = 0; y < h; y += 6) {
        ctx.fillRect(0, y, w, 2);
      }

      ctx.fillStyle = '#07111C';
      ctx.fillRect(0, 0, w, 26);
      ctx.fillStyle = '#FF4D4F';
      ctx.beginPath();
      ctx.arc(16, 13, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#E6F4FF';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(cam.name, 28, 13);
    });

    return new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(cam.accent),
      emissiveMap: tex,
      emissiveIntensity: 0.75,
      roughness: 0.35,
    });
  });

  const carColorHexes = [0x0058a3, 0xd64045, 0xf4f7fb, 0x3a4a5e, 0xe09f24, 0x2f7d58];

  return {
    floor: new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.88,
      metalness: 0.05,
    }),
    showroomFloor: new THREE.MeshStandardMaterial({
      map: showroomFloorTex,
      roughness: 0.82,
      metalness: 0.04,
    }),
    warehouseFloor: new THREE.MeshStandardMaterial({
      map: warehouseFloorTex,
      roughness: 0.9,
      metalness: 0.06,
    }),
    asphalt: lowPolyMat(IKEA_COLORS.asphalt, { roughness: 0.92, metalness: 0.04 }),
    sidewalk: lowPolyMat(0xc3ccd6, { roughness: 0.88 }),
    wall: lowPolyMat(IKEA_COLORS.wallLight, { roughness: 0.9 }),
    ceiling: lowPolyMat(0xd9e1ea, { roughness: 0.92 }),
    ikeaBlue: lowPolyMat(IKEA_COLORS.blue, { roughness: 0.72 }),
    ikeaYellow: lowPolyMat(IKEA_COLORS.yellow, { roughness: 0.65 }),
    darkNavy: lowPolyMat(IKEA_COLORS.darkNavy, { roughness: 0.78 }),
    wood: lowPolyMat(IKEA_COLORS.wood, { roughness: 0.8 }),
    darkWood: lowPolyMat(IKEA_COLORS.darkWood, { roughness: 0.82 }),
    metalGrey: lowPolyMat(IKEA_COLORS.metalGrey, { roughness: 0.5, metalness: 0.35 }),
    metalDark: lowPolyMat(IKEA_COLORS.metalDark, { roughness: 0.55, metalness: 0.4 }),
    cardboard: lowPolyMat(IKEA_COLORS.cardboard, { roughness: 0.9 }),
    accentRed: lowPolyMat(IKEA_COLORS.accentRed, { roughness: 0.6 }),
    white: lowPolyMat(IKEA_COLORS.white, { roughness: 0.75 }),
    gold: lowPolyMat(IKEA_COLORS.gold, { roughness: 0.35, metalness: 0.7 }),
    grass: lowPolyMat(IKEA_COLORS.grass, { roughness: 0.9 }),
    foliage: lowPolyMat(IKEA_COLORS.foliage, { roughness: 0.86 }),
    terracotta: lowPolyMat(IKEA_COLORS.terracotta, { roughness: 0.84 }),
    sofaBlue: lowPolyMat(IKEA_COLORS.sofaBlue, { roughness: 0.88 }),
    rugBeige: lowPolyMat(IKEA_COLORS.rugBeige, { roughness: 0.95 }),
    forkliftYellow: lowPolyMat(IKEA_COLORS.forkliftYellow, { roughness: 0.55, metalness: 0.18 }),
    rackOrange: lowPolyMat(IKEA_COLORS.rackOrange, { roughness: 0.6, metalness: 0.2 }),
    meatballBrown: lowPolyMat(IKEA_COLORS.meatballBrown, { roughness: 0.78 }),
    glass: lowPolyMat(IKEA_COLORS.glassTint, {
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.5,
    }),
    parkingLine: lowPolyMat(IKEA_COLORS.parkingLine, { roughness: 0.8 }),
    lightPanel: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xeaf4ff,
      emissiveIntensity: 1.1,
      roughness: 0.25,
    }),
    controlSign: new THREE.MeshStandardMaterial({ map: controlSignTex, roughness: 0.55 }),
    exitSign: new THREE.MeshStandardMaterial({
      map: exitSignTex,
      emissive: 0x157f3d,
      emissiveMap: exitSignTex,
      emissiveIntensity: 0.4,
      roughness: 0.45,
    }),
    kfirBadge: new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.45 }),
    cctvScreens,
    boxLabel: new THREE.MeshStandardMaterial({ map: boxLabelTex, roughness: 0.85 }),
    ikeaFacadeLogo: new THREE.MeshStandardMaterial({ map: ikeaFacadeTex, roughness: 0.45 }),
    showroomSign: createDepartmentSignMat(
      assets,
      'sign-showroom',
      'SHOWROOM',
      'LIVING · BEDROOM · KITCHEN',
    ),
    warehouseSign: createDepartmentSignMat(
      assets,
      'sign-warehouse',
      'SELF-SERVE WAREHOUSE',
      'AISLES 01–03 · PICKUP AREA',
      '#162436',
      '#FFDA1A',
    ),
    checkoutSign: createDepartmentSignMat(
      assets,
      'sign-checkout',
      'CHECKOUT & EXIT',
      'LANES 01–04 → PARKING',
    ),
    restaurantSign: createDepartmentSignMat(
      assets,
      'sign-restaurant',
      'IKEA RESTAURANT',
      'SWEDISH MEATBALLS & COFFEE',
      '#0058A3',
      '#FFFFFF',
    ),
    hazardStripe: new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.75 }),
    floorArrow: new THREE.MeshStandardMaterial({ map: arrowTex, roughness: 0.7 }),
    productSigns: {
      BILLY: createProductSignMat(assets, 'BILLY', 'Bookcase, white', '$69'),
      KALLAX: createProductSignMat(assets, 'KALLAX', 'Shelf unit, 4x4', '$119'),
      MALM: createProductSignMat(assets, 'MALM', 'Queen bed frame', '$249'),
      POÄNG: createProductSignMat(assets, 'POÄNG', 'Armchair, birch', '$129'),
    },
    carColors: carColorHexes.map((c) => lowPolyMat(c, { roughness: 0.45, metalness: 0.25 })),
  };
}
