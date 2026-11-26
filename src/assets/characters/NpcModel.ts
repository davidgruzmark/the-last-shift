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
  hips: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
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
 * Articulated Stylized Low-Poly IKEA employee NPC matching Kfir's art direction,
 * supporting walking, idle, sitting, and distinct default/female silhouettes.
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

  const hips = new THREE.Group();
  hips.position.y = 0.78;
  root.add(hips);

  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.56, 0);
  torso.add(headGroup);

  const buildLeg = (x: number, legW: number, shoeW: number, legH: number): THREE.Group => {
    const legPivot = new THREE.Group();
    legPivot.position.set(x, -0.05, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legW + 0.015), pantsMat);
    leg.position.y = -legH / 2 + 0.02;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(shoeW, 0.095, 0.21), shoesMat);
    shoe.position.set(0, -0.68, 0.028);
    legPivot.add(leg, shoe);
    hips.add(legPivot);
    return legPivot;
  };

  const buildArm = (x: number, sleeveW: number, armW: number): THREE.Group => {
    const armPivot = new THREE.Group();
    armPivot.position.set(x, 0.44, 0);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(sleeveW, 0.19, sleeveW + 0.01), shirtMat);
    sleeve.position.y = -0.08;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(armW, 0.31, armW), skinMat);
    arm.position.y = -0.31;
    armPivot.add(sleeve, arm);
    torso.add(armPivot);
    return armPivot;
  };

  let leftLeg: THREE.Group;
  let rightLeg: THREE.Group;
  let leftArm: THREE.Group;
  let rightArm: THREE.Group;

  if (isFemale) {
    leftLeg = buildLeg(0.095, 0.13, 0.14, 0.65);
    rightLeg = buildLeg(-0.095, 0.13, 0.14, 0.65);

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.21), pantsMat);
    hips.add(pelvis);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.21), shirtMat);
    chest.name = 'FemaleTorso';
    chest.position.y = 0.25;
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.065, 0.18), palette.ikeaBlue);
    collar.position.set(0, 0.505, 0.01);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.02), palette.ikeaBlue);
    badge.position.set(0.1, 0.34, 0.112);
    torso.add(chest, collar, badge);

    leftArm = buildArm(0.255, 0.105, 0.085);
    rightArm = buildArm(-0.255, 0.105, 0.085);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.28), skinMat);
    head.position.y = 0.15;
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.04, 0.02), eyeMat);
    eyeL.position.set(0.06, 0.17, 0.142);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.04, 0.02), eyeMat);
    eyeR.position.set(-0.06, 0.17, 0.142);
    const browL = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.018), hairMat);
    browL.position.set(0.06, 0.215, 0.143);
    const browR = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.018), hairMat);
    browR.position.set(-0.06, 0.215, 0.143);
    const lipAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.022, 0.018),
      mat(0xb8666a, 0.65),
    );
    lipAccent.position.set(0, 0.075, 0.142);

    const hairCrown = new THREE.Mesh(new THREE.BoxGeometry(0.325, 0.11, 0.305), hairMat);
    hairCrown.position.set(0, 0.335, -0.01);
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.075), hairMat);
    hairBack.position.set(0, 0.16, -0.14);
    headGroup.add(head, eyeL, eyeR, browL, browR, lipAccent, hairCrown, hairBack);

    [-0.145, 0.145].forEach((x) => {
      const sideLock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.11), hairMat);
      sideLock.position.set(x, 0.17, -0.04);
      headGroup.add(sideLock);
    });

    if (hairStyle === 'ponytail') {
      const hairTie = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.055, 0.06),
        palette.ikeaBlue,
      );
      hairTie.position.set(0, 0.19, -0.19);
      const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.1), hairMat);
      ponytail.name = 'FemalePonytail';
      ponytail.position.set(0, 0.04, -0.22);
      ponytail.rotation.x = 0.22;
      headGroup.add(hairTie, ponytail);
    }
  } else {
    leftLeg = buildLeg(0.11, 0.15, 0.16, 0.65);
    rightLeg = buildLeg(-0.11, 0.15, 0.16, 0.65);

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.22), pantsMat);
    hips.add(pelvis);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.52, 0.24), shirtMat);
    chest.position.y = 0.26;
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.2), palette.ikeaBlue);
    collar.position.set(0, 0.52, 0.01);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.02), palette.ikeaBlue);
    badge.position.set(0.12, 0.36, 0.125);
    torso.add(chest, collar, badge);

    leftArm = buildArm(0.31, 0.13, 0.1);
    rightArm = buildArm(-0.31, 0.13, 0.1);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), skinMat);
    head.position.y = 0.17;
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.32), hairMat);
    hair.position.set(0, 0.36, -0.01);
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.06), hairMat);
    hairBack.position.set(0, 0.24, -0.14);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eyeMat);
    eyeL.position.set(0.065, 0.19, 0.152);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eyeMat);
    eyeR.position.set(-0.065, 0.19, 0.152);
    headGroup.add(head, hair, hairBack, eyeL, eyeR);
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

  return {
    root,
    hips,
    torso,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    highlightRing,
  };
}
