import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/constants';
import { AssetManager } from '../src/core/AssetManager';
import type { InputState } from '../src/core/InputManager';
import { PlayerController } from '../src/player/PlayerController';
import { CollisionManager } from '../src/world/CollisionManager';
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

describe('WorldManager (Phase 2)', () => {
  it('builds all connected world areas and detects zones accurately', () => {
    const assets = new AssetManager();
    const collision = new CollisionManager();
    const world = new WorldManager(assets, collision);

    expect(world.getZoneAt(new THREE.Vector3(0, 0, 2.5))).toBe('Control Room');
    expect(world.getZoneAt(new THREE.Vector3(14, 0, 3.6))).toBe('Showroom');
    expect(world.getZoneAt(new THREE.Vector3(30, 0, -8))).toBe('Restaurant');
    expect(world.getZoneAt(new THREE.Vector3(21, 0, -24))).toBe('Warehouse');
    expect(world.getZoneAt(new THREE.Vector3(21, 0, 19))).toBe('Checkout');
    expect(world.getZoneAt(new THREE.Vector3(21, 0, 35))).toBe('Parking Lot');
  });

  it('has unobstructed walkable passages between Control Room, Showroom, Warehouse, Checkout, and Parking Lot', () => {
    const assets = new AssetManager();
    const collision = new CollisionManager();
    const world = new WorldManager(assets, collision);

    // 1. Walk East out of Control Room doorway (x=5 -> x=9 at z=3.6)
    const p1 = new PlayerController(new THREE.Vector3(4.5, 0, 3.6), collision);
    for (let i = 0; i < 60; i++) {
      // cameraYaw = -PI/2 looks toward +X
      p1.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), -Math.PI / 2);
    }
    expect(p1.position.x).toBeGreaterThan(8.0);
    expect(world.getZoneAt(p1.position)).toBe('Showroom');

    // 2. Walk North from Showroom into Warehouse (z=-11 -> z=-17 at x=21)
    const p2 = new PlayerController(new THREE.Vector3(21, 0, -11), collision);
    for (let i = 0; i < 60; i++) {
      p2.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), 0);
    }
    expect(p2.position.z).toBeLessThan(-16.0);
    expect(world.getZoneAt(p2.position)).toBe('Warehouse');

    // 3. Walk South from Showroom through Checkout into Parking Lot (z=11 -> z=27 at x=21)
    const p3 = new PlayerController(new THREE.Vector3(21, 0, 11), collision);
    for (let i = 0; i < 160; i++) {
      p3.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), Math.PI);
    }
    expect(p3.position.z).toBeGreaterThan(25.0);
    expect(world.getZoneAt(p3.position)).toBe('Parking Lot');
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
