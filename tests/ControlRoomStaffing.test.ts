import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createPalette } from '../src/assets/materials/Palette';
import { SurveillanceCameraSystem } from '../src/camera/SurveillanceCameraSystem';
import { AssetManager } from '../src/core/AssetManager';
import { SECURITY_CAMERA_FEEDS } from '../src/interaction/ComputerInteraction';
import { DoorInteraction } from '../src/interaction/DoorInteraction';
import {
  ControlRoomStaffingSystem,
  SECURITY_ROSTER_DEFS,
} from '../src/npcs/ControlRoomStaffingSystem';
import { DialogueManager } from '../src/npcs/DialogueManager';
import { NPCInteraction } from '../src/npcs/NPCInteraction';
import { CollisionManager } from '../src/world/CollisionManager';
import { buildControlRoom } from '../src/world/ControlRoomBuilder';

function createStaffSetup() {
  const assets = new AssetManager();
  const collision = new CollisionManager();
  const palette = createPalette(assets);
  const dialogue = new DialogueManager();

  // Registers 'ctrl-chair-b' and builds dark Control Room + Staff Break Room
  buildControlRoom(assets, collision, palette);

  const staffDoor = DoorInteraction.createManualHinged(
    {
      id: 'staff-break-door',
      hingePos: new THREE.Vector3(-3.95, 0, 6.15),
      width: 1.85,
      height: 3.1,
      thickness: 0.14,
      axis: 'x',
      openAngle: -Math.PI * 0.48,
    },
    palette,
    collision,
  );

  const guards = SECURITY_ROSTER_DEFS.map(
    (def) => new NPCInteraction(def, palette, collision, dialogue),
  );

  const staffing = new ControlRoomStaffingSystem({
    guards,
    staffDoor,
    collision,
    dialogue,
    shiftDurationSec: 5,
  });

  return { collision, staffDoor, guards, staffing };
}

