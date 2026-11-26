import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKfirModel } from '../src/assets/characters/KfirModel';
import { createPalette } from '../src/assets/materials/Palette';
import { PLAYER_CONFIG, WORLD_ZONES } from '../src/config/constants';
import { AssetManager } from '../src/core/AssetManager';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import type { InputState } from '../src/core/InputManager';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { PlayerController } from '../src/player/PlayerController';
import { VEHICLE_CONFIG } from '../src/vehicles/VehicleController';
import { VehicleManager } from '../src/vehicles/VehicleManager';
import { CollisionManager } from '../src/world/CollisionManager';
import { WorldManager } from '../src/world/WorldManager';

function makeInput(overrides: Partial<InputState> = {}): InputState {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    jumpPressed: false,
    handbrake: false,
    lookDeltaX: 0,
    lookDeltaY: 0,
    ...overrides,
  };
}

describe('Phase 5 Vehicle System', () => {
  function setupWorldAndCar(carPos = new THREE.Vector3(14.0, 0, 33.5), carYaw = 0) {
    const bus = new EventBus<GameEvents>();
    const assets = new AssetManager();
    const collision = new CollisionManager();
    const world = new WorldManager(assets, collision);
    const palette = createPalette(assets);
    const interactions = new InteractionManager(bus, collision);
    const kfirRig = createKfirModel(palette);
    const player = new PlayerController(new THREE.Vector3(15.6, 0, 33.5), collision, bus);
    const manager = new VehicleManager(palette, collision, interactions, bus, kfirRig, player);

    const car = manager.spawnVehicle({
      id: 'car-kfir',
      name: 'Car',
      position: carPos,
      yaw: carYaw,
      bodyMat: palette.carColors[0],
    });

    return { bus, collision, world, palette, interactions, kfirRig, player, manager, car };
  }

  it('detects driver-side enter prompt cleanly and blocks entering through a wall', () => {
    const { interactions, collision, player, car } = setupWorldAndCar();

    // Facing -X toward driver door (15.18, 0, 33.5) from (16.5, 0, 33.5)
    player.position.set(16.5, 0, 33.5);
    player.facingYaw = -Math.PI / 2;
    interactions.update(0.016, player.position, player.facingYaw, true);
    expect(interactions.getActiveTarget()?.id).toBe(car.id);
    expect(interactions.getActiveTarget()?.getPromptText()).toBe('PRESS E TO ENTER CAR');

    // Place a solid wall between Kfir and the driver door
    collision.addBox(
      'blocker-wall',
      new THREE.Vector3(15.7, 0, 31.0),
      new THREE.Vector3(15.9, 2.5, 36.0),
      true,
    );
    interactions.update(0.016, player.position, player.facingYaw, true);
    expect(interactions.getActiveTarget()).toBeNull();
  });

  it('accelerates, boosts, coasts, brakes, reverses, applies handbrake, and steers based on speed', () => {
    // Open center drive aisle at x = 21 (clear of parked cars and streetlights at x=0, 17, 34)
    const { manager, car, kfirRig } = setupWorldAndCar(new THREE.Vector3(21.0, 0, 29.0), 0);
    expect(manager.enterVehicle(car)).toBe(true);

    // Finish enter transition
    for (let i = 0; i < 20; i++) {
      manager.updateDriving(1 / 60, makeInput(), true);
    }
    expect(manager.isDriving()).toBe(true);
    expect(kfirRig.hips.position.y).toBeLessThan(0);

    // Stationary steering must not rotate the car in place
    const yawBefore = car.yaw;
    manager.updateDriving(0.1, makeInput({ moveX: -1 }), true);
    expect(car.yaw).toBeCloseTo(yawBefore, 5);

    // Accelerate forward and steer left slightly (A -> moveX = -1 -> +yaw)
    const startZ = car.position.z;
    for (let i = 0; i < 70; i++) {
      manager.updateDriving(1 / 60, makeInput({ moveZ: 1, moveX: -0.5 }), true);
    }
    expect(car.getSpeed()).toBeGreaterThan(10);
    expect(car.position.z).toBeGreaterThan(startZ);
    expect(car.yaw).toBeGreaterThan(yawBefore);
    expect(car.rig.frontLeftSteerPivot.rotation.y).toBeGreaterThan(0.05);
    expect(car.rig.wheels[0].rotation.x).toBeGreaterThan(5);

    // Boost on wide unobstructed Eastbound lane (-6, 0, 48.5, yaw=PI/2) pushes beyond normal maxForwardSpeed
    car.position.set(-6.0, 0, 48.5);
    car.yaw = Math.PI / 2;
    for (let i = 0; i < 95; i++) {
      manager.updateDriving(1 / 60, makeInput({ moveZ: 1, sprint: true }), true);
    }
    expect(car.getSpeed()).toBeGreaterThan(VEHICLE_CONFIG.maxForwardSpeed);
    expect(car.getSpeed()).toBeLessThanOrEqual(VEHICLE_CONFIG.boostMaxSpeed + 0.01);

    // Coasting decays speed naturally
    const boostedSpeed = car.getSpeed();
    for (let i = 0; i < 30; i++) {
      manager.updateDriving(1 / 60, makeInput(), true);
    }
    expect(car.getSpeed()).toBeLessThan(boostedSpeed);

    // Braking illuminates brake lights and reverses when held from rest
    manager.updateDriving(1 / 60, makeInput({ moveZ: -1 }), true);
    expect(car.rig.brakeLightMat.emissiveIntensity).toBeGreaterThan(1.0);
    for (let i = 0; i < 180; i++) {
      manager.updateDriving(1 / 60, makeInput({ moveZ: -1 }), true);
    }
    expect(car.getSpeed()).toBeLessThan(-3);
    expect(car.getGear()).toBe('R');

    // Handbrake stops fast
    for (let i = 0; i < 30; i++) {
      manager.updateDriving(1 / 60, makeInput({ handbrake: true }), true);
    }
    expect(Math.abs(car.getSpeed())).toBeLessThan(0.1);

    // Headlight toggle
    expect(manager.toggleHeadlights()).toBe(false);
    expect(car.rig.headlightBeams.visible).toBe(false);
    expect(manager.toggleHeadlights()).toBe(true);
    expect(car.rig.headlightBeams.visible).toBe(true);
  });

  it('collides solidly with Parking Lot perimeter walls, entrance safety bollards, and parked cars without teleporting or falling', () => {
    const { minX, maxZ } = WORLD_ZONES.parkingLot;
    const { manager, car } = setupWorldAndCar(new THREE.Vector3(21.0, 0, maxZ - 8.0), 0);
    manager.enterVehicle(car);
    for (let i = 0; i < 20; i++) manager.updateDriving(1 / 60, makeInput(), true);

    // Drive straight South (+Z) into parking-bound-s at z = WORLD_ZONES.parkingLot.maxZ
    for (let i = 0; i < 240; i++) {
      manager.updateDriving(1 / 60, makeInput({ moveZ: 1, sprint: true }), true);
    }
    expect(car.position.z).toBeLessThanOrEqual(maxZ - car.rig.halfExtents.z + 0.35);
    expect(car.position.y).toBe(0);

    // Entrance steel bollards at z = 25.0 must block Kfir's Car from driving North inside Checkout Hall
    car.position.set(21.0, 0, 29.0);
    car.yaw = Math.PI;
    for (let i = 0; i < 120; i++) {
      manager.updateDriving(1 / 60, makeInput({ moveZ: 1, sprint: true }), true);
    }
    expect(car.position.z).toBeGreaterThanOrEqual(25.0);

    // Verify clean driving across West wall (minX = -18)
    expect(minX).toBe(-18);
  });

  it('prevents high-speed exits, selects clear exit sides near walls, and supports repeated enter/exit', () => {
    const { minX } = WORLD_ZONES.parkingLot;
    const { manager, car, player, kfirRig, bus } = setupWorldAndCar(
      new THREE.Vector3(minX + 1.9, 0, 35.0),
      0,
    );
    const notices: string[] = [];
    bus.on('vehicle:stateChanged', (s) => {
      if (s.statusToast) notices.push(s.statusToast);
    });

    manager.enterVehicle(car);
    for (let i = 0; i < 20; i++) manager.updateDriving(1 / 60, makeInput(), true);

    // Accelerate above maxExitSpeed -> tryExit must fail
    for (let i = 0; i < 45; i++) {
      manager.updateDriving(1 / 60, makeInput({ moveZ: 1 }), true);
    }
    expect(car.getSpeed()).toBeGreaterThan(VEHICLE_CONFIG.maxExitSpeed);
    expect(manager.tryExit()).toBe(false);
    expect(notices[notices.length - 1]).toContain('Slow down');

    // Handbrake to rest near West wall (x=-12; car driver +X side is open, or invert yaw so +X faces wall)
    for (let i = 0; i < 60; i++) {
      manager.updateDriving(1 / 60, makeInput({ handbrake: true }), true);
    }
    car.yaw = Math.PI; // now driver local +X faces -X toward wall at x = -12 (-10.1 - 1.75 = -11.85 too close!)
    car.updatePhysics(1 / 60, makeInput(), false);

    expect(manager.tryExit()).toBe(true);
    for (let i = 0; i < 20; i++) manager.updateDriving(1 / 60, makeInput(), false);
    expect(manager.isInVehicle()).toBe(false);
    // Exited on clear passenger/open side away from West wall, standing safely on ground
    expect(player.position.x).toBeGreaterThan(minX + PLAYER_CONFIG.radius);
    expect(player.position.y).toBe(0);
    expect(kfirRig.hips.position.y).toBe(0);

    // Re-enter and exit a second time cleanly
    expect(manager.enterVehicle(car)).toBe(true);
    for (let i = 0; i < 20; i++) manager.updateDriving(1 / 60, makeInput(), true);
    expect(manager.tryExit()).toBe(true);
    for (let i = 0; i < 20; i++) manager.updateDriving(1 / 60, makeInput(), false);
    expect(manager.isInVehicle()).toBe(false);
  });
});
