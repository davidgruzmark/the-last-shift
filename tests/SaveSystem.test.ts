import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CollectibleManager } from '../src/collectibles/CollectibleManager';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { CAMPAIGN_MISSIONS } from '../src/missions/MissionDefinitions';
import { MissionManager } from '../src/missions/MissionManager';
import { DialogueManager } from '../src/npcs/DialogueManager';
import { SaveManager, SAVE_STORAGE_KEY, type KeyValueStorage } from '../src/save/SaveManager';
import { PhoneManager } from '../src/ui/PhoneManager';

class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function buildMissionManager() {
  const bus = new EventBus<GameEvents>();
  const dialogue = new DialogueManager(bus);
  const phone = new PhoneManager(bus, false);
  const collectibles = new CollectibleManager(bus);
  const mm = new MissionManager(CAMPAIGN_MISSIONS, bus, dialogue, phone, collectibles);
  return { bus, dialogue, phone, collectibles, mm };
}

describe('SaveManager persistence', () => {
  it('round-trips a save payload through storage', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);

    saves.save({
      money: 2750,
      completedMissionIds: ['mission-01', 'mission-02', 'mission-01'],
      collectibleIds: ['perfume-jpg-le-male', 'watch-casio-gshock'],
      graphicsQuality: 'high',
      language: 'he',
    });

    const loaded = saves.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.money).toBe(2750);
    expect(loaded!.completedMissionIds).toEqual(['mission-01', 'mission-02']);
    expect(loaded!.collectibleIds).toEqual(['perfume-jpg-le-male', 'watch-casio-gshock']);
    expect(loaded!.graphicsQuality).toBe('high');
    expect(loaded!.language).toBe('he');
    expect(loaded!.savedAt).not.toBe('');
  });

  it('returns null for missing or corrupt payloads', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    expect(saves.load()).toBeNull();

    storage.setItem(SAVE_STORAGE_KEY, '{not json');
    expect(saves.load()).toBeNull();

    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ version: 99, money: 5 }));
    expect(saves.load()).toBeNull();
  });

  it('sanitizes invalid fields instead of crashing', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        money: Number.NaN,
        completedMissionIds: ['mission-01', 42],
        collectibleIds: 'oops',
        graphicsQuality: 'ultra',
        language: 'fr',
      }),
    );
    const loaded = new SaveManager(storage).load();
    expect(loaded).not.toBeNull();
    expect(loaded!.money).toBe(0);
    expect(loaded!.completedMissionIds).toEqual(['mission-01']);
    expect(loaded!.collectibleIds).toEqual([]);
    expect(loaded!.graphicsQuality).toBe('medium');
    expect(loaded!.language).toBe('en');
  });

  it('clear() removes the stored save', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    saves.save({
      money: 1,
      completedMissionIds: [],
      collectibleIds: [],
      graphicsQuality: 'low',
      language: 'en',
    });
    saves.clear();
    expect(saves.load()).toBeNull();
  });
});

describe('Campaign restore from save', () => {
  it('restores wallet and completed missions, then resumes at the next mission', () => {
    const { mm } = buildMissionManager();
    mm.restoreProgress(900, ['mission-01', 'mission-02']);

    // Simulate the engine resume logic: first mission not completed.
    const completed = new Set(mm.getSnapshot().completedMissions);
    const nextIndex = CAMPAIGN_MISSIONS.findIndex((mission) => !completed.has(mission.id));
    expect(nextIndex).toBe(2);

    mm.startCampaign(nextIndex);
    const snap = mm.getSnapshot();
    expect(snap.status).toBe('active');
    expect(snap.missionId).toBe('mission-03');
    expect(snap.money).toBe(900);
    expect(snap.completedMissions).toContain('mission-01');
    expect(snap.completedMissions).toContain('mission-02');
  });

  it('enters campaign_complete when every mission is in the save', () => {
    const { mm } = buildMissionManager();
    const allIds = CAMPAIGN_MISSIONS.map((mission) => mission.id);
    mm.restoreProgress(6000, allIds);
    const snap = mm.getSnapshot();
    expect(snap.status).toBe('campaign_complete');
    expect(snap.money).toBe(6000);
  });

  it('ignores unknown mission ids from stale saves', () => {
    const { mm } = buildMissionManager();
    mm.restoreProgress(0, ['mission-99', 'mission-01']);
    expect(mm.getSnapshot().completedMissions).toEqual(['mission-01']);
  });
});

describe('Collectible restore from save', () => {
  it('marks world items collected without firing collection events', () => {
    const bus = new EventBus<GameEvents>();
    const collectibles = new CollectibleManager(bus);
    let events = 0;
    bus.on('collectible:collected', () => {
      events += 1;
    });

    collectibles.addCollectible({
      id: 'watch-test',
      name: 'Test Watch',
      position: new THREE.Vector3(0, 0, 0),
      color: 0xffffff,
      kind: 'watch',
    });

    collectibles.restoreCollected(['watch-test', 'golden-steak']);
    expect(collectibles.hasCollected('watch-test')).toBe(true);
    expect(collectibles.hasCollected('golden-steak')).toBe(true);
    expect(events).toBe(0);

    // Double restore is a no-op and does not duplicate.
    collectibles.restoreCollected(['watch-test']);
    expect(collectibles.getCollectedIds().filter((id) => id === 'watch-test')).toHaveLength(1);
  });
});
