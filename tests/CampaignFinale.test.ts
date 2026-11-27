import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CollectibleManager } from '../src/collectibles/CollectibleManager';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { CAMPAIGN_MISSIONS } from '../src/missions/MissionDefinitions';
import { MissionManager } from '../src/missions/MissionManager';
import { DialogueManager } from '../src/npcs/DialogueManager';
import { PhoneManager } from '../src/ui/PhoneManager';

/**
 * End-to-end campaign finale: Missions 07 (Steak Emergency), 08 (Security
 * Breach) and 09 (The Last Shift) through to campaign_complete.
 */
describe('Campaign finale: Missions 07-09', () => {
  function setup() {
    const bus = new EventBus<GameEvents>();
    const dialogue = new DialogueManager(bus);
    const phone = new PhoneManager(bus, false);
    const collectibles = new CollectibleManager(bus);
    const mm = new MissionManager(CAMPAIGN_MISSIONS, bus, dialogue, phone, collectibles);
    const drainDialogue = () => {
      while (dialogue.isActive()) dialogue.advance();
    };
    return { bus, dialogue, phone, collectibles, mm, drainDialogue };
  }

  it('defines a 9-mission campaign in spec order', () => {
    expect(CAMPAIGN_MISSIONS.map((mission) => mission.id)).toEqual([
      'mission-01',
      'mission-02',
      'mission-03',
      'mission-04',
      'mission-05',
      'mission-06',
      'mission-07',
      'mission-08',
      'mission-09',
    ]);
  });

  it('plays Mission 08 Security Breach from alert to latched gate', () => {
    const { mm, drainDialogue } = setup();
    mm.startCampaign(7);
    expect(mm.getActiveMission()?.id).toBe('mission-08');
    expect(mm.getActiveObjective()?.id).toBe('m8-check-cam02');

    // Wrong camera does not advance the objective
    mm.notifyCameraInspected(3);
    expect(mm.getActiveObjective()?.id).toBe('m8-check-cam02');
    mm.notifyCameraInspected(1);
    expect(mm.getActiveObjective()?.id).toBe('m8-sweep-checkout');

    mm.update(0.016, new THREE.Vector3(21.0, 0, 23.8));
    expect(mm.getActiveObjective()?.id).toBe('m8-check-panel');

    // Out-of-order interacts are ignored
    mm.notifyInteract('m8-gate-control');
    expect(mm.getActiveObjective()?.id).toBe('m8-check-panel');
    mm.notifyInteract('m8-breach-panel');
    expect(mm.getActiveObjective()?.id).toBe('m8-reach-gate');

    mm.update(0.016, new THREE.Vector3(50.5, 0, 58.0));
    expect(mm.getActiveObjective()?.id).toBe('m8-secure-gate');

    mm.notifyInteract('m8-gate-control');
    drainDialogue();
    expect(mm.getStatus()).toBe('completed_screen');
    expect(mm.getSnapshot().money).toBe(900);
  });

  it('plays Mission 09 The Last Shift to campaign completion', () => {
    const { phone, mm, drainDialogue } = setup();
    mm.startCampaign(8);
    expect(mm.getActiveMission()?.id).toBe('mission-09');

    // The manager's "one more small thing" call rings on mission start
    expect(phone.getActiveCall()?.status).toBe('ringing');

    // Clock out at the control room desk
    mm.update(0.016, new THREE.Vector3(-0.6, 0, -3.55));
    drainDialogue();
    expect(mm.getActiveObjective()?.id).toBe('m9-reach-car');

    // Walk to the car, then drive home (vehicle position arrives as player pos)
    mm.update(0.016, new THREE.Vector3(14.0, 0, 33.5));
    expect(mm.getActiveObjective()?.id).toBe('m9-drive-home');

    mm.update(0.016, new THREE.Vector3(-12.5, 0, 67.0));
    drainDialogue();
    expect(mm.getStatus()).toBe('completed_screen');
    expect(mm.getSnapshot().money).toBe(1000);

    mm.continueAfterCompletion();
    expect(mm.getStatus()).toBe('campaign_complete');
    expect(mm.getSnapshot().completedMissions).toContain('mission-09');
  });

  it('grants the full campaign wallet across Missions 07-09', () => {
    const { mm, drainDialogue } = setup();
    // Simulate Missions 01-06 already done via resume, then finish the finale.
    mm.restoreProgress(2550, [
      'mission-01',
      'mission-02',
      'mission-03',
      'mission-04',
      'mission-05',
      'mission-06',
    ]);
    mm.startCampaign(6);

    // M07
    mm.update(0.016, new THREE.Vector3(41.0, 5.8, -12.2));
    mm.notifyInteract('m7-steak-pan');
    mm.notifyMinigameComplete('steak-emergency');
    drainDialogue();
    expect(mm.getSnapshot().money).toBe(3350);
    mm.continueAfterCompletion();

    // M08
    expect(mm.getActiveMission()?.id).toBe('mission-08');
    mm.notifyCameraInspected(1);
    mm.update(0.016, new THREE.Vector3(21.0, 0, 23.8));
    mm.notifyInteract('m8-breach-panel');
    mm.update(0.016, new THREE.Vector3(50.5, 0, 58.0));
    mm.notifyInteract('m8-gate-control');
    drainDialogue();
    expect(mm.getSnapshot().money).toBe(4250);
    mm.continueAfterCompletion();

    // M09
    expect(mm.getActiveMission()?.id).toBe('mission-09');
    mm.update(0.016, new THREE.Vector3(-0.6, 0, -3.55));
    drainDialogue();
    mm.update(0.016, new THREE.Vector3(14.0, 0, 33.5));
    mm.update(0.016, new THREE.Vector3(-12.5, 0, 67.0));
    drainDialogue();
    expect(mm.getSnapshot().money).toBe(5250);
    mm.continueAfterCompletion();

    expect(mm.getStatus()).toBe('campaign_complete');
    expect(mm.getSnapshot().completedMissions).toHaveLength(9);
  });
});
