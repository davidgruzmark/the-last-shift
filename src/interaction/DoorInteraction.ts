import * as THREE from 'three';
import type { MaterialPalette } from '../assets/materials/Palette';
import { PLAYER_CONFIG } from '../config/constants';
import { i18n } from '../i18n/LocalizationManager';
import type { CollisionManager } from '../world/CollisionManager';
import type { Interactable } from './Interactable';

const DEFAULT_DOOR_INTERACT_RADIUS = 3.2;
const DOOR_SWING_CLEARANCE = PLAYER_CONFIG.radius + 0.08;
const DOORWAY_BLOCK_CLEARANCE = PLAYER_CONFIG.radius + 0.14;
const DEFAULT_UNLOCK_DURATION_SEC = 0.85;

export interface DoorKeySecurityConfig {
  lockedByDefault: boolean;
  unlockDurationSec?: number;
  onUnlockStart?: () => void;
  onUnlockComplete?: () => void;
  onLock?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface ManualDoorOptions {
  id: string;
  hingePos: THREE.Vector3;
  width: number;
  height: number;
  thickness: number;
  axis: 'x' | 'z';
  openAngle: number;
  radius?: number;
  securedByKey?: DoorKeySecurityConfig;
}

export interface DoubleDoorOptions {
  id: string;
  centerPos: THREE.Vector3;
  totalWidth: number;
  height: number;
  thickness: number;
  axis: 'x' | 'z'; // Door span axis when closed
  outwardSign: 1 | -1; // Direction leaves swing into (+1 -> +X when axis==='z', or +Z when axis==='x')
  openAngleAbs?: number;
  radius?: number;
  securedByKey?: DoorKeySecurityConfig;
}

export interface AutoSlidingDoorOptions {
  id: string;
  centerPos: THREE.Vector3;
  totalWidth: number;
  height: number;
  thickness: number;
  triggerRadius?: number;
}

interface HingedLeaf {
  colliderId: string;
  pivot: THREE.Group;
  hingePos: THREE.Vector3;
  localCenter: THREE.Vector3;
  halfExtents: THREE.Vector3;
  openAngle: number;
  currentAngle: number;
  handleMesh: THREE.Mesh;
}

/**
 * Functional door supporting single/double hinged manual doors (press E)
 * and automatic sliding double glass doors, with continuous real-time
 * collision tracking and anti-displacement clearance guards.
 */
export class DoorInteraction implements Interactable {
  readonly id: string;
  readonly type = 'door' as const;
  readonly radius: number;
  readonly colliderIds: readonly string[];
  readonly meshGroup = new THREE.Group();

  private readonly mode: 'manual' | 'auto';
  private readonly collision: CollisionManager;
  private readonly worldCenter: THREE.Vector3;

  // Manual hinge leaves (1 for single door, 2 for double door)
  private leaves: HingedLeaf[] = [];

  // Auto sliding state
  private leftLeaf?: THREE.Group;
  private rightLeaf?: THREE.Group;
  private leftColliderId = '';
  private rightColliderId = '';
  private panelWidth = 0;
  private doorHeight = 0;
  private doorThickness = 0;
  private slideOffset = 0;
  private maxSlide = 0;
  private autoTriggerRadius = 4.2;

  private isOpen = false;
  private isLocked = false;
  private pendingRelock = false;
  private unlockTimer = -1;
  private unlockTurnNotified = false;
  private readonly security?: DoorKeySecurityConfig;
  private lockLedMat?: THREE.MeshStandardMaterial;
  private keyPropGroup?: THREE.Group;
  private keyAxis: 'x' | 'z' = 'z';
  private keyBasePos = new THREE.Vector3();
  private lastPlayerPos = new THREE.Vector3(1e6, 0, 1e6);
  private highlightRing?: THREE.Mesh;

