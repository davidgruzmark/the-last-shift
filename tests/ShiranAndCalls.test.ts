import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollectibleManager } from '../src/collectibles/CollectibleManager';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { i18n } from '../src/i18n/LocalizationManager';
import { CAMPAIGN_MISSIONS } from '../src/missions/MissionDefinitions';
import { MissionManager } from '../src/missions/MissionManager';
import { DialogueManager } from '../src/npcs/DialogueManager';
import { CALL_SCENARIOS, PhoneManager } from '../src/ui/PhoneManager';

describe('Phase 6.2 Shiran Milestone Messages & Incoming Call Separation', () => {
  afterEach(() => {
    i18n.setLanguage('en');
  });

  it('separates work alerts from Shiran personal chat and deduplicates milestone deliveries', () => {
    const bus = new EventBus<GameEvents>();
    const phone = new PhoneManager(bus, true);

    expect(phone.getActiveThread()).toBe('shiran');
    expect(phone.getMessages('shiran')).toHaveLength(2);
    expect(phone.getMessages('work')).toHaveLength(0);

    // Calm, believable tone (no excessive emoji / melodrama)
    expect(phone.getMessages('shiran')[0].text).not.toContain('❤️');

    // Deliver M02, M04, M05 milestones
    expect(phone.deliverShiranMilestone('m2-complete')).not.toBeNull();
    expect(phone.deliverShiranMilestone('m2-complete')).toBeNull(); // duplicate rejected
    expect(phone.deliverShiranMilestone('m4-complete')).not.toBeNull();
    expect(phone.deliverShiranMilestone('m5-complete')).not.toBeNull();

    // Work thread must remain empty of Shiran messages
    expect(phone.getMessages('work')).toHaveLength(0);
    expect(phone.getMessages('shiran')).toHaveLength(5);

    // Work message goes only to work thread
    phone.receiveMessage('SHIFT MANAGER', 'Warehouse status check.');
    expect(phone.getMessages('work')).toHaveLength(1);
    expect(phone.getMessages('shiran').some((m) => m.sender === 'SHIFT MANAGER')).toBe(false);
  });

  it('triggers M02/M04/M05 Shiran milestones and M05 Incoming Call via MissionManager while keeping M07/M09 dormant', () => {
    const bus = new EventBus<GameEvents>();
    const dialogue = new DialogueManager(bus);
    const phone = new PhoneManager(bus, true);
    const collectibles = new CollectibleManager(bus);
    const manager = new MissionManager(CAMPAIGN_MISSIONS, bus, dialogue, phone, collectibles);

    manager.startCampaign();
    dialogue.close();

    // Complete M01
    manager.notifyCameraInspected(3);
    manager.notifyInteract('m1-radio');
    manager.update(0.1, CAMPAIGN_MISSIONS[0].objectives[2].targetPos!);
    manager.update(0.1, CAMPAIGN_MISSIONS[0].objectives[3].targetPos!);
    manager.notifyInteract('m1-warehouse-clue');
    dialogue.close();
    expect(phone.hasMilestoneSent('m2-complete')).toBe(false);
    expect(phone.getActiveCall()).toBeNull();

    // Complete M02 -> delivers Shiran m2-complete
    manager.continueAfterCompletion();
    manager.setDynamicMarkerResolver((obj) => obj.targetPos ?? null);
    manager.setDynamicTravelGetter(() => 10);
    manager.update(0.1, CAMPAIGN_MISSIONS[1].objectives[0].targetPos!);
    manager.update(0.1, CAMPAIGN_MISSIONS[1].objectives[1].targetPos!);
    manager.notifyInteract('m2-runaway-cart');
    manager.notifyInteract('m2-cart-clipboard');
    dialogue.close();
    expect(phone.hasMilestoneSent('m2-complete')).toBe(true);

    // Complete M03 -> no extra Shiran milestone on M03
    manager.continueAfterCompletion();
    manager.update(0.1, CAMPAIGN_MISSIONS[2].objectives[0].targetPos!);
    manager.notifyInteract('m3-watch-box-clue');
    dialogue.close();
    manager.notifyInteract('m3-missing-watch');
    manager.notifyNpcTalked('employee-danny');
    expect(phone.hasMilestoneSent('m4-complete')).toBe(false);

    // Complete M04 -> delivers Shiran m4-complete
    manager.continueAfterCompletion();
    manager.update(0.1, CAMPAIGN_MISSIONS[3].objectives[0].targetPos!);
    manager.update(0.1, CAMPAIGN_MISSIONS[3].objectives[1].targetPos!);
    manager.notifyInteract('m4-emergency-switch');
    manager.notifyInteract('m4-forklift-inspect');
    dialogue.close();
    expect(phone.hasMilestoneSent('m4-complete')).toBe(true);

    // Start M05 -> triggers Incoming Call from Shift Manager
    manager.continueAfterCompletion();
    expect(phone.getActiveCall()?.status).toBe('ringing');
    expect(phone.getActiveCall()?.callerName).toBe('Shift Manager');

    // Complete M05 -> delivers Shiran m5-complete, keeps M07/M09 hooks dormant
    phone.declineCall();
    manager.update(0.1, CAMPAIGN_MISSIONS[4].objectives[0].targetPos!);
    manager.notifyInteract('m5-empty-display');
    dialogue.close();
    manager.notifyNpcTalked('employee-danny');
    manager.notifyNpcTalked('employee-maya');
    manager.notifyInteract('m5-clue-bag');
    dialogue.close();
    manager.notifyInteract('m5-jpg-le-male-bottle');
    dialogue.close();
    manager.notifyNpcTalked('employee-danny');

    expect(phone.hasMilestoneSent('m5-complete')).toBe(true);
    expect(phone.hasMilestoneSent('m7-complete')).toBe(false);
    expect(phone.hasMilestoneSent('m9-trigger')).toBe(false);
    expect(phone.getMessages('shiran').some((m) => m.sender === 'SHIFT MANAGER')).toBe(false);
  });

  it('supports Answer, Decline, and Hang Up incoming calls completely separate from chat history', () => {
    const bus = new EventBus<GameEvents>();
    const phone = new PhoneManager(bus, true);
    const beforeCount = phone.getMessages().length;

    const onAnswer = vi.fn();
    const onDecline = vi.fn();

    phone.triggerIncomingCall({ ...CALL_SCENARIOS.shift_manager, onAnswer });
    expect(phone.isOpen()).toBe(true);
    expect(phone.getActiveCall()?.status).toBe('ringing');

    phone.answerCall();
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(phone.getActiveCall()?.status).toBe('connected');

    phone.endCall();
    expect(phone.getActiveCall()).toBeNull();

    phone.triggerIncomingCall({ ...CALL_SCENARIOS.ikea_security, onDecline });
    phone.declineCall();
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(phone.getActiveCall()).toBeNull();

    // Incoming calls must never pollute chat message lists
    expect(phone.getMessages()).toHaveLength(beforeCount);
  });

  it('delivers Shiran exact Hebrew message for m9-trigger and removes stale Phase 6.2 debug labels', () => {
    const bus = new EventBus<GameEvents>();
    const phone = new PhoneManager(bus, true);

    expect(i18n.t('hud.debugTitle')).not.toContain('6.2');
    expect(i18n.t('mission.campaignComplete.obj')).not.toContain('6.2');

    i18n.setLanguage('he');
    expect(i18n.t('hud.debugTitle')).not.toContain('6.2');
    expect(i18n.t('mission.campaignComplete.obj')).not.toContain('6.2');

    const msg = phone.deliverShiranMilestone('m9-trigger');
    expect(msg?.text).toBe('מתי אתה חוזר הביתה?');
  });

  it('delivers staggered Friends Group Chat bursts across shift-start, M03 Daytona, Jimmy Choo, and M06', () => {
    const bus = new EventBus<GameEvents>();
    const phone = new PhoneManager(bus, true);

    phone.deliverFriendsMilestone('shift-start');
    expect(phone.hasGroupEventSent('shift-start')).toBe(true);
    // Delayed burst not yet delivered at t=0
    expect(phone.getMessages('friends')).toHaveLength(0);

    phone.update(4.0);
    expect(phone.getMessages('friends')).toHaveLength(1);
    expect(phone.getMessages('friends')[0].sender).toBe('David');

    phone.update(4.0);
    expect(phone.getMessages('friends')).toHaveLength(2);
    expect(phone.getMessages('friends')[1].sender).toBe('Mor');

    // Switch to Hebrew and verify live localized friend names & messages
    i18n.setLanguage('he');
    const heFriends = phone.getMessages('friends');
    expect(heFriends[0].sender).toBe('דוד');
    expect(heFriends[1].sender).toBe('מור');
    i18n.setLanguage('en');

    // Immediate + staggered M03 Gold Rolex Daytona reaction
    phone.deliverFriendsMilestone('m3-daytona');
    expect(phone.getMessages('friends')).toHaveLength(3);
    phone.update(7.0);
    expect(phone.getMessages('friends')).toHaveLength(5);

    // Duplicate trigger does not re-send
    phone.deliverFriendsMilestone('m3-daytona');
    expect(phone.getMessages('friends')).toHaveLength(5);

    // Jimmy Choo Man pickup burst mentions Lior cleanly
    phone.deliverFriendsMilestone('jimmy-choo-found');
    expect(phone.getMessages('friends').at(-1)?.sender).toBe('Lior');
    phone.update(4.0);
    expect(phone.getMessages('friends').at(-1)?.text).toContain('Jimmy Choo');

    // M06 completion burst
    phone.deliverFriendsMilestone('m6-complete');
    phone.update(7.0);
    expect(phone.getMessages('friends').length).toBeGreaterThanOrEqual(10);
  });
});
