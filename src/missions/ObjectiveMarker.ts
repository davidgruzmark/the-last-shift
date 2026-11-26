import * as THREE from 'three';

export interface ScreenNavState {
  visible: boolean;
  offScreen: boolean;
  x: number;
  y: number;
  angleRad: number;
  distanceMeters: number;
  verticalHint: 'same' | 'up' | 'down';
}

/**
 * World-space 3D objective beacon + screen-space directional indicator calculator.
 */
export class ObjectiveMarker {
  readonly group = new THREE.Group();
  private readonly diamond: THREE.Mesh;
  private readonly floorRing: THREE.Mesh;
  private targetPos: THREE.Vector3 | null = null;
  private animTime = 0;

  constructor() {
    this.group.name = 'ObjectiveMarker';
    this.group.visible = false;

    const diamondGeo = new THREE.OctahedronGeometry(0.28, 0);
    const diamondMat = new THREE.MeshStandardMaterial({
      color: 0xffda1a,
      emissive: 0xffda1a,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      flatShading: true,
    });
    this.diamond = new THREE.Mesh(diamondGeo, diamondMat);
    this.diamond.position.y = 2.35;

    const ringGeo = new THREE.RingGeometry(0.55, 0.75, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffda1a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    this.floorRing = new THREE.Mesh(ringGeo, ringMat);
    this.floorRing.rotation.x = -Math.PI / 2;
    this.floorRing.position.y = 0.03;

    this.group.add(this.diamond, this.floorRing);
  }

  setTarget(pos: THREE.Vector3 | null): void {
    if (!pos) {
      this.targetPos = null;
      this.group.visible = false;
      return;
    }
    this.targetPos = pos.clone();
    this.group.position.set(pos.x, pos.y, pos.z);
    this.group.visible = true;
  }

  update(dt: number): void {
    if (!this.targetPos) return;
    this.animTime += dt * 3.0;
    this.diamond.position.y = 2.35 + Math.sin(this.animTime) * 0.22;
    this.diamond.rotation.y += dt * 2.2;
    const pulse = 1 + Math.sin(this.animTime * 1.4) * 0.12;
    this.floorRing.scale.setScalar(pulse);
  }

  computeScreenNav(
    camera: THREE.Camera,
    playerPos: THREE.Vector3,
    viewportW: number,
    viewportH: number,
  ): ScreenNavState {
    if (!this.targetPos || viewportW <= 0 || viewportH <= 0) {
      return {
        visible: false,
        offScreen: false,
        x: 0,
        y: 0,
        angleRad: 0,
        distanceMeters: 0,
        verticalHint: 'same',
      };
    }

    const dy = this.targetPos.y - playerPos.y;
    const verticalHint: 'same' | 'up' | 'down' = dy > 2.4 ? 'up' : dy < -2.4 ? 'down' : 'same';
    const dist = Math.hypot(
      this.targetPos.x - playerPos.x,
      this.targetPos.z - playerPos.z,
    );

    const projected = new THREE.Vector3(
      this.targetPos.x,
      this.targetPos.y + 1.8,
      this.targetPos.z,
    ).project(camera);

    const isBehind = projected.z > 1;
    let ndcX = projected.x;
    let ndcY = projected.y;

    if (isBehind) {
      ndcX = -ndcX;
      ndcY = -ndcY;
    }

    const onScreen =
      !isBehind && Math.abs(ndcX) <= 0.88 && Math.abs(ndcY) <= 0.85;

    if (onScreen) {
      return {
        visible: verticalHint !== 'same',
        offScreen: false,
        x: (ndcX * 0.5 + 0.5) * viewportW,
        y: Math.max(70, (-ndcY * 0.5 + 0.5) * viewportH - 36),
        angleRad: 0,
        distanceMeters: dist,
        verticalHint,
      };
    }

    // Clamp to safe viewport border so the directional arrow points cleanly toward the objective
    const angle = Math.atan2(-ndcY, ndcX);
    const maxNdc = Math.max(Math.abs(ndcX), Math.abs(ndcY), 1e-4);
    const clampedNdcX = (ndcX / maxNdc) * 0.86;
    const clampedNdcY = (ndcY / maxNdc) * 0.78;

    return {
      visible: true,
      offScreen: true,
      x: (clampedNdcX * 0.5 + 0.5) * viewportW,
      y: (-clampedNdcY * 0.5 + 0.5) * viewportH,
      angleRad: angle,
      distanceMeters: dist,
      verticalHint,
    };
  }
}
