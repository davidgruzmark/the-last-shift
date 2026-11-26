import * as THREE from 'three';
import {
  createMidnightNoirBottle,
  type PerfumeBottleRig,
} from '../assets/collectibles/PerfumeBottleModel';
import { createWatchModel } from '../assets/collectibles/WatchModel';
import { createFlatbedCart, createForklift } from '../assets/environments/IkeaFurnitureAssets';
import type { MaterialPalette } from '../assets/materials/Palette';
import { WAREHOUSE_BALL_PICKUP_ZONE } from '../config/constants';
import type { Interactable, InteractableType } from '../interaction/Interactable';
import type { InteractionManager } from '../interaction/InteractionManager';
import { i18n } from '../i18n/LocalizationManager';
import type { CollisionManager, FloorId } from '../world/CollisionManager';
import { WORLD_ANCHORS } from '../world/WorldAnchors';
import {
  WorldProgressionManager,
  type WorldProgressionState,
} from '../world/WorldProgressionManager';
import type { MissionManager } from './MissionManager';
import type { MissionObjectiveDef } from './MissionObjectives';

class SimpleMissionProp implements Interactable {
  readonly id: string;
  readonly type: InteractableType;
  readonly radius: number;
  readonly floor: FloorId;
  readonly colliderIds?: readonly string[];
  readonly meshGroup = new THREE.Group();

  private readonly worldPos: THREE.Vector3;
  private readonly promptText: string;
  private readonly isEligible: () => boolean;
  private readonly onTrigger: () => void;
  private readonly ring: THREE.Mesh;
  private active = false;
  private passiveDisplay = false;

  constructor(options: {
    id: string;
    type: InteractableType;
    position: THREE.Vector3;
    floor?: FloorId;
    promptText: string;
    radius?: number;
    colliderIds?: readonly string[];
    mesh: THREE.Object3D;
    isEligible: () => boolean;
    onTrigger: () => void;
  }) {
    this.id = options.id;
    this.type = options.type;
    this.radius = options.radius ?? 2.6;
    this.floor = options.floor ?? (options.position.y >= 5.3 ? 2 : 1);
    this.colliderIds = options.colliderIds;
    this.worldPos = options.position.clone();
    this.promptText = options.promptText;
    this.isEligible = options.isEligible;
    this.onTrigger = options.onTrigger;

    this.meshGroup.name = `MissionProp_${options.id}`;
    this.meshGroup.position.copy(options.position);
    this.meshGroup.add(options.mesh);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.48, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffda1a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.meshGroup.add(this.ring);
  }

  setVisible(visible: boolean): void {
    this.active = visible;
    this.passiveDisplay = false;
    this.ring.visible = visible;
    this.meshGroup.visible = visible;
  }

  /** Shows decorative prop geometry without allowing interaction or showing selection ring. */
  setPassiveDisplay(visible: boolean): void {
    this.active = false;
    this.passiveDisplay = visible;
    this.ring.visible = false;
    this.meshGroup.visible = visible;
  }

  setPosition(pos: THREE.Vector3): void {
    this.worldPos.copy(pos);
    this.meshGroup.position.copy(pos);
  }

  getWorldPosition(): THREE.Vector3 {
    return this.worldPos;
  }

  canInteract(): boolean {
    return this.active && !this.passiveDisplay && this.isEligible();
  }

  getPromptText(): string {
    const key = `mprop.${this.id}`;
    const translated = i18n.t(key);
    return translated === key ? this.promptText : translated;
  }

  getPriority(): number {
    return 1.2;
  }

  setHighlighted(highlighted: boolean): void {
    const mat = this.ring.material as THREE.MeshBasicMaterial;
    mat.color.setHex(highlighted ? 0x2ecc71 : 0xffda1a);
    this.ring.scale.setScalar(highlighted ? 1.25 : 1.0);
  }

  onInteract(): void {
    if (!this.canInteract()) return;
    this.onTrigger();
  }
}

interface TippingBox {
  colliderId: string;
  mesh: THREE.Mesh;
  triggerX: number;
  triggerZ: number;
  tipped: boolean;
  animProgress: number;
  fallDirX: number;
  fallDirZ: number;
}

const M1_ACTIVITY_START = new THREE.Vector3(24.6, 0, -20.5);
const M1_ACTIVITY_END = new THREE.Vector3(24.8, 0, -27.5);
const CART_LOOP_SPEED = 5.6;
const CART_BRAKE_DECEL = 7.2;
const CART_HALF_EXTENTS = new THREE.Vector3(0.72, 0.72, 0.98);
const CART_COLLISION_IGNORE_IDS = [
  'm2-cart-col',
  'm2-tipbox-0',
  'm2-tipbox-1',
  'm2-tipbox-2',
  'm2-tipbox-3',
] as const;
const FORKLIFT_LOOP_SPEED = 6.8;
const FORKLIFT_BRAKE_DECEL = 5.8;

/**
 * Manages all scripted 3D props, live CAM 04 Warehouse motion, physical moving cart/forklift
 * colliders, tipping warehouse boxes, and mission-scoped interactables for Missions 01-04.
 */
export class MissionPropsController {
  readonly group = new THREE.Group();
  private readonly missions: MissionManager;
  private readonly collision: CollisionManager;
  private readonly progression: WorldProgressionManager;
  private lastProgressionSig = '';

  // M01 props + live Aisle 02 rolling anomaly visible on CAM 04
  private readonly radioProp: SimpleMissionProp;
  private readonly warehouseClueProp: SimpleMissionProp;
  private readonly m1ActivityGroup: THREE.Group;
  private readonly m1BeaconMat: THREE.MeshStandardMaterial;
  private m1ActivityForward = true;
  private m1ActivityCleared = false;

