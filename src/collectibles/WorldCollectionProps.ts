import * as THREE from 'three';
import { createPerfumeBottle, type PerfumeVariant } from '../assets/collectibles/PerfumeBottleModel';
import { createWatchModel, type WatchVisualRarity } from '../assets/collectibles/WatchModel';
import type { MaterialPalette } from '../assets/materials/Palette';
import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { Interactable } from '../interaction/Interactable';
import type { InteractionManager } from '../interaction/InteractionManager';
import type { CollectibleManager } from './CollectibleManager';
import type { PerfumeCollection } from './PerfumeCollection';
import type { WatchCollection } from './WatchCollection';

interface AnimatedPickup {
  id: string;
  meshGroup: THREE.Group;
  visualPivot: THREE.Group;
  ring: THREE.Mesh;
  sparkles: THREE.Object3D[];
  animTimer: number;
  collected: boolean;
  bobOffset: number;
}

class WorldCollectibleProp implements Interactable {
  readonly id: string;
  readonly type = 'collectible' as const;
  readonly radius: number;
  readonly state: AnimatedPickup;

  private readonly worldPos: THREE.Vector3;
  private readonly getPromptFn: () => string;
  private readonly onTriggerFn: () => void;
  private readonly canInteractFn: () => boolean;

  constructor(options: {
    id: string;
    position: THREE.Vector3;
    radius?: number;
    visual: THREE.Group;
    sparkles: THREE.Object3D[];
    ringColor?: number;
    getPrompt: () => string;
    canInteract: () => boolean;
    onTrigger: () => void;
  }) {
    this.id = options.id;
    this.radius = options.radius ?? 2.4;
    this.worldPos = options.position.clone();
    this.getPromptFn = options.getPrompt;
    this.canInteractFn = options.canInteract;
    this.onTriggerFn = options.onTrigger;

    const meshGroup = new THREE.Group();
    meshGroup.name = `CollectionProp_${options.id}`;
    meshGroup.position.copy(options.position);

    const visualPivot = new THREE.Group();
    visualPivot.position.y = 0.55;
    visualPivot.add(options.visual);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.4, 18),
      new THREE.MeshBasicMaterial({
        color: options.ringColor ?? 0xffda1a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    meshGroup.add(visualPivot, ring);

    this.state = {
      id: options.id,
      meshGroup,
      visualPivot,
      ring,
      sparkles: options.sparkles,
      animTimer: -1,
      collected: false,
      bobOffset: Math.random() * Math.PI * 2,
    };
  }

  getWorldPosition(): THREE.Vector3 {
    return this.worldPos;
  }

  getPromptText(): string {
    return this.getPromptFn();
  }

  getPriority(): number {
    return 0.6;
  }

  canInteract(): boolean {
    return !this.state.collected && this.canInteractFn();
  }

  setHighlighted(active: boolean): void {
    const mat = this.state.ring.material as THREE.MeshBasicMaterial;
    mat.color.setHex(active ? 0x2ecc71 : 0xffda1a);
    this.state.ring.scale.setScalar(active ? 1.25 : 1.0);
  }

  onInteract(): void {
    if (!this.canInteract()) return;
    this.onTriggerFn();
  }

  update(dt: number): void {
    if (this.state.collected) {
      if (this.state.animTimer >= 0 && this.state.animTimer < 0.6) {
        this.state.animTimer += dt;
        const p = Math.min(1, this.state.animTimer / 0.6);
        this.state.visualPivot.position.y = 0.55 + p * 0.9;
        this.state.visualPivot.rotation.y += dt * 11;
        this.state.visualPivot.scale.setScalar(1 + p * 0.3);
        for (let i = 0; i < this.state.sparkles.length; i++) {
          const sp = this.state.sparkles[i];
          const ang = (i * Math.PI) / 2 + p * 4;
          sp.position.set(
            Math.cos(ang) * (0.24 + p * 0.5),
            0.35 + p * 0.65,
            Math.sin(ang) * (0.24 + p * 0.5),
          );
          sp.scale.setScalar(1 - p * 0.85);
        }
        if (p >= 1) {
          this.state.meshGroup.visible = false;
        }
      }
      return;
    }

    this.state.bobOffset += dt * 2.2;
    this.state.visualPivot.position.y = 0.55 + Math.sin(this.state.bobOffset) * 0.08;
    this.state.visualPivot.rotation.y += dt * 1.4;
  }
}

/**
 * Spawns and manages the Phase 6.2 world collectibles for the remaining 4 perfumes
 * (Ocean King, Royal Essence, The Boss, Kfir Signature VIP locker) and 2 new watches
 * (IKEA Chrono Pro Epic, Shiftmaster Chronometer Legendary).
 */
export class WorldCollectionProps {
  readonly group = new THREE.Group();
  private readonly props: WorldCollectibleProp[] = [];
  private vipLockerDoor?: THREE.Object3D;

