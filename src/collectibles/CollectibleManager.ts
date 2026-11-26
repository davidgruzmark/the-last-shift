import * as THREE from 'three';
import { createWatchModel } from '../assets/collectibles/WatchModel';
import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { Interactable } from '../interaction/Interactable';
import type { FloorId } from '../world/CollisionManager';

export interface CollectibleDefinition {
  id: string;
  name: string;
  nameKey?: string;
  position: THREE.Vector3;
  floor?: FloorId;
  color: number;
  kind: 'keycard' | 'perfume' | 'watch' | 'battery';
}

function buildCollectibleMesh(def: CollectibleDefinition): THREE.Group {
  const group = new THREE.Group();
  const mainMat = new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: 0.35,
    metalness: 0.45,
    emissive: def.color,
    emissiveIntensity: 0.2,
    flatShading: true,
  });

  if (def.kind === 'keycard') {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.22), mainMat);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.33, 0.045, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xffda1a, roughness: 0.4 }),
    );
    stripe.position.z = 0.05;
    group.add(card, stripe);
  } else if (def.kind === 'perfume') {
    const bottle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.14), mainMat);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6),
      new THREE.MeshStandardMaterial({ color: 0xf4c430, metalness: 0.7, roughness: 0.3 }),
    );
    cap.position.y = 0.19;
    group.add(bottle, cap);
  } else if (def.kind === 'watch') {
    const watchRig = createWatchModel('Common');
    watchRig.group.scale.setScalar(1.1);
    group.add(watchRig.group);
  } else {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.14), mainMat);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.04, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x2ecc71, emissiveIntensity: 0.6 }),
    );
    top.position.y = 0.16;
    group.add(pack, top);
  }

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
    }
  });

  return group;
}

class CollectibleItem implements Interactable {
  readonly id: string;
  readonly type = 'collectible' as const;
  readonly radius = 2.2;
  readonly floor: FloorId;
  readonly meshGroup = new THREE.Group();

  private readonly itemName: string;
  private readonly itemNameKey?: string;
  private readonly worldPos: THREE.Vector3;
  private readonly visualPivot = new THREE.Group();
  private readonly ring: THREE.Mesh;
  private readonly onCollect: (item: CollectibleItem) => void;
  private collected = false;
  private bobTime = Math.random() * Math.PI * 2;

  constructor(def: CollectibleDefinition, onCollect: (item: CollectibleItem) => void) {
    this.id = def.id;
    this.floor = def.floor ?? (def.position.y >= 5.3 ? 2 : 1);
    this.itemName = def.name;
    this.itemNameKey = def.nameKey;
    this.worldPos = def.position.clone();
    this.onCollect = onCollect;

    this.meshGroup.name = `Collectible_${def.id}`;
    this.meshGroup.position.copy(def.position);

    const mesh = buildCollectibleMesh(def);
    this.visualPivot.position.y = 0.55;
    this.visualPivot.add(mesh);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.36, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffda1a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;

    this.meshGroup.add(this.visualPivot, this.ring);
  }

  getName(): string {
    return this.itemNameKey ? i18n.t(this.itemNameKey) : this.itemName;
  }

  isCollected(): boolean {
    return this.collected;
  }

  getWorldPosition(): THREE.Vector3 {
    return this.worldPos;
  }

  canInteract(): boolean {
    return !this.collected;
  }

  getPromptText(): string {
    return i18n.t('prompt.collectItem', { name: this.getName().toUpperCase() });
  }

  setHighlighted(active: boolean): void {
    const mat = this.ring.material as THREE.MeshBasicMaterial;
    mat.color.setHex(active ? 0x2ecc71 : 0xffda1a);
    this.ring.scale.setScalar(active ? 1.28 : 1.0);
  }

  onInteract(): void {
    if (this.collected) return;
    this.collected = true;
    this.meshGroup.visible = false;
    this.onCollect(this);
  }

  update(dt: number): void {
    if (this.collected) return;
    this.bobTime += dt * 2.4;
    this.visualPivot.position.y = 0.55 + Math.sin(this.bobTime) * 0.1;
    this.visualPivot.rotation.y += dt * 1.6;
  }
}

/**
 * Reusable collectible manager tracking collected IDs and preventing double collection.
 */
export class CollectibleManager {
  readonly group = new THREE.Group();
  private readonly items: CollectibleItem[] = [];
  private readonly collectedIds = new Set<string>();
  private readonly eventBus?: EventBus<GameEvents>;

  constructor(eventBus?: EventBus<GameEvents>) {
    this.group.name = 'CollectiblesGroup';
    this.eventBus = eventBus;
  }

  addCollectible(def: CollectibleDefinition): Interactable {
    const item = new CollectibleItem(def, (collectedItem) => {
      if (this.collectedIds.has(collectedItem.id)) return;
      this.collectedIds.add(collectedItem.id);
      this.eventBus?.emit('collectible:collected', {
        id: collectedItem.id,
        name: collectedItem.getName(),
        collectedCount: this.collectedIds.size,
        totalCount: this.items.length,
      });
    });
    this.items.push(item);
    this.group.add(item.meshGroup);
    return item;
  }

  getCollectedIds(): string[] {
    return Array.from(this.collectedIds);
  }

  getTotalCount(): number {
    return this.items.length;
  }

  hasCollected(id: string): boolean {
    return this.collectedIds.has(id);
  }

  grantRewardItem(id: string, name: string): void {
    if (this.collectedIds.has(id)) return;
    this.collectedIds.add(id);
    this.eventBus?.emit('collectible:collected', {
      id,
      name,
      collectedCount: this.collectedIds.size,
      totalCount: Math.max(this.items.length, this.collectedIds.size),
    });
  }
}