  // M02 scripted cart & tipping boxes (routed along clear Warehouse aisles between racks & forklifts)
  private readonly runawayCartProp: SimpleMissionProp;
  private readonly cartClipboardProp: SimpleMissionProp;
  private readonly cartWaypoints = [
    new THREE.Vector3(18.5, 0, -16.8),
    new THREE.Vector3(18.5, 0, -36.2),
    new THREE.Vector3(28.6, 0, -36.2),
    new THREE.Vector3(28.6, 0, -16.8),
  ];
  private cartWaypointIdx = 1;
  private cartState: 'idle' | 'moving' | 'braking' | 'halted' = 'idle';
  private cartSpeed = 0;
  private cartHeading = new THREE.Vector3(0, 0, -1);
  private cartTravelDist = 0;
  private readonly tippingBoxes: TippingBox[] = [];

  // M03 props
  private readonly watchBoxClueProp: SimpleMissionProp;
  private readonly missingWatchProp: SimpleMissionProp;

  // M04 scripted forklift & emergency switch
  private readonly forkliftGroup: THREE.Group;
  private readonly forkliftBeaconMat: THREE.MeshStandardMaterial;
  private readonly forkliftInspectProp: SimpleMissionProp;
  private readonly emergencySwitchProp: SimpleMissionProp;
  private readonly forkliftLoop = [
    new THREE.Vector3(13.8, 0, -16.8),
    new THREE.Vector3(13.8, 0, -35.5),
    new THREE.Vector3(24.4, 0, -35.5),
    new THREE.Vector3(24.4, 0, -16.8),
  ];
  private forkliftWpIdx = 1;
  private forkliftState: 'idle' | 'running' | 'braking' | 'stopped' = 'idle';
  private forkliftSpeed = 0;
  private forkliftHeading = new THREE.Vector3(0, 0, -1);
  private forkliftTravelDist = 0;
  private beaconTimer = 0;

  // M05 Perfume Heist props & Midnight Noir pickup animation
  private readonly m5EmptyDisplayProp: SimpleMissionProp;
  private readonly m5TippedCard: THREE.Mesh;
  private readonly m5ClueBagProp: SimpleMissionProp;
  private readonly m5PerfumeBottleProp: SimpleMissionProp;
  private readonly m5BottleRig: PerfumeBottleRig;
  private m5BottleCollected = false;
  private m5PickupAnim = -1;