  private constructor(
    id: string,
    mode: 'manual' | 'auto',
    radius: number,
    worldCenter: THREE.Vector3,
    collision: CollisionManager,
    colliderIds: readonly string[],
    securedByKey?: DoorKeySecurityConfig,
  ) {
    this.id = id;
    this.mode = mode;
    this.radius = radius;
    this.worldCenter = worldCenter.clone();
    this.collision = collision;
    this.colliderIds = colliderIds;
    this.security = securedByKey;
    this.isLocked = Boolean(securedByKey?.lockedByDefault);
    this.meshGroup.name = `Door_${id}`;
  }

  static createManualHinged(
    options: ManualDoorOptions,
    palette: MaterialPalette,
    collision: CollisionManager,
  ): DoorInteraction {
    const {
      id,
      hingePos,
      width,
      height,
      thickness,
      axis,
      openAngle,
      radius = DEFAULT_DOOR_INTERACT_RADIUS,
    } = options;

    const center = hingePos.clone();
    if (axis === 'z') {
      center.z += width / 2;
    } else {
      center.x += width / 2;
    }

    const colId = `door-col-${id}`;
    const door = new DoorInteraction(
      id,
      'manual',
      radius,
      center,
      collision,
      [colId],
      options.securedByKey,
    );

    const leaf = DoorInteraction.buildHingedLeaf(
      colId,
      hingePos,
      width,
      1,
      height,
      thickness,
      axis,
      openAngle,
      palette,
      collision,
    );
    door.leaves.push(leaf);
    if (options.securedByKey) {
      door.attachSecurityLockHardware(leaf, width, 1, thickness, axis);
    }
    door.meshGroup.add(leaf.pivot, door.createHighlightPad(center));

    return door;
  }

  static createDoubleHinged(
    options: DoubleDoorOptions,
    palette: MaterialPalette,
    collision: CollisionManager,
  ): DoorInteraction {
    const {
      id,
      centerPos,
      totalWidth,
      height,
      thickness,
      axis,
      outwardSign,
      openAngleAbs = 1.56,
      radius = DEFAULT_DOOR_INTERACT_RADIUS,
      securedByKey,
    } = options;

    const leafWidth = totalWidth / 2;
    const colA = `door-col-${id}-a`;
    const colB = `door-col-${id}-b`;
    const door = new DoorInteraction(
      id,
      'manual',
      radius,
      centerPos,
      collision,
      [colA, colB],
      securedByKey,
    );

    const hingeA = centerPos.clone();
    const hingeB = centerPos.clone();
    if (axis === 'z') {
      hingeA.z -= leafWidth;
      hingeB.z += leafWidth;
    } else {
      hingeA.x -= leafWidth;
      hingeB.x += leafWidth;
    }

    // Leaf A spans +leafWidth from hingeA; Leaf B spans -leafWidth from hingeB
    // For axis==='z': rotation.y = +theta swings +Z toward +X (outwardSign = +1)
    // Leaf B (-Z span): rotation.y = -theta swings -Z toward +X (outwardSign = +1)
    const angleA = axis === 'z' ? openAngleAbs * outwardSign : -openAngleAbs * outwardSign;
    const angleB = -angleA;

    const leafA = DoorInteraction.buildHingedLeaf(
      colA,
      hingeA,
      leafWidth,
      1,
      height,
      thickness,
      axis,
      angleA,
      palette,
      collision,
    );
    const leafB = DoorInteraction.buildHingedLeaf(
      colB,
      hingeB,
      leafWidth,
      -1,
      height,
      thickness,
      axis,
      angleB,
      palette,
      collision,
    );

    door.leaves.push(leafA, leafB);
    if (securedByKey) {
      door.attachSecurityLockHardware(leafA, leafWidth, 1, thickness, axis);
    }
    door.meshGroup.add(leafA.pivot, leafB.pivot, door.createHighlightPad(centerPos));

    return door;
  }