  constructor(
    palette: MaterialPalette,
    interactions: InteractionManager,
    collectibles: CollectibleManager,
    perfumes: PerfumeCollection,
    watches: WatchCollection,
    eventBus: EventBus<GameEvents>,
  ) {
    this.group.name = 'Phase62CollectionProps';

    const addPerfumePickup = (
      id: string,
      variant: PerfumeVariant,
      pos: THREE.Vector3,
    ): void => {
      const rig = createPerfumeBottle(variant);
      rig.group.scale.setScalar(1.25);
      const prop = new WorldCollectibleProp({
        id,
        position: pos,
        visual: rig.group,
        sparkles: rig.sparkles,
        getPrompt: () => i18n.t('prompt.collectItem', { name: i18n.t(`item.${id}`).toUpperCase() }),
        canInteract: () => !collectibles.hasCollected(id),
        onTrigger: () => {
          if (collectibles.hasCollected(id)) return;
          prop.state.collected = true;
          prop.state.animTimer = 0;
          perfumes.unlockPerfume(id);
        },
      });
      this.props.push(prop);
      this.group.add(prop.state.meshGroup);
      interactions.register(prop);
    };

    const addWatchPickup = (
      id: string,
      rarity: WatchVisualRarity,
      pos: THREE.Vector3,
    ): void => {
      const rig = createWatchModel(rarity);
      rig.group.scale.setScalar(1.15);
      const prop = new WorldCollectibleProp({
        id,
        position: pos,
        visual: rig.group,
        sparkles: rig.sparkles,
        ringColor: rarity === 'Legendary' ? 0xfbbf24 : 0xc084fc,
        getPrompt: () => i18n.t('prompt.collectItem', { name: i18n.t(`item.${id}`).toUpperCase() }),
        canInteract: () => !collectibles.hasCollected(id),
        onTrigger: () => {
          if (collectibles.hasCollected(id)) return;
          prop.state.collected = true;
          prop.state.animTimer = 0;
          watches.unlockWatch(id);
        },
      });
      this.props.push(prop);
      this.group.add(prop.state.meshGroup);
      interactions.register(prop);
    };

    // 1. Ocean King — IKEA Restaurant Patio corner
    addPerfumePickup('perfume-ocean-king', 'ocean-king', new THREE.Vector3(33.4, 0, -3.0));
    // 2. Royal Essence — Living Room Vignette shelf corner
    addPerfumePickup('perfume-royal-essence', 'royal-essence', new THREE.Vector3(9.2, 0, 12.2));
    // 3. The Boss — Warehouse East Self-Serve Bay
    addPerfumePickup('perfume-the-boss', 'the-boss', new THREE.Vector3(33.4, 0, -34.8));

    // 4. Kfir Signature — Control Room VIP Security Locker (unlocks with keycard-spare)
    const lockerPedestal = new THREE.Group();
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.55), palette.darkNavy);
    cabinet.position.y = 0.45;
    const glassCase = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.65, 0.48),
      new THREE.MeshStandardMaterial({
        color: 0x9bd3f5,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    glassCase.position.y = 1.22;
    this.vipLockerDoor = glassCase;
    const kfirBottle = createPerfumeBottle('kfir-signature');
    kfirBottle.group.position.y = 0.94;
    kfirBottle.group.scale.setScalar(1.2);
    lockerPedestal.add(cabinet, glassCase, kfirBottle.group);

    // Offset base Y = 0 inside WorldCollectibleProp pivot
    const lockerWrap = new THREE.Group();
    lockerPedestal.position.y = -0.55;
    lockerWrap.add(lockerPedestal);

    const kfirProp = new WorldCollectibleProp({
      id: 'perfume-kfir-signature',
      position: new THREE.Vector3(-5.2, 0, -4.6),
      radius: 2.6,
      visual: lockerWrap,
      sparkles: kfirBottle.sparkles,
      getPrompt: () =>
        collectibles.hasCollected('keycard-spare')
          ? i18n.t('prompt.vipLockerOpen')
          : i18n.t('prompt.vipLockerLocked'),
      canInteract: () => !collectibles.hasCollected('perfume-kfir-signature'),
      onTrigger: () => {
        if (!collectibles.hasCollected('keycard-spare')) {
          eventBus.emit('mission:notification', {
            kind: 'failed',
            title: i18n.t('locker.lockedToastTitle'),
            subtitle: i18n.t('locker.lockedToastBody'),
          });
          return;
        }
        if (collectibles.hasCollected('perfume-kfir-signature')) return;
        kfirProp.state.collected = true;
        kfirProp.state.animTimer = 0;
        if (this.vipLockerDoor) this.vipLockerDoor.visible = false;
        perfumes.unlockPerfume('perfume-kfir-signature');
      },
    });
    // Keep pedestal steady (do not spin entire cabinet inside pivot)
    kfirProp.update = (dt: number) => {
      if (kfirProp.state.collected) {
        if (kfirProp.state.animTimer >= 0 && kfirProp.state.animTimer < 0.6) {
          kfirProp.state.animTimer += dt;
          const p = Math.min(1, kfirProp.state.animTimer / 0.6);
          kfirBottle.group.position.y = 0.94 + p * 0.9;
          kfirBottle.group.rotation.y += dt * 10;
          if (p >= 1) kfirBottle.group.visible = false;
        }
        return;
      }
      kfirBottle.group.rotation.y += dt * 1.4;
    };
    this.props.push(kfirProp);
    this.group.add(kfirProp.state.meshGroup);
    interactions.register(kfirProp);

    // 5. IKEA Chrono Pro (Epic Watch) — Showroom Kitchen showcase
    addWatchPickup('watch-chronograph-pro', 'Epic', new THREE.Vector3(28.4, 0, 10.2));
    // 6. Shiftmaster Chronometer (Legendary Watch) — Parking Lot East Apron
    addWatchPickup('watch-chrono-legend', 'Legendary', new THREE.Vector3(39.2, 0, 28.5));
  }

  getPropCount(): number {
    return this.props.length;
  }
}
