import * as THREE from 'three';
import type { WorldZoneId } from '../config/constants';
import type { FloorId } from './CollisionManager';

export interface WorldAnchor {
  readonly id: string;
  readonly position: THREE.Vector3;
  readonly floor: FloorId;
  readonly zone: WorldZoneId;
  readonly facingYaw?: number;
}

export interface WorldFloorRegion {
  readonly id: string;
  readonly floor: FloorId;
  readonly zone: WorldZoneId;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

function anchor(
  id: string,
  x: number,
  y: number,
  z: number,
  floor: FloorId,
  zone: WorldZoneId,
  facingYaw?: number,
): WorldAnchor {
  return {
    id,
    position: new THREE.Vector3(x, y, z),
    floor,
    zone,
    facingYaw,
  };
}

/**
 * Semantic world location anchors decoupling missions, props, NPCs, cameras,
 * and collectibles from hardcoded raw coordinates across map expansions.
 * (Stage 2B.1 aligns cleanly to existing F1 layout; updated atomically in 2B.2–2B.5.)
 */
export const WORLD_ANCHORS = {
  controlRoom: {
    spawn: anchor('control.spawn', 0, 0, 2.5, 1, 'Control Room', Math.PI),
    computer: anchor('control.computer', 0, 0, -2.85, 1, 'Control Room', Math.PI),
    m1Radio: anchor('control.m1Radio', -1.8, 0, -2.1, 1, 'Control Room'),
    vipLocker: anchor('control.vipLocker', -5.2, 0, -4.6, 1, 'Control Room'),
    spareKeycard: anchor('control.spareKeycard', -3.0, 0, 3.6, 1, 'Control Room'),
    eastDoor: anchor('control.eastDoor', 7.15, 0, 3.6, 1, 'Control Room'),
    eastDoorExit: anchor('control.eastDoorExit', 9.2, 0, 3.6, 1, 'Showroom'),
  },
  showroom: {
    entry: anchor('showroom.entry', 13.5, 0, 2.5, 1, 'Showroom'),
    danny: anchor('showroom.danny', 10.6, 0, 1.4, 1, 'Showroom', -Math.PI * 0.35),
    maya: anchor('showroom.maya', 16.5, 0, 7.5, 1, 'Showroom', Math.PI * 0.75),
    malmWatchBox: anchor('showroom.malmWatchBox', 13.8, 0, -7.8, 1, 'Showroom'),
    m5Reach: anchor('showroom.m5Reach', 14.8, 0, 1.2, 1, 'Showroom'),
    m5EmptyDisplay: anchor('showroom.m5EmptyDisplay', 15.2, 0, -1.8, 1, 'Showroom'),
    royalEssence: anchor('showroom.royalEssence', 9.2, 0, 12.2, 1, 'Showroom'),
    kitchenEpicWatch: anchor('showroom.kitchenEpicWatch', 28.4, 0, 10.2, 1, 'Showroom'),
    flashlight: anchor('showroom.flashlight', 14.2, 0, -6.0, 1, 'Showroom'),
  },
  restaurant: {
    missingWatch: anchor('restaurant.missingWatch', 28.2, 0, -11.0, 1, 'Restaurant'),
    classicWatch: anchor('restaurant.classicWatch', 29.5, 0, -6.5, 1, 'Restaurant'),
    oceanKing: anchor('restaurant.oceanKing', 33.4, 0, -3.0, 1, 'Restaurant'),
  },
  warehouse: {
    entrance: anchor('warehouse.entrance', 21.0, 0, -16.5, 1, 'Warehouse'),
    m1Clue: anchor('warehouse.m1Clue', 18.5, 0, -21.0, 1, 'Warehouse'),
    yossi: anchor('warehouse.yossi', 18.4, 0, -22.8, 1, 'Warehouse', 0.2),
    m2Reach: anchor('warehouse.m2Reach', 17.5, 0, -18.2, 1, 'Warehouse'),
    m4Reach: anchor('warehouse.m4Reach', 21.0, 0, -17.5, 1, 'Warehouse'),
    m4EmergencySwitch: anchor('warehouse.m4EmergencySwitch', 21.0, 0, -37.2, 1, 'Warehouse'),
    ballPickup: anchor('warehouse.ballPickup', 21.0, 0, -16.8, 1, 'Warehouse'),
    theBoss: anchor('warehouse.theBoss', 33.4, 0, -34.8, 1, 'Warehouse'),
    radioBattery: anchor('warehouse.radioBattery', 24.5, 0, -22.5, 1, 'Warehouse'),
  },
  checkout: {
    bagClue: anchor('checkout.bagClue', 19.5, 0, 16.5, 1, 'Checkout'),
    midnightNoir: anchor('checkout.midnightNoir', 29.8, 0, 21.8, 1, 'Checkout'),
    mainEntrance: anchor('checkout.mainEntrance', 21.0, 0, 23.82, 1, 'Checkout'),
  },
  parking: {
    kfirCar: anchor('parking.kfirCar', 14.0, 0, 33.5, 1, 'Parking Lot', 0),
    miniPitchCenter: anchor('parking.miniPitchCenter', 23.5, 0, 44.0, 1, 'Parking Lot'),
    legendaryWatch: anchor('parking.legendaryWatch', 39.2, 0, 28.5, 1, 'Parking Lot'),
  },
} as const;

export const DEFAULT_FLOOR_REGIONS: readonly WorldFloorRegion[] = [
  { id: 'reg-control', floor: 1, zone: 'Control Room', minX: -7, maxX: 7, minY: -0.5, maxY: 4.5, minZ: -6, maxZ: 6 },
  { id: 'reg-warehouse', floor: 1, zone: 'Warehouse', minX: 7, maxX: 35, minY: -0.5, maxY: 7.5, minZ: -38, maxZ: -14 },
  { id: 'reg-restaurant', floor: 1, zone: 'Restaurant', minX: 25, maxX: 35, minY: -0.5, maxY: 5.6, minZ: -14, maxZ: -2 },
  { id: 'reg-showroom', floor: 1, zone: 'Showroom', minX: 7, maxX: 35, minY: -0.5, maxY: 5.6, minZ: -14, maxZ: 14 },
  { id: 'reg-checkout', floor: 1, zone: 'Checkout', minX: 7, maxX: 35, minY: -0.5, maxY: 5.6, minZ: 14, maxZ: 24 },
  { id: 'reg-parking', floor: 1, zone: 'Parking Lot', minX: -12, maxX: 46, minY: -0.5, maxY: 8.0, minZ: 24, maxZ: 52 },
];

/** Resolves explicit 3D region matching a world position and optional committed floor. */
export function resolveFloorRegion(
  pos: THREE.Vector3,
  regions: readonly WorldFloorRegion[] = DEFAULT_FLOOR_REGIONS,
  committedFloor?: FloorId,
): WorldFloorRegion | null {
  let fallbackMatch: WorldFloorRegion | null = null;
  for (const r of regions) {
    if (
      pos.x >= r.minX &&
      pos.x <= r.maxX &&
      pos.z >= r.minZ &&
      pos.z <= r.maxZ &&
      pos.y >= r.minY &&
      pos.y <= r.maxY
    ) {
      if (!committedFloor || r.floor === committedFloor) {
        return r;
      }
      if (!fallbackMatch) fallbackMatch = r;
    }
  }
  return fallbackMatch;
}
