import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createJpgLeMaleBottle,
  createPerfumeBottle,
  type PerfumeVariant,
} from '../src/assets/collectibles/PerfumeBottleModel';
import { AssetManager } from '../src/core/AssetManager';
import { createPalette } from '../src/assets/materials/Palette';
import { CollectibleManager } from '../src/collectibles/CollectibleManager';
import { PERFUME_CATALOG, PerfumeCollection } from '../src/collectibles/PerfumeCollection';
import { WatchCollection } from '../src/collectibles/WatchCollection';
import { WorldCollectionProps } from '../src/collectibles/WorldCollectionProps';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { i18n } from '../src/i18n/LocalizationManager';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { DialogueManager } from '../src/npcs/DialogueManager';
import { WORLD_ANCHORS } from '../src/world/WorldAnchors';

describe('Phase 6.3.2 Perfume Collection (4/4) & Real-World 3D Bottles', () => {
  afterEach(() => {
    i18n.setLanguage('en');
  });

  it('exposes all 4 real-world perfumes in the catalog and resolves bilingual metadata', () => {
    const bus = new EventBus<GameEvents>();
    const cm = new CollectibleManager(bus);
    const collection = new PerfumeCollection(cm, bus);

    expect(PERFUME_CATALOG.every((p) => p.obtainableInBuild)).toBe(true);
    expect(collection.getEntries().map((e) => e.name)).toEqual([
      'Jean Paul Gaultier Le Male Le Parfum',
      'Armani Code Parfum',
      'Dior Sauvage EDP',
      'Jimmy Choo Man EDT',
    ]);

    i18n.setLanguage('he');
    const heEntries = collection.getEntries();
    expect(heEntries).toHaveLength(4);
    expect(heEntries[0].rarityLabel.length).toBeGreaterThan(0);
    expect(heEntries[0].acquisitionSource).toContain('משימה 05');
  });

  it('unlocks all 4 perfumes without duplicates and keeps non-perfume rewards separate', () => {
    const bus = new EventBus<GameEvents>();
    const cm = new CollectibleManager(bus);
    const collection = new PerfumeCollection(cm, bus);

    // M02–M04 non-perfume rewards do not increment perfume count
    cm.grantRewardItem('golden-wrench', 'Golden Flat-Pack Wrench');
    cm.grantRewardItem('watch-rolex-daytona', 'Rolex Cosmograph Daytona (Gold Ref. 126508)');
    cm.grantRewardItem('warehouse-hero-badge', 'Warehouse Hero Badge');
    expect(collection.getProgress()).toEqual({ collected: 0, total: 4 });

    const ids = [
      'perfume-jpg-le-male',
      'perfume-armani-code',
      'perfume-dior-sauvage',
      'perfume-jimmy-choo-man',
    ];

    ids.forEach((id, idx) => {
      expect(collection.unlockPerfume(id)).toBe(true);
      expect(collection.unlockPerfume(id)).toBe(false);
      expect(collection.hasPerfume(id)).toBe(true);
      expect(collection.getProgress()).toEqual({ collected: idx + 1, total: 4 });
    });

    expect(collection.getEntries().every((e) => e.collected)).toBe(true);
  });

  it('builds 4 distinct low-poly 3D real-world perfume bottles with labels and sparkles', () => {
    const jpg = createJpgLeMaleBottle();
    expect(jpg.group.name).toBe('JpgLeMaleBottle');
    expect(jpg.sparkles).toHaveLength(4);

    const variants: PerfumeVariant[] = [
      'jpg-le-male',
      'armani-code',
      'dior-sauvage',
      'jimmy-choo-man',
    ];
    for (const variant of variants) {
      const rig = createPerfumeBottle(variant);
      expect(rig.sparkles).toHaveLength(4);
      expect(rig.group.children.length).toBeGreaterThanOrEqual(7);
    }
  });

  it('triggers Kfir arsim joke on Dior Sauvage and Lior joke on Jimmy Choo Man pickups', () => {
    const bus = new EventBus<GameEvents>();
    const cm = new CollectibleManager(bus);
    const perfumes = new PerfumeCollection(cm, bus);
    const watches = new WatchCollection(cm, bus);
    const interactions = new InteractionManager(bus);
    const dialogue = new DialogueManager(bus);
    const palette = createPalette(new AssetManager());
    const onJimmyChooCollected = vi.fn();

    new WorldCollectionProps(palette, interactions, cm, perfumes, watches, bus, {
      dialogue,
      onJimmyChooCollected,
    });

    const diorPos = WORLD_ANCHORS.restaurant.diorSauvage.position.clone();
    interactions.update(0.25, diorPos, 0, true);
    expect(interactions.interact()).toBe(true);
    expect(perfumes.hasPerfume('perfume-dior-sauvage')).toBe(true);
    expect(dialogue.isActive()).toBe(true);
    i18n.setLanguage('he');
    expect(dialogue.getCurrentLine()?.text).toContain('ערסים');
    dialogue.close();
    i18n.setLanguage('en');

    const jimmyPos = WORLD_ANCHORS.warehouse.jimmyChooMan.position.clone();
    interactions.update(0.25, jimmyPos, 0, true);
    expect(interactions.interact()).toBe(true);
    expect(perfumes.hasPerfume('perfume-jimmy-choo-man')).toBe(true);
    expect(onJimmyChooCollected).toHaveBeenCalledTimes(1);
    expect(dialogue.getCurrentLine()?.text).toContain('Lior');
    dialogue.close();
  });
});
