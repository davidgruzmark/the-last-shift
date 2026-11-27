import * as THREE from 'three';
import type { MaterialPalette } from '../assets/materials/Palette';
import type { EventBus, GameEvents, SteakDoneness } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { Interactable, InteractableType } from '../interaction/Interactable';
import type { InteractionManager } from '../interaction/InteractionManager';
import type { MissionManager } from '../missions/MissionManager';
import type { FloorId } from '../world/CollisionManager';
import { WORLD_ANCHORS } from '../world/WorldAnchors';

export const STEAK_MINIGAME_ID = 'steak-emergency';
export const STEAK_COOK_DURATION_SEC = 16;
export const STEAK_TARGET_DONENESS: SteakDoneness = 'medium';

export type SteakZone = SteakDoneness | 'raw' | 'burnt';
export type SteakResult = 'perfect' | 'good' | 'miss';
export type SteakSnapshot = GameEvents['steak:stateChanged'];

/** Doneness gauge (0-100) split into the GAME_SPEC cooking grades. */
export const STEAK_ZONES: ReadonlyArray<{ zone: SteakZone; min: number; max: number }> = [
  { zone: 'raw', min: 0, max: 15 },
  { zone: 'rare', min: 15, max: 32 },
  { zone: 'mediumRare', min: 32, max: 48 },
  { zone: 'medium', min: 48, max: 64 },
  { zone: 'mediumWell', min: 64, max: 80 },
  { zone: 'wellDone', min: 80, max: 96 },
  { zone: 'burnt', min: 96, max: 100 },
];

/** Half-width of the "perfect" bullseye inside the target zone, in doneness points. */
const PERFECT_WINDOW = 4;
const ZONE_CENTERS: Record<SteakDoneness, number> = {
  rare: 23.5,
  mediumRare: 40,
  medium: 56,
  mediumWell: 72,
  wellDone: 88,
};

export function zoneForDoneness(doneness: number): SteakZone {
  const clamped = Math.max(0, Math.min(100, doneness));
  for (const { zone, min, max } of STEAK_ZONES) {
    if (clamped >= min && clamped < max) return zone;
  }
  return 'burnt';
}

/** Interactable restaurant pan that opens the cooking minigame during Mission 07. */
class SteakPanInteractable implements Interactable {
  readonly id = 'm7-steak-pan';
  readonly type: InteractableType = 'interact';
  readonly radius = 2.4;
  readonly floor: FloorId;
  readonly meshGroup = new THREE.Group();

  private readonly worldPos: THREE.Vector3;
  private readonly ring: THREE.Mesh;

