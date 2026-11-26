import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKfirModel } from '../src/assets/characters/KfirModel';
import { createNpcModel } from '../src/assets/characters/NpcModel';
import { createPalette } from '../src/assets/materials/Palette';
import { CollectibleManager } from '../src/collectibles/CollectibleManager';
import { bindContextAwareNpcDialogues, EMPLOYEE_NPCS } from '../src/config/worldInteractions';
import { AssetManager } from '../src/core/AssetManager';
import { WorldManager } from '../src/world/WorldManager';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { i18n } from '../src/i18n/LocalizationManager';
import { DoorInteraction } from '../src/interaction/DoorInteraction';
import type { Interactable } from '../src/interaction/Interactable';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { CAMPAIGN_MISSIONS } from '../src/missions/MissionDefinitions';
import { MissionManager } from '../src/missions/MissionManager';
import { MissionPropsController } from '../src/missions/MissionPropsController';
import { DialogueManager } from '../src/npcs/DialogueManager';
import { NPCInteraction } from '../src/npcs/NPCInteraction';
import { PlayerAnimation } from '../src/player/PlayerAnimation';
import { PhoneManager } from '../src/ui/PhoneManager';
import { CollisionManager } from '../src/world/CollisionManager';
import { WORLD_ANCHORS } from '../src/world/WorldAnchors';
import { WorldProgressionManager } from '../src/world/WorldProgressionManager';

function buildScenario() {
  const assets = new AssetManager();
  const palette = createPalette(assets);
  const bus = new EventBus<GameEvents>();
  const collision = new CollisionManager();
  const dialogue = new DialogueManager(bus);
  const phone = new PhoneManager(bus, false);
  const collectibles = new CollectibleManager(bus);
  const interactions = new InteractionManager(bus, collision);
  const progression = new WorldProgressionManager();

  const npcs = EMPLOYEE_NPCS.map(
    (def) => new NPCInteraction(def, palette, collision, dialogue),
  );
  const mm = new MissionManager(CAMPAIGN_MISSIONS, bus, dialogue, phone, collectibles);
  mm.registerNpcs(npcs);
  bindContextAwareNpcDialogues(npcs, mm);

  const props = new MissionPropsController(palette, interactions, mm, collision, progression);
  mm.setDynamicMarkerResolver((obj) => props.getDynamicMarkerPosition(obj));
  mm.setDynamicTravelGetter((key) => props.getDynamicTravelDistance(key));
  bus.on('mission:scriptEvent', ({ eventId }) => props.handleScriptEvent(eventId));

  const danny = npcs.find((n) => n.id === 'employee-danny')!;
  const maya = npcs.find((n) => n.id === 'employee-maya')!;
  const yossi = npcs.find((n) => n.id === 'employee-yossi')!;

  return { assets, palette, bus, collision, dialogue, phone, collectibles, interactions, progression, mm, props, npcs, danny, maya, yossi };
}

function completeMission02(s: ReturnType<typeof buildScenario>): void {
  s.mm.update(0.016, new THREE.Vector3(16.2, 0, -19.5));
  for (let i = 0; i < 45; i++) s.props.update(0.05);
  const cartPos = s.props.getDynamicMarkerPosition({
    id: 'm2-follow-cart',
    type: 'reach_location',
    title: '',
    dynamicTargetKey: 'm2_cart',
  })!;
  s.mm.update(0.016, cartPos);
  s.mm.notifyInteract('m2-runaway-cart');
  s.mm.notifyInteract('m2-cart-clipboard');
  while (s.dialogue.isActive()) s.dialogue.advance();
  s.mm.continueAfterCompletion();
}

function completeMission04(s: ReturnType<typeof buildScenario>): void {
  s.mm.update(0.016, new THREE.Vector3(21.0, 0, -17.5));
  for (let i = 0; i < 40; i++) s.props.update(0.05);
  const forkPos = s.props.getDynamicMarkerPosition({
    id: 'm4-follow-forklift',
    type: 'reach_location',
    title: '',
    dynamicTargetKey: 'm4_forklift',
  })!;
  s.mm.update(0.016, forkPos);
  s.mm.notifyInteract('m4-emergency-switch');
  s.mm.notifyInteract('m4-forklift-inspect');
  while (s.dialogue.isActive()) s.dialogue.advance();
  s.mm.continueAfterCompletion();
}

