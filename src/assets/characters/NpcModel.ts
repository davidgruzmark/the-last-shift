import * as THREE from 'three';
import { IKEA_COLORS } from '../../config/constants';
import type { MaterialPalette } from '../materials/Palette';

export interface NpcVisualConfig {
  skinColor?: number;
  hairColor?: number;
  shirtColor?: number;
  variant?: 'default' | 'female';
  hairStyle?: 'short' | 'ponytail';
}

export interface NpcModelResult {
  root: THREE.Group;
  highlightRing: THREE.Mesh;
}

function mat(color: number, roughness = 0.82): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.04,
    flatShading: true,
  });
}

/**
 * Stylized Low-Poly IKEA employee NPC matching Kfir's art direction,
 * supporting distinct default and female employee silhouettes.
 */
export function createNpcModel(
  palette: MaterialPalette,
  config: NpcVisualConfig = {},
): NpcModelResult {
  const root = new THREE.Group();
  const isFemale = config.variant === 'female';
  const hairStyle = config.hairStyle ?? (isFemale ? 'ponytail' : 'short');

  const skinMat = mat(config.skinColor ?? 0xe8be9e, 0.78);
  const hairMat = mat(config.hairColor ?? 0x3b281c, 0.88);
  const shirtMat = mat(config.shirtColor ?? IKEA_COLORS.yellow, 0.76);
  const pantsMat = mat(0x1f2b3a, 0.85);
  const shoesMat = mat(0x1d1e22, 0.75);
  const eyeMat = mat(0x141418, 0.3);

  if (isFemale) {
    // Tapered IKEA employee trousers & sneakers
    [-0.095, 0.095].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.67, 0.145), pantsMat);
      leg.position.set(x, 0.4, 0);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.2), shoesMat);
      shoe.position.set(x, 0.045, 0.025);
      root.add(leg, shoe);
    });

    // Contoured low-poly waist & IKEA polo torso
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.21), pantsMat);
    pelvis.position.y = 0.78;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.21), shirtMat);
    torso.name = 'FemaleTorso';
    torso.position.y = 1.11;
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.065, 0.18), palette.ikeaBlue);
    collar.position.set(0, 1.365, 0.01);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.02), palette.ikeaBlue);
    badge.position.set(0.1, 1.2, 0.112);
    root.add(pelvis, torso, collar, badge);

    // Slimmer arms
    [-0.255, 0.255].forEach((x) => {
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.18, 0.12), shirtMat);
      sleeve.position.set(x, 1.24, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.31, 0.085), skinMat);
      arm.position.set(x, 1.0, 0);
      root.add(sleeve, arm);
    });

    // Head + facial features + shoulder-length hair & ponytail
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.28), skinMat);
    head.position.y = 1.57;
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.04, 0.02), eyeMat);
    eyeL.position.set(0.06, 1.59, 0.142);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.04, 0.02), eyeMat);
    eyeR.position.set(-0.06, 1.59, 0.142);
    const browL = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.018), hairMat);
    browL.position.set(0.06, 1.635, 0.143);
    const browR = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.018), hairMat);
    browR.position.set(-0.06, 1.635, 0.143);
    const lipAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.022, 0.018),
      mat(0xb8666a, 0.65),
    );
    lipAccent.position.set(0, 1.495, 0.142);

    const hairCrown = new THREE.Mesh(new THREE.BoxGeometry(0.325, 0.11, 0.305), hairMat);
    hairCrown.position.set(0, 1.755, -0.01);
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.075), hairMat);
    hairBack.position.set(0, 1.58, -0.14);
    root.add(head, eyeL, eyeR, browL, browR, lipAccent, hairCrown, hairBack);

    // Side framing locks
    [-0.145, 0.145].forEach((x) => {
      const sideLock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.11), hairMat);
      sideLock.position.set(x, 1.59, -0.04);
      root.add(sideLock);
    });

    if (hairStyle === 'ponytail') {
      const hairTie = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.055, 0.06),
        palette.ikeaBlue,
      );
      hairTie.position.set(0, 1.61, -0.19);
      const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.1), hairMat);
      ponytail.name = 'FemalePonytail';
      ponytail.position.set(0, 1.46, -0.22);
      ponytail.rotation.x = 0.22;
      root.add(hairTie, ponytail);
    }
  } else {
    // Legs
    [-0.11, 0.11].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.66, 0.16), pantsMat);
      leg.position.set(x, 0.4, 0);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.22), shoesMat);
      shoe.position.set(x, 0.05, 0.03);
      root.add(leg, shoe);
    });

    // Torso (IKEA yellow employee polo with blue collar)
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.22), pantsMat);
    pelvis.position.y = 0.78;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.52, 0.24), shirtMat);
    torso.position.y = 1.12;
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.2), palette.ikeaBlue);
    collar.position.set(0, 1.38, 0.01);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.02), palette.ikeaBlue);
    badge.position.set(0.12, 1.22, 0.125);
    root.add(pelvis, torso, collar, badge);

    // Arms
    [-0.31, 0.31].forEach((x) => {
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.14), shirtMat);
      sleeve.position.set(x, 1.26, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.1), skinMat);
      arm.position.set(x, 1.0, 0);
      root.add(sleeve, arm);
    });

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), skinMat);
    head.position.y = 1.59;
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.32), hairMat);
    hair.position.set(0, 1.78, -0.01);
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.06), hairMat);
    hairBack.position.set(0, 1.66, -0.14);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eyeMat);
    eyeL.position.set(0.065, 1.61, 0.152);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eyeMat);
    eyeR.position.set(-0.065, 1.61, 0.152);
    root.add(head, hair, hairBack, eyeL, eyeR);
  }

  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  // Subtle floor selection ring shown when targeted
  const highlightRing = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.56, 20),
    new THREE.MeshBasicMaterial({
      color: 0xffda1a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    }),
  );
  highlightRing.rotation.x = -Math.PI / 2;
  highlightRing.position.y = 0.025;
  highlightRing.visible = false;
  root.add(highlightRing);

  return { root, highlightRing };
}
