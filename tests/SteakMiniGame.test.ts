import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPalette } from '../src/assets/materials/Palette';
import { CollectibleManager } from '../src/collectibles/CollectibleManager';
import { AssetManager } from '../src/core/AssetManager';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { CAMPAIGN_MISSIONS } from '../src/missions/MissionDefinitions';
import { MissionManager } from '../src/missions/MissionManager';
import {
  STEAK_COOK_DURATION_SEC,
  SteakMiniGame,
  zoneForDoneness,
} from '../src/minigames/SteakMiniGame';
import { DialogueManager } from '../src/npcs/DialogueManager';
import { PhoneManager } from '../src/ui/PhoneManager';
import { CollisionManager } from '../src/world/CollisionManager';

function setupSteak() {
  const bus = new EventBus<GameEvents>();
  const dialogue = new DialogueManager(bus);
  const phone = new PhoneManager(bus, false);
  const collectibles = new CollectibleManager(bus);
  const assets = new AssetManager();
  const palette = createPalette(assets);
  const collision = new CollisionManager();
  const interactions = new InteractionManager(bus, collision);
  const mm = new MissionManager(CAMPAIGN_MISSIONS, bus, dialogue, phone, collectibles);
  const steak = new SteakMiniGame(palette, interactions, mm, bus);
  return { bus, dialogue, phone, collectibles, collision, interactions, mm, steak };
}

/** Advances the gauge to just under the given doneness value deterministically. */
function cookTo(steak: SteakMiniGame, targetDoneness: number): void {
  const step = 0.05;
  const perStep = (step * 100) / STEAK_COOK_DURATION_SEC;
  while (steak.getSnapshot().doneness + perStep < targetDoneness) {
    steak.update(step);
  }
}

describe('SteakMiniGame doneness zones', () => {
  it('maps gauge values to the GAME_SPEC cook grades', () => {
    expect(zoneForDoneness(0)).toBe('raw');
    expect(zoneForDoneness(14.9)).toBe('raw');
    expect(zoneForDoneness(15)).toBe('rare');
    expect(zoneForDoneness(40)).toBe('mediumRare');
    expect(zoneForDoneness(56)).toBe('medium');
    expect(zoneForDoneness(72)).toBe('mediumWell');
    expect(zoneForDoneness(88)).toBe('wellDone');
    expect(zoneForDoneness(99)).toBe('burnt');
    expect(zoneForDoneness(100)).toBe('burnt');
  });
});

describe('SteakMiniGame flow (Mission 07)', () => {
  it('grades a perfect MEDIUM flip and completes the minigame objective', () => {
    const { dialogue, mm, steak, collectibles } = setupSteak();
    mm.startCampaign(6); // mission-07
    expect(mm.getActiveMission()?.id).toBe('mission-07');

    // Objective 1: reach the F2 Restaurant kitchen
    mm.update(0.016, new THREE.Vector3(41.0, 5.8, -12.2));
    expect(mm.getActiveObjective()?.id).toBe('m7-start-cooking');

    // Objective 2: grab the pan (prop opens the overlay)
    steak.open();
    expect(steak.isOverlayOpen()).toBe(true);
    expect(steak.isCooking()).toBe(true);
    mm.notifyInteract('m7-steak-pan');
    expect(mm.getActiveObjective()?.id).toBe('m7-cook-medium');

    // Objective 3: cook to the middle of the MEDIUM zone (48-64, center 56)
    cookTo(steak, 56);
    expect(steak.getSnapshot().currentZone).toBe('medium');
    steak.finishCooking();

    const snap = steak.getSnapshot();
    expect(snap.phase).toBe('ended');
    expect(snap.result).toBe('perfect');

    // Completion dialogue defers the mission completion screen
    while (dialogue.isActive()) dialogue.advance();
    expect(mm.getStatus()).toBe('completed_screen');
    expect(mm.getSnapshot().money).toBe(800);
    expect(collectibles.hasCollected('golden-steak')).toBe(true);
  });

  it('marks off-target flips as a miss and allows a retry round', () => {
    const { mm, steak } = setupSteak();
    mm.startCampaign(6);
    mm.update(0.016, new THREE.Vector3(41.0, 5.8, -12.2));
    steak.open();
    mm.notifyInteract('m7-steak-pan');

    // Flip far too early (still raw)
    steak.update(0.5);
    steak.finishCooking();
    expect(steak.getSnapshot().result).toBe('miss');
    expect(mm.getActiveObjective()?.id).toBe('m7-cook-medium');

    // Retry: second round resets the gauge and can succeed
    const attemptsBefore = steak.getSnapshot().attempts;
    steak.startRound();
    expect(steak.getSnapshot().attempts).toBe(attemptsBefore + 1);
    expect(steak.getSnapshot().doneness).toBe(0);
    cookTo(steak, 52);
    steak.finishCooking();
    expect(steak.getSnapshot().result).toBe('good');
  });

  it('burns the steak automatically when the gauge maxes out', () => {
    const { mm, steak } = setupSteak();
    mm.startCampaign(6);
    mm.update(0.016, new THREE.Vector3(41.0, 5.8, -12.2));
    steak.open();

    steak.update(STEAK_COOK_DURATION_SEC + 1);
    const snap = steak.getSnapshot();
    expect(snap.doneness).toBe(100);
    expect(snap.phase).toBe('ended');
    expect(snap.result).toBe('miss');
  });
});
