import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/constants';
import { AssetManager } from '../src/core/AssetManager';
import type { InputState } from '../src/core/InputManager';
import { PlayerController } from '../src/player/PlayerController';
import { CollisionManager } from '../src/world/CollisionManager';
import { createStoreNavGraph } from '../src/world/NavGraph';
import { WorldManager } from '../src/world/WorldManager';

function makeInput(overrides: Partial<InputState> = {}): InputState {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    jumpPressed: false,
    lookDeltaX: 0,
    lookDeltaY: 0,
    ...overrides,
  };
}

describe('WorldManager & Two-Floor Store (Stage 2B.3)', () => {
  it('builds all connected F1 & F2 areas and detects surface/floor-aware zones accurately', () => {
    const assets = new AssetManager();
    const collision = new CollisionManager();
    const world = new WorldManager(assets, collision);

    expect(world.getZoneAt(new THREE.Vector3(0, 0, 2.5), 1)).toBe('Control Room');
    expect(world.getZoneAt(new THREE.Vector3(1.5, 0, 8.8), 1)).toBe('Staff Break Room');
    expect(world.getZoneAt(new THREE.Vector3(14, 0, 3.6), 1)).toBe('Market Hall');
    expect(world.getZoneAt(new THREE.Vector3(14, 5.8, 3.6), 2)).toBe('Showroom');
    expect(world.getZoneAt(new THREE.Vector3(36, 5.8, -6), 2)).toBe('Restaurant');
    expect(world.getZoneAt(new THREE.Vector3(21, 0, -24), 1)).toBe('Warehouse');
    expect(world.getZoneAt(new THREE.Vector3(21, 0, 19), 1)).toBe('Checkout');
    expect(world.getZoneAt(new THREE.Vector3(21, 0, 35), 1)).toBe('Parking Lot');

    // Committed floor wins over intermediate height near upper landing
    expect(world.getZoneAt(new THREE.Vector3(21.6, 5.4, 2.5), 1)).toBe('Market Hall');
    expect(world.getZoneAt(new THREE.Vector3(21.6, 5.4, 1.5), 2)).toBe('Showroom');
  });

  it('has unobstructed walkable passages between Control Room, Market Hall, Warehouse, Checkout, and Parking Lot', () => {
    const assets = new AssetManager();
    const collision = new CollisionManager();
    const world = new WorldManager(assets, collision);

    // 1. Walk East out of Control Room doorway (x=4.5 -> x=9 at z=3.6)
    const p1 = new PlayerController(new THREE.Vector3(4.5, 0, 3.6), collision);
    for (let i = 0; i < 60; i++) {
      // cameraYaw = -PI/2 looks toward +X
      p1.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), -Math.PI / 2);
    }
    expect(p1.position.x).toBeGreaterThan(8.0);
    expect(world.getZoneAt(p1.position, p1.getFloorState().committedFloor)).toBe('Market Hall');

    // 2. Walk North from Market Hall into Warehouse (z=-11 -> z=-17 at x=21)
    const p2 = new PlayerController(new THREE.Vector3(21, 0, -11), collision);
    for (let i = 0; i < 60; i++) {
      p2.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), 0);
    }
    expect(p2.position.z).toBeLessThan(-16.0);
    expect(world.getZoneAt(p2.position, p2.getFloorState().committedFloor)).toBe('Warehouse');

    // 3. Walk South from Market Hall West aisle (x=18.2, z=11) through Checkout into Parking Lot
    const p3 = new PlayerController(new THREE.Vector3(18.2, 0, 11), collision);
    for (let i = 0; i < 160; i++) {
      p3.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), Math.PI);
    }
    expect(p3.position.z).toBeGreaterThan(25.0);
    expect(world.getZoneAt(p3.position, p3.getFloorState().committedFloor)).toBe('Parking Lot');
  });

  it('transports Kfir smoothly between F1 and F2 via Up Escalator, Wide Stairs, and protects Atrium cutout with balustrades', () => {
    const assets = new AssetManager();
    const collision = new CollisionManager();
    const world = new WorldManager(assets, collision);

    // Walk onto Up Escalator (x=21.6, z=12.6 -> z<=1.0 at Y=5.8) even with modest input
    const pUp = new PlayerController(new THREE.Vector3(21.6, 0, 12.6), collision);
    for (let i = 0; i < 150; i++) {
      // Yaw = 0 pushes North (-Z)
      pUp.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), 0);
      if (pUp.position.z <= 0.8) break;
    }
    expect(pUp.position.y).toBeCloseTo(5.8, 1);
    expect(pUp.getFloorState().committedFloor).toBe(2);
    expect(world.getZoneAt(pUp.position, pUp.getFloorState().committedFloor)).toBe('Showroom');

    // Verify F2 Atrium glass balustrade blocks stepping East off West slab at z=7 into the open Atrium
    const pRail = new PlayerController(new THREE.Vector3(18.5, 5.8, 7.0), collision);
    for (let i = 0; i < 60; i++) {
      pRail.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), -Math.PI / 2);
    }
    expect(pRail.position.x).toBeLessThan(19.9);
    expect(pRail.position.y).toBeCloseTo(5.8, 1);

    // Descend Wide Staircase from F2 (27.9, 5.8, 1.2) -> F1 (z >= 13.0, Y = 0)
    const pDown = new PlayerController(new THREE.Vector3(27.9, 5.8, 1.2), collision);
    for (let i = 0; i < 160; i++) {
      // Yaw = Math.PI pushes South (+Z)
      pDown.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), Math.PI);
      if (pDown.position.z >= 13.0) break;
    }
    expect(pDown.position.y).toBeCloseTo(0, 1);
    expect(pDown.getFloorState().committedFloor).toBe(1);
    expect(world.getZoneAt(pDown.position, pDown.getFloorState().committedFloor)).toBe('Market Hall');

    // Verify Store NavGraph routes F1 -> F2 via Up Escalator and F2 -> F1 via Down Escalator or Wide Stairs
    const nav = createStoreNavGraph();
    const upRoute = nav.findPath('f1-market-center', 'f2-restaurant');
    expect(upRoute.length).toBeGreaterThanOrEqual(4);
    expect(upRoute.some((n) => n.id === 'f1-esc-up-bottom')).toBe(true);
    expect(upRoute.some((n) => n.id === 'f2-esc-up-top')).toBe(true);

    const downRoute = nav.findPath('f2-living', 'f1-market-center');
    expect(downRoute.length).toBeGreaterThanOrEqual(4);
    expect(
      downRoute.some((n) => n.id === 'f2-esc-down-top' || n.id === 'f2-stairs-top'),
    ).toBe(true);
  });

  it('prevents walking past outer Parking Lot perimeter bounds', () => {
    const assets = new AssetManager();
    const collision = new CollisionManager();
    new WorldManager(assets, collision);

    const player = new PlayerController(new THREE.Vector3(21, 0, 49), collision);
    for (let i = 0; i < 90; i++) {
      player.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), Math.PI);
    }
    expect(player.position.z).toBeLessThanOrEqual(52 - PLAYER_CONFIG.radius + 0.01);
  });
});