  static createAutoSliding(
    options: AutoSlidingDoorOptions,
    palette: MaterialPalette,
    collision: CollisionManager,
  ): DoorInteraction {
    const { id, centerPos, totalWidth, height, thickness, triggerRadius = 4.2 } = options;
    const leftCol = `door-col-${id}-left`;
    const rightCol = `door-col-${id}-right`;
    const door = new DoorInteraction(id, 'auto', triggerRadius, centerPos, collision, [
      leftCol,
      rightCol,
    ]);
    door.autoTriggerRadius = triggerRadius;

    const panelW = totalWidth / 2;
    door.panelWidth = panelW;
    door.doorHeight = height;
    door.doorThickness = thickness;
    door.maxSlide = panelW * 0.92;
    door.leftColliderId = leftCol;
    door.rightColliderId = rightCol;

    const buildPanel = (offsetX: number): THREE.Group => {
      const panel = new THREE.Group();
      panel.position.set(centerPos.x + offsetX, 0, centerPos.z);

      const glassH = height - 0.26;
      const frameBot = new THREE.Mesh(
        new THREE.BoxGeometry(panelW - 0.02, 0.14, thickness + 0.02),
        palette.ikeaBlue,
      );
      frameBot.position.y = 0.07;

      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(panelW - 0.04, glassH, thickness),
        palette.glass,
      );
      glass.position.y = 0.14 + glassH / 2;

      const frameTop = new THREE.Mesh(
        new THREE.BoxGeometry(panelW - 0.02, 0.12, thickness + 0.02),
        palette.metalDark,
      );
      frameTop.position.y = height - 0.06;

      const faceZ = thickness / 2 + 0.01;
      [-faceZ, faceZ].forEach((zOff) => {
        const safetyBand = new THREE.Mesh(
          new THREE.BoxGeometry(panelW - 0.08, 0.1, 0.005),
          palette.ikeaYellow,
        );
        safetyBand.position.set(0, 1.2, zOff);
        safetyBand.castShadow = false;
        safetyBand.receiveShadow = false;
        panel.add(safetyBand);
      });

      panel.add(frameBot, glass, frameTop);
      return panel;
    };

    door.leftLeaf = buildPanel(-panelW / 2);
    door.rightLeaf = buildPanel(panelW / 2);
    door.meshGroup.add(door.leftLeaf, door.rightLeaf);