describe('Phase 2B.2 Control Room & Physical Staffing Rotation', () => {
  it('completes full shift rotation physically with door passage, zero teleportation, and chair collider toggling', () => {
    const { collision, staffDoor, guards, staffing } = createStaffSetup();
    const farPlayer = new THREE.Vector3(25, 0, 25);

    const isChairColliderEnabled = () =>
      collision.getColliders().find((c) => c.id === 'ctrl-chair-b')?.enabled ?? false;

    expect(staffing.getPhase()).toBe('staffed');
    expect(staffing.getActiveGuard()?.id).toBe('guard-avi');
    expect(staffing.getReliefGuard()?.id).toBe('guard-omer');
    expect(isChairColliderEnabled()).toBe(true);

    // Advance past shift duration to trigger shift rotation
    const dt = 0.05;
    let sawStanding = false;
    let sawDeparting = false;
    let sawReliefEnRoute = false;
    let sawSeating = false;
    let sawDoorOpened = false;
    let completedCycle = false;

    const prevPos = guards.map((g) => g.getWorldPosition().clone());

    for (let step = 0; step < 600; step++) {
      staffing.update(dt);
      staffDoor.update(dt, farPlayer);
      for (let i = 0; i < guards.length; i++) {
        guards[i].update(dt, farPlayer);
        const cur = guards[i].getWorldPosition();
        const delta = cur.distanceTo(prevPos[i]);
        // Must move continuously without any teleport jump
        expect(delta).toBeLessThan(0.35);
        prevPos[i].copy(cur);
      }

      const phase = staffing.getPhase();
      if (phase === 'standing') {
        sawStanding = true;
        expect(isChairColliderEnabled()).toBe(false);
      } else if (phase === 'departing') {
        sawDeparting = true;
        expect(isChairColliderEnabled()).toBe(true);
      } else if (phase === 'relief_en_route') {
        sawReliefEnRoute = true;
        expect(isChairColliderEnabled()).toBe(true);
      } else if (phase === 'seating') {
        sawSeating = true;
        expect(isChairColliderEnabled()).toBe(false);
      }

      if (Math.abs(staffDoor.getCurrentAngle()) > 0.35) {
        sawDoorOpened = true;
      }

      if (
        sawSeating &&
        phase === 'staffed' &&
        staffing.getActiveGuard()?.id === 'guard-omer'
      ) {
        completedCycle = true;
        // Let door close cleanly after rotation completes
        for (let c = 0; c < 60; c++) {
          staffDoor.update(dt, farPlayer);
        }
        break;
      }
    }

    expect(sawStanding).toBe(true);
    expect(sawDeparting).toBe(true);
    expect(sawReliefEnRoute).toBe(true);
    expect(sawSeating).toBe(true);
    expect(sawDoorOpened).toBe(true);
    expect(completedCycle).toBe(true);
    expect(staffing.getActiveGuard()?.id).toBe('guard-omer');
    expect(staffing.getReliefGuard()?.id).toBe('guard-avi');
    expect(guards[1].isSeated()).toBe(true);
    expect(guards[0].isSeated()).toBe(false);
    expect(isChairColliderEnabled()).toBe(true);
    expect(Math.abs(staffDoor.getCurrentAngle())).toBeLessThan(0.12);
  });

  it('yields courteously when player blocks a walking guard and resumes when clear', () => {
    const { staffDoor, guards, staffing } = createStaffSetup();
    staffing.triggerShiftChangeNow();

    const dt = 0.05;
    const farPlayer = new THREE.Vector3(25, 0, 25);

    // Advance through standing slide until Avi starts departing toward ctrl-center
    for (let i = 0; i < 15; i++) {
      staffing.update(dt);
      staffDoor.update(dt, farPlayer);
      guards[0].update(dt, farPlayer);
      guards[1].update(dt, farPlayer);
      if (staffing.getPhase() === 'departing') break;
    }
    expect(staffing.getPhase()).toBe('departing');

    // Place player directly ahead of Avi along his path
    const aviPos = guards[0].getWorldPosition();
    const blockingPlayer = new THREE.Vector3(aviPos.x - 0.3, 0, aviPos.z + 0.45);
    const posAtBlockStart = aviPos.clone();

    for (let i = 0; i < 10; i++) {
      staffing.update(dt);
      staffDoor.update(dt, blockingPlayer);
      guards[0].update(dt, blockingPlayer);
    }

    // Should yield without pushing through the player
    expect(guards[0].getWorldPosition().distanceTo(posAtBlockStart)).toBeLessThan(0.1);

    // Clear the path and confirm Avi resumes walking
    for (let i = 0; i < 20; i++) {
      staffing.update(dt);
      staffDoor.update(dt, farPlayer);
      guards[0].update(dt, farPlayer);
    }
    expect(guards[0].getWorldPosition().distanceTo(posAtBlockStart)).toBeGreaterThan(0.5);
  });

  it('renders GPU wall CCTV feeds only inside Control Room when terminal closed, throttled round-robin', () => {
    const surveillance = new SurveillanceCameraSystem();
    const scene = new THREE.Scene();

    let currentTarget: THREE.WebGLRenderTarget | null = null;
    const mockRenderer = {
      shadowMap: { autoUpdate: true },
      getRenderTarget: () => currentTarget,
      setRenderTarget: vi.fn((rt: THREE.WebGLRenderTarget | null) => {
        currentTarget = rt;
      }),
      clear: vi.fn(),
      render: vi.fn(),
    } as unknown as THREE.WebGLRenderer;

    expect(surveillance.getWallFeedCount()).toBe(SECURITY_CAMERA_FEEDS.length);

    // Outside Control Room -> 0 renders
    surveillance.updateWallMonitors(0.2, mockRenderer, scene, false, false);
    expect(surveillance.getWallRenderCount()).toBe(0);

    // Inside Control Room, but fullscreen computer terminal is open -> 0 renders
    surveillance.updateWallMonitors(0.2, mockRenderer, scene, true, true);
    expect(surveillance.getWallRenderCount()).toBe(0);

    // Inside Control Room with terminal closed -> initializes all wall feeds once
    surveillance.updateWallMonitors(0.05, mockRenderer, scene, true, false);
    expect(surveillance.getWallRenderCount()).toBe(SECURITY_CAMERA_FEEDS.length);

    // Sub-interval tick (< 0.1s) -> no extra render yet
    surveillance.updateWallMonitors(0.05, mockRenderer, scene, true, false);
    expect(surveillance.getWallRenderCount()).toBe(SECURITY_CAMERA_FEEDS.length);

    // Crosses 0.1s threshold -> renders 1 round-robin monitor
    surveillance.updateWallMonitors(0.06, mockRenderer, scene, true, false);
    expect(surveillance.getWallRenderCount()).toBe(SECURITY_CAMERA_FEEDS.length + 1);

    surveillance.dispose();
  });
});
