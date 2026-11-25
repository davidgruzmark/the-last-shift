import * as THREE from 'three';
import { IKEA_COLORS } from '../../config/constants';
import type { AssetManager } from '../../core/AssetManager';

export interface MaterialPalette {
  floor: THREE.MeshStandardMaterial;
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
  lightPanel: THREE.MeshStandardMaterial;
  controlSign: THREE.MeshStandardMaterial;
  exitSign: THREE.MeshStandardMaterial;
  kfirBadge: THREE.MeshStandardMaterial;
  cctvScreens: THREE.MeshStandardMaterial[];
  boxLabel: THREE.MeshStandardMaterial;
}

function lowPolyMat(
  color: number,
  options?: { roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number },
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options?.roughness ?? 0.82,
    metalness: options?.metalness ?? 0.06,
    flatShading: true,
    emissive: options?.emissive ?? 0x000000,
    emissiveIntensity: options?.emissiveIntensity ?? 0,
  });
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

      // Stylized low-poly room silhouette on monitor
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

      // Scanlines
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let y = 0; y < h; y += 6) {
        ctx.fillRect(0, y, w, 2);
      }

      // Header & REC dot
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

  return {
    floor: new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.88,
      metalness: 0.05,
    }),
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
  };
}
