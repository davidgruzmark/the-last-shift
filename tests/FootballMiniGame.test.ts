import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { createPalette } from '../src/assets/materials/Palette';
import { CollectibleManager } from '../src/collectibles/CollectibleManager';
import { AssetManager } from '../src/core/AssetManager';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { i18n } from '../src/i18n/LocalizationManager';
import { InteractionManager } from '../src/interaction/InteractionManager';
import {
  FOOTBALL_MATCH_DURATION,
  FOOTBALL_PITCH_BOUNDS,
  FOOTBALL_WIN_GOALS,
  FootballMiniGame,
} from '../src/minigames/FootballMiniGame';
import { CAMPAIGN_MISSIONS } from '../src/missions/MissionDefinitions';
import { MissionManager } from '../src/missions/MissionManager';
import { DialogueManager } from '../src/npcs/DialogueManager';
import { MissionUI } from '../src/ui/MissionUI';
import { PhoneManager } from '../src/ui/PhoneManager';

function setupFootballTest() {
  const assets = new AssetManager();
  const palette = createPalette(assets);
  const bus = new EventBus<GameEvents>();
  const dialogue = new DialogueManager(bus);
  const phone = new PhoneManager(bus, false);
  const collectibles = new CollectibleManager(bus);
  const interactions = new InteractionManager(bus);
  const mm = new MissionManager(CAMPAIGN_MISSIONS, bus, dialogue, phone, collectibles);

  const football = new FootballMiniGame(palette, interactions, mm, bus);
  return { bus, dialogue, collectibles, interactions, mm, football };
}

