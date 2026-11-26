import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/constants';
import type { InputState } from '../src/core/InputManager';
import { PlayerController } from '../src/player/PlayerController';
import { CollisionManager } from '../src/world/CollisionManager';

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

function createRoomCollision(): CollisionManager {
  const cm = new CollisionManager();
  cm.addBox('floor', new THREE.Vector3(-7, -1, -6), new THREE.Vector3(7, 0, 6));
  cm.addBox('wall-north', new THREE.Vector3(-7, 0, -6.3), new THREE.Vector3(7, 4, -6));
  cm.addBox('wall-south', new THREE.Vector3(-7, 0, 6), new THREE.Vector3(7, 4, 6.3));
  cm.addBox('wall-west', new THREE.Vector3(-7.3, 0, -6), new THREE.Vector3(-7, 4, 6));
  cm.addBox('wall-east', new THREE.Vector3(7, 0, -6), new THREE.Vector3(7.3, 4, 6));
  return cm;
}

describe('PlayerController', () => {
  it('moves forward relative to camera yaw and transitions from walk to run to sprint', () => {
    const cm = new CollisionManager();
    cm.addBox('wide-floor', new THREE.Vector3(-30, -1, -30), new THREE.Vector3(30, 0, 30));
    const player = new PlayerController(new THREE.Vector3(0, 0, 15), cm);

    // Walk forward (camera yaw = 0 looks toward -Z)
    for (let i = 0; i < 30; i++) {
      player.update(1 / 60, makeInput({ moveZ: 1, sprint: false }), 0);
    }
    expect(player.position.z).toBeLessThan(13.0);
    expect(player.animState).toBe('walk');
    expect(player.getHorizontalSpeed()).toBeCloseTo(PLAYER_CONFIG.walkSpeed, 1);

    // Initial Shift+W transitions into Run
    for (let i = 0; i < 20; i++) {
      player.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), 0);
    }
    expect(player.animState).toBe('run');
    expect(player.getHorizontalSpeed()).toBeGreaterThan(PLAYER_CONFIG.walkSpeed + 1.5);

    // Sustained Shift+W ramps into energetic Sprint
    for (let i = 0; i < 65; i++) {
      player.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), 0);
    }
    expect(player.animState).toBe('sprint');
    expect(player.getHorizontalSpeed()).toBeGreaterThan(PLAYER_CONFIG.runSpeed + 1.5);
  });

  it('jumps when grounded, ignores mid-air jump presses, and lands back on the floor', () => {
    const cm = createRoomCollision();
    const player = new PlayerController(new THREE.Vector3(0, 0, 0), cm);

    player.update(1 / 60, makeInput({ jumpPressed: true }), 0);
    expect(player.grounded).toBe(false);
    expect(player.animState).toBe('jump');
    expect(player.position.y).toBeGreaterThan(0);

    // Try jumping again mid-air near apex — velocity should not reset upward
    for (let i = 0; i < 15; i++) {
      player.update(1 / 60, makeInput(), 0);
    }
    const vyBeforeAirJump = player.velocity.y;
    player.update(1 / 60, makeInput({ jumpPressed: true }), 0);
    expect(player.velocity.y).toBeLessThan(vyBeforeAirJump);

    // Simulate until landed
    for (let i = 0; i < 60; i++) {
      player.update(1 / 60, makeInput(), 0);
    }
    expect(player.grounded).toBe(true);
    expect(player.position.y).toBeCloseTo(0, 4);
    expect(player.animState).toBe('idle');
  });

  it('prevents player from exiting room walls', () => {
    const cm = createRoomCollision();
    const player = new PlayerController(new THREE.Vector3(0, 0, -5), cm);

    for (let i = 0; i < 120; i++) {
      player.update(1 / 60, makeInput({ moveZ: 1, sprint: true }), 0);
    }

    expect(player.position.z).toBeGreaterThanOrEqual(-6 + PLAYER_CONFIG.radius - 0.001);
    expect(player.getHorizontalSpeed()).toBeCloseTo(0, 2);
    expect(player.animState).toBe('idle');
  });
});
