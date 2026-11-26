/// <reference types="vite/client" />
import * as THREE from 'three';
import { createPalette, type MaterialPalette } from '../assets/materials/Palette';
import { COLLECTIBLE_DEFS, EMPLOYEE_NPCS } from '../config/worldInteractions';
import { CONTROL_ROOM_BOUNDS, WORLD_ZONES, type WorldZoneId } from '../config/constants';
import { CollectibleManager } from '../collectibles/CollectibleManager';
import type { AssetManager } from '../core/AssetManager';
import type { EventBus, GameEvents } from '../core/EventBus';
import { ComputerInteraction } from '../interaction/ComputerInteraction';
import { DoorInteraction, type DoorKeySecurityConfig } from '../interaction/DoorInteraction';
import type { InteractionManager } from '../interaction/InteractionManager';
import type { DialogueManager } from '../npcs/DialogueManager';
import { NPCInteraction } from '../npcs/NPCInteraction';
import type { CollisionManager } from './CollisionManager';
import { buildControlRoom } from './ControlRoomBuilder';
import { buildStoreWorld } from './EnvironmentBuilder';

export interface InteractiveWorldHandles {
  collectibles: CollectibleManager;
  computer: ComputerInteraction;
  doors: DoorInteraction[];
  npcs: NPCInteraction[];
}

/**
 * Coordinates all connected Phase 2/3 world zones, unified sky/shadow lighting,
 * interactive objects, and live player zone detection.
 */
export class WorldManager {
  readonly root = new THREE.Group();
  readonly palette: MaterialPalette;
  readonly sunLight: THREE.DirectionalLight;
  private readonly collision: CollisionManager;
  private readonly sunOffset = new THREE.Vector3(14, 24, 16);

  constructor(assets: AssetManager, collision: CollisionManager) {
    this.root.name = 'WorldRoot';
    this.collision = collision;
    this.palette = createPalette(assets);

    const controlRoom = buildControlRoom(assets, collision, this.palette);
    this.root.add(controlRoom.group);

    const storeWorld = buildStoreWorld(this.palette, collision);
    this.root.add(storeWorld);

    const hemiLight = new THREE.HemisphereLight(0xdceeff, 0x7d746b, 0.92);
    hemiLight.position.set(15, 25, 0);
    this.root.add(hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff6e8, 1.25);
    this.sunLight.position.copy(this.sunOffset);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 65;
    this.sunLight.shadow.camera.left = -22;
    this.sunLight.shadow.camera.right = 22;
    this.sunLight.shadow.camera.top = 22;
    this.sunLight.shadow.camera.bottom = -22;
    this.sunLight.shadow.bias = -0.0008;
    this.sunLight.shadow.normalBias = 0.02;

    this.root.add(this.sunLight);
    this.root.add(this.sunLight.target);
  }

  /** Populates Phase 3 doors, NPCs, collectibles, and Control Room security computer. */
  populateInteractions(
    interactions: InteractionManager,
    dialogue: DialogueManager,
    eventBus: EventBus<GameEvents>,
    controlRoomSecurity: DoorKeySecurityConfig = { lockedByDefault: true },
  ): InteractiveWorldHandles {
    const eastWallX = CONTROL_ROOM_BOUNDS.width / 2 + CONTROL_ROOM_BOUNDS.wallThickness / 2;

    // 1. Functional Doors (Secured Key-Locked Control Room Door + Automatic Main Entrance Sliding Doors)
    const controlRoomDoor = DoorInteraction.createDoubleHinged(
      {
        id: 'control-room-exit',
        centerPos: new THREE.Vector3(eastWallX, 0, 3.6),
        totalWidth: 2.56,
        height: 2.68,
        thickness: 0.12,
        axis: 'z',
        outwardSign: 1,
        securedByKey: controlRoomSecurity,
      },
      this.palette,
      this.collision,
    );

    const entranceAutoDoors = DoorInteraction.createAutoSliding(
      {
        id: 'main-entrance-sliding',
        centerPos: new THREE.Vector3(21, 0, WORLD_ZONES.checkout.maxZ - 0.18),
        totalWidth: 6.0,
        height: 3.55,
        thickness: 0.14,
        triggerRadius: 4.4,
      },
      this.palette,
      this.collision,
    );

    const doors = [controlRoomDoor, entranceAutoDoors];
    for (const door of doors) {
      this.root.add(door.meshGroup);
      interactions.register(door);
    }

    // 2. IKEA Employee NPCs
    const qaYossiOverlap =
      import.meta.env.DEV &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('qa') === 'yossi-overlap';

    const npcs = EMPLOYEE_NPCS.map((def) => {
      const effectiveDef =
        qaYossiOverlap && def.id === 'employee-yossi'
          ? {
              ...def,
              position: new THREE.Vector3(18.5, 0, -21.0),
              patrolPoints: undefined,
            }
          : def;
      const npc = new NPCInteraction(effectiveDef, this.palette, this.collision, dialogue);
      this.root.add(npc.meshGroup);
      interactions.register(npc);
      return npc;
    });

    // 3. Collectibles
    const collectibles = new CollectibleManager(eventBus);
    for (const def of COLLECTIBLE_DEFS) {
      const item = collectibles.addCollectible(def);
      interactions.register(item);
    }
    this.root.add(collectibles.group);

    // 4. Control Room Security Computer
    const computer = new ComputerInteraction(new THREE.Vector3(0, 0, -2.85), eventBus);
    interactions.register(computer);

    return { collectibles, computer, doors, npcs };
  }

  /** Keeps directional shadows crisp around Kfir across the entire connected map. */
  updateShadowTarget(playerPos: THREE.Vector3): void {
    const snappedX = Math.round(playerPos.x * 2) * 0.5;
    const snappedZ = Math.round(playerPos.z * 2) * 0.5;
    this.sunLight.target.position.set(snappedX, 0, snappedZ);
    this.sunLight.position.set(
      snappedX + this.sunOffset.x,
      this.sunOffset.y,
      snappedZ + this.sunOffset.z,
    );
  }

  getZoneAt(pos: THREE.Vector3): WorldZoneId {
    const { controlRoom, restaurant, warehouse, checkout, parkingLot } = WORLD_ZONES;

    if (
      pos.x >= controlRoom.minX &&
      pos.x <= controlRoom.maxX &&
      pos.z >= controlRoom.minZ &&
      pos.z <= controlRoom.maxZ
    ) {
      return 'Control Room';
    }

    if (pos.z < warehouse.maxZ) {
      return 'Warehouse';
    }

    if (
      pos.x >= restaurant.minX &&
      pos.x <= restaurant.maxX &&
      pos.z >= restaurant.minZ &&
      pos.z <= restaurant.maxZ
    ) {
      return 'Restaurant';
    }

    if (pos.z >= parkingLot.minZ) {
      return 'Parking Lot';
    }

    if (pos.z >= checkout.minZ) {
      return 'Checkout';
    }

    return 'Showroom';
  }
}