  constructor(
    position: THREE.Vector3,
    floor: FloorId,
    panMesh: THREE.Object3D,
    private readonly isEligible: () => boolean,
    private readonly onTrigger: () => void,
  ) {
    this.worldPos = position.clone();
    this.floor = floor;
    this.meshGroup.name = 'MissionProp_m7-steak-pan';
    this.meshGroup.position.copy(position);
    this.meshGroup.add(panMesh);

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

  getWorldPosition(): THREE.Vector3 {
    return this.worldPos;
  }

  canInteract(): boolean {
    return this.isEligible();
  }

  getPromptText(): string {
    return i18n.t('mprop.m7-steak-pan');
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

/**
 * Mission 07 "Steak Emergency" cooking minigame (GAME_SPEC section 7):
 * a stylized pan in the F2 Restaurant kitchen, a climbing doneness gauge,
 * and flip-at-the-right-moment timing against the requested cook grade.
 */
export class SteakMiniGame {
  readonly group = new THREE.Group();

  private readonly eventBus: EventBus<GameEvents>;
  private readonly missions: MissionManager;
  private readonly panProp: SteakPanInteractable;
  private readonly sizzleLight: THREE.PointLight;

  private phase: 'idle' | 'cooking' | 'ended' = 'idle';
  private overlayOpen = false;
  private doneness = 0;
  private result: SteakResult | null = null;
  private attempts = 0;
  private sizzleTime = 0;

  constructor(
    palette: MaterialPalette,
    interactions: InteractionManager,
    missions: MissionManager,
    eventBus: EventBus<GameEvents>,
  ) {
    this.eventBus = eventBus;
    this.missions = missions;
    this.group.name = 'SteakMiniGameGroup';

    // Stylized pan + steak + stovetop, matching the low-poly flat-shaded art direction.
    const anchor = WORLD_ANCHORS.restaurantF2.kitchenPan;
    const panVisual = new THREE.Group();

    const stove = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.8), palette.metalDark);
    stove.position.y = 0.45;
    const burner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.04, 12),
      new THREE.MeshStandardMaterial({
        color: 0xff6b35,
        emissive: 0xff6b35,
        emissiveIntensity: 0.9,
        roughness: 0.4,
      }),
    );
    burner.position.y = 0.92;
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.07, 14), palette.darkNavy);
    pan.position.y = 0.99;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.07), palette.darkNavy);
    handle.position.set(0.42, 1.0, 0);
    const steak = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.045, 10),
      new THREE.MeshStandardMaterial({ color: 0xb3543f, roughness: 0.7, flatShading: true }),
    );
    steak.position.y = 1.05;
    const butter = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.03, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xf7d774, roughness: 0.35 }),
    );
    butter.position.set(0.1, 1.08, 0.06);
    panVisual.add(stove, burner, pan, handle, steak, butter);

    this.sizzleLight = new THREE.PointLight(0xff8c42, 0, 3.2);
    this.sizzleLight.position.set(0, 1.6, 0);
    panVisual.add(this.sizzleLight);

    this.panProp = new SteakPanInteractable(
      anchor.position,
      anchor.floor,
      panVisual,
      () => this.missions.getActiveObjective()?.id === 'm7-start-cooking' && this.phase === 'idle',
      () => {
        this.missions.notifyInteract(this.panProp.id);
        this.open();
      },
    );

    this.group.add(this.panProp.meshGroup);
    interactions.register(this.panProp);
    i18n.onChange(() => this.emitState());
  }

  /** Opens the cooking overlay and starts a fresh round. */
  open(): void {
    this.overlayOpen = true;
    this.startRound();
  }

  close(): void {
    this.overlayOpen = false;
    this.phase = 'idle';
    this.result = null;
    this.doneness = 0;
    this.emitState();
  }

  isOverlayOpen(): boolean {
    return this.overlayOpen;
  }

  isCooking(): boolean {
    return this.overlayOpen && this.phase === 'cooking';
  }

  startRound(): void {
    if (!this.overlayOpen) return;
    this.phase = 'cooking';
    this.result = null;
    this.doneness = 0;
    this.attempts += 1;
    this.emitState();
  }

  /** Flip & serve: grade the steak against the requested doneness. */
  finishCooking(): void {
    if (!this.isCooking()) return;

    const zone = zoneForDoneness(this.doneness);
    if (zone === STEAK_TARGET_DONENESS) {
      const center = ZONE_CENTERS[STEAK_TARGET_DONENESS];
      this.result = Math.abs(this.doneness - center) <= PERFECT_WINDOW ? 'perfect' : 'good';
    } else {
      this.result = 'miss';
    }

    this.phase = 'ended';
    if (this.result === 'perfect' || this.result === 'good') {
      this.missions.notifyMinigameComplete(STEAK_MINIGAME_ID);
    }
    this.emitState();
  }

  update(dt: number): void {
    if (this.phase === 'cooking') {
      this.sizzleTime += dt;
      this.sizzleLight.intensity = 0.7 + Math.sin(this.sizzleTime * 18) * 0.25;
      this.doneness = Math.min(100, this.doneness + (dt * 100) / STEAK_COOK_DURATION_SEC);
      if (this.doneness >= 100) {
        // Left on the heat too long: burnt, round over.
        this.result = 'miss';
        this.phase = 'ended';
      }
      this.emitState();
    } else {
      this.sizzleLight.intensity = 0;
    }
  }

  getSnapshot(): SteakSnapshot {
    return {
      visible: this.overlayOpen,
      phase: this.phase,
      doneness: Math.round(this.doneness * 10) / 10,
      targetDoneness: STEAK_TARGET_DONENESS,
      currentZone: zoneForDoneness(this.doneness),
      result: this.result,
      attempts: this.attempts,
    };
  }

  private emitState(): void {
    this.eventBus.emit('steak:stateChanged', this.getSnapshot());
  }
}
