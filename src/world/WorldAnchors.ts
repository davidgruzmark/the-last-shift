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
    computer: anchor('control.computer', -0.6, 0, -3.55, 1, 'Control Room', Math.PI),
    m1Radio: anchor('control.m1Radio', -1.8, 0, -2.1, 1, 'Control Room'),
    vipLocker: anchor('control.vipLocker', -5.2, 0, -4.6, 1, 'Control Room'),
    spareKeycard: anchor('control.spareKeycard', -3.0, 0, 3.6, 1, 'Control Room'),
    eastDoor: anchor('control.eastDoor', 7.15, 0, 3.6, 1, 'Control Room'),
    eastDoorExit: anchor('control.eastDoorExit', 9.2, 0, 3.6, 1, 'Market Hall'),
  },
  vertical: {
    escalatorUpBottom: anchor('vertical.escalatorUpBottom', 21.6, 0, 12.6, 1, 'Market Hall'),
    escalatorUpTop: anchor('vertical.escalatorUpTop', 21.6, 5.8, 1.4, 2, 'Showroom'),
    escalatorDownTop: anchor('vertical.escalatorDownTop', 24.4, 5.8, 1.4, 2, 'Showroom'),
    escalatorDownBottom: anchor('vertical.escalatorDownBottom', 24.4, 0, 12.6, 1, 'Market Hall'),
    stairsBottom: anchor('vertical.stairsBottom', 27.9, 0, 12.6, 1, 'Market Hall'),
    stairsTop: anchor('vertical.stairsTop', 27.9, 5.8, 1.4, 2, 'Showroom'),
  },
  showroomF2: {
    livingRoom: anchor('showroomF2.livingRoom', 14.0, 5.8, 6.0, 2, 'Showroom'),
    bedrooms: anchor('showroomF2.bedrooms', 13.5, 5.8, 18.0, 2, 'Showroom'),
    kitchens: anchor('showroomF2.kitchens', 36.5, 5.8, 10.5, 2, 'Showroom'),
    northPromenade: anchor('showroomF2.northPromenade', 15.0, 5.8, -8.0, 2, 'Showroom'),
  },
  restaurantF2: {
    counter: anchor('restaurantF2.counter', 37.5, 5.8, -11.6, 2, 'Restaurant'),
    diningCenter: anchor('restaurantF2.diningCenter', 36.8, 5.8, -5.5, 2, 'Restaurant'),
  },
  showroom: {
    entry: anchor('showroom.entry', 13.5, 0, 2.5, 1, 'Market Hall'),
    danny: anchor('showroom.danny', 10.6, 0, 1.4, 1, 'Market Hall', -Math.PI * 0.35),
    maya: anchor('showroom.maya', 16.6, 5.8, 6.8, 2, 'Showroom', Math.PI * 0.75),
    malmWatchBox: anchor('showroom.malmWatchBox', 14.6, 5.8, 18.2, 2, 'Showroom'),
    m5Reach: anchor('showroom.m5Reach', 16.2, 5.8, 2.5, 2, 'Showroom'),
    m5EmptyDisplay: anchor('showroom.m5EmptyDisplay', 15.2, 5.8, 1.2, 2, 'Showroom'),
    royalEssence: anchor('showroom.royalEssence', 9.2, 0, 12.2, 1, 'Market Hall'),
    kitchenEpicWatch: anchor('showroom.kitchenEpicWatch', 38.2, 5.8, 10.6, 2, 'Showroom'),
    flashlight: anchor('showroom.flashlight', 14.2, 0, -6.0, 1, 'Market Hall'),
  },
  restaurant: {
    missingWatch: anchor('restaurant.missingWatch', 35.8, 5.8, -10.8, 2, 'Restaurant'),
    classicWatch: anchor('restaurant.classicWatch', 35.6, 5.8, -6.2, 2, 'Restaurant'),
    oceanKing: anchor('restaurant.oceanKing', 42.8, 5.8, -3.2, 2, 'Restaurant'),
  },
  warehouse: {
    entrance: anchor('warehouse.entrance', 21.0, 0, -16.5, 1, 'Warehouse'),
    m1Clue: anchor('warehouse.m1Clue', 18.5, 0, -21.0, 1, 'Warehouse'),
    yossi: anchor('warehouse.yossi', 18.4, 0, -22.8, 1, 'Warehouse', 0.2),
    m2Reach: anchor('warehouse.m2Reach', 17.5, 0, -18.2, 1, 'Warehouse'),
    m4Reach: anchor('warehouse.m4Reach', 21.0, 0, -17.5, 1, 'Warehouse'),
    m4EmergencySwitch: anchor('warehouse.m4EmergencySwitch', 21.0, 0, -37.2, 1, 'Warehouse'),
    ballPickup: anchor('warehouse.ballPickup', 21.0, 0, -16.8, 1, 'Warehouse'),
    theBoss: anchor('warehouse.theBoss', 35.2, 0, -34.8, 1, 'Warehouse'),
    radioBattery: anchor('warehouse.radioBattery', 24.5, 0, -22.5, 1, 'Warehouse'),
  },
  checkout: {
    bagClue: anchor('checkout.bagClue', 19.5, 0, 16.5, 1, 'Checkout'),
    midnightNoir: anchor('checkout.midnightNoir', 29.8, 0, 21.8, 1, 'Checkout'),
    mainEntrance: anchor('checkout.mainEntrance', 21.0, 0, 23.82, 1, 'Checkout'),
  },
  parking: {
    kfirCar: anchor('parking.kfirCar', 14.0, 0, 33.5, 1, 'Parking Lot', 0),
    miniPitchCenter: anchor('parking.miniPitchCenter', 34.0, 0, 48.0, 1, 'Parking Lot'),
    legendaryWatch: anchor('parking.legendaryWatch', 43.2, 0, 30.5, 1, 'Parking Lot'),
  },
} as const;

export const DEFAULT_FLOOR_REGIONS: readonly WorldFloorRegion[] = [
  { id: 'reg-control', floor: 1, zone: 'Control Room', minX: -7, maxX: 7, minY: -0.5, maxY: 4.7, minZ: -6, maxZ: 6 },
  { id: 'reg-staff', floor: 1, zone: 'Staff Break Room', minX: -7, maxX: 7, minY: -0.5, maxY: 4.7, minZ: 6.01, maxZ: 12.2 },
  { id: 'reg-warehouse', floor: 1, zone: 'Warehouse', minX: 7, maxX: 45, minY: -0.5, maxY: 9.5, minZ: -44, maxZ: -14 },
  { id: 'reg-restaurant-f2', floor: 2, zone: 'Restaurant', minX: 30.5, maxX: 45, minY: 5.3, maxY: 11.0, minZ: -14, maxZ: 1.8 },
  { id: 'reg-showroom-f2', floor: 2, zone: 'Showroom', minX: 7, maxX: 45, minY: 5.3, maxY: 11.0, minZ: -14, maxZ: 24 },
  { id: 'reg-markethall-f1', floor: 1, zone: 'Market Hall', minX: 7, maxX: 45, minY: -0.5, maxY: 5.75, minZ: -14, maxZ: 14 },
  { id: 'reg-checkout-f1', floor: 1, zone: 'Checkout', minX: 7, maxX: 45, minY: -0.5, maxY: 5.75, minZ: 14, maxZ: 24 },
  { id: 'reg-parking', floor: 1, zone: 'Parking Lot', minX: -24, maxX: 60, minY: -0.5, maxY: 10.0, minZ: 24, maxZ: 80 },
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