function advanceToMission03Clues(s: ReturnType<typeof buildScenario>): void {
  s.mm.startCampaign();
  while (s.dialogue.isActive()) s.dialogue.advance();

  // Complete M01
  s.mm.notifyCameraInspected(3);
  s.mm.notifyInteract('m1-radio');
  s.mm.update(0.016, new THREE.Vector3(9.2, 0, 3.6));
  s.mm.update(0.016, new THREE.Vector3(21.0, 0, -16.5));
  s.mm.notifyInteract('m1-warehouse-clue');
  while (s.dialogue.isActive()) s.dialogue.advance();
  s.mm.continueAfterCompletion();

  // Complete M02
  completeMission02(s);

  // Enter M03 showroom clues objective on Floor 2
  s.mm.update(0.016, WORLD_ANCHORS.showroomF2.livingRoom.position.clone(), {
    committedFloor: 2,
    onTransition: false,
    lastGroundedPos: WORLD_ANCHORS.showroomF2.livingRoom.position.clone(),
    lastGroundedFloor: 2,
    supportingSurfaceId: 'f2-slab-west',
  });
  expect(s.mm.getActiveObjective()?.id).toBe('m3-gather-clues');
}

describe('Phase 6.2.1 World Reactivity, NPC Consistency, Investigations, Door Security & Gaze', () => {
  afterEach(() => {
    i18n.setLanguage('en');
  });

  it('1. M03 & M05 witness conversations work in both Maya->Danny and Danny->Maya order without premature references', () => {
    // Path A: M03 Maya -> Danny
    const sA = buildScenario();
    advanceToMission03Clues(sA);
    sA.maya.onInteract();
    const mayaFirstLine = sA.dialogue.getCurrentLine()?.text ?? '';
    expect(mayaFirstLine.toLowerCase()).not.toContain('danny');
    expect(mayaFirstLine.toLowerCase()).not.toContain('restaurant');
    expect(mayaFirstLine).toContain('MALM');
    while (sA.dialogue.isActive()) sA.dialogue.advance();
    expect(sA.mm.getSnapshot().progressText).toBe('1/2');

    sA.danny.onInteract();
    const dannyAfterMaya = sA.dialogue.getCurrentLine()?.text ?? '';
    expect(dannyAfterMaya).toContain('Maya');
    while (sA.dialogue.isActive()) sA.dialogue.advance();
    expect(sA.mm.getActiveObjective()?.id).toBe('m3-inspect-watch-box');

    // Path B: M03 Danny -> Maya -> complete M03 -> M04 -> M05 Maya -> Danny
    const sB = buildScenario();
    advanceToMission03Clues(sB);
    sB.danny.onInteract();
    expect(sB.dialogue.getCurrentLine()?.text.toLowerCase()).not.toContain('maya');
    while (sB.dialogue.isActive()) sB.dialogue.advance();
    sB.maya.onInteract();
    expect(sB.dialogue.getCurrentLine()?.text).toContain('Danny');
    while (sB.dialogue.isActive()) sB.dialogue.advance();
    expect(sB.mm.getActiveObjective()?.id).toBe('m3-inspect-watch-box');

    // Finish M03 & M04 to reach M05 witness interviews
    sB.mm.notifyInteract('m3-watch-box-clue');
    while (sB.dialogue.isActive()) sB.dialogue.advance();
    sB.mm.notifyInteract('m3-missing-watch');
    sB.danny.onInteract();
    while (sB.dialogue.isActive()) sB.dialogue.advance();
    sB.mm.continueAfterCompletion();

    completeMission04(sB);

    sB.phone.declineCall();
    sB.mm.update(0.016, WORLD_ANCHORS.showroom.m5Reach.position.clone(), {
      committedFloor: 2,
      onTransition: false,
      lastGroundedPos: WORLD_ANCHORS.showroom.m5Reach.position.clone(),
      lastGroundedFloor: 2,
      supportingSurfaceId: 'f2-slab-west',
    });
    sB.mm.notifyInteract('m5-empty-display');
    while (sB.dialogue.isActive()) sB.dialogue.advance();
    expect(sB.mm.getActiveObjective()?.id).toBe('m5-interview-witnesses');

    // M05 Maya BEFORE Danny: zero premature reference to Danny
    sB.maya.onInteract();
    const m5MayaFirst = sB.dialogue.getCurrentLine()?.text ?? '';
    expect(m5MayaFirst.toLowerCase()).not.toContain('danny');
    expect(m5MayaFirst).toContain('Checkout Hall');
    while (sB.dialogue.isActive()) sB.dialogue.advance();

    sB.danny.onInteract();
    const m5DannyAfter = sB.dialogue.getCurrentLine()?.text ?? '';
    expect(m5DannyAfter).toContain('Maya');
    while (sB.dialogue.isActive()) sB.dialogue.advance();
    expect(sB.mm.getActiveObjective()?.id).toBe('m5-inspect-bag-clue');
  });

  it('2. hides future mission props during early missions and persists completed world changes cleanly', () => {
    const s = buildScenario();
    s.mm.startCampaign();
    while (s.dialogue.isActive()) s.dialogue.advance();
    s.props.update(0.05);

    const byName = (name: string) => s.props.group.getObjectByName(name)!;

    // During M01, M03–M05 props must all be hidden
    expect(byName('MissionProp_m3-watch-box-clue').visible).toBe(false);
    expect(byName('MissionProp_m3-missing-watch').visible).toBe(false);
    expect(byName('MissionProp_m4-emergency-switch').visible).toBe(false);
    expect(byName('MissionProp_m5-empty-display').visible).toBe(false);
    expect(byName('MissionProp_m5-clue-bag').visible).toBe(false);
    expect(byName('MissionProp_m5-jpg-le-male-bottle').visible).toBe(false);

    // Advance cleanly through M04
    s.mm.notifyCameraInspected(3);
    s.mm.notifyInteract('m1-radio');
    s.mm.update(0.016, new THREE.Vector3(9.2, 0, 3.6));
    s.mm.update(0.016, new THREE.Vector3(21.0, 0, -16.5));
    s.mm.notifyInteract('m1-warehouse-clue');
    while (s.dialogue.isActive()) s.dialogue.advance();
    s.mm.continueAfterCompletion();

    completeMission02(s);

    s.mm.update(0.016, WORLD_ANCHORS.showroomF2.livingRoom.position.clone(), {
      committedFloor: 2,
      onTransition: false,
      lastGroundedPos: WORLD_ANCHORS.showroomF2.livingRoom.position.clone(),
      lastGroundedFloor: 2,
      supportingSurfaceId: 'f2-slab-west',
    });
    s.props.update(0.05);
    expect(byName('MissionProp_m3-watch-box-clue').visible).toBe(true);
    expect(byName('MissionProp_m4-emergency-switch').visible).toBe(false);

    s.mm.notifyInteract('m3-watch-box-clue');
    while (s.dialogue.isActive()) s.dialogue.advance();
    s.mm.notifyInteract('m3-missing-watch');
    s.danny.onInteract();
    while (s.dialogue.isActive()) s.dialogue.advance();
    s.mm.continueAfterCompletion();

    // M04 active -> emergency switch appears; complete M04 -> switch & parked forklift remain in world
    s.props.update(0.05);
    expect(byName('MissionProp_m4-emergency-switch').visible).toBe(true);
    expect(byName('MissionProp_m5-empty-display').visible).toBe(false);
    completeMission04(s);
    s.props.update(0.05);

    // During M05, M04 emergency switch remains permanently installed while M05 display appears
    // and bag/bottle stay hidden until their witness/clue steps
    expect(byName('MissionProp_m4-emergency-switch').visible).toBe(true);
    expect(byName('MissionProp_m5-empty-display').visible).toBe(true);
    expect(byName('MissionProp_m5-clue-bag').visible).toBe(false);
    expect(byName('MissionProp_m5-jpg-le-male-bottle').visible).toBe(false);

    s.mm.update(0.016, WORLD_ANCHORS.showroom.m5Reach.position.clone(), {
      committedFloor: 2,
      onTransition: false,
      lastGroundedPos: WORLD_ANCHORS.showroom.m5Reach.position.clone(),
      lastGroundedFloor: 2,
      supportingSurfaceId: 'f2-slab-west',
    });
    s.mm.notifyInteract('m5-empty-display');
    while (s.dialogue.isActive()) s.dialogue.advance();
    s.maya.onInteract();
    while (s.dialogue.isActive()) s.dialogue.advance();
    s.danny.onInteract();
    while (s.dialogue.isActive()) s.dialogue.advance();
    s.props.update(0.05);
    expect(byName('MissionProp_m5-clue-bag').visible).toBe(true);
    expect(byName('MissionProp_m5-jpg-le-male-bottle').visible).toBe(false);

    s.mm.notifyInteract('m5-clue-bag');
    while (s.dialogue.isActive()) s.dialogue.advance();
    s.props.update(0.05);
    expect(byName('MissionProp_m5-jpg-le-male-bottle').visible).toBe(true);
  });

  it('3. builds Maya with a distinct female IKEA employee model while leaving Danny and Yossi unchanged', () => {
    const assets = new AssetManager();
    const palette = createPalette(assets);
    const mayaDef = EMPLOYEE_NPCS.find((n) => n.id === 'employee-maya')!;
    const dannyDef = EMPLOYEE_NPCS.find((n) => n.id === 'employee-danny')!;

    expect(mayaDef.visual?.variant).toBe('female');
    expect(mayaDef.visual?.hairStyle).toBe('ponytail');
    expect(dannyDef.visual?.variant).toBeUndefined();

    const mayaRig = createNpcModel(palette, mayaDef.visual);
    const dannyRig = createNpcModel(palette, dannyDef.visual);

    expect(mayaRig.root.getObjectByName('FemaleTorso')).toBeDefined();
    expect(mayaRig.root.getObjectByName('FemalePonytail')).toBeDefined();
    expect(dannyRig.root.getObjectByName('FemaleTorso')).toBeUndefined();
    expect(dannyRig.root.getObjectByName('FemalePonytail')).toBeUndefined();
  });

  it('4. updates Yossi, Danny, and Maya ambient dialogues dynamically as world missions resolve', () => {
    const s = buildScenario();
    s.mm.startCampaign();
    while (s.dialogue.isActive()) s.dialogue.advance();

    // Before M04: Yossi mentions Forklift #2 acting up
    s.yossi.onInteract();
    expect(s.dialogue.getCurrentLine()?.text).toContain('acting up');
    s.dialogue.close();

    // Complete M01–M04
    s.mm.notifyCameraInspected(3);
    s.mm.notifyInteract('m1-radio');
    s.mm.update(0.016, new THREE.Vector3(9.2, 0, 3.6));
    s.mm.update(0.016, new THREE.Vector3(21.0, 0, -16.5));
    s.mm.notifyInteract('m1-warehouse-clue');
    while (s.dialogue.isActive()) s.dialogue.advance();
    s.mm.continueAfterCompletion();

    completeMission02(s);

    // Post-M02 before M04: Yossi acknowledges cart stop while warning forklift still weird
    s.yossi.onInteract();
    expect(s.dialogue.getCurrentLine()?.text).toContain('runaway furniture cart');
    s.dialogue.close();

    s.mm.update(0.016, WORLD_ANCHORS.showroomF2.livingRoom.position.clone(), {
      committedFloor: 2,
      onTransition: false,
      lastGroundedPos: WORLD_ANCHORS.showroomF2.livingRoom.position.clone(),
      lastGroundedFloor: 2,
      supportingSurfaceId: 'f2-slab-west',
    });
    s.mm.notifyInteract('m3-watch-box-clue');
    while (s.dialogue.isActive()) s.dialogue.advance();
    s.mm.notifyInteract('m3-missing-watch');
    s.danny.onInteract();
    while (s.dialogue.isActive()) s.dialogue.advance();
    s.mm.continueAfterCompletion();

    completeMission04(s);

    // After M04: Yossi acknowledges Forklift #2 is shut down and tagged for maintenance
    s.yossi.onInteract();
    expect(s.dialogue.getCurrentLine()?.text).toContain('shut down');
    s.dialogue.close();

    // After M03 (before M05 done): Danny reflects on watch near meatballs
    s.danny.onInteract();
    expect(s.dialogue.getCurrentLine()?.text).toContain('Swedish meatballs');
    s.dialogue.close();

    // Hebrew localization works dynamically too
    i18n.setLanguage('he');
    s.yossi.onInteract();
    expect(s.dialogue.getCurrentLine()?.text).toContain('כבויה');
    s.dialogue.close();
  });

  it('5. locks Control Room by default, plays physical key-turn animation, unlocks/relocks cleanly, and blocks unauthorized NPCs', () => {
    const assets = new AssetManager();
    const palette = createPalette(assets);
    const cm = new CollisionManager();
    cm.addBox('floor', new THREE.Vector3(-12, -1, -12), new THREE.Vector3(25, 0, 12));

    const anim = new PlayerAnimation(createKfirModel(palette));
    const onUnlockStart = vi.fn(() => anim.playKeyTurnAnimation(0.85));
    const onUnlockComplete = vi.fn();
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const onLock = vi.fn();

    const securedDoor = DoorInteraction.createDoubleHinged(
      {
        id: 'control-room-exit',
        centerPos: new THREE.Vector3(7.15, 0, 3.6),
        totalWidth: 2.56,
        height: 2.68,
        thickness: 0.12,
        axis: 'z',
        outwardSign: 1,
        securedByKey: {
          lockedByDefault: true,
          unlockDurationSec: 0.85,
          onUnlockStart,
          onUnlockComplete,
          onOpen,
          onClose,
          onLock,
        },
      },
      palette,
      cm,
    );

    const standInside = new THREE.Vector3(5.5, 0, 3.6);
    expect(securedDoor.getIsLocked()).toBe(true);
    expect(securedDoor.getIsOpen()).toBe(false);
    expect(securedDoor.getPromptText()).toBe('PRESS E TO UNLOCK CONTROL ROOM');

    // Start unlock -> plays key turn animation & rotates brass key 90 degrees before swinging open
    securedDoor.update(1 / 60, standInside);
    securedDoor.onInteract();
    expect(onUnlockStart).toHaveBeenCalledTimes(1);
    expect(anim.isPlayingKeyTurn()).toBe(true);
    expect(securedDoor.isUnlocking()).toBe(true);
    expect(securedDoor.getPromptText()).toBe('UNLOCKING CONTROL ROOM...');

    const keyObj = securedDoor.meshGroup.getObjectByName('ControlRoomPhysicalKey')!;
    expect(keyObj.visible).toBe(true);

    for (let i = 0; i < 60; i++) {
      securedDoor.update(1 / 60, standInside);
      anim.update(1 / 60, 'idle', 0);
    }

    expect(onUnlockComplete).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(securedDoor.getIsLocked()).toBe(false);
    expect(securedDoor.getIsOpen()).toBe(true);
    expect(keyObj.visible).toBe(false);
    expect(securedDoor.getPromptText()).toBe('PRESS E TO CLOSE & LOCK DOOR');

    // Closing while standing in doorway stays open
    securedDoor.update(1 / 60, new THREE.Vector3(7.1, 0, 3.6));
    expect(securedDoor.getPromptText()).toBe('STEP CLEAR OF DOORWAY TO CLOSE');
    securedDoor.onInteract();
    expect(securedDoor.getIsOpen()).toBe(true);

    // Step clear, close, and wait for swing shut -> re-locks automatically
    securedDoor.update(1 / 60, standInside);
    securedDoor.onInteract();
    expect(onClose).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 90; i++) {
      securedDoor.update(1 / 60, standInside);
    }
    expect(securedDoor.getIsLocked()).toBe(true);
    expect(onLock).toHaveBeenCalledTimes(1);

    // Unauthorized NPC trying to patrol inside Control Room is clamped outside
    const dialogue = new DialogueManager();
    const unauthorizedNpc = new NPCInteraction(
      {
        id: 'npc-test-guard',
        name: 'Test Staff',
        position: new THREE.Vector3(8.5, 0, 3.6),
        facingYaw: 0,
        patrolPoints: [new THREE.Vector3(8.5, 0, 3.6), new THREE.Vector3(2.0, 0, 3.6)],
        patrolSpeed: 4.0,
        lines: [{ speaker: 'TEST', text: 'Hi' }],
      },
      palette,
      cm,
      dialogue,
    );
    expect(unauthorizedNpc.isControlRoomAuthorized()).toBe(false);
    for (let i = 0; i < 90; i++) {
      unauthorizedNpc.update(1 / 60);
    }
    expect(unauthorizedNpc.getWorldPosition().x).toBeGreaterThan(7.4);

    // Scripted override explicitly permits entry when enabled
    unauthorizedNpc.setControlRoomAuthorized(true);
    expect(unauthorizedNpc.isControlRoomAuthorized()).toBe(true);
  });

  it('6. selects targets by camera gaze direction independently of Kfir body orientation while enforcing range and wall LOS', () => {
    const cm = new CollisionManager();
    cm.addBox('floor', new THREE.Vector3(-12, -1, -12), new THREE.Vector3(12, 0, 12));
    // Solid wall hiding target behind North wall
    cm.addBox('north-wall', new THREE.Vector3(-4, 0, -2.5), new THREE.Vector3(4, 3, -2.2));

    const im = new InteractionManager(undefined, cm);
    const makeItem = (id: string, pos: THREE.Vector3, radius = 3.0): Interactable => ({
      id,
      type: 'interact',
      radius,
      getWorldPosition: () => pos,
      canInteract: () => true,
      getPromptText: () => `USE ${id}`,
      onInteract: vi.fn(),
    });

    const eastObj = makeItem('east-obj', new THREE.Vector3(1.8, 0, 0));
    const westObj = makeItem('west-obj', new THREE.Vector3(-1.8, 0, 0));
    const behindWallObj = makeItem('behind-wall', new THREE.Vector3(0, 0, -3.2), 5.0);
    const distantObj = makeItem('far-obj', new THREE.Vector3(0, 0, 6.5), 3.0);

    im.register(eastObj);
    im.register(westObj);
    im.register(behindWallObj);
    im.register(distantObj);

    const playerPos = new THREE.Vector3(0, 0, 0);
    const bodyFacingNorth = 0; // Kfir physically faces North (+Z)

    // Camera looks East (+X) from (-2.0, 1.5, 0) without changing Kfir's body facingYaw
    im.update(0.016, playerPos, bodyFacingNorth, true, {
      origin: new THREE.Vector3(-2.0, 1.45, 0),
      direction: new THREE.Vector3(1, -0.1, 0).normalize(),
    });
    expect(im.getActiveTarget()?.id).toBe('east-obj');

    // Camera rotates West (-X) -> targets westObj even with body facingYaw still at 0
    im.update(0.016, playerPos, bodyFacingNorth, true, {
      origin: new THREE.Vector3(2.0, 1.45, 0),
      direction: new THREE.Vector3(-1, -0.1, 0).normalize(),
    });
    expect(im.getActiveTarget()?.id).toBe('west-obj');

    // Looking North (-Z) toward wall-occluded target must NOT select behind-wall object
    im.update(0.016, playerPos, bodyFacingNorth, true, {
      origin: new THREE.Vector3(0, 1.45, 2.2),
      direction: new THREE.Vector3(0, -0.05, -1).normalize(),
    });
    expect(im.getActiveTarget()).toBeNull();

    // Looking straight at far-obj outside radius must NOT allow interaction
    im.update(0.016, playerPos, bodyFacingNorth, true, {
      origin: new THREE.Vector3(0, 1.45, -2.0),
      direction: new THREE.Vector3(0, -0.05, 1).normalize(),
    });
    expect(im.getActiveTarget()).toBeNull();
  });

  it('7. keeps the M02 runaway cart physically clear of all real WorldManager Warehouse shelves, forklifts, and walls and drops clipboard safely', () => {
    const assets = new AssetManager();
    const collision = new CollisionManager();
    new WorldManager(assets, collision);
    const palette = createPalette(assets);
    const bus = new EventBus<GameEvents>();
    const dialogue = new DialogueManager(bus);
    const phone = new PhoneManager(bus, false);
    const collectibles = new CollectibleManager(bus);
    const interactions = new InteractionManager(bus, collision);
    const mm = new MissionManager(CAMPAIGN_MISSIONS, bus, dialogue, phone, collectibles);
    const props = new MissionPropsController(palette, interactions, mm, collision);
    mm.setDynamicMarkerResolver((obj) => props.getDynamicMarkerPosition(obj));
    mm.setDynamicTravelGetter((key) => props.getDynamicTravelDistance(key));
    bus.on('mission:scriptEvent', ({ eventId }) => props.handleScriptEvent(eventId));

    mm.startCampaign(1); // Start cleanly at M02
    while (dialogue.isActive()) dialogue.advance();

    // Trigger M02 runaway cart inside Warehouse
    mm.update(0.016, new THREE.Vector3(18.5, 0, -17.5));
    expect(mm.getActiveObjective()?.id).toBe('m2-follow-cart');

    // Run full cart aisle loop against real WorldManager warehouse geometry (shelves, forklifts, walls)
    const ignore = new Set([
      'm2-cart-col',
      'm2-tipbox-0',
      'm2-tipbox-1',
      'm2-tipbox-2',
      'm2-tipbox-3',
    ]);
    let minShelfClearance = Infinity;
    for (let step = 0; step < 300; step++) {
      props.update(0.04);
      const cartPos = props.getDynamicMarkerPosition({
        id: 'm2-follow-cart',
        type: 'reach_location',
        title: '',
        dynamicTargetKey: 'm2_cart',
      })!;
      // Cart must NEVER overlap any shelf/rack/forklift/wall collider
      for (const box of collision.getColliders()) {
        if (!box.enabled || ignore.has(box.id)) continue;
        if (box.max.y <= 0.1 || box.min.y >= 1.5) continue;
        const clampedX = THREE.MathUtils.clamp(cartPos.x, box.min.x, box.max.x);
        const clampedZ = THREE.MathUtils.clamp(cartPos.z, box.min.z, box.max.z);
        const d = Math.hypot(cartPos.x - clampedX, cartPos.z - clampedZ);
        if (d < minShelfClearance) minShelfClearance = d;
        expect(d).toBeGreaterThan(0.5);
      }
    }

    // Complete chase, press E to brake cart, and confirm clipboard drops cleanly in walkable space
    const curCart = props.getDynamicMarkerPosition({
      id: 'm2-follow-cart',
      type: 'reach_location',
      title: '',
      dynamicTargetKey: 'm2_cart',
    })!;
    mm.update(0.016, curCart);
    expect(mm.getActiveObjective()?.id).toBe('m2-stop-cart');

    const cartInteractable = props.group.getObjectByName('MissionProp_m2-runaway-cart')!;
    expect(cartInteractable.visible).toBe(true);
    interactions.update(0.016, new THREE.Vector3(curCart.x, 0, curCart.z + 1.5), Math.PI, true);
    expect(interactions.getActiveTarget()?.id).toBe('m2-runaway-cart');
    interactions.interact(); // Starts braking

    for (let i = 0; i < 60; i++) props.update(0.05);
    expect(mm.getActiveObjective()?.id).toBe('m2-investigate-cause');

    const clipPos = props.getDynamicMarkerPosition({
      id: 'm2-investigate-cause',
      type: 'interact',
      title: '',
      dynamicTargetKey: 'm2_clipboard',
    })!;
    const clipClear = collision.resolvePlayerMovement(clipPos, new THREE.Vector3(), 0.4, 1.0);
    expect(clipClear.hitWall).toBe(false);
    expect(minShelfClearance).toBeGreaterThan(0.5);
  });
});
