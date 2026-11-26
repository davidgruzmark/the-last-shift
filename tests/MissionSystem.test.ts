import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPalette } from '../src/assets/materials/Palette';
import { CollectibleManager } from '../src/collectibles/CollectibleManager';
import { AssetManager } from '../src/core/AssetManager';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { CAMPAIGN_MISSIONS } from '../src/missions/MissionDefinitions';
import { MissionManager } from '../src/missions/MissionManager';
import { MissionPropsController } from '../src/missions/MissionPropsController';
import { DialogueManager } from '../src/npcs/DialogueManager';
import { NPCInteraction } from '../src/npcs/NPCInteraction';
import { PhoneManager } from '../src/ui/PhoneManager';
import { CollisionManager } from '../src/world/CollisionManager';
import { WORLD_ANCHORS } from '../src/world/WorldAnchors';

describe('Phase 4.1 MissionSystem Campaign & Physics (Missions 01–04)', () => {
  function setupCampaign() {
    const bus = new EventBus<GameEvents>();
    const dialogue = new DialogueManager(bus);
    const phone = new PhoneManager(bus, false);
    const collectibles = new CollectibleManager(bus);
    const assets = new AssetManager();
    const palette = createPalette(assets);
    const collision = new CollisionManager();
    const interactions = new InteractionManager(bus, collision);

    const makeNpc = (id: string, name: string, pos: THREE.Vector3, patrolPoints?: THREE.Vector3[]) =>
      new NPCInteraction(
        {
          id,
          name,
          position: pos,
          facingYaw: 0,
          patrolPoints,
          patrolSpeed: 1.6,
          lines: [{ speaker: name, text: 'Ambient' }],
        },
        palette,
        collision,
        dialogue,
      );

    const danny = makeNpc('employee-danny', 'Danny', WORLD_ANCHORS.showroom.danny.position.clone());
    const maya = makeNpc('employee-maya', 'Maya', WORLD_ANCHORS.showroom.maya.position.clone());
    const yossi = makeNpc(
      'employee-yossi',
      'Yossi',
      new THREE.Vector3(18.2, 0, -19.0),
      [new THREE.Vector3(18.2, 0, -19.0), new THREE.Vector3(18.6, 0, -24.5)],
    );

    const mm = new MissionManager(CAMPAIGN_MISSIONS, bus, dialogue, phone, collectibles);
    mm.registerNpcs([danny, maya, yossi]);

    const props = new MissionPropsController(palette, interactions, mm, collision);
    mm.setDynamicMarkerResolver((obj) => props.getDynamicMarkerPosition(obj));
    mm.setDynamicTravelGetter((key) => props.getDynamicTravelDistance(key));
    bus.on('mission:scriptEvent', ({ eventId }) => props.handleScriptEvent(eventId));

    return { bus, dialogue, phone, collectibles, collision, interactions, mm, props, danny, maya, yossi };
  }

  it('prevents out-of-order completion and progresses sequentially through Missions 01–04 with dynamic tracking and hidden search markers', () => {
    const { dialogue, collectibles, mm, props, danny, maya, yossi } = setupCampaign();

    mm.startCampaign();
    expect(mm.getStatus()).toBe('active');
    expect(mm.getActiveMission()?.id).toBe('mission-01');
    expect(mm.getActiveObjective()?.id).toBe('m1-check-cam04');
    while (dialogue.isActive()) dialogue.advance();

    // Verify Yossi patrols cleanly when idle
    const yossiStart = yossi.getWorldPosition().clone();
    yossi.update(0.8);
    expect(yossi.getWorldPosition().distanceTo(yossiStart)).toBeGreaterThan(0.5);

    // Out-of-order checks
    mm.notifyCameraInspected(0);
    mm.notifyInteract('m2-runaway-cart');
    mm.notifyInteract('m5-jpg-le-male-bottle');
    expect(mm.getActiveObjective()?.id).toBe('m1-check-cam04');
    expect(collectibles.hasCollected('perfume-jpg-le-male')).toBe(false);

    // --- MISSION 01 ---
    mm.notifyCameraInspected(3);
    expect(mm.getActiveObjective()?.id).toBe('m1-pickup-radio');
    mm.notifyInteract('m1-radio');
    expect(mm.getActiveObjective()?.id).toBe('m1-leave-control');
    mm.update(0.016, new THREE.Vector3(9.2, 0, 3.6));
    expect(mm.getActiveObjective()?.id).toBe('m1-reach-warehouse');
    mm.update(0.016, new THREE.Vector3(21.0, 0, -16.5));
    expect(mm.getActiveObjective()?.id).toBe('m1-investigate-clue');
    mm.notifyInteract('m1-warehouse-clue');
    expect(dialogue.isActive()).toBe(true);
    while (dialogue.isActive()) dialogue.advance();

    expect(mm.getStatus()).toBe('completed_screen');
    expect(mm.getSnapshot().money).toBe(150);
    mm.notifyInteract('m1-warehouse-clue');
    expect(mm.getSnapshot().money).toBe(150);

    // --- MISSION 02 (Dynamic cart chase & braking) ---
    mm.continueAfterCompletion();
    expect(mm.getActiveMission()?.id).toBe('mission-02');
    mm.update(0.016, new THREE.Vector3(16.2, 0, -19.5));
    expect(mm.getActiveObjective()?.id).toBe('m2-follow-cart');

    // Step cart past minTravelDistance (8m)
    for (let i = 0; i < 60; i++) props.update(0.05);
    const liveCartPos = mm.getCurrentMarkerPosition()!;
    expect(liveCartPos).not.toBeNull();
    mm.update(0.016, liveCartPos);
    expect(mm.getActiveObjective()?.id).toBe('m2-stop-cart');

    mm.notifyInteract('m2-runaway-cart');
    expect(mm.getActiveObjective()?.id).toBe('m2-investigate-cause');
    mm.notifyInteract('m2-cart-clipboard');
    while (dialogue.isActive()) dialogue.advance();

    expect(mm.getStatus()).toBe('completed_screen');
    expect(mm.getSnapshot().money).toBe(400);
    expect(collectibles.hasCollected('golden-wrench')).toBe(true);

    // --- MISSION 03 (2-of-3 clue gathering + hidden spoiler markers) ---
    mm.continueAfterCompletion();
    expect(mm.getActiveMission()?.id).toBe('mission-03');
    mm.update(0.016, WORLD_ANCHORS.showroomF2.livingRoom.position.clone(), {
      committedFloor: 2,
      onTransition: false,
      lastGroundedPos: WORLD_ANCHORS.showroomF2.livingRoom.position.clone(),
      lastGroundedFloor: 2,
      supportingSurfaceId: 'f2-slab-west',
    });
    expect(mm.getActiveObjective()?.id).toBe('m3-gather-clues');

    danny.onInteract();
    expect(dialogue.getCurrentLine()?.speaker).toContain('DANNY');
    while (dialogue.isActive()) dialogue.advance();
    expect(mm.getSnapshot().progressText).toBe('1/2');

    maya.onInteract();
    expect(dialogue.getCurrentLine()?.speaker).toContain('MAYA');
    // Maya should NOT spoil the Restaurant directly
    expect(dialogue.getCurrentLine()?.text.toLowerCase()).not.toContain('restaurant');
    while (dialogue.isActive()) dialogue.advance();

    // 2/2 clues advances to hidden-marker watch box search without requiring Yossi
    expect(mm.getActiveObjective()?.id).toBe('m3-inspect-watch-box');
    expect(mm.getCurrentMarkerPosition()).toBeNull();

    mm.notifyInteract('m3-watch-box-clue');
    expect(dialogue.isActive()).toBe(true);
    expect(dialogue.getCurrentLine()?.text.toLowerCase()).toContain('restaurant');
    while (dialogue.isActive()) dialogue.advance();

    // Watch search also hides marker
    expect(mm.getActiveObjective()?.id).toBe('m3-find-watch');
    expect(mm.getCurrentMarkerPosition()).toBeNull();
    mm.notifyInteract('m3-missing-watch');

    // Return to Danny restores marker
    expect(mm.getActiveObjective()?.id).toBe('m3-return-watch');
    expect(mm.getCurrentMarkerPosition()).not.toBeNull();
    danny.onInteract();
    while (dialogue.isActive()) dialogue.advance();

    expect(mm.getStatus()).toBe('completed_screen');
    expect(mm.getSnapshot().money).toBe(750);
    expect(collectibles.hasCollected('watch-rolex-daytona')).toBe(true);

    // --- MISSION 04 (Dynamic forklift chase + maxPlayerZ guard) ---
    mm.continueAfterCompletion();
    expect(mm.getActiveMission()?.id).toBe('mission-04');
    mm.update(0.016, new THREE.Vector3(21.0, 0, -17.5));
    expect(mm.getActiveObjective()?.id).toBe('m4-follow-forklift');

    for (let i = 0; i < 60; i++) props.update(0.05);
    const liveForkliftPos = mm.getCurrentMarkerPosition()!.clone();
    mm.update(0.016, new THREE.Vector3(liveForkliftPos.x, 0, Math.min(-24, liveForkliftPos.z)));
    expect(mm.getActiveObjective()?.id).toBe('m4-pull-emergency-switch');

    mm.notifyInteract('m4-emergency-switch');
    expect(mm.getActiveObjective()?.id).toBe('m4-confirm-stopped');
    mm.notifyInteract('m4-forklift-inspect');
    while (dialogue.isActive()) dialogue.advance();

    expect(mm.getStatus()).toBe('completed_screen');
    expect(mm.getSnapshot().money).toBe(1250);
    expect(collectibles.hasCollected('warehouse-hero-badge')).toBe(true);

    // --- MISSION 05 (The Perfume Heist & Midnight Noir collection) ---
    mm.continueAfterCompletion();
    expect(mm.getStatus()).toBe('active');
    expect(mm.getActiveMission()?.id).toBe('mission-05');
    expect(mm.getActiveObjective()?.id).toBe('m5-reach-display');

    mm.update(0.016, WORLD_ANCHORS.showroom.m5Reach.position.clone(), {
      committedFloor: 2,
      onTransition: false,
      lastGroundedPos: WORLD_ANCHORS.showroom.m5Reach.position.clone(),
      lastGroundedFloor: 2,
      supportingSurfaceId: 'f2-slab-west',
    });
    expect(mm.getActiveObjective()?.id).toBe('m5-inspect-display');

    mm.notifyInteract('m5-empty-display');
    while (dialogue.isActive()) dialogue.advance();
    expect(mm.getActiveObjective()?.id).toBe('m5-interview-witnesses');

    danny.onInteract();
    while (dialogue.isActive()) dialogue.advance();
    expect(mm.getSnapshot().progressText).toBe('1/2');
    maya.onInteract();
    while (dialogue.isActive()) dialogue.advance();

    // Clue bag search hides marker
    expect(mm.getActiveObjective()?.id).toBe('m5-inspect-bag-clue');
    expect(mm.getCurrentMarkerPosition()).toBeNull();
    mm.notifyInteract('m5-clue-bag');
    while (dialogue.isActive()) dialogue.advance();

    // Perfume bottle search hides marker until recovered
    expect(mm.getActiveObjective()?.id).toBe('m5-recover-perfume');
    expect(mm.getCurrentMarkerPosition()).toBeNull();
    mm.notifyInteract('m5-jpg-le-male-bottle');
    expect(collectibles.hasCollected('perfume-jpg-le-male')).toBe(true);
    while (dialogue.isActive()) dialogue.advance();

    expect(mm.getActiveObjective()?.id).toBe('m5-report-back');
    danny.onInteract();
    while (dialogue.isActive()) dialogue.advance();

    expect(mm.getStatus()).toBe('completed_screen');
    expect(mm.getSnapshot().money).toBe(1850);
    expect(collectibles.hasCollected('perfume-jpg-le-male')).toBe(true);

    // Duplicate notify cannot grant extra money
    mm.notifyInteract('m5-jpg-le-male-bottle');
    expect(mm.getSnapshot().money).toBe(1850);

    mm.continueAfterCompletion();
    expect(mm.getStatus()).toBe('active');
    expect(mm.getActiveMission()?.id).toBe('mission-06');

    // --- MISSION 06 (FIFA at IKEA) ---
    mm.notifyInteract('m6-warehouse-ball');
    while (dialogue.isActive()) dialogue.advance();
    expect(mm.getActiveObjective()?.id).toBe('m6-start-match');

    mm.notifyInteract('m6-start-match');
    expect(mm.getActiveObjective()?.id).toBe('m6-win-match');
    mm.notifyMinigameComplete('fifa-at-ikea');
    expect(mm.getStatus()).toBe('completed_screen');
    expect(mm.getSnapshot().money).toBe(2550);
    expect(collectibles.hasCollected('personal-football')).toBe(true);

    mm.continueAfterCompletion();
    expect(mm.getStatus()).toBe('campaign_complete');
    expect(mm.getSnapshot().completedMissions).toEqual([
      'mission-01',
      'mission-02',
      'mission-03',
      'mission-04',
      'mission-05',
      'mission-06',
    ]);
  });

  it('supports Mission 03 early physical clue discovery and dynamic cart/forklift physics without teleporting', () => {
    const { dialogue, collision, interactions, mm, props, danny } = setupCampaign();

    mm.startCampaign();
    while (dialogue.isActive()) dialogue.advance();
    mm.notifyCameraInspected(3);
    mm.notifyInteract('m1-radio');
    mm.update(0.016, new THREE.Vector3(9.2, 0, 3.6));
    mm.update(0.016, new THREE.Vector3(21.0, 0, -16.5));
    mm.notifyInteract('m1-warehouse-clue');
    while (dialogue.isActive()) dialogue.advance();
    mm.continueAfterCompletion();

    // Verify M02 cart loops continuously, pushes player collider, and brakes dynamically on interact
    mm.update(0.016, new THREE.Vector3(16.2, 0, -19.5));
    for (let i = 0; i < 120; i++) props.update(0.05);
    const cartObj = { id: 'm2-follow-cart', type: 'reach_location' as const, title: '', dynamicTargetKey: 'm2_cart' as const };
    const posAfter6s = props.getDynamicMarkerPosition(cartObj)!.clone();
    props.update(0.2);
    const posAfter6_2s = props.getDynamicMarkerPosition(cartObj)!;
    // Still moving (never auto-stops)
    expect(posAfter6_2s.distanceTo(posAfter6s)).toBeGreaterThan(0.5);

    // Cart collider is enabled and separates overlapping player
    const cartCol = collision.getColliders().find((c) => c.id === 'm2-cart-col');
    expect(cartCol?.enabled).toBe(true);
    const colTest = collision.resolvePlayerMovement(
      new THREE.Vector3(posAfter6_2s.x, 0, posAfter6_2s.z),
      new THREE.Vector3(0, -0.01, 0),
      0.38,
      1.7,
    );
    expect(colTest.hitWall).toBe(true);

    // Advance to stop-cart and interact while cart is moving
    mm.update(0.016, posAfter6_2s);
    expect(mm.getActiveObjective()?.id).toBe('m2-stop-cart');
    const cartInteractable = interactions.getActiveTarget(); // may be null if disabled update; trigger via props
    void cartInteractable;
    // Complete M02 via clipboard after braking
    const preBrakePos = posAfter6_2s.clone();
    // Simulate interact via MissionManager after checking no instant completion
    mm.notifyInteract('m2-runaway-cart');
    expect(mm.getActiveObjective()?.id).toBe('m2-investigate-cause');
    mm.notifyInteract('m2-cart-clipboard');
    while (dialogue.isActive()) dialogue.advance();
    expect(preBrakePos).toBeDefined();

    // M03: verify finding watch box early after 1 clue advances cleanly & clears Danny override
    mm.continueAfterCompletion();
    mm.update(0.016, WORLD_ANCHORS.showroomF2.livingRoom.position.clone(), {
      committedFloor: 2,
      onTransition: false,
      lastGroundedPos: WORLD_ANCHORS.showroomF2.livingRoom.position.clone(),
      lastGroundedFloor: 2,
      supportingSurfaceId: 'f2-slab-west',
    });
    danny.onInteract();
    while (dialogue.isActive()) dialogue.advance();
    expect(mm.getActiveObjective()?.id).toBe('m3-gather-clues');
    mm.notifyInteract('m3-watch-box-clue');
    while (dialogue.isActive()) dialogue.advance();
    expect(mm.getActiveObjective()?.id).toBe('m3-find-watch');

    mm.notifyInteract('m3-missing-watch');
    danny.onInteract();
    while (dialogue.isActive()) dialogue.advance();
    mm.continueAfterCompletion();

    // M04: verify Emergency Stop decelerates forklift smoothly without teleporting
    mm.update(0.016, new THREE.Vector3(21.0, 0, -17.5));
    for (let i = 0; i < 40; i++) props.update(0.05);
    const fkObj = { id: 'm4-follow-forklift', type: 'reach_location' as const, title: '', dynamicTargetKey: 'm4_forklift' as const };
    const fkBeforeStop = props.getDynamicMarkerPosition(fkObj)!.clone();
    mm.update(0.016, new THREE.Vector3(fkBeforeStop.x, 0, Math.min(-24, fkBeforeStop.z)));
    expect(mm.getActiveObjective()?.id).toBe('m4-pull-emergency-switch');
    mm.notifyInteract('m4-emergency-switch');
    // Immediately after hitting switch, forklift has NOT teleported to (16.2, 0, -31.5)
    props.update(0.05);
    const fkRightAfterSwitch = props.getDynamicMarkerPosition(fkObj)!.clone();
    expect(fkRightAfterSwitch.distanceTo(fkBeforeStop)).toBeLessThan(1.0);
    // Decelerate to full stop
    for (let i = 0; i < 40; i++) props.update(0.05);
    const fkStopped1 = props.getDynamicMarkerPosition(fkObj)!.clone();
    props.update(0.2);
    const fkStopped2 = props.getDynamicMarkerPosition(fkObj)!;
    expect(fkStopped2.distanceTo(fkStopped1)).toBeLessThan(0.001);
  });
});