  constructor(
    palette: MaterialPalette,
    interactions: InteractionManager,
    missions: MissionManager,
    collision: CollisionManager,
    progression?: WorldProgressionManager,
  ) {
    this.group.name = 'MissionPropsGroup';
    this.missions = missions;
    this.collision = collision;
    this.progression = progression ?? new WorldProgressionManager();

    // --- M01: Security Radio on Control Room desk/side ---
    const radioVisual = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.55), palette.darkNavy);
    stand.position.y = 0.36;
    const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.1), palette.metalDark);
    radioBody.position.set(0, 0.86, 0);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.24, 6), palette.ikeaYellow);
    antenna.position.set(0.04, 1.08, 0);
    radioVisual.add(stand, radioBody, antenna);

    this.radioProp = new SimpleMissionProp({
      id: 'm1-radio',
      type: 'interact',
      position: WORLD_ANCHORS.controlRoom.m1Radio.position,
      floor: WORLD_ANCHORS.controlRoom.m1Radio.floor,
      promptText: 'PRESS E TO PICK UP RADIO',
      mesh: radioVisual,
      isEligible: () => this.missions.getActiveObjective()?.id === 'm1-pickup-radio',
      onTrigger: () => {
        this.radioProp.setVisible(false);
        this.missions.notifyInteract('m1-radio');
      },
    });

    // --- M01: Warehouse Aisle 02 Clue ---
    const clueVisual = new THREE.Group();
    const boxA = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.6), palette.boxLabel);
    boxA.position.set(-0.2, 0.225, 0);
    boxA.rotation.y = 0.35;
    const boxB = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), palette.cardboard);
    boxB.position.set(0.32, 0.175, 0.15);
    boxB.rotation.z = 0.2;
    clueVisual.add(boxA, boxB);

    this.warehouseClueProp = new SimpleMissionProp({
      id: 'm1-warehouse-clue',
      type: 'interact',
      position: WORLD_ANCHORS.warehouse.m1Clue.position,
      floor: WORLD_ANCHORS.warehouse.m1Clue.floor,
      promptText: 'PRESS E TO INVESTIGATE SCATTERED BOXES',
      mesh: clueVisual,
      isEligible: () => this.missions.getActiveObjective()?.id === 'm1-investigate-clue',
      onTrigger: () => {
        this.m1ActivityCleared = true;
        this.m1ActivityGroup.visible = false;
        this.warehouseClueProp.setVisible(false);
        this.missions.notifyInteract('m1-warehouse-clue');
      },
    });

    // Live rolling Aisle 02 anomaly visible on CAM 04 throughout Mission 01
    this.m1ActivityGroup = createFlatbedCart(palette).group;
    this.m1ActivityGroup.scale.setScalar(1.15);
    this.m1ActivityGroup.position.copy(M1_ACTIVITY_START);
    const strayCargo = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.72, 0.9), palette.ikeaBlue);
    strayCargo.position.set(0, 1.05, 0);
    this.m1BeaconMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff8800,
      emissiveIntensity: 1.1,
      roughness: 0.3,
    });
    const m1Beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.2, 8),
      this.m1BeaconMat,
    );
    m1Beacon.position.set(0, 1.52, 0);
    this.m1ActivityGroup.add(strayCargo, m1Beacon);
    this.group.add(this.m1ActivityGroup);

    // --- M02: Runaway Furniture Cart + Tipping Boxes + Clipboard ---
    const cartMesh = createFlatbedCart(palette).group;
    cartMesh.scale.setScalar(1.35);
    const extraBox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.8), palette.ikeaBlue);
    extraBox.position.set(0, 1.15, 0.08);
    cartMesh.add(extraBox);

    this.collision.addOrientedBox(
      'm2-cart-col',
      new THREE.Vector3(this.cartWaypoints[0].x, 0.72, this.cartWaypoints[0].z),
      new THREE.Vector3(0.75, 0.72, 1.05),
      0,
      false,
    );
    this.collision.setColliderEnabled('m2-cart-col', false);

    this.runawayCartProp = new SimpleMissionProp({
      id: 'm2-runaway-cart',
      type: 'interact',
      position: this.cartWaypoints[0],
      promptText: 'PRESS E TO STOP RUNAWAY CART',
      radius: 3.6,
      colliderIds: ['m2-cart-col'],
      mesh: cartMesh,
      isEligible: () =>
        this.missions.getActiveObjective()?.id === 'm2-stop-cart' &&
        this.cartState === 'moving',
      onTrigger: () => {
        if (this.cartState === 'moving') {
          this.cartState = 'braking';
        }
      },
    });

    const clipMesh = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.42), palette.wood);
    board.position.y = 0.35;
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.32), palette.white);
    paper.position.y = 0.36;
    clipMesh.add(board, paper);

    this.cartClipboardProp = new SimpleMissionProp({
      id: 'm2-cart-clipboard',
      type: 'interact',
      position: new THREE.Vector3(24.8, 0, -19.5),
      promptText: 'PRESS E TO INSPECT CART CLIPBOARD',
      radius: 3.4,
      colliderIds: ['m2-cart-col'],
      mesh: clipMesh,
      isEligible: () => this.missions.getActiveObjective()?.id === 'm2-investigate-cause',
      onTrigger: () => {
        this.cartClipboardProp.setVisible(false);
        this.missions.notifyInteract('m2-cart-clipboard');
      },
    });

    // 4 Tipping boxes placed beside the clear M02 cart aisle loop with live physical colliders
    const tipConfigs = [
      { x: 17.4, z: -23.0, fx: 0.7, fz: 0.2 },
      { x: 17.4, z: -30.5, fx: 0.7, fz: -0.2 },
      { x: 23.5, z: -35.0, fx: 0.2, fz: -0.7 },
      { x: 29.7, z: -26.0, fx: 0.7, fz: 0.2 },
    ];
    tipConfigs.forEach((cfg, idx) => {
      const colliderId = `m2-tipbox-${idx}`;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), palette.boxLabel);
      mesh.position.set(cfg.x, 0.375, cfg.z);
      mesh.castShadow = true;
      mesh.visible = false;
      this.group.add(mesh);
      this.collision.addBox(
        colliderId,
        new THREE.Vector3(cfg.x - 0.38, 0, cfg.z - 0.38),
        new THREE.Vector3(cfg.x + 0.38, 0.78, cfg.z + 0.38),
        false,
      );
      this.collision.setColliderEnabled(colliderId, false);
      this.tippingBoxes.push({
        colliderId,
        mesh,
        triggerX: cfg.x,
        triggerZ: cfg.z,
        tipped: false,
        animProgress: 0,
        fallDirX: cfg.fx,
        fallDirZ: cfg.fz,
      });
    });

    // --- M03: Empty Watch Box & Missing Watch ---
    const watchBoxVisual = new THREE.Group();
    const boxBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.32), palette.darkNavy);
    boxBase.position.y = 0.52;
    const velvet = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.24), palette.accentRed);
    velvet.position.y = 0.54;
    watchBoxVisual.add(boxBase, velvet);

    this.watchBoxClueProp = new SimpleMissionProp({
      id: 'm3-watch-box-clue',
      type: 'interact',
      position: WORLD_ANCHORS.showroom.malmWatchBox.position,
      floor: WORLD_ANCHORS.showroom.malmWatchBox.floor,
      promptText: 'PRESS E TO INSPECT EMPTY WATCH BOX',
      mesh: watchBoxVisual,
      isEligible: () => {
        const objId = this.missions.getActiveObjective()?.id;
        return objId === 'm3-gather-clues' || objId === 'm3-inspect-watch-box';
      },
      onTrigger: () => {
        this.watchBoxClueProp.setVisible(false);
        this.missions.notifyInteract('m3-watch-box-clue');
      },
    });

    const watchVisual = createWatchModel('Rare').group;
    watchVisual.position.y = 0.28;
    watchVisual.scale.setScalar(1.2);

    this.missingWatchProp = new SimpleMissionProp({
      id: 'm3-missing-watch',
      type: 'collect',
      position: WORLD_ANCHORS.restaurant.missingWatch.position,
      floor: WORLD_ANCHORS.restaurant.missingWatch.floor,
      promptText: 'PRESS E TO COLLECT MISSING WATCH',
      mesh: watchVisual,
      isEligible: () => {
        const objId = this.missions.getActiveObjective()?.id;
        return (
          objId === 'm3-gather-clues' ||
          objId === 'm3-inspect-watch-box' ||
          objId === 'm3-find-watch'
        );
      },
      onTrigger: () => {
        this.missingWatchProp.setVisible(false);
        this.missions.notifyInteract('m3-missing-watch');
      },
    });

    // --- M04: Runaway Forklift + Red Emergency Stop Switch ---
    this.forkliftGroup = createForklift(palette).group;
    this.forkliftGroup.position.copy(this.forkliftLoop[0]);
    this.forkliftGroup.visible = false;

    this.collision.addOrientedBox(
      'm4-forklift-col',
      new THREE.Vector3(this.forkliftLoop[0].x, 1.05, this.forkliftLoop[0].z),
      new THREE.Vector3(0.82, 1.05, 1.25),
      0,
      false,
    );
    this.collision.setColliderEnabled('m4-forklift-col', false);

    this.forkliftBeaconMat = new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      emissive: 0xff3b30,
      emissiveIntensity: 1.2,
      roughness: 0.3,
    });
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.22, 8),
      this.forkliftBeaconMat,
    );
    beacon.position.set(0, 2.22, -0.2);
    this.forkliftGroup.add(beacon);
    this.group.add(this.forkliftGroup);

    const switchVisual = new THREE.Group();
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.5, 0.28), palette.ikeaYellow);
    pillar.position.y = 0.75;
    const redButton = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10),
      palette.accentRed,
    );
    redButton.rotation.x = Math.PI / 2;
    redButton.position.set(0, 1.25, 0.16);
    switchVisual.add(pillar, redButton);

    this.emergencySwitchProp = new SimpleMissionProp({
      id: 'm4-emergency-switch',
      type: 'activate_switch',
      position: WORLD_ANCHORS.warehouse.m4EmergencySwitch.position,
      floor: WORLD_ANCHORS.warehouse.m4EmergencySwitch.floor,
      promptText: 'PRESS E TO ACTIVATE EMERGENCY STOP',
      radius: 3.0,
      mesh: switchVisual,
      isEligible: () => this.missions.getActiveObjective()?.id === 'm4-pull-emergency-switch',
      onTrigger: () => {
        this.missions.notifyInteract('m4-emergency-switch');
      },
    });

    const inspectMarkerVisual = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshStandardMaterial({
        color: 0x2ecc71,
        emissive: 0x2ecc71,
        emissiveIntensity: 0.5,
      }),
    );
    inspectMarkerVisual.position.y = 1.6;
    inspectMarkerVisual.visible = false;

    this.forkliftInspectProp = new SimpleMissionProp({
      id: 'm4-forklift-inspect',
      type: 'interact',
      position: new THREE.Vector3(13.8, 0, -31.5),
      promptText: 'PRESS E TO CONFIRM FORKLIFT STOPPED',
      radius: 3.8,
      colliderIds: ['m4-forklift-col'],
      mesh: inspectMarkerVisual,
      isEligible: () =>
        this.missions.getActiveObjective()?.id === 'm4-confirm-stopped' &&
        this.forkliftState === 'stopped',
      onTrigger: () => {
        this.forkliftInspectProp.setVisible(false);
        this.missions.notifyInteract('m4-forklift-inspect');
      },
    });

    // --- M05: The Perfume Heist (Empty Display, Clue Bag, Midnight Noir Bottle) ---
    const displayVisual = new THREE.Group();
    const pedBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.9), palette.darkNavy);
    pedBase.position.y = 0.5;
    const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.94), palette.gold);
    goldTrim.position.y = 1.02;
    const velvetPad = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.36), palette.accentRed);
    velvetPad.position.y = 1.07;
    const tippedCard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.16), palette.white);
    tippedCard.position.set(0.28, 1.07, 0.18);
    tippedCard.rotation.y = 0.45;
    this.m5TippedCard = tippedCard;
    displayVisual.add(pedBase, goldTrim, velvetPad, tippedCard);

    this.m5EmptyDisplayProp = new SimpleMissionProp({
      id: 'm5-empty-display',
      type: 'interact',
      position: WORLD_ANCHORS.showroom.m5EmptyDisplay.position,
      floor: WORLD_ANCHORS.showroom.m5EmptyDisplay.floor,
      promptText: 'PRESS E TO INSPECT EMPTY DISPLAY',
      radius: 2.8,
      mesh: displayVisual,
      isEligible: () => this.missions.getActiveObjective()?.id === 'm5-inspect-display',
      onTrigger: () => {
        this.missions.notifyInteract('m5-empty-display');
      },
    });

    const bagVisual = new THREE.Group();
    const bagBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.34), palette.ikeaBlue);
    bagBody.position.y = 0.24;
    const bagStrap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.06), palette.ikeaYellow);
    bagStrap.position.set(0, 0.5, 0.14);
    const clueNote = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.2), palette.white);
    clueNote.position.set(0.32, 0.02, 0.24);
    clueNote.rotation.y = -0.35;
    bagVisual.add(bagBody, bagStrap, clueNote);

    this.m5ClueBagProp = new SimpleMissionProp({
      id: 'm5-clue-bag',
      type: 'interact',
      position: WORLD_ANCHORS.checkout.bagClue.position,
      floor: WORLD_ANCHORS.checkout.bagClue.floor,
      promptText: 'PRESS E TO INSPECT IKEA BAG',
      radius: 2.8,
      mesh: bagVisual,
      isEligible: () => this.missions.getActiveObjective()?.id === 'm5-inspect-bag-clue',
      onTrigger: () => {
        this.m5ClueBagProp.setVisible(false);
        this.missions.notifyInteract('m5-clue-bag');
      },
    });

    const bottleStage = new THREE.Group();
    const stashCrate = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.46, 0.65), palette.wood);
    stashCrate.position.y = 0.23;
    this.m5BottleRig = createMidnightNoirBottle();
    this.m5BottleRig.group.position.y = 0.52;
    this.m5BottleRig.group.scale.setScalar(1.25);
    bottleStage.add(stashCrate, this.m5BottleRig.group);

    this.m5PerfumeBottleProp = new SimpleMissionProp({
      id: 'm5-midnight-noir-bottle',
      type: 'collect',
      position: WORLD_ANCHORS.checkout.midnightNoir.position,
      floor: WORLD_ANCHORS.checkout.midnightNoir.floor,
      promptText: 'PRESS E TO COLLECT MIDNIGHT NOIR',
      radius: 2.9,
      mesh: bottleStage,
      isEligible: () =>
        !this.m5BottleCollected &&
        this.missions.getActiveObjective()?.id === 'm5-recover-perfume',
      onTrigger: () => {
        if (this.m5BottleCollected) return;
        this.m5BottleCollected = true;
        this.m5PickupAnim = 0;
        this.missions.notifyInteract('m5-midnight-noir-bottle');
      },
    });

    const allProps = [
      this.radioProp,
      this.warehouseClueProp,
      this.runawayCartProp,
      this.cartClipboardProp,
      this.watchBoxClueProp,
      this.missingWatchProp,
      this.emergencySwitchProp,
      this.forkliftInspectProp,
      this.m5EmptyDisplayProp,
      this.m5ClueBagProp,
      this.m5PerfumeBottleProp,
    ];
    for (const prop of allProps) {
      prop.setVisible(false);
      this.group.add(prop.meshGroup);
      interactions.register(prop);
    }

    this.registerProgressionRules();
  }

  getProgression(): WorldProgressionManager {
    return this.progression;
  }

  private registerProgressionRules(): void {
    this.progression.registerRule('m1-props', (state: WorldProgressionState) => {
      const m1 = state.activeMissionId === 'mission-01';
      this.radioProp.setVisible(m1 && state.activeObjectiveId === 'm1-pickup-radio');
      this.warehouseClueProp.setVisible(m1 && state.activeObjectiveId === 'm1-investigate-clue');
      this.m1ActivityGroup.visible = m1 && !this.m1ActivityCleared;
    });

    this.progression.registerRule('m2-props', (state: WorldProgressionState) => {
      if (state.activeMissionId !== 'mission-02') {
        this.runawayCartProp.setVisible(false);
        this.cartClipboardProp.setVisible(false);
        this.collision.setColliderEnabled('m2-cart-col', false);
        for (const tb of this.tippingBoxes) {
          tb.mesh.visible = false;
          this.collision.setColliderEnabled(tb.colliderId, false);
        }
      } else {
        this.cartClipboardProp.setVisible(state.activeObjectiveId === 'm2-investigate-cause');
      }
    });

    this.progression.registerRule('m3-props', (state: WorldProgressionState) => {
      const m3 = state.activeMissionId === 'mission-03';
      const objId = state.activeObjectiveId;
      this.watchBoxClueProp.setVisible(
        m3 && (objId === 'm3-gather-clues' || objId === 'm3-inspect-watch-box'),
      );
      this.missingWatchProp.setVisible(
        m3 &&
          (objId === 'm3-gather-clues' ||
            objId === 'm3-inspect-watch-box' ||
            objId === 'm3-find-watch'),
      );
    });

    this.progression.registerRule('m4-forklift', (state: WorldProgressionState) => {
      const m4 = state.activeMissionId === 'mission-04';
      const m4Done = state.completedMissions.has('mission-04');
      if (m4) {
        this.emergencySwitchProp.setVisible(true);
      } else if (m4Done) {
        // Emergency stop switch and deactivated Forklift #2 remain visibly secured in the Warehouse
        this.emergencySwitchProp.setPassiveDisplay(true);
        this.forkliftInspectProp.setVisible(false);
        if (this.isInsideBallNoStopZone(this.forkliftGroup.position)) {
          this.forkliftState = 'braking';
          this.forkliftSpeed = Math.max(this.forkliftSpeed, 2.8);
          if (this.forkliftHeading.lengthSq() < 0.01) {
            this.forkliftHeading.set(-1, 0, 0);
          }
        } else {
          this.forkliftState = 'stopped';
        }
        this.forkliftBeaconMat.color.setHex(0x2ecc71);
        this.forkliftBeaconMat.emissive.setHex(0x2ecc71);
        this.forkliftBeaconMat.emissiveIntensity = 0.8;
        this.forkliftGroup.visible = true;
        this.collision.setColliderEnabled('m4-forklift-col', true);
      } else {
        this.emergencySwitchProp.setVisible(false);
        this.forkliftGroup.visible = false;
        this.forkliftInspectProp.setVisible(false);
        this.collision.setColliderEnabled('m4-forklift-col', false);
      }
    });

    this.progression.registerRule('m5-perfume-heist', (state: WorldProgressionState) => {
      const m5 = state.activeMissionId === 'mission-05';
      const m5Done = state.completedMissions.has('mission-05');
      const objId = state.activeObjectiveId;

      if (m5) {
        this.m5TippedCard.visible = true;
        this.m5EmptyDisplayProp.setVisible(
          objId === 'm5-reach-display' ||
            objId === 'm5-inspect-display' ||
            objId === 'm5-interview-witnesses',
        );
      } else if (m5Done) {
        // Display pedestal remains cleanly restored after M05 completes
        this.m5TippedCard.visible = false;
        this.m5EmptyDisplayProp.setPassiveDisplay(true);
      } else {
        this.m5EmptyDisplayProp.setVisible(false);
      }

      this.m5ClueBagProp.setVisible(m5 && objId === 'm5-inspect-bag-clue');
    });
  }

  getDynamicMarkerPosition(obj: MissionObjectiveDef): THREE.Vector3 | null {
    switch (obj.dynamicTargetKey) {
      case 'm2_cart':
        return this.runawayCartProp.getWorldPosition().clone();
      case 'm2_clipboard':
        return this.cartClipboardProp.getWorldPosition().clone();
      case 'm4_forklift':
        return this.forkliftGroup.position.clone();
      default:
        return obj.targetPos ?? null;
    }
  }

  getDynamicTravelDistance(key: string): number {
    if (key === 'm2_cart') return this.cartTravelDist;
    if (key === 'm4_forklift') return this.forkliftTravelDist;
    return 0;
  }

  handleScriptEvent(eventId: string): void {
    if (eventId === 'm2_start_cart') {
      this.cartState = 'moving';
      this.cartSpeed = CART_LOOP_SPEED;
      this.cartTravelDist = 0;
      this.cartWaypointIdx = 1;
      this.runawayCartProp.setPosition(this.cartWaypoints[0]);
      this.runawayCartProp.setVisible(true);
      this.collision.setColliderEnabled('m2-cart-col', true);
      this.collision.updateOrientedBox(
        'm2-cart-col',
        new THREE.Vector3(this.cartWaypoints[0].x, 0.72, this.cartWaypoints[0].z),
        new THREE.Vector3(0.75, 0.72, 1.05),
        0,
      );
      for (const tb of this.tippingBoxes) {
        tb.tipped = false;
        tb.animProgress = 0;
        tb.mesh.position.set(tb.triggerX, 0.375, tb.triggerZ);
        tb.mesh.rotation.set(0, 0, 0);
        tb.mesh.visible = true;
        this.collision.setColliderEnabled(tb.colliderId, true);
        this.collision.updateBox(
          tb.colliderId,
          new THREE.Vector3(tb.triggerX - 0.38, 0, tb.triggerZ - 0.38),
          new THREE.Vector3(tb.triggerX + 0.38, 0.78, tb.triggerZ + 0.38),
        );
      }
      return;
    }

    if (eventId === 'm4_start_forklift') {
      this.forkliftState = 'running';
      this.forkliftSpeed = FORKLIFT_LOOP_SPEED;
      this.forkliftTravelDist = 0;
      this.forkliftWpIdx = 1;
      this.forkliftGroup.position.copy(this.forkliftLoop[0]);
      this.forkliftGroup.visible = true;
      this.forkliftBeaconMat.color.setHex(0xff3b30);
      this.forkliftBeaconMat.emissive.setHex(0xff3b30);
      this.collision.setColliderEnabled('m4-forklift-col', true);
      this.collision.updateOrientedBox(
        'm4-forklift-col',
        new THREE.Vector3(this.forkliftLoop[0].x, 1.05, this.forkliftLoop[0].z),
        new THREE.Vector3(0.82, 1.05, 1.25),
        0,
      );
      this.progression.setFlag('m4_start_forklift', true);
      return;
    }

    if (eventId === 'm4_stop_forklift') {
      // Decelerate smoothly from current world position instead of teleporting
      if (this.forkliftState === 'running') {
        this.forkliftState = 'braking';
      }
      this.forkliftBeaconMat.color.setHex(0x2ecc71);
      this.forkliftBeaconMat.emissive.setHex(0x2ecc71);
      this.forkliftBeaconMat.emissiveIntensity = 1.0;
      this.progression.setFlag('m4_stop_forklift', true);
    }
  }

  update(dt: number): void {
    const activeMission = this.missions.getActiveMission();
    const activeObj = this.missions.getActiveObjective();
    const snap = this.missions.getSnapshot();
    const mId = activeMission?.id ?? null;
    const objId = activeObj?.id ?? null;

    const sig = `${mId ?? ''}|${objId ?? ''}|${snap.completedMissions.join(',')}|${this.m1ActivityCleared}`;
    if (sig !== this.lastProgressionSig) {
      this.lastProgressionSig = sig;
      this.progression.sync(mId, objId, snap.completedMissions);
    }

    if (this.m1ActivityGroup.visible) {
      const target = this.m1ActivityForward ? M1_ACTIVITY_END : M1_ACTIVITY_START;
      const pos = this.m1ActivityGroup.position;
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      const step = 2.6 * dt;
      if (dist <= step) {
        pos.copy(target);
        this.m1ActivityForward = !this.m1ActivityForward;
      } else {
        pos.x += (dx / dist) * step;
        pos.z += (dz / dist) * step;
        this.m1ActivityGroup.rotation.y = Math.atan2(dx, dz);
      }
      this.beaconTimer += dt * 7;
      this.m1BeaconMat.emissiveIntensity = 0.4 + Math.abs(Math.sin(this.beaconTimer)) * 1.1;
    }

    if (this.missingWatchProp.meshGroup.visible) {
      this.missingWatchProp.meshGroup.children[0].rotation.y += dt * 2.0;
    }

    const showBottle =
      mId === 'mission-05' &&
      ((objId === 'm5-recover-perfume' && !this.m5BottleCollected) ||
        (this.m5PickupAnim >= 0 && this.m5PickupAnim < 0.65));
    this.m5PerfumeBottleProp.setVisible(showBottle);
    if (showBottle) {
      if (this.m5PickupAnim >= 0 && this.m5PickupAnim < 0.65) {
        this.m5PickupAnim += dt;
        const p = Math.min(1, this.m5PickupAnim / 0.65);
        this.m5BottleRig.group.position.y = 0.52 + p * 0.95;
        this.m5BottleRig.group.rotation.y += dt * 11;
        this.m5BottleRig.group.scale.setScalar(1.25 * (1 + p * 0.35));
        for (let i = 0; i < this.m5BottleRig.sparkles.length; i++) {
          const sp = this.m5BottleRig.sparkles[i];
          const ang = (i * Math.PI) / 2 + p * 4;
          sp.position.set(Math.cos(ang) * (0.25 + p * 0.55), 0.35 + p * 0.7, Math.sin(ang) * (0.25 + p * 0.55));
          sp.scale.setScalar(1 - p * 0.8);
        }
      } else {
        this.m5BottleRig.group.rotation.y += dt * 1.4;
        this.m5BottleRig.group.position.y = 0.54 + Math.sin(performance.now() * 0.003) * 0.04;
      }
    }

    // Update M02 runaway cart (resolved against real Warehouse collision geometry + smooth braking)
    if (mId === 'mission-02' && (this.cartState === 'moving' || this.cartState === 'braking')) {
      const pos = this.runawayCartProp.getWorldPosition().clone();
      if (this.cartState === 'moving') {
        const target = this.cartWaypoints[this.cartWaypointIdx];
        const dx = target.x - pos.x;
        const dz = target.z - pos.z;
        const dist = Math.hypot(dx, dz);
        const step = this.cartSpeed * dt;

        if (dist <= step) {
          const desiredDelta = new THREE.Vector3(dx, 0, dz);
          const res = this.collision.resolveVehicleMovement(
            pos,
            desiredDelta,
            CART_HALF_EXTENTS,
            this.runawayCartProp.meshGroup.rotation.y,
            CART_COLLISION_IGNORE_IDS,
          );
          this.cartTravelDist += Math.hypot(res.position.x - pos.x, res.position.z - pos.z);
          pos.copy(res.position);
          this.cartWaypointIdx = (this.cartWaypointIdx + 1) % this.cartWaypoints.length;
        } else {
          this.cartHeading.set(dx / dist, 0, dz / dist);
          const yaw = Math.atan2(dx, dz);
          this.runawayCartProp.meshGroup.rotation.y = yaw;
          const desiredDelta = new THREE.Vector3(
            this.cartHeading.x * step,
            0,
            this.cartHeading.z * step,
          );
          const res = this.collision.resolveVehicleMovement(
            pos,
            desiredDelta,
            CART_HALF_EXTENTS,
            yaw,
            CART_COLLISION_IGNORE_IDS,
          );
          const moved = Math.hypot(res.position.x - pos.x, res.position.z - pos.z);
          this.cartTravelDist += moved;
          pos.copy(res.position);

          // If blocked by an obstacle/wall along current segment, redirect smoothly to next waypoint
          if (res.hitWall && moved < step * 0.25) {
            this.cartWaypointIdx = (this.cartWaypointIdx + 1) % this.cartWaypoints.length;
          }
        }
      } else {
        this.cartSpeed = Math.max(0, this.cartSpeed - CART_BRAKE_DECEL * dt);
        const step = this.cartSpeed * dt;
        const desiredDelta = new THREE.Vector3(
          this.cartHeading.x * step,
          0,
          this.cartHeading.z * step,
        );
        const res = this.collision.resolveVehicleMovement(
          pos,
          desiredDelta,
          CART_HALF_EXTENTS,
          this.runawayCartProp.meshGroup.rotation.y,
          CART_COLLISION_IGNORE_IDS,
        );
        pos.copy(res.position);
        if (res.hitWall) {
          this.cartSpeed = 0;
        }

        if (this.cartSpeed <= 0.05) {
          this.cartSpeed = 0;
          this.cartState = 'halted';
          // Drop clipboard in open floor space verified clear against Warehouse colliders
          const offset = 1.95;
          const candidates = [
            new THREE.Vector3(pos.x - this.cartHeading.z * offset, 0, pos.z + this.cartHeading.x * offset),
            new THREE.Vector3(pos.x + this.cartHeading.z * offset, 0, pos.z - this.cartHeading.x * offset),
            new THREE.Vector3(pos.x - this.cartHeading.x * offset, 0, pos.z - this.cartHeading.z * offset),
            new THREE.Vector3(pos.x + this.cartHeading.x * offset, 0, pos.z + this.cartHeading.z * offset),
          ];
          const zeroDelta = new THREE.Vector3();
          let bestClip = pos.clone();
          let bestScore = -Infinity;
          for (const c of candidates) {
            c.x = THREE.MathUtils.clamp(c.x, 8.4, 33.6);
            c.z = THREE.MathUtils.clamp(c.z, -36.8, -15.4);
            const clearCheck = this.collision.resolvePlayerMovement(c, zeroDelta, 0.45, 1.0);
            const distFromCart = Math.hypot(clearCheck.position.x - pos.x, clearCheck.position.z - pos.z);
            const score = distFromCart - (clearCheck.hitWall ? 5.0 : 0);
            if (score > bestScore) {
              bestScore = score;
              bestClip = clearCheck.position.clone();
            }
          }
          bestClip.y = 0;
          this.cartClipboardProp.setPosition(bestClip);
          this.missions.notifyInteract('m2-runaway-cart');
        }
      }

      this.runawayCartProp.setPosition(pos);
      this.collision.updateOrientedBox(
        'm2-cart-col',
        new THREE.Vector3(pos.x, 0.72, pos.z),
        new THREE.Vector3(0.75, 0.72, 1.05),
        this.runawayCartProp.meshGroup.rotation.y,
      );

      // Tip boxes when cart passes nearby
      for (const tb of this.tippingBoxes) {
        if (!tb.tipped && Math.hypot(pos.x - tb.triggerX, pos.z - tb.triggerZ) < 2.2) {
          tb.tipped = true;
        }
      }
    }

    if (mId === 'mission-02') {
      for (const tb of this.tippingBoxes) {
        if (tb.tipped && tb.animProgress < 1) {
          tb.animProgress = Math.min(1, tb.animProgress + dt * 3.5);
          tb.mesh.position.x = tb.triggerX + tb.fallDirX * tb.animProgress;
          tb.mesh.position.z = tb.triggerZ + tb.fallDirZ * tb.animProgress;
          tb.mesh.rotation.z = tb.animProgress * 1.3;
          this.collision.updateBox(
            tb.colliderId,
            new THREE.Vector3(tb.mesh.position.x - 0.38, 0, tb.mesh.position.z - 0.38),
            new THREE.Vector3(tb.mesh.position.x + 0.38, 0.78, tb.mesh.position.z + 0.38),
          );
        }
      }
    }

    // Update M04 runaway forklift (live OBB collider, reserved ball pickup no-stop zone & smooth braking)
    const activeForkliftMotion =
      (mId === 'mission-04' && (this.forkliftState === 'running' || this.forkliftState === 'braking')) ||
      (this.forkliftState === 'braking' && this.forkliftGroup.visible);

    if (activeForkliftMotion) {
      const pos = this.forkliftGroup.position;
      if (this.forkliftState === 'running') {
        const target = this.forkliftLoop[this.forkliftWpIdx];
        const dx = target.x - pos.x;
        const dz = target.z - pos.z;
        const dist = Math.hypot(dx, dz);
        const step = this.forkliftSpeed * dt;

        if (dist <= step) {
          pos.copy(target);
          this.forkliftTravelDist += dist;
          this.forkliftWpIdx = (this.forkliftWpIdx + 1) % this.forkliftLoop.length;
        } else {
          this.forkliftHeading.set(dx / dist, 0, dz / dist);
          pos.x += this.forkliftHeading.x * step;
          pos.z += this.forkliftHeading.z * step;
          this.forkliftTravelDist += step;
          this.forkliftGroup.rotation.y = Math.atan2(dx, dz);
        }

        this.beaconTimer += dt * 8;
        this.forkliftBeaconMat.emissiveIntensity =
          0.5 + Math.abs(Math.sin(this.beaconTimer)) * 1.4;
      } else {
        const insideReservedZone = this.isInsideBallNoStopZone(pos);
        if (insideReservedZone) {
          // Keep rolling along the aisle loop until cleanly outside the Warehouse ball pickup zone
          this.forkliftSpeed = Math.max(this.forkliftSpeed, 2.8);
          if (this.forkliftHeading.lengthSq() < 0.01) {
            this.forkliftHeading.set(-1, 0, 0);
          }
          // Steer onto the next loop segment if braking reaches a loop boundary inside the zone
          if (
            (pos.x <= 14.0 && this.forkliftHeading.x < -0.2) ||
            (pos.x >= 24.2 && this.forkliftHeading.x > 0.2) ||
            (pos.z <= -35.2 && this.forkliftHeading.z < -0.2) ||
            (pos.z >= -17.0 && this.forkliftHeading.z > 0.2)
          ) {
            const nextWp = this.forkliftLoop[this.forkliftWpIdx];
            const wx = nextWp.x - pos.x;
            const wz = nextWp.z - pos.z;
            const wDist = Math.hypot(wx, wz);
            if (wDist > 0.1) {
              this.forkliftHeading.set(wx / wDist, 0, wz / wDist);
              this.forkliftGroup.rotation.y = Math.atan2(wx, wz);
            } else {
              this.forkliftWpIdx = (this.forkliftWpIdx + 1) % this.forkliftLoop.length;
            }
          }
        } else {
          this.forkliftSpeed = Math.max(0, this.forkliftSpeed - FORKLIFT_BRAKE_DECEL * dt);
        }

        const step = this.forkliftSpeed * dt;
        pos.x = THREE.MathUtils.clamp(pos.x + this.forkliftHeading.x * step, 13.6, 24.6);
        pos.z = THREE.MathUtils.clamp(pos.z + this.forkliftHeading.z * step, -35.6, -16.6);

        if (this.forkliftSpeed <= 0.05 && !this.isInsideBallNoStopZone(pos)) {
          this.forkliftSpeed = 0;
          this.forkliftState = 'stopped';
          if (mId === 'mission-04') {
            this.forkliftInspectProp.setPosition(pos.clone());
            this.forkliftInspectProp.setVisible(true);
          }
        }
      }

      this.collision.updateOrientedBox(
        'm4-forklift-col',
        new THREE.Vector3(pos.x, 1.05, pos.z),
        new THREE.Vector3(0.82, 1.05, 1.25),
        this.forkliftGroup.rotation.y,
      );
    }

    // Recovery safeguard: if stopped Forklift #2 is ever inside the reserved ball zone, roll it clear
    if (
      this.forkliftState === 'stopped' &&
      this.forkliftGroup.visible &&
      this.isInsideBallNoStopZone(this.forkliftGroup.position)
    ) {
      this.forkliftState = 'braking';
      this.forkliftSpeed = 2.8;
      this.forkliftHeading.set(-1, 0, 0);
      this.forkliftGroup.rotation.y = Math.atan2(-1, 0);
      this.forkliftInspectProp.setVisible(false);
    }
  }

  private isInsideBallNoStopZone(pos: THREE.Vector3): boolean {
    return (
      Math.hypot(pos.x - WAREHOUSE_BALL_PICKUP_ZONE.x, pos.z - WAREHOUSE_BALL_PICKUP_ZONE.z) <
      WAREHOUSE_BALL_PICKUP_ZONE.noStopRadius
    );
  }

  getForkliftPosition(): THREE.Vector3 {
    return this.forkliftGroup.position.clone();
  }

  getForkliftState(): 'idle' | 'running' | 'braking' | 'stopped' {
    return this.forkliftState;
  }
}
