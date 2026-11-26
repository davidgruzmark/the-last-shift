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
import { SECURITY_ROSTER_DEFS } from '../npcs/ControlRoomStaffingSystem';
import type { DialogueManager } from '../npcs/DialogueManager';
import { NPCInteraction } from '../npcs/NPCInteraction';
import type { CollisionManager, FloorId } from './CollisionManager';
import { buildControlRoom } from './ControlRoomBuilder';
import { buildStoreWorld } from './EnvironmentBuilder';
import { buildShowroomFloor2 } from './ShowroomFloor2Builder';
import { resolveFloorRegion, WORLD_ANCHORS } from './WorldAnchors';

export interface InteractiveWorldHandles {
  collectibles: CollectibleManager;
  computer: ComputerInteraction;
  doors: DoorInteraction[];
  npcs: NPCInteraction[];
  staffDoor: DoorInteraction;
  staffGuards: NPCInteraction[];
}

/**
 * Coordinates all connected Phase 2/3/2B world zones, unified sky/shadow lighting,
 * dark interior Control Room atmosphere transitions, interactive objects, and live zone detection.
 */
export class WorldManager {
  readonly root = new THREE.Group();
  readonly palette: MaterialPalette;
  readonly sunLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly collision: CollisionManager;
  private readonly sunOffset = new THREE.Vector3(14, 24, 16);

  constructor(
    assets: AssetManager,
    collision: CollisionManager,
    wallFeedTextures: readonly THREE.Texture[] = [],
  ) {
    this.root.name = 'WorldRoot';
    this.collision = collision;
    this.palette = createPalette(assets);

    const controlRoom = buildControlRoom(assets, collision, this.palette, wallFeedTextures);
    this.root.add(controlRoom.group);

    const storeWorld = buildStoreWorld(this.palette, collision);
    this.root.add(storeWorld);

    const floor2Showroom = buildShowroomFloor2(this.palette, collision);
    this.root.add(floor2Showroom);

    this.hemiLight = new THREE.HemisphereLight(0xdceeff, 0x7d746b, 0.92);
    this.hemiLight.position.set(15, 25, 0);
    this.root.add(this.hemiLight);

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

    const southDoorZ = CONTROL_ROOM_BOUNDS.depth / 2 + CONTROL_ROOM_BOUNDS.wallThickness / 2;
    const staffDoor = DoorInteraction.createManualHinged(
      {
        id: 'staff-break-door',
        hingePos: new THREE.Vector3(-3.95, 0, southDoorZ),
        width: 1.85,
        height: 2.65,
        thickness: 0.12,
        axis: 'x',
        openAngle: -Math.PI * 0.48,
      },
      this.palette,
      this.collision,
    );

    const doors = [controlRoomDoor, staffDoor, entranceAutoDoors];
    for (const door of doors) {
      this.root.add(door.meshGroup);
      interactions.register(door);
    }

    // 2. IKEA Employee NPCs + Rotating Control Room Security Roster
    const qaYossiOverlap =
      import.meta.env.DEV &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('qa') === 'yossi-overlap';

    const storyNpcs = EMPLOYEE_NPCS.map((def) => {
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

    const staffGuards = SECURITY_ROSTER_DEFS.map((def) => {
      const guard = new NPCInteraction(def, this.palette, this.collision, dialogue);
      this.root.add(guard.meshGroup);
      interactions.register(guard);
      return guard;
    });

    const npcs = [...storyNpcs, ...staffGuards];

    // 3. Collectibles
    const collectibles = new CollectibleManager(eventBus);
    for (const def of COLLECTIBLE_DEFS) {
      const item = collectibles.addCollectible(def);
      interactions.register(item);
    }
    this.root.add(collectibles.group);

    // 4. Control Room Security Computer (anchored at Station A desk)
    const computer = new ComputerInteraction(WORLD_ANCHORS.controlRoom.computer.position.clone(), eventBus);
    interactions.register(computer);

    return { collectibles, computer, doors, npcs, staffDoor, staffGuards };
  }

  /** Smoothly shifts ambient lighting dark inside the Control Room so monitor glow pops cleanly. */
  updateAtmosphere(dt: number, zone: WorldZoneId): void {
    const isDarkOps = zone === 'Control Room';
    const targetHemi = isDarkOps ? 0.36 : 0.92;
    const targetSun = isDarkOps ? 0.16 : 1.25;
    const blend = 1 - Math.exp(-5.0 * dt);
    this.hemiLight.intensity += (targetHemi - this.hemiLight.intensity) * blend;
    this.sunLight.intensity += (targetSun - this.sunLight.intensity) * blend;
  }

  /** Keeps directional shadows crisp around Kfir across the entire connected map. */
  updateShadowTarget(playerPos: THREE.Vector3): void {
    const snappedX = Math.round(playerPos.x * 2) * 0.5;
    const snappedZ = Math.round(playerPos.z * 2) * 0.5;
    this.sunLight.target.position.set(snappedX, playerPos.y, snappedZ);
    this.sunLight.position.set(
      snappedX + this.sunOffset.x,
      playerPos.y + this.sunOffset.y,
      snappedZ + this.sunOffset.z,
    );
  }

  getZoneAt(pos: THREE.Vector3, committedFloor?: FloorId): WorldZoneId {
    const region = resolveFloorRegion(pos, undefined, committedFloor);
    if (region) return region.zone;
    if (pos.y >= 5.3) return 'Showroom';
    return 'Market Hall';
  }
}