describe('Phase 6.3 FIFA at IKEA Football Mini-Game (Mission 06)', () => {
  afterEach(() => {
    i18n.setLanguage('en');
  });

  it('progresses from Warehouse ball pickup -> Mini-Pitch match -> aimed kick -> 3-goal win & Personal Football reward', () => {
    const { dialogue, collectibles, mm, football } = setupFootballTest();
    mm.startCampaign(5); // Mission 06
    expect(mm.getActiveMission()?.id).toBe('mission-06');
    expect(mm.getActiveObjective()?.id).toBe('m6-find-ball');

    // Pitch and Warehouse ball respect progression visibility
    football.update(0.016, new THREE.Vector3(21, 0, -16.8), new THREE.Vector3());
    expect(football.group.getObjectByName('FootballProp_m6-warehouse-ball')!.visible).toBe(true);

    // Pick up Warehouse ball -> advance to Mini-Pitch challenge
    mm.notifyInteract('m6-warehouse-ball');
    while (dialogue.isActive()) dialogue.advance();
    expect(mm.getActiveObjective()?.id).toBe('m6-start-match');

    // Start 1v1 match cleanly
    football.startMatch();
    mm.notifyInteract('m6-start-match');
    expect(mm.getActiveObjective()?.id).toBe('m6-win-match');
    expect(football.isMatchActive()).toBe(true);
    expect(football.getSnapshot().kfirScore).toBe(0);
    expect(football.getSnapshot().opponentScore).toBe(0);

    // Score 3 goals by positioning behind the ball facing North goal (-Z) and kicking cleanly
    for (let goal = 1; goal <= FOOTBALL_WIN_GOALS; goal++) {
      // Clear any goal pause between goals
      if (football.getSnapshot().phase === 'goal_pause') {
        for (let t = 0; t < 35; t++) {
          football.update(0.05, new THREE.Vector3(23.5, 0, 45.2), new THREE.Vector3());
        }
      }
      // Move ball out from opponent block onto clean attacking spot and kick North (-Z)
      football.ballPosition.set(FOOTBALL_PITCH_BOUNDS.centerX, 0.24, FOOTBALL_PITCH_BOUNDS.minZ + 2.2);
      football.opponentPosition.set(FOOTBALL_PITCH_BOUNDS.minX + 1.0, 0, FOOTBALL_PITCH_BOUNDS.centerZ);
      const kickerPos = new THREE.Vector3(
        FOOTBALL_PITCH_BOUNDS.centerX,
        0,
        FOOTBALL_PITCH_BOUNDS.minZ + 3.2,
      );
      expect(football.kick(kickerPos, new THREE.Vector3(0, 0, -1))).toBe(true);

      for (let t = 0; t < 30; t++) {
        football.update(0.04, kickerPos, new THREE.Vector3());
      }
      expect(football.getSnapshot().kfirScore).toBe(goal);
    }

    // Match won -> Mission 06 completed & Personal Football unlocked
    expect(football.getSnapshot().winner).toBe('kfir');
    expect(football.getSnapshot().phase).toBe('ended');
    expect(mm.getStatus()).toBe('completed_screen');
    expect(collectibles.hasCollected('personal-football')).toBe(true);
    expect(mm.getSnapshot().money).toBe(700);

    // Continue -> campaign complete & permanent Parking Lot free-play mode active!
    mm.continueAfterCompletion();
    football.update(0.016, new THREE.Vector3(23.5, 0, 45.0), new THREE.Vector3());
    expect(football.getSnapshot().mode).toBe('freeplay');
    expect(
      football.pass(new THREE.Vector3(23.5, 0, 45.0), new THREE.Vector3(0, 0, -1)),
    ).toBe(true);
  });

  it('supports ball dribbling, sideline wall rebound, and rematch recovery on timer draw/loss', () => {
    const { mm, football } = setupFootballTest();
    mm.startCampaign(5);
    mm.notifyInteract('m6-warehouse-ball');
    football.startMatch();
    mm.notifyInteract('m6-start-match');

    // Touchball dribble pushes ball forward cleanly
    const startZ = football.ballPosition.z;
    football.update(
      0.1,
      new THREE.Vector3(football.ballPosition.x, 0, football.ballPosition.z + 0.4),
      new THREE.Vector3(0, 0, -4.5),
    );
    expect(football.ballVelocity.z).toBeLessThan(-2);
    expect(football.ballPosition.z).toBeLessThan(startZ);

    // Kick sideways toward East wall -> rebounds safely inside pitch boundaries
    football.ballPosition.set(FOOTBALL_PITCH_BOUNDS.maxX - 0.5, 0.24, FOOTBALL_PITCH_BOUNDS.centerZ);
    football.kick(
      new THREE.Vector3(FOOTBALL_PITCH_BOUNDS.maxX - 1.2, 0, FOOTBALL_PITCH_BOUNDS.centerZ),
      new THREE.Vector3(1, 0, 0),
    );
    for (let i = 0; i < 20; i++) {
      football.update(0.03, new THREE.Vector3(20, 0, 44), new THREE.Vector3());
    }
    expect(football.ballPosition.x).toBeLessThanOrEqual(FOOTBALL_PITCH_BOUNDS.maxX);
    expect(football.ballVelocity.x).toBeLessThan(0);

    // Run match timer down cleanly to 0 -> draw ends match without softlocking, rematch resets cleanly
    football.opponentPosition.set(20, 0, 40);
    football.ballPosition.set(20, 0.24, 48);
    football.ballVelocity.set(0, 0, 0);
    for (let i = 0; i < FOOTBALL_MATCH_DURATION + 2; i++) {
      football.update(1.0, new THREE.Vector3(20, 0, 40), new THREE.Vector3());
    }
    expect(football.getSnapshot().phase).toBe('ended');
    expect(football.getSnapshot().winner).not.toBe('kfir');
    expect(mm.getStatus()).toBe('active');

    football.restartMatch();
    expect(football.getSnapshot().phase).toBe('active');
    expect(football.getSnapshot().timeRemaining).toBe(FOOTBALL_MATCH_DURATION);
    expect(football.getSnapshot().kfirScore).toBe(0);
    expect(football.getSnapshot().opponentScore).toBe(0);
  });

  it('deflects kicked balls off Yossi body without tunneling and runs active intercept/shoot AI', () => {
    const { mm, football } = setupFootballTest();
    mm.startCampaign(5);
    mm.notifyInteract('m6-warehouse-ball');
    football.startMatch();
    mm.notifyInteract('m6-start-match');

    // Position Yossi directly between Kfir and North goal, then kick straight through Yossi
    football.opponentPosition.set(FOOTBALL_PITCH_BOUNDS.centerX, 0, FOOTBALL_PITCH_BOUNDS.opponentGoalZ + 2.2);
    football.ballPosition.set(FOOTBALL_PITCH_BOUNDS.centerX, 0.24, FOOTBALL_PITCH_BOUNDS.opponentGoalZ + 3.6);
    const kickerPos = new THREE.Vector3(
      FOOTBALL_PITCH_BOUNDS.centerX,
      0,
      FOOTBALL_PITCH_BOUNDS.opponentGoalZ + 4.6,
    );
    expect(football.kick(kickerPos, new THREE.Vector3(0, 0, -1))).toBe(true);

    for (let i = 0; i < 18; i++) {
      football.update(0.025, kickerPos, new THREE.Vector3());
    }
    expect(football.getOpponentDeflections()).toBeGreaterThan(0);
    expect(football.getSnapshot().kfirScore).toBe(0);
    expect(football.ballVelocity.z).toBeGreaterThan(0);

    // Restart match, verify defend state when ball moves into South half, then place ball near Yossi -> shoots South (+Z)
    football.restartMatch();
    for (let i = 0; i < 24; i++) {
      football.ballPosition.set(FOOTBALL_PITCH_BOUNDS.maxX - 1.2, 0.24, FOOTBALL_PITCH_BOUNDS.kfirGoalZ - 2.0);
      football.ballVelocity.set(0, 0, 3.2);
      football.update(0.05, new THREE.Vector3(24.5, 0, 48.0), new THREE.Vector3());
    }
    expect(football.getOpponentAIState()).toBe('defend');

    football.ballPosition.set(FOOTBALL_PITCH_BOUNDS.centerX, 0.24, FOOTBALL_PITCH_BOUNDS.opponentGoalZ + 2.6);
    football.ballVelocity.set(0, 0, 0);
    football.opponentPosition.set(FOOTBALL_PITCH_BOUNDS.centerX, 0, FOOTBALL_PITCH_BOUNDS.opponentGoalZ + 2.0);
    football.update(0.016, new THREE.Vector3(24.5, 0, 48.0), new THREE.Vector3());
    expect(football.getOpponentAIState()).toBe('shoot');
    expect(football.ballVelocity.z).toBeGreaterThan(6);

    // Verify Yossi recovers and clears stationary balls in ALL FOUR corners (NE, NW, SE, SW) without stalling
    const corners = [
      { name: 'NE', x: FOOTBALL_PITCH_BOUNDS.maxX - 0.28, z: FOOTBALL_PITCH_BOUNDS.minZ + 0.28 },
      { name: 'NW', x: FOOTBALL_PITCH_BOUNDS.minX + 0.28, z: FOOTBALL_PITCH_BOUNDS.minZ + 0.28 },
      { name: 'SE', x: FOOTBALL_PITCH_BOUNDS.maxX - 0.28, z: FOOTBALL_PITCH_BOUNDS.maxZ - 0.28 },
      { name: 'SW', x: FOOTBALL_PITCH_BOUNDS.minX + 0.28, z: FOOTBALL_PITCH_BOUNDS.maxZ - 0.28 },
    ];
    for (const c of corners) {
      football.restartMatch();
      for (let i = 0; i < 24; i++) {
        football.ballPosition.set(FOOTBALL_PITCH_BOUNDS.centerX, 0.24, FOOTBALL_PITCH_BOUNDS.kfirGoalZ - 2.0);
        football.ballVelocity.set(0, 0, 3.2);
        football.update(0.05, new THREE.Vector3(23.5, 0, 44.0), new THREE.Vector3());
      }
      football.ballPosition.set(c.x, 0.24, c.z);
      football.ballVelocity.set(0, 0, 0);

      let kicked = false;
      for (let i = 0; i < 70; i++) {
        football.update(0.05, new THREE.Vector3(23.5, 0, 44.0), new THREE.Vector3());
        if (football.getOpponentAIState() === 'shoot') {
          kicked = true;
        }
        if (kicked && i > 10) {
          const clearedDist = Math.hypot(football.ballPosition.x - c.x, football.ballPosition.z - c.z);
          if (clearedDist > 1.2) break;
        }
      }
      const distCleared = Math.hypot(football.ballPosition.x - c.x, football.ballPosition.z - c.z);
      expect(kicked, `Yossi should kick stationary ball out of ${c.name} corner`).toBe(true);
      expect(distCleared, `Ball in ${c.name} corner should clear into play`).toBeGreaterThan(1.2);
    }
  });

  it('suppresses objective_done and new_objective banners on MissionUI during live football match kickoff', () => {
    const createMockEl = () => {
      const classes = new Set<string>(['hidden']);
      let cls = '';
      const children = new Map<string, ReturnType<typeof createMockEl>>();
      const el = {
        id: '',
        innerHTML: '',
        textContent: '',
        style: {} as Record<string, string>,
        classList: {
          add: (c: string) => classes.add(c),
          remove: (c: string) => classes.delete(c),
          toggle: (c: string, force?: boolean) => {
            if (force === undefined ? !classes.has(c) : force) classes.add(c);
            else classes.delete(c);
          },
          contains: (c: string) => classes.has(c),
        },
        set className(val: string) {
          cls = val;
          classes.clear();
          val.split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
        },
        get className() {
          return cls;
        },
        appendChild: () => {},
        addEventListener: () => {},
        remove: () => {},
        querySelector: (selector: string) => {
          if (!children.has(selector)) children.set(selector, createMockEl());
          return children.get(selector)!;
        },
      };
      return el;
    };

    const prevDoc = (globalThis as Record<string, unknown>).document;
    const prevWin = (globalThis as Record<string, unknown>).window;
    const hudRoot = createMockEl();
    (globalThis as Record<string, unknown>).document = {
      createElement: () => createMockEl(),
      documentElement: { lang: 'en', dir: 'ltr' },
    };
    (globalThis as Record<string, unknown>).window = {
      setTimeout: () => 1,
      clearTimeout: () => {},
    };

    try {
      const bus = new EventBus<GameEvents>();
      const dialogue = new DialogueManager(bus);
      const phone = new PhoneManager(bus, false);
      const collectibles = new CollectibleManager(bus);
      const mm = new MissionManager(CAMPAIGN_MISSIONS, bus, dialogue, phone, collectibles);
      const ui = new MissionUI(hudRoot as unknown as HTMLElement, bus, mm);
      const bannerEl = (ui as unknown as { bannerEl: ReturnType<typeof createMockEl> }).bannerEl;

      // 1. Outside match: objective_done banner displays normally
      bus.emit('mission:notification', {
        kind: 'objective_done',
        title: 'OBJECTIVE COMPLETED',
        subtitle: 'Normal toast',
      });
      expect(bannerEl.classList.contains('hidden')).toBe(false);

      // 2. Kickoff transition: football match becomes visible -> hides active kickoff banner and suppresses new objective banners
      bus.emit('football:stateChanged', {
        visible: true,
        phase: 'active',
        mode: 'match',
        kfirScore: 0,
        opponentScore: 0,
        timeRemaining: 60,
        winner: null,
        lastScorer: null,
        ballInRange: true,
      });
      expect(bannerEl.classList.contains('hidden')).toBe(true);

      bus.emit('mission:notification', {
        kind: 'objective_done',
        title: 'OBJECTIVE COMPLETED',
        subtitle: 'Should be suppressed during kickoff',
      });
      expect(bannerEl.classList.contains('hidden')).toBe(true);

      // 3. Freeplay after match restores normal objective banner behavior
      bus.emit('football:stateChanged', {
        visible: false,
        phase: 'active',
        mode: 'freeplay',
        kfirScore: 3,
        opponentScore: 0,
        timeRemaining: 30,
        winner: 'kfir',
        lastScorer: 'kfir',
        ballInRange: false,
      });
      bus.emit('mission:notification', {
        kind: 'objective_done',
        title: 'OBJECTIVE COMPLETED',
        subtitle: 'Restored outside match',
      });
      expect(bannerEl.classList.contains('hidden')).toBe(false);
      ui.dispose();
    } finally {
      if (prevDoc === undefined) delete (globalThis as Record<string, unknown>).document;
      else (globalThis as Record<string, unknown>).document = prevDoc;
      if (prevWin === undefined) delete (globalThis as Record<string, unknown>).window;
      else (globalThis as Record<string, unknown>).window = prevWin;
    }
  });
});
