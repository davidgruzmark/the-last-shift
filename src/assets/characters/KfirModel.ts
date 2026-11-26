import * as THREE from 'three';
import { IKEA_COLORS } from '../../config/constants';
import type { MaterialPalette } from '../materials/Palette';

export interface KfirRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

function enableShadows(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = child.userData.noSelfShadow ? false : true;
    }
  });
}

function mat(color: number, roughness = 0.8, metalness = 0.05): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: true,
  });
}

/**
 * Builds Kfir as an articulated Stylized Low-Poly 3D character (~1.75m tall).
 * Features:
 * - Natural fair skin tone
 * - Dark brown short Marine-style fade haircut (zero overlapping / coplanar hair geometry)
 * - Distinct dark brown mustache and short chin goatee
 * - Black polo shirt (folded collar, V-neck placket, buttons, short sleeves) + KFIR badge
 * - Walkie-talkie, security belt, key ring, beige work trousers, and dark work shoes
 */
export function createKfirModel(palette: MaterialPalette): KfirRig {
  const root = new THREE.Group();
  root.name = 'KfirRoot';

  const skinMat = mat(IKEA_COLORS.skin, 0.78, 0.02);
  const hairMat = mat(IKEA_COLORS.hair, 0.88, 0.02);
  const hairMidFadeMat = mat(IKEA_COLORS.hairMidFade, 0.89, 0.02);
  const hairFadeMat = mat(IKEA_COLORS.hairFade, 0.9, 0.02);
  const facialHairMat = mat(IKEA_COLORS.facialHair, 0.88, 0.02);
  const shirtMat = mat(IKEA_COLORS.securityShirt, 0.82, 0.04);
  const collarMat = mat(IKEA_COLORS.poloCollar, 0.8, 0.04);
  const buttonMat = mat(0x555d68, 0.5, 0.25);
  const pantsMat = mat(IKEA_COLORS.securityPants, 0.86, 0.03);
  const bootsMat = mat(IKEA_COLORS.boots, 0.72, 0.1);
  const eyeMat = mat(0x141418, 0.3, 0.1);
  const radioBodyMat = mat(0x20262e, 0.6, 0.2);
  const radioLedMat = new THREE.MeshStandardMaterial({
    color: 0x2ecc71,
    emissive: 0x2ecc71,
    emissiveIntensity: 0.75,
    roughness: 0.3,
  });
  const holsterMat = mat(0x1a1c20, 0.7, 0.12);
  const gunmetalMat = mat(0x363d47, 0.38, 0.65);
  const pistolGripMat = mat(0x16181c, 0.85, 0.08);

  const hips = new THREE.Group();
  hips.position.y = 0.78;
  root.add(hips);

  // Pelvis block (beige work trousers)
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.24), pantsMat);
  hips.add(pelvis);

  // Torso group pivoted from hips
  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);

  // Black polo shirt body
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.54, 0.26), shirtMat);
  chest.position.y = 0.27;
  torso.add(chest);

  // Polo collar: back collar + left/right folded collar flaps + fair-skin V-opening + placket
  const backCollar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.065, 0.08), collarMat);
  backCollar.position.set(0, 0.545, -0.055);
  torso.add(backCollar);

  const leftCollarFlap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.15), collarMat);
  leftCollarFlap.position.set(0.085, 0.535, 0.055);
  leftCollarFlap.rotation.z = -0.18;
  leftCollarFlap.rotation.y = -0.12;
  torso.add(leftCollarFlap);

  const rightCollarFlap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.15), collarMat);
  rightCollarFlap.position.set(-0.085, 0.535, 0.055);
  rightCollarFlap.rotation.z = 0.18;
  rightCollarFlap.rotation.y = 0.12;
  torso.add(rightCollarFlap);

  // Subtle polo V-neck skin & vertical placket with two small buttons
  const neckV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.075, 0.02), skinMat);
  neckV.position.set(0, 0.505, 0.128);
  torso.add(neckV);

  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.014), collarMat);
  placket.position.set(0, 0.42, 0.132);
  torso.add(placket);

  const btnGeo = new THREE.BoxGeometry(0.018, 0.018, 0.012);
  const topButton = new THREE.Mesh(btnGeo, buttonMat);
  topButton.position.set(0, 0.455, 0.139);
  const bottomButton = new THREE.Mesh(btnGeo, buttonMat);
  bottomButton.position.set(0, 0.39, 0.139);
  torso.add(topButton, bottomButton);

  // KFIR Badge on left chest (facing +Z forward in local space)
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.02), palette.kfirBadge);
  badge.position.set(0.135, 0.355, 0.138);
  torso.add(badge);

  // Security belt + silver buckle
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.27), bootsMat);
  belt.position.set(0, 0.03, 0);
  torso.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), palette.metalGrey);
  buckle.position.set(0, 0.03, 0.138);
  torso.add(buckle);

  // Security radio (walkie-talkie) mounted on left-rear belt
  const radioGroup = new THREE.Group();
  radioGroup.name = 'kfir-radio';
  radioGroup.position.set(0.246, 0.045, -0.055);
  torso.add(radioGroup);

  const radioClip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.04), bootsMat);
  radioClip.position.set(-0.015, -0.01, 0);
  const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.125, 0.068), radioBodyMat);
  radioBody.position.set(0.01, 0.015, 0);
  const radioSpeaker = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.055, 0.046), palette.metalGrey);
  radioSpeaker.position.set(0.034, 0.02, 0);
  const radioLed = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.014, 0.014), radioLedMat);
  radioLed.position.set(0.032, 0.068, 0.016);
  const radioAntenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.009, 0.13, 6),
    bootsMat,
  );
  radioAntenna.position.set(0.01, 0.14, -0.018);
  radioGroup.add(radioClip, radioBody, radioSpeaker, radioLed, radioAntenna);

  // Key ring preserved on left-front belt
  const keysGroup = new THREE.Group();
  keysGroup.name = 'kfir-keys';
  keysGroup.position.set(0.24, 0.01, 0.065);
  torso.add(keysGroup);

  const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 10), palette.gold);
  keyRing.rotation.y = Math.PI / 2;
  const keyBlade1 = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.06, 0.024), palette.gold);
  keyBlade1.position.set(0, -0.05, 0.005);
  const keyBlade2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.02), palette.metalGrey);
  keyBlade2.position.set(0.006, -0.045, -0.012);
  keysGroup.add(keyRing, keyBlade1, keyBlade2);

  // Service pistol in belt-mounted holster on right hip (visual accessory only)
  const holsterGroup = new THREE.Group();
  holsterGroup.name = 'kfir-pistol-holster';
  holsterGroup.position.set(-0.248, 0.0, 0.01);
  torso.add(holsterGroup);

  const beltLoop = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.075, 0.075), holsterMat);
  beltLoop.position.set(0.012, 0.028, 0);
  const holsterBody = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.15, 0.088), holsterMat);
  holsterBody.position.set(-0.012, -0.04, 0.005);
  holsterBody.rotation.x = 0.08;
  const retentionStrap = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.024, 0.092), palette.metalDark);
  retentionStrap.position.set(-0.012, 0.02, 0.005);
  // Service pistol seated inside holster (gunmetal slide + dark grip angled backward)
  const pistolSlide = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.11, 0.056), gunmetalMat);
  pistolSlide.position.set(-0.012, -0.005, 0.015);
  pistolSlide.rotation.x = 0.12;
  const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.085, 0.046), pistolGripMat);
  pistolGrip.position.set(-0.012, 0.065, -0.028);
  pistolGrip.rotation.x = -0.35;
  holsterGroup.add(beltLoop, holsterBody, retentionStrap, pistolSlide, pistolGrip);

  // Head group (moderately stylized larger proportions)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.56, 0);
  torso.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.09, 6), skinMat);
  neck.position.y = 0.03;
  headGroup.add(neck);

  // Head occupies X [-0.170, +0.170], Y [0.060, 0.420], Z [-0.160, +0.160]
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skinMat);
  head.position.y = 0.24;
  headGroup.add(head);

  // Ears positioned outside head sides with zero overlap
  const earGeo = new THREE.BoxGeometry(0.032, 0.085, 0.055);
  const leftEar = new THREE.Mesh(earGeo, skinMat);
  leftEar.position.set(0.186, 0.225, 0);
  const rightEar = new THREE.Mesh(earGeo, skinMat);
  rightEar.position.set(-0.186, 0.225, 0);
  headGroup.add(leftEar, rightEar);

  // Non-overlapping Marine haircut:
  // Every hair piece is strictly outside the head box and strictly partitioned by Y and Z planes
  // so no two hair or head meshes ever share coplanar faces or intersect.
  const hairGroup = new THREE.Group();
  hairGroup.name = 'KfirHairGroup';
  headGroup.add(hairGroup);

  const addHairPart = (
    name: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.MeshStandardMaterial,
  ): void => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.userData.noSelfShadow = true;
    hairGroup.add(mesh);
  };

  // Lower short fade band (lighter warm brown): Y [0.240, 0.350] back, Y [0.270, 0.350] sides
  addHairPart('hair-back-lower-fade', 0.364, 0.11, 0.016, 0, 0.295, -0.168, hairFadeMat);
  addHairPart('hair-left-lower-fade', 0.012, 0.08, 0.21, 0.176, 0.31, -0.055, hairFadeMat);
  addHairPart('hair-right-lower-fade', 0.012, 0.08, 0.21, -0.176, 0.31, -0.055, hairFadeMat);

  // Upper fade transition (medium warm brown): Y [0.350, 0.420]
  addHairPart('hair-back-upper-fade', 0.372, 0.07, 0.02, 0, 0.385, -0.17, hairMidFadeMat);
  addHairPart('hair-left-upper-fade', 0.016, 0.07, 0.23, 0.178, 0.385, -0.045, hairMidFadeMat);
  addHairPart('hair-right-upper-fade', 0.016, 0.07, 0.23, -0.178, 0.385, -0.045, hairMidFadeMat);

  // Slightly longer Marine top stacked cleanly above y = 0.420
  addHairPart('hair-top-base', 0.356, 0.064, 0.336, 0, 0.452, -0.008, hairMat);
  addHairPart('hair-top-crest', 0.3, 0.028, 0.24, 0, 0.498, 0.015, hairMat);

  // Facial features cleanly in front of z = +0.160 (zero coplanarity)
  const eyeGeo = new THREE.BoxGeometry(0.044, 0.044, 0.016);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(0.07, 0.27, 0.168);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(-0.07, 0.27, 0.168);
  headGroup.add(leftEye, rightEye);

  const browGeo = new THREE.BoxGeometry(0.07, 0.02, 0.016);
  const leftBrow = new THREE.Mesh(browGeo, hairMat);
  leftBrow.position.set(0.07, 0.32, 0.168);
  leftBrow.userData.noSelfShadow = true;
  const rightBrow = new THREE.Mesh(browGeo, hairMat);
  rightBrow.position.set(-0.07, 0.32, 0.168);
  rightBrow.userData.noSelfShadow = true;
  headGroup.add(leftBrow, rightBrow);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.056, 0.032), skinMat);
  nose.position.set(0, 0.22, 0.176);
  headGroup.add(nose);

  // Distinct dark brown mustache & short chin goatee (with clear fair skin separation)
  const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.03, 0.018), facialHairMat);
  mustache.name = 'kfir-mustache';
  mustache.position.set(0, 0.168, 0.169);
  mustache.userData.noSelfShadow = true;
  headGroup.add(mustache);

  const goatee = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.05, 0.02), facialHairMat);
  goatee.name = 'kfir-goatee';
  goatee.position.set(0, 0.092, 0.17);
  goatee.userData.noSelfShadow = true;
  headGroup.add(goatee);

  // Arms pivoted at shoulders (short polo sleeves + fair forearms/hands)
  const buildArm = (xOffset: number): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(xOffset, 0.48, 0);

    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.2, 0.155), shirtMat);
    sleeve.position.y = -0.09;
    arm.add(sleeve);

    const sleeveCuff = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.025, 0.16), collarMat);
    sleeveCuff.position.y = -0.195;
    arm.add(sleeveCuff);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.25, 0.11), skinMat);
    forearm.position.y = -0.325;
    arm.add(forearm);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.095, 0.1), skinMat);
    hand.position.y = -0.465;
    arm.add(hand);

    return arm;
  };

  const leftArm = buildArm(0.33);
  const rightArm = buildArm(-0.33);
  torso.add(leftArm, rightArm);

  // Legs pivoted at hips (beige work trousers + dark work shoes)
  const buildLeg = (xOffset: number): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(xOffset, -0.05, 0);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.36, 0.18), pantsMat);
    thigh.position.y = -0.18;
    leg.add(thigh);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.28, 0.16), pantsMat);
    shin.position.y = -0.48;
    leg.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.24), bootsMat);
    boot.position.set(0, -0.665, 0.035);
    leg.add(boot);

    return leg;
  };

  const leftLeg = buildLeg(0.12);
  const rightLeg = buildLeg(-0.12);
  hips.add(leftLeg, rightLeg);

  enableShadows(root);

  return {
    root,
    hips,
    torso,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
  };
}