    const sensor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.24), palette.metalDark);
    sensor.position.set(centerPos.x, height + 0.12, centerPos.z);
    door.meshGroup.add(sensor);

    const halfPanel = panelW / 2;
    const halfT = thickness / 2;
    collision.addBox(
      leftCol,
      new THREE.Vector3(centerPos.x - panelW, 0, centerPos.z - halfT),
      new THREE.Vector3(centerPos.x, height, centerPos.z + halfT),
      false,
    );
    collision.addBox(
      rightCol,
      new THREE.Vector3(centerPos.x, 0, centerPos.z - halfT),
      new THREE.Vector3(centerPos.x + halfPanel * 2, height, centerPos.z + halfT),
      false,
    );

    return door;
  }

  private static buildHingedLeaf(
    colliderId: string,
    hingePos: THREE.Vector3,
    width: number,
    spanDir: 1 | -1,
    height: number,
    thickness: number,
    axis: 'x' | 'z',
    openAngle: number,
    palette: MaterialPalette,
    collision: CollisionManager,
  ): HingedLeaf {
    const pivot = new THREE.Group();
    pivot.position.copy(hingePos);

    const leafSpan = width - 0.02;
    const leafW = axis === 'x' ? leafSpan : thickness;
    const leafD = axis === 'z' ? leafSpan : thickness;
    const offsetX = axis === 'x' ? spanDir * (width / 2) : 0;
    const offsetZ = axis === 'z' ? spanDir * (width / 2) : 0;

    const localCenter = new THREE.Vector3(offsetX, height / 2, offsetZ);
    const halfExtents = new THREE.Vector3(leafW / 2, height / 2, leafD / 2);

    const leafMesh = new THREE.Mesh(new THREE.BoxGeometry(leafW, height, leafD), palette.ikeaBlue);
    leafMesh.position.set(offsetX, height / 2, offsetZ);
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    pivot.add(leafMesh);

    const faceOffset = thickness / 2 + 0.012;
    const winSpan = width * 0.44;
    const stripeSpan = leafSpan - 0.06;

    [-faceOffset, faceOffset].forEach((side) => {
      const winPanel = new THREE.Mesh(
        new THREE.BoxGeometry(axis === 'x' ? winSpan : 0.006, 0.72, axis === 'z' ? winSpan : 0.006),
        palette.glass,
      );
      winPanel.position.set(
        offsetX + (axis === 'z' ? side : 0),
        height * 0.66,
        offsetZ + (axis === 'x' ? side : 0),
      );
      winPanel.castShadow = false;
      winPanel.receiveShadow = false;
      pivot.add(winPanel);

      const stripePanel = new THREE.Mesh(
        new THREE.BoxGeometry(
          axis === 'x' ? stripeSpan : 0.006,
          0.14,
          axis === 'z' ? stripeSpan : 0.006,
        ),
        palette.ikeaYellow,
      );
      stripePanel.position.set(
        offsetX + (axis === 'z' ? side : 0),
        0.95,
        offsetZ + (axis === 'x' ? side : 0),
      );
      stripePanel.castShadow = false;
      stripePanel.receiveShadow = false;
      pivot.add(stripePanel);
    });

    const handleW = axis === 'x' ? 0.2 : thickness + 0.14;
    const handleD = axis === 'z' ? 0.2 : thickness + 0.14;
    const handleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(handleW, 0.08, handleD),
      palette.ikeaYellow,
    );
    handleMesh.position.set(
      axis === 'x' ? spanDir * width * 0.8 : 0,
      1.05,
      axis === 'z' ? spanDir * width * 0.8 : 0,
    );
    pivot.add(handleMesh);

    const leaf: HingedLeaf = {
      colliderId,
      pivot,
      hingePos: hingePos.clone(),
      localCenter,
      halfExtents,
      openAngle,
      currentAngle: 0,
      handleMesh,
    };

    collision.addOrientedBox(
      colliderId,
      DoorInteraction.computeLeafWorldCenter(leaf, 0),
      halfExtents,
      0,
      true,
    );

    return leaf;
  }

  private createHighlightPad(center: THREE.Vector3): THREE.Mesh {
    const pad = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.42, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffda1a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(center.x, 0.025, center.z);
    pad.visible = false;
    this.highlightRing = pad;
    return pad;
  }

  private attachSecurityLockHardware(
    leaf: HingedLeaf,
    leafWidth: number,
    spanDir: 1 | -1,
    thickness: number,
    axis: 'x' | 'z',
  ): void {
    const lockAlong = spanDir * leafWidth * 0.84;
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x2a313b,
      roughness: 0.35,
      metalness: 0.78,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xf4c430,
      roughness: 0.28,
      metalness: 0.85,
    });
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x090b0f });
    this.lockLedMat = new THREE.MeshStandardMaterial({
      color: this.isLocked ? 0xef4444 : 0x22c55e,
      emissive: this.isLocked ? 0xef4444 : 0x22c55e,
      emissiveIntensity: 1.0,
      roughness: 0.3,
    });

    const plateW = axis === 'x' ? 0.14 : thickness + 0.04;
    const plateD = axis === 'z' ? 0.14 : thickness + 0.04;
    const lockPos = new THREE.Vector3(
      axis === 'x' ? lockAlong : 0,
      1.18,
      axis === 'z' ? lockAlong : 0,
    );

    const escutcheon = new THREE.Mesh(new THREE.BoxGeometry(plateW, 0.24, plateD), plateMat);
    escutcheon.position.copy(lockPos);
    leaf.pivot.add(escutcheon);

    const sideOffset = thickness / 2 + 0.024;
    [-sideOffset, sideOffset].forEach((side) => {
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.016, 12),
        brassMat,
      );
      cylinder.rotation.z = axis === 'z' ? Math.PI / 2 : 0;
      cylinder.rotation.x = axis === 'x' ? Math.PI / 2 : 0;
      cylinder.position.set(
        lockPos.x + (axis === 'z' ? side : 0),
        1.16,
        lockPos.z + (axis === 'x' ? side : 0),
      );
      const slit = new THREE.Mesh(
        new THREE.BoxGeometry(axis === 'x' ? 0.012 : 0.01, 0.034, axis === 'z' ? 0.012 : 0.01),
        holeMat,
      );
      slit.position.set(
        lockPos.x + (axis === 'z' ? side * 1.08 : 0),
        1.16,
        lockPos.z + (axis === 'x' ? side * 1.08 : 0),
      );
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.025), this.lockLedMat!);
      led.position.set(
        lockPos.x + (axis === 'z' ? side : 0),
        1.255,
        lockPos.z + (axis === 'x' ? side : 0),
      );
      leaf.pivot.add(cylinder, slit, led);
    });

    // Animated physical brass key shown during insertion + 90-degree lock turn
    const keyGroup = new THREE.Group();
    keyGroup.name = 'ControlRoomPhysicalKey';
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.065, 0.065), brassMat);
    bow.position.x = axis === 'z' ? -0.055 : 0;
    bow.position.z = axis === 'x' ? -0.055 : 0;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(axis === 'z' ? 0.095 : 0.014, 0.018, axis === 'x' ? 0.095 : 0.014),
      brassMat,
    );
    keyGroup.add(bow, blade);
    keyGroup.position.set(lockPos.x, 1.16, lockPos.z);
    keyGroup.visible = false;
    leaf.pivot.add(keyGroup);

    this.keyPropGroup = keyGroup;
    this.keyAxis = axis;
    this.keyBasePos.set(lockPos.x, 1.16, lockPos.z);
  }

  getWorldPosition(): THREE.Vector3 {
    return this.worldCenter;
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }

  getIsLocked(): boolean {
    return this.isLocked;
  }

  isUnlocking(): boolean {
    return this.unlockTimer >= 0;
  }

  getCurrentAngle(): number {
    return this.leaves[0]?.currentAngle ?? 0;
  }

  isPlayerInDoorway(playerPos: THREE.Vector3): boolean {
    if (this.mode !== 'manual') return false;
    // Check both the closed doorway AND the swing arc so closing never hits or traps the player
    for (const leaf of this.leaves) {
      if (
        this.wouldLeafOverlapPlayer(leaf, 0, playerPos, DOORWAY_BLOCK_CLEARANCE) ||
        this.wouldLeafOverlapPlayer(leaf, leaf.openAngle * 0.5, playerPos, DOOR_SWING_CLEARANCE)
      ) {
        return true;
      }
    }
    return false;
  }

  canInteract(): boolean {
    return this.mode === 'manual' && !this.isUnlocking();
  }

  getPromptText(): string {
    if (this.mode === 'auto') return '';
    if (this.isUnlocking()) {
      return i18n.t('prompt.doorUnlocking');
    }
    if (this.isLocked) {
      return i18n.t('prompt.doorUnlock');
    }
    if (this.isOpen) {
      if (this.isPlayerInDoorway(this.lastPlayerPos)) {
        return i18n.t('prompt.doorClear');
      }
      return this.security ? i18n.t('prompt.doorCloseLock') : i18n.t('prompt.doorClose');
    }
    return i18n.t('prompt.doorOpen');
  }

  setHighlighted(active: boolean): void {
    if (this.highlightRing) {
      this.highlightRing.visible = active;
    }
    for (const leaf of this.leaves) {
      leaf.handleMesh.scale.setScalar(active ? 1.18 : 1.0);
    }
  }

  onInteract(): void {
    if (this.mode !== 'manual' || this.isUnlocking()) return;

    if (this.isLocked) {
      this.unlockTimer = 0;
      this.unlockTurnNotified = false;
      if (this.keyPropGroup) {
        this.keyPropGroup.visible = true;
      }
      this.security?.onUnlockStart?.();
      return;
    }

    if (this.isOpen && this.isPlayerInDoorway(this.lastPlayerPos)) {
      return;
    }

    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.pendingRelock = false;
      this.security?.onOpen?.();
    } else {
      this.pendingRelock = Boolean(this.security);
      this.security?.onClose?.();
    }
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    this.lastPlayerPos.copy(playerPos);
    const smooth = 1 - Math.exp(-8.5 * dt);

    if (this.unlockTimer >= 0) {
      const duration = this.security?.unlockDurationSec ?? DEFAULT_UNLOCK_DURATION_SEC;
      this.unlockTimer += dt;
      const p = Math.min(1, this.unlockTimer / duration);

      // Determine which side of the door Kfir stands on so key inserts facing him
      const sideSign =
        this.keyAxis === 'z'
          ? playerPos.x >= this.worldCenter.x
            ? 1
            : -1
          : playerPos.z >= this.worldCenter.z
            ? 1
            : -1;

      if (this.keyPropGroup) {
        const insertT = Math.min(1, p / 0.35);
        const turnT = p > 0.35 ? Math.min(1, (p - 0.35) / 0.55) : 0;
        const offsetOut = THREE.MathUtils.lerp(0.18, 0.06, insertT) * sideSign;

        if (this.keyAxis === 'z') {
          this.keyPropGroup.position.set(
            this.keyBasePos.x + offsetOut,
            this.keyBasePos.y,
            this.keyBasePos.z,
          );
          this.keyPropGroup.rotation.set(turnT * (Math.PI / 2), sideSign < 0 ? Math.PI : 0, 0);
        } else {
          this.keyPropGroup.position.set(
            this.keyBasePos.x,
            this.keyBasePos.y,
            this.keyBasePos.z + offsetOut,
          );
          this.keyPropGroup.rotation.set(0, sideSign < 0 ? Math.PI : 0, turnT * (Math.PI / 2));
        }
      }

      if (p >= 0.35 && !this.unlockTurnNotified) {
        this.unlockTurnNotified = true;
        this.security?.onUnlockComplete?.();
      }

      if (p >= 1) {
        this.unlockTimer = -1;
        this.isLocked = false;
        this.isOpen = true;
        this.pendingRelock = false;
        if (this.keyPropGroup) {
          this.keyPropGroup.visible = false;
        }
        if (this.lockLedMat) {
          this.lockLedMat.color.setHex(0x22c55e);
          this.lockLedMat.emissive.setHex(0x22c55e);
        }
        this.security?.onOpen?.();
      }
    }

    if (this.mode === 'manual' && this.leaves.length > 0) {
      for (const leaf of this.leaves) {
        const targetAngle = this.isOpen ? leaf.openAngle : 0;
        let candidateAngle = leaf.currentAngle + (targetAngle - leaf.currentAngle) * smooth;
        if (Math.abs(targetAngle - candidateAngle) < 0.002) {
          candidateAngle = targetAngle;
        }

        if (!this.wouldLeafOverlapPlayer(leaf, candidateAngle, playerPos, DOOR_SWING_CLEARANCE)) {
          leaf.currentAngle = candidateAngle;
        }
        leaf.pivot.rotation.y = leaf.currentAngle;

        this.collision.updateOrientedBox(
          leaf.colliderId,
          DoorInteraction.computeLeafWorldCenter(leaf, leaf.currentAngle),
          leaf.halfExtents,
          leaf.currentAngle,
        );
      }

      if (
        this.pendingRelock &&
        !this.isOpen &&
        this.leaves.every((l) => Math.abs(l.currentAngle) < 0.03)
      ) {
        this.pendingRelock = false;
        this.isLocked = true;
        if (this.lockLedMat) {
          this.lockLedMat.color.setHex(0xef4444);
          this.lockLedMat.emissive.setHex(0xef4444);
        }
        this.security?.onLock?.();
      }
      return;
    }

    if (this.mode === 'auto' && this.leftLeaf && this.rightLeaf) {
      const dist = Math.hypot(playerPos.x - this.worldCenter.x, playerPos.z - this.worldCenter.z);
      this.isOpen = dist <= this.autoTriggerRadius;

      const targetSlide = this.isOpen ? this.maxSlide : 0;
      let candidateSlide = this.slideOffset + (targetSlide - this.slideOffset) * smooth;
      if (Math.abs(targetSlide - candidateSlide) < 0.002) {
        candidateSlide = targetSlide;
      }

      const halfPanel = this.panelWidth * 0.5;
      const halfT = this.doorThickness / 2;
      const candLeftX = this.worldCenter.x - halfPanel - candidateSlide;
      const candRightX = this.worldCenter.x + halfPanel + candidateSlide;

      const overlapsLeft = this.collision.isCircleOverlappingAABB(
        playerPos.x,
        playerPos.z,
        DOOR_SWING_CLEARANCE,
        new THREE.Vector3(candLeftX - halfPanel, 0, this.worldCenter.z - halfT),
        new THREE.Vector3(candLeftX + halfPanel, this.doorHeight, this.worldCenter.z + halfT),
      );
      const overlapsRight = this.collision.isCircleOverlappingAABB(
        playerPos.x,
        playerPos.z,
        DOOR_SWING_CLEARANCE,
        new THREE.Vector3(candRightX - halfPanel, 0, this.worldCenter.z - halfT),
        new THREE.Vector3(candRightX + halfPanel, this.doorHeight, this.worldCenter.z + halfT),
      );

      if (!overlapsLeft && !overlapsRight) {
        this.slideOffset = candidateSlide;
      }

      const leftCenterX = this.worldCenter.x - halfPanel - this.slideOffset;
      const rightCenterX = this.worldCenter.x + halfPanel + this.slideOffset;

      this.leftLeaf.position.x = leftCenterX;
      this.rightLeaf.position.x = rightCenterX;

      this.collision.updateBox(
        this.leftColliderId,
        new THREE.Vector3(leftCenterX - halfPanel, 0, this.worldCenter.z - halfT),
        new THREE.Vector3(leftCenterX + halfPanel, this.doorHeight, this.worldCenter.z + halfT),
      );
      this.collision.updateBox(
        this.rightColliderId,
        new THREE.Vector3(rightCenterX - halfPanel, 0, this.worldCenter.z - halfT),
        new THREE.Vector3(rightCenterX + halfPanel, this.doorHeight, this.worldCenter.z + halfT),
      );
    }
  }

  private wouldLeafOverlapPlayer(
    leaf: HingedLeaf,
    angle: number,
    playerPos: THREE.Vector3,
    clearanceRadius: number,
  ): boolean {
    return this.collision.isCircleOverlappingOBB(
      playerPos.x,
      playerPos.z,
      clearanceRadius,
      DoorInteraction.computeLeafWorldCenter(leaf, angle),
      leaf.halfExtents,
      angle,
    );
  }

  private static computeLeafWorldCenter(leaf: HingedLeaf, angle: number): THREE.Vector3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rx = leaf.localCenter.x * cos + leaf.localCenter.z * sin;
    const rz = -leaf.localCenter.x * sin + leaf.localCenter.z * cos;
    return new THREE.Vector3(
      leaf.hingePos.x + rx,
      leaf.hingePos.y + leaf.localCenter.y,
      leaf.hingePos.z + rz,
    );
  }
}
