import * as THREE from 'three';
import type { MaterialPalette } from '../materials/Palette';

export const FOOTBALL_RADIUS = 0.24;

/**
 * Builds a stylized low-poly soccer ball with contrasting classic pentagon panels.
 */
export function createFootballMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'LowPolyFootball';

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.45,
    metalness: 0.06,
    flatShading: true,
  });
  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.55,
    metalness: 0.1,
    flatShading: true,
  });

  const ballCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(FOOTBALL_RADIUS, 1),
    whiteMat,
  );
  ballCore.castShadow = true;
  ballCore.receiveShadow = true;
  group.add(ballCore);

  // Add dark low-poly pentagon patch caps evenly across axes for clear rotation readability
  const patchGeo = new THREE.CylinderGeometry(0.088, 0.088, 0.025, 5);
  const dirs: Array<[number, number, number]> = [
    [0, 1, 0],
    [0, -1, 0],
    [1, 0.35, 0],
    [-1, -0.35, 0],
    [0, 0.35, 1],
    [0, -0.35, -1],
  ];
  const up = new THREE.Vector3(0, 1, 0);
  for (const [dx, dy, dz] of dirs) {
    const patch = new THREE.Mesh(patchGeo, blackMat);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    patch.position.copy(dir).multiplyScalar(FOOTBALL_RADIUS * 0.94);
    patch.quaternion.setFromUnitVectors(up, dir);
    group.add(patch);
  }

  return group;
}

/**
 * Builds an IKEA-styled low-poly mini-pitch football goal with posts, crossbar, and mesh net.
 */
export function createIkeaGoalMesh(
  palette: MaterialPalette,
  accentColor: number,
  width = 3.2,
  height = 1.65,
  depth = 1.05,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'IkeaFootballGoal';

  const postMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.25,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.35,
    metalness: 0.25,
    emissive: accentColor,
    emissiveIntensity: 0.18,
  });
  const netMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    wireframe: true,
  });

  const halfW = width / 2;
  const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, height, 8), postMat);
  leftPost.position.set(-halfW, height / 2, 0);
  const rightPost = leftPost.clone();
  rightPost.position.x = halfW;

  const crossbar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, width + 0.11, 8),
    trimMat,
  );
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, height, 0);

  // Rear frame supports
  const backBottom = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, 0.06), palette.metalGrey);
  backBottom.position.set(0, 0.03, depth);
  const backLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, depth), palette.metalGrey);
  backLeft.position.set(-halfW, 0.03, depth / 2);
  const backRight = backLeft.clone();
  backRight.position.x = halfW;

  const backNet = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 8, 5), netMat);
  backNet.position.set(0, height / 2, depth);
  const topNet = new THREE.Mesh(new THREE.PlaneGeometry(width, depth, 8, 3), netMat);
  topNet.rotation.x = Math.PI / 2;
  topNet.position.set(0, height, depth / 2);

  group.add(leftPost, rightPost, crossbar, backBottom, backLeft, backRight, backNet, topNet);
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material !== netMat) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return group;
}
