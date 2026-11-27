import * as THREE from 'three';
import { createPerfumeBottle, type PerfumeVariant } from '../assets/collectibles/PerfumeBottleModel';
import { createWatchModel, type WatchVisualRarity } from '../assets/collectibles/WatchModel';
import type { MaterialPalette } from '../assets/materials/Palette';
import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { Interactable } from '../interaction/Interactable';
import type { InteractionManager } from '../interaction/InteractionManager';
import type { DialogueLine, DialogueManager } from '../npcs/DialogueManager';
import type { FloorId } from '../world/CollisionManager';
import { WORLD_ANCHORS, type WorldAnchor } from '../world/WorldAnchors';
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
  readonly floor: FloorId;
  readonly state: AnimatedPickup;

  private readonly worldPos: THREE.Vector3;
  private readonly getPromptFn: () => string;
  private readonly onTriggerFn: () => void;
  private readonly canInteractFn: () => boolean;

  constructor(options: {
    id: string;
    position: THREE.Vector3;
    floor?: FloorId;
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
    this.floor = options.floor ?? (options.position.y >= 5.3 ? 2 : 1);
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

export interface WorldCollectionHooks {
  dialogue?: DialogueManager;
  onJimmyChooCollected?: () => void;
}

/**
 * Spawns and manages the real-world exploration pickups:
 * - Perfumes: Dior Sauvage EDP (F2 Restaurant), Jimmy Choo Man EDT (Warehouse East), Armani Code Parfum (Control Room VIP Locker)
 *   (JPG Le Male Le Parfum is M05's heist centerpiece)
 * - Watches: TAG Heuer Carrera (F2 Kitchens), Omega Seamaster Diver 300M (Parking Lot East)
 *   (Casio G-Shock is in F2 Restaurant via COLLECTIBLE_DEFS; Gold Rolex Daytona Ref. 126508 is M03's centerpiece)
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
    hooks?: WorldCollectionHooks,
  ) {
    this.group.name = 'RealWorldCollectionProps';

    const showMonologue = (lines: DialogueLine[]): void => {
      if (hooks?.dialogue && !hooks.dialogue.isActive()) {
        hooks.dialogue.start(i18n.t('npc.Kfir'), lines);
      }
    };

    const addPerfumePickup = (
      id: string,
      variant: PerfumeVariant,
      anchor: WorldAnchor,
      onCollected?: () => void,
    ): void => {
      const rig = createPerfumeBottle(variant);
      rig.group.scale.setScalar(1.25);
      const prop = new WorldCollectibleProp({
        id,
        position: anchor.position,
        floor: anchor.floor,
        visual: rig.group,
        sparkles: rig.sparkles,
        getPrompt: () => i18n.t('prompt.collectItem', { name: i18n.t(`item.${id}`).toUpperCase() }),
        canInteract: () => !collectibles.hasCollected(id),
        onTrigger: () => {
          if (collectibles.hasCollected(id)) return;
          prop.state.collected = true;
          prop.state.animTimer = 0;
          perfumes.unlockPerfume(id);
          onCollected?.();
        },
      });
      this.props.push(prop);
      this.group.add(prop.state.meshGroup);
      interactions.register(prop);
    };

    const addWatchPickup = (
      id: string,
      rarity: WatchVisualRarity,
      anchor: WorldAnchor,
    ): void => {
      const rig = createWatchModel(rarity);
      rig.group.scale.setScalar(1.15);
      const prop = new WorldCollectibleProp({
        id,
        position: anchor.position,
        floor: anchor.floor,
        visual: rig.group,
        sparkles: rig.sparkles,
        ringColor: rarity === 'Legendary' ? 0xfbbf24 : rarity === 'Epic' ? 0xc084fc : 0x60a5fa,
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

    // 1. Dior Sauvage EDP — F2 IKEA Restaurant Patio (triggers Kfir's natural "ערסִים" joke)
    addPerfumePickup('perfume-dior-sauvage', 'dior-sauvage', WORLD_ANCHORS.restaurant.diorSauvage, () => {
      showMonologue([
        {
          speaker: 'KFIR',
          speakerKey: 'speaker.KFIR',
          text: 'Dior Sauvage... the undefeated classic for every arsim night out.',
          textKey: 'dialogue.diorSauvage.1',
        },
      ]);
    });

    // 2. Jimmy Choo Man EDT — F1 High-Bay Warehouse East Aisle (triggers Lior joke + Friends milestone)
    addPerfumePickup('perfume-jimmy-choo-man', 'jimmy-choo-man', WORLD_ANCHORS.warehouse.jimmyChooMan, () => {
      showMonologue([
        {
          speaker: 'KFIR',
          speakerKey: 'speaker.KFIR',
          text: 'Jimmy Choo Man... Lior sprays so much of this you can smell him two aisles before you see him.',
          textKey: 'dialogue.jimmyChoo.1',
        },
      ]);
      hooks?.onJimmyChooCollected?.();
    });

    // 3. Armani Code Parfum — Control Room VIP Security Locker (unlocks with keycard-spare)
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
    const armaniBottle = createPerfumeBottle('armani-code');
    armaniBottle.group.position.y = 0.94;
    armaniBottle.group.scale.setScalar(1.2);
    lockerPedestal.add(cabinet, glassCase, armaniBottle.group);

    const lockerWrap = new THREE.Group();
    lockerPedestal.position.y = -0.55;
    lockerWrap.add(lockerPedestal);

    const armaniProp = new WorldCollectibleProp({
      id: 'perfume-armani-code',
      position: WORLD_ANCHORS.controlRoom.vipLocker.position,
      floor: WORLD_ANCHORS.controlRoom.vipLocker.floor,
      radius: 2.6,
      visual: lockerWrap,
      sparkles: armaniBottle.sparkles,
      getPrompt: () =>
        collectibles.hasCollected('keycard-spare')
          ? i18n.t('prompt.vipLockerOpen')
          : i18n.t('prompt.vipLockerLocked'),
      canInteract: () => !collectibles.hasCollected('perfume-armani-code'),
      onTrigger: () => {
        if (!collectibles.hasCollected('keycard-spare')) {
          eventBus.emit('mission:notification', {
            kind: 'failed',
            title: i18n.t('locker.lockedToastTitle'),
            subtitle: i18n.t('locker.lockedToastBody'),
          });
          return;
        }
        if (collectibles.hasCollected('perfume-armani-code')) return;
        armaniProp.state.collected = true;
        armaniProp.state.animTimer = 0;
        if (this.vipLockerDoor) this.vipLockerDoor.visible = false;
        perfumes.unlockPerfume('perfume-armani-code');
      },
    });
    armaniProp.update = (dt: number) => {
      if (armaniProp.state.collected) {
        if (armaniProp.state.animTimer >= 0 && armaniProp.state.animTimer < 0.6) {
          armaniProp.state.animTimer += dt;
          const p = Math.min(1, armaniProp.state.animTimer / 0.6);
          armaniBottle.group.position.y = 0.94 + p * 0.9;
          armaniBottle.group.rotation.y += dt * 10;
          if (p >= 1) armaniBottle.group.visible = false;
        }
        return;
      }
      armaniBottle.group.rotation.y += dt * 1.4;
    };
    this.props.push(armaniProp);
    this.group.add(armaniProp.state.meshGroup);
    interactions.register(armaniProp);

    // 4. TAG Heuer Carrera Chronograph (Epic Watch) — F2 Showroom Kitchen display
    addWatchPickup('watch-tag-carrera', 'Epic', WORLD_ANCHORS.showroom.tagCarrera);
    // 5. Omega Seamaster Diver 300M (Rare Watch) — Parking Lot East Apron
    addWatchPickup('watch-omega-seamaster', 'Rare', WORLD_ANCHORS.parking.omegaSeamaster);
  }

  getPropCount(): number {
    return this.props.length;
  }

  /**
   * Hides pickup props whose IDs were already collected in a restored save file,
   * so reloaded sessions never show ghost collectibles that cannot be picked up.
   */
  syncCollectedFromSave(hasCollected: (id: string) => boolean): void {
    for (const prop of this.props) {
      if (!prop.state.collected && hasCollected(prop.id)) {
        prop.state.collected = true;
        prop.state.meshGroup.visible = false;
      }
    }
  }
}
