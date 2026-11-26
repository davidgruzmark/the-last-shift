import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPalette } from '../src/assets/materials/Palette';
import { CollectibleManager } from '../src/collectibles/CollectibleManager';
import { AssetManager } from '../src/core/AssetManager';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { SurveillanceCameraSystem } from '../src/camera/SurveillanceCameraSystem';
import { ComputerInteraction, SECURITY_CAMERA_FEEDS } from '../src/interaction/ComputerInteraction';
import { DoorInteraction } from '../src/interaction/DoorInteraction';
import type { Interactable } from '../src/interaction/Interactable';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { DialogueManager } from '../src/npcs/DialogueManager';
import { NPCInteraction } from '../src/npcs/NPCInteraction';
import { PhoneManager } from '../src/ui/PhoneManager';
import { CollisionManager } from '../src/world/CollisionManager';

function makeMockInteractable(id: string, pos: THREE.Vector3, radius = 2.5): Interactable & { calls: number } {
  return {
    id,
    type: 'door',
    radius,
    calls: 0,
    getWorldPosition: () => pos,
    getPromptText: () => `PRESS E FOR ${id}`,
    canInteract: () => true,
    onInteract() {
      this.calls += 1;
    },
  };
}

describe('Phase 3 & 3.1 Interaction Systems', () => {
  it('InteractionManager selects only the nearby object Kfir faces and clears when moving away', () => {
    const bus = new EventBus<GameEvents>();
    const im = new InteractionManager(bus);

    const ahead = makeMockInteractable('ahead', new THREE.Vector3(0, 0, 2));
    const behind = makeMockInteractable('behind', new THREE.Vector3(0, 0, -2));
    im.register(ahead);
    im.register(behind);

    im.update(0.016, new THREE.Vector3(0, 0, 0), 0);
    expect(im.getActiveTarget()?.id).toBe('ahead');
    expect(im.interact()).toBe(true);
    expect(ahead.calls).toBe(1);
    expect(behind.calls).toBe(0);

    im.update(0.25, new THREE.Vector3(0, 0, 10), 0);
    expect(im.getActiveTarget()).toBeNull();
    expect(im.interact()).toBe(false);
  });

  it('Manual DoorInteraction blocks when closed, updates oriented collision during swing, clears doorway when open, and blocks again when closed', () => {
    const assets = new AssetManager();
    const palette = createPalette(assets);
    const cm = new CollisionManager();
    cm.addBox('floor', new THREE.Vector3(-10, -1, -10), new THREE.Vector3(10, 0, 10));

    const manual = DoorInteraction.createManualHinged(
      {
        id: 'test-manual',
        hingePos: new THREE.Vector3(0, 0, 0),
        width: 2.5,
        height: 2.6,
        thickness: 0.12,
        axis: 'z',
        openAngle: Math.PI / 2,
      },
      palette,
      cm,
    );

    const safeStandPos = new THREE.Vector3(-1.5, 0, 1.25);

    // 1. Closed door blocks walking through x=0 at z=1.25
    const closedPass = cm.resolvePlayerMovement(
      new THREE.Vector3(-0.6, 0, 1.25),
      new THREE.Vector3(1.2, 0, 0),
      0.38,
      1.75,
    );
    expect(closedPass.hitWall).toBe(true);
    expect(closedPass.position.x).toBeLessThan(-0.4);

    // 2. Open door and step simulation until fully open (~90 deg)
    manual.update(1 / 60, safeStandPos);
    manual.onInteract();
    expect(manual.getIsOpen()).toBe(true);
    for (let i = 0; i < 90; i++) {
      manual.update(1 / 60, safeStandPos);
    }
    expect(manual.getCurrentAngle()).toBeGreaterThan(1.4);

    // Doorway at z=1.25 is now passable
    const openPass = cm.resolvePlayerMovement(
      new THREE.Vector3(-0.6, 0, 1.25),
      new THREE.Vector3(1.4, 0, 0),
      0.38,
      1.75,
    );
    expect(openPass.position.x).toBeCloseTo(0.8, 3);

    // Meanwhile the open door panel itself (along +X at z=0) still has physical collision
    const hitOpenLeaf = cm.resolvePlayerMovement(
      new THREE.Vector3(1.2, 0, 0.55),
      new THREE.Vector3(0, 0, -0.5),
      0.38,
      1.75,
    );
    expect(hitOpenLeaf.hitWall).toBe(true);

    // 3. Attempting to close while standing in the doorway keeps door open (no displacement)
    const inDoorway = new THREE.Vector3(0.05, 0, 1.25);
    manual.update(1 / 60, inDoorway);
    expect(manual.getPromptText()).toBe('STEP CLEAR OF DOORWAY TO CLOSE');
    manual.onInteract();
    expect(manual.getIsOpen()).toBe(true);

    // 4. Step clear, close door again, and verify doorway blocks again
    manual.update(1 / 60, safeStandPos);
    manual.onInteract();
    expect(manual.getIsOpen()).toBe(false);
    for (let i = 0; i < 90; i++) {
      manual.update(1 / 60, safeStandPos);
    }
    const reclosedPass = cm.resolvePlayerMovement(
      new THREE.Vector3(-0.6, 0, 1.25),
      new THREE.Vector3(1.2, 0, 0),
      0.38,
      1.75,
    );
    expect(reclosedPass.hitWall).toBe(true);
    expect(reclosedPass.position.x).toBeLessThan(-0.4);
  });

  it('Manual Door pauses swing if player stands in its path and InteractionManager respects wall occlusion & 3.2m radius', () => {
    const assets = new AssetManager();
    const palette = createPalette(assets);
    const cm = new CollisionManager();
    cm.addBox('floor', new THREE.Vector3(-10, -1, -10), new THREE.Vector3(10, 0, 10));
    cm.addBox('blocking-wall', new THREE.Vector3(-2, 0, -0.2), new THREE.Vector3(-1.7, 3, 2.5));

    const door = DoorInteraction.createManualHinged(
      {
        id: 'swing-door',
        hingePos: new THREE.Vector3(0, 0, 0),
        width: 2.5,
        height: 2.6,
        thickness: 0.12,
        axis: 'z',
        openAngle: Math.PI / 2,
      },
      palette,
      cm,
    );
    expect(door.radius).toBe(3.2);

    const im = new InteractionManager(undefined, cm);
    im.register(door);

    // Player at x=-2.4, z=1.25 is within 3.2m, facing +X, but blocked by 'blocking-wall'
    im.update(0.016, new THREE.Vector3(-2.4, 0, 1.25), Math.PI / 2);
    expect(im.getActiveTarget()).toBeNull();

    // Player at x=2.6, z=1.25 (unobstructed side, ~2.6m away) facing -X (-PI/2) CAN target the door
    im.update(0.016, new THREE.Vector3(2.6, 0, 1.25), -Math.PI / 2);
    expect(im.getActiveTarget()?.id).toBe('swing-door');

    // Open door while standing inside its swing arc (x=1.0, z=0.4) -> leaf stops before overlapping player
    door.onInteract();
    const inArcPos = new THREE.Vector3(1.0, 0, 0.4);
    for (let i = 0; i < 60; i++) {
      door.update(1 / 60, inArcPos);
    }
    expect(door.getCurrentAngle()).toBeLessThan(1.3);
  });

  it('AutoSliding DoorInteraction blocks when closed and opens physical passage as panels slide apart', () => {
    const assets = new AssetManager();
    const palette = createPalette(assets);
    const cm = new CollisionManager();
    cm.addBox('floor', new THREE.Vector3(-10, -1, -10), new THREE.Vector3(10, 0, 10));

    const autoDoor = DoorInteraction.createAutoSliding(
      {
        id: 'test-auto',
        centerPos: new THREE.Vector3(0, 0, 0),
        totalWidth: 4.0,
        height: 3.0,
        thickness: 0.14,
        triggerRadius: 3.5,
      },
      palette,
      cm,
    );

    // Far away -> closed and blocks x=0, z=0
    autoDoor.update(0.1, new THREE.Vector3(0, 0, 10));
    expect(autoDoor.getIsOpen()).toBe(false);
    const blocked = cm.resolvePlayerMovement(
      new THREE.Vector3(0, 0, -0.6),
      new THREE.Vector3(0, 0, 1.2),
      0.38,
      1.75,
    );
    expect(blocked.hitWall).toBe(true);
    expect(blocked.position.z).toBeLessThan(-0.4);

    // Approach -> panels slide open and center passage clears
    for (let i = 0; i < 60; i++) {
      autoDoor.update(1 / 60, new THREE.Vector3(0, 0, 1.5));
    }
    expect(autoDoor.getIsOpen()).toBe(true);
    const cleared = cm.resolvePlayerMovement(
      new THREE.Vector3(0, 0, -0.6),
      new THREE.Vector3(0, 0, 1.2),
      0.38,
      1.75,
    );
    expect(cleared.position.z).toBeCloseTo(0.6, 3);
  });

  it('DialogueManager advances multi-line conversations and closes cleanly', () => {
    const dm = new DialogueManager();
    dm.start('Danny', [
      { speaker: 'DANNY', text: 'Line 1' },
      { speaker: 'KFIR', text: 'Line 2' },
    ]);

    expect(dm.isActive()).toBe(true);
    expect(dm.getCurrentLine()?.text).toBe('Line 1');

    expect(dm.advance()).toBe(true);
    expect(dm.getCurrentLine()?.text).toBe('Line 2');

    expect(dm.advance()).toBe(false);
    expect(dm.isActive()).toBe(false);
  });

  it('CollectibleManager prevents collecting the same item twice and tracks collected IDs', () => {
    const bus = new EventBus<GameEvents>();
    const manager = new CollectibleManager(bus);
    const item = manager.addCollectible({
      id: 'spare-key',
      name: 'Spare Keycard',
      position: new THREE.Vector3(1, 0, 1),
      color: 0x1e90ff,
      kind: 'keycard',
    });

    expect(item.canInteract()).toBe(true);
    item.onInteract();
    expect(item.canInteract()).toBe(false);
    expect(manager.hasCollected('spare-key')).toBe(true);
    expect(manager.getCollectedIds()).toEqual(['spare-key']);

    item.onInteract();
    expect(manager.getCollectedIds()).toEqual(['spare-key']);
  });

  it('ComputerInteraction and PhoneManager manage open/close, cameras, two-way replies, and unread counts', () => {
    const computer = new ComputerInteraction(new THREE.Vector3(0, 0, 0));
    expect(computer.isOpen()).toBe(false);
    computer.onInteract();
    expect(computer.isOpen()).toBe(true);
    computer.selectCamera(3);
    expect(computer.getActiveCamera()).toBe(3);
    computer.close();
    expect(computer.isOpen()).toBe(false);

    const phone = new PhoneManager(undefined, true);
    // 1 incoming from Shiran + 1 outgoing from Kfir seeded -> unreadCount = 1
    expect(phone.getUnreadCount()).toBe(1);
    phone.receiveMessage('SHIRAN', 'Checking in on your shift.');
    expect(phone.getUnreadCount()).toBe(2);
    phone.openPhone();
    expect(phone.isOpen()).toBe(true);
    expect(phone.getUnreadCount()).toBe(0);

    const reply = phone.sendReply('On my way!');
    expect(reply?.direction).toBe('outgoing');
    expect(phone.getMessages().at(-1)?.text).toBe('On my way!');

    phone.closePhone();
    expect(phone.isOpen()).toBe(false);
  });

  it('SurveillanceCameraSystem defines all 4 world locations and performs zero renders while terminal is closed', () => {
    expect(SECURITY_CAMERA_FEEDS.map((f) => f.name)).toEqual([
      'IKEA Showroom',
      'Parking Lot',
      'Main Entrance',
      'Warehouse',
    ]);

    const sys = new SurveillanceCameraSystem();
    expect(sys.getCameras()).toHaveLength(4);
    expect(sys.getRenderCount()).toBe(0);

    // Calling update while closed must perform 0 renders
    sys.update(
      0.016,
      {} as THREE.WebGLRenderer,
      {} as THREE.Scene,
      false,
      0,
      {} as HTMLCanvasElement,
      [],
    );
    expect(sys.getRenderCount()).toBe(0);
    sys.dispose();
  });

  it('DoubleHinged door closes cleanly from 1.25m away, blocks East->West passage, and NPCInteraction passes LOS check', () => {
    const assets = new AssetManager();
    const palette = createPalette(assets);
    const cm = new CollisionManager();
    cm.addBox('floor', new THREE.Vector3(-10, -1, -10), new THREE.Vector3(10, 0, 10));

    const dblDoor = DoorInteraction.createDoubleHinged(
      {
        id: 'double-exit',
        centerPos: new THREE.Vector3(0, 0, 0),
        totalWidth: 2.56,
        height: 2.68,
        thickness: 0.12,
        axis: 'z',
        outwardSign: 1,
      },
      palette,
      cm,
    );

    const showroomStand = new THREE.Vector3(1.25, 0, 0);
    dblDoor.update(1 / 60, showroomStand);
    dblDoor.onInteract(); // Open
    for (let i = 0; i < 90; i++) dblDoor.update(1 / 60, showroomStand);
    expect(dblDoor.getIsOpen()).toBe(true);

    // Close from 1.25m on Showroom side -> succeeds without pausing!
    dblDoor.onInteract();
    expect(dblDoor.getIsOpen()).toBe(false);
    for (let i = 0; i < 90; i++) dblDoor.update(1 / 60, showroomStand);
    expect(Math.abs(dblDoor.getCurrentAngle())).toBeLessThan(0.01);

    // Walking East->West from Showroom side is solidly blocked
    const blocked = cm.resolvePlayerMovement(
      new THREE.Vector3(0.6, 0, 0),
      new THREE.Vector3(-1.0, 0, 0),
      0.38,
      1.75,
    );
    expect(blocked.hitWall).toBe(true);
    expect(blocked.position.x).toBeGreaterThanOrEqual(0.43);

    // NPCInteraction passes InteractionManager line-of-sight check when facing NPC
    const dm = new DialogueManager();
    const npc = new NPCInteraction(
      {
        id: 'danny',
        name: 'Danny',
        position: new THREE.Vector3(3, 0, 0),
        facingYaw: 0,
        lines: [{ speaker: 'DANNY', text: 'Hi' }],
      },
      palette,
      cm,
      dm,
    );
    const im = new InteractionManager(undefined, cm);
    im.register(npc);
    im.update(0.016, new THREE.Vector3(1.8, 0, 0), Math.PI / 2);
    expect(im.getActiveTarget()?.id).toBe('danny');
  });

  it('allows interacting with an active mission package even when an NPC stands directly on it or between Kfir and the package, while preserving wall LOS and normal NPC interaction', () => {
    const assets = new AssetManager();
    const palette = createPalette(assets);
    const cm = new CollisionManager();
    const bus = new EventBus<GameEvents>();
    const dm = new DialogueManager(bus);
    cm.addBox('floor', new THREE.Vector3(-10, -1, -30), new THREE.Vector3(30, 0, 10));

    // Place Yossi directly on top of the M01 package coordinates (18.5, 0, -21.0)
    const yossi = new NPCInteraction(
      {
        id: 'employee-yossi',
        name: 'Yossi',
        position: new THREE.Vector3(18.5, 0, -21.0),
        facingYaw: 0,
        lines: [{ speaker: 'YOSSI', text: 'Working in Aisle 02.' }],
      },
      palette,
      cm,
      dm,
    );

    let packageTriggered = 0;
    let packageActive = true;
    const m1Package: Interactable = {
      id: 'm1-warehouse-clue',
      type: 'interact',
      radius: 2.6,
      getWorldPosition: () => new THREE.Vector3(18.5, 0, -21.0),
      getPromptText: () => 'PRESS E TO INVESTIGATE SCATTERED BOXES',
      getPriority: () => 1.2,
      canInteract: () => packageActive,
      onInteract() {
        packageTriggered += 1;
        packageActive = false;
      },
    };

    const im = new InteractionManager(bus, cm);
    im.register(yossi);
    im.register(m1Package);

    // 1. Kfir approaches from South (18.5, 0, -19.2) facing North (PI) -> Yossi sits directly on package
    im.update(0.016, new THREE.Vector3(18.5, 0, -19.2), Math.PI, true);
    expect(im.getActiveTarget()?.id).toBe('m1-warehouse-clue');
    expect(im.interact()).toBe(true);
    expect(packageTriggered).toBe(1);

    // 2. Once package is cleared, Kfir still talks to Yossi normally
    im.update(0.25, new THREE.Vector3(18.5, 0, -19.2), Math.PI, true);
    expect(im.getActiveTarget()?.id).toBe('employee-yossi');

    // 3. With Yossi between Kfir and a reactivated package (player z=-18.8, Yossi z=-20.0, package z=-21.0)
    packageActive = true;
    yossi.getWorldPosition().set(18.5, 0, -20.0);
    cm.updateBox(
      yossi.colliderIds[0],
      new THREE.Vector3(18.5 - 0.34, 0, -20.0 - 0.34),
      new THREE.Vector3(18.5 + 0.34, 1.8, -20.0 + 0.34),
    );
    im.update(0.25, new THREE.Vector3(18.5, 0, -18.8), Math.PI, true);
    expect(im.getActiveTarget()?.id).toBe('m1-warehouse-clue');

    // 4. Legitimate solid wall between Kfir and the package still blocks interaction
    cm.addBox('solid-rack-wall', new THREE.Vector3(17.5, 0, -19.5), new THREE.Vector3(19.5, 2.5, -19.2));
    im.update(0.25, new THREE.Vector3(18.5, 0, -18.8), Math.PI, true);
    expect(im.getActiveTarget()).toBeNull();
  });
});
