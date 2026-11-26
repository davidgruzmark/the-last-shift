import { afterEach, describe, expect, it } from 'vitest';
import {
  createMidnightNoirBottle,
  createPerfumeBottle,
  type PerfumeVariant,
} from '../src/assets/collectibles/PerfumeBottleModel';
import { CollectibleManager } from '../src/collectibles/CollectibleManager';
import { PERFUME_CATALOG, PerfumeCollection } from '../src/collectibles/PerfumeCollection';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { i18n } from '../src/i18n/LocalizationManager';

describe('Phase 6.2 Perfume Collection (5/5) & Distinct 3D Bottles', () => {
  afterEach(() => {
    i18n.setLanguage('en');
  });

  it('exposes all 5 perfumes in the catalog and resolves bilingual metadata', () => {
    const bus = new EventBus<GameEvents>();
    const cm = new CollectibleManager(bus);
    const collection = new PerfumeCollection(cm, bus);

    expect(PERFUME_CATALOG.every((p) => p.obtainableInBuild)).toBe(true);
    expect(collection.getEntries().map((e) => e.name)).toEqual([
      'Midnight Noir',
      'Ocean King',
      'Royal Essence',
      'The Boss',
      'Kfir Signature',
    ]);

    i18n.setLanguage('he');
    const heEntries = collection.getEntries();
    expect(heEntries).toHaveLength(5);
    expect(heEntries[0].rarityLabel.length).toBeGreaterThan(0);
    expect(heEntries[0].acquisitionSource).toContain('משימה 05');
  });

  it('unlocks all 5 perfumes without duplicates and keeps non-perfume rewards separate', () => {
    const bus = new EventBus<GameEvents>();
    const cm = new CollectibleManager(bus);
    const collection = new PerfumeCollection(cm, bus);

    // M02–M04 non-perfume rewards do not increment perfume count
    cm.grantRewardItem('golden-wrench', 'Golden Flat-Pack Wrench');
    cm.grantRewardItem('silver-guard-watch', 'Silver Guard Watch');
    cm.grantRewardItem('warehouse-hero-badge', 'Warehouse Hero Badge');
    expect(collection.getProgress()).toEqual({ collected: 0, total: 5 });

    const ids = [
      'perfume-midnight-noir',
      'perfume-ocean-king',
      'perfume-royal-essence',
      'perfume-the-boss',
      'perfume-kfir-signature',
    ];

    ids.forEach((id, idx) => {
      expect(collection.unlockPerfume(id)).toBe(true);
      expect(collection.unlockPerfume(id)).toBe(false);
      expect(collection.hasPerfume(id)).toBe(true);
      expect(collection.getProgress()).toEqual({ collected: idx + 1, total: 5 });
    });

    expect(collection.getEntries().every((e) => e.collected)).toBe(true);
  });

  it('builds 5 distinct low-poly 3D perfume bottles with labels and sparkles', () => {
    const midnight = createMidnightNoirBottle();
    expect(midnight.group.name).toBe('MidnightNoirBottle');
    expect(midnight.sparkles).toHaveLength(4);

    const variants: PerfumeVariant[] = [
      'midnight-noir',
      'ocean-king',
      'royal-essence',
      'the-boss',
      'kfir-signature',
    ];
    for (const variant of variants) {
      const rig = createPerfumeBottle(variant);
      expect(rig.sparkles).toHaveLength(4);
      expect(rig.group.children.length).toBeGreaterThanOrEqual(8);
    }
  });
});
