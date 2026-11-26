import { afterEach, describe, expect, it } from 'vitest';
import { createWatchModel, type WatchVisualRarity } from '../src/assets/collectibles/WatchModel';
import { CollectibleManager } from '../src/collectibles/CollectibleManager';
import { WATCH_CATALOG, WatchCollection } from '../src/collectibles/WatchCollection';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { SLOW_MO_CONFIG, TimeScaleController } from '../src/game/TimeScaleController';
import { i18n } from '../src/i18n/LocalizationManager';

describe('Phase 6.2 Watch Collection (4/4) & Legendary Watch Slow-Motion', () => {
  afterEach(() => {
    i18n.setLanguage('en');
  });

  it('tracks all 4 watch tiers on top of CollectibleManager without duplicate counting', () => {
    const bus = new EventBus<GameEvents>();
    const cm = new CollectibleManager(bus);
    const watches = new WatchCollection(cm, bus);

    expect(WATCH_CATALOG.map((w) => w.rarity)).toEqual(['Common', 'Rare', 'Epic', 'Legendary']);
    expect(watches.getProgress()).toEqual({ collected: 0, total: 4 });
    expect(watches.hasLegendaryWatch()).toBe(false);

    // Non-watch reward must not affect watch count
    cm.grantRewardItem('perfume-midnight-noir', 'Midnight Noir');
    expect(watches.getProgress()).toEqual({ collected: 0, total: 4 });

    // M03 Silver Guard Watch granted via reward path integrates cleanly
    cm.grantRewardItem('silver-guard-watch', 'Silver Guard Watch');
    expect(watches.hasWatch('silver-guard-watch')).toBe(true);
    expect(watches.unlockWatch('silver-guard-watch')).toBe(false);
    expect(watches.getProgress()).toEqual({ collected: 1, total: 4 });
    expect(watches.hasLegendaryWatch()).toBe(false);

    // Classic, Epic, Legendary watches unlock cleanly
    expect(watches.unlockWatch('watch-classic')).toBe(true);
    expect(watches.unlockWatch('watch-chronograph-pro')).toBe(true);
    expect(watches.hasLegendaryWatch()).toBe(false);

    expect(watches.unlockWatch('watch-chrono-legend')).toBe(true);
    expect(watches.unlockWatch('watch-chrono-legend')).toBe(false);
    expect(watches.hasLegendaryWatch()).toBe(true);
    expect(watches.getProgress()).toEqual({ collected: 4, total: 4 });

    // Localized Hebrew watch labels
    i18n.setLanguage('he');
    const heEntries = watches.getEntries();
    expect(heEntries[0].name).toBe('שעון יד קלאסי');
    expect(heEntries[3].rarityLabel).toBe('אגדי');
  });

  it('builds 4 distinct detailed low-poly 3D wristwatches with cases, dials, crystals, crowns, and straps', () => {
    const rarities: WatchVisualRarity[] = ['Common', 'Rare', 'Epic', 'Legendary'];
    const childCounts: number[] = [];
    for (const rarity of rarities) {
      const rig = createWatchModel(rarity);
      expect(rig.group.name).toBe(`WatchModel_${rarity}`);
      expect(rig.group.getObjectByName('WatchAssembly')).toBeDefined();
      expect(rig.group.getObjectByName('WatchStrapLoop')).toBeDefined();
      expect(rig.group.getObjectByName('WatchCase')).toBeDefined();
      expect(rig.group.getObjectByName('WatchDial')).toBeDefined();
      expect(rig.group.getObjectByName('WatchCrown')).toBeDefined();
      expect(rig.group.getObjectByName('WatchCrystal')).toBeDefined();
      expect(rig.group.getObjectByName('WatchClasp')).toBeDefined();
      childCounts.push(rig.group.getObjectByName('WatchAssembly')!.children.length);
      if (rarity === 'Epic' || rarity === 'Legendary') {
        expect(rig.sparkles).toHaveLength(4);
      } else {
        expect(rig.sparkles).toHaveLength(0);
      }
    }
    // Verify Legendary Watch contains visible Tourbillon wheel complication & physically connected strap links
    const legRig = createWatchModel('Legendary');
    expect(legRig.group.getObjectByName('TourbillonWheel')).toBeDefined();
    expect(new Set(childCounts).size).toBeGreaterThanOrEqual(3);

    for (const rarity of rarities) {
      const rig = createWatchModel(rarity);
      const strap = rig.group.getObjectByName('WatchStrapLoop')!;
      const links = strap.children.filter((c) => c.name.startsWith('WatchStrapLink_'));
      expect(links.length).toBeGreaterThanOrEqual(18);
      for (let i = 1; i < links.length; i++) {
        const prev = links[i - 1];
        const curr = links[i];
        const segLen = Number(curr.userData.segmentLength);
        expect(prev.position.distanceTo(curr.position)).toBeLessThan(segLen);
      }
    }
  });

  it('gates 4s Slow-Motion ability behind Legendary Watch and enforces cooldown cleanly', () => {
    const bus = new EventBus<GameEvents>();
    const ctrl = new TimeScaleController(bus);
    const notices: string[] = [];
    bus.on('slowmo:changed', ({ notice }) => {
      if (notice) notices.push(notice);
    });

    // Locked initially
    expect(ctrl.tryActivate()).toBe(false);
    expect(ctrl.isActive()).toBe(false);
    expect(ctrl.getWorldScale()).toBe(1.0);
    expect(notices.at(-1)).toContain('Legendary');

    // Unlock Legendary Watch -> activate slow-mo
    ctrl.setUnlocked(true);
    expect(ctrl.tryActivate()).toBe(true);
    expect(ctrl.isActive()).toBe(true);
    expect(ctrl.getWorldScale()).toBe(SLOW_MO_CONFIG.worldScale);
    expect(ctrl.getPlayerScale()).toBe(SLOW_MO_CONFIG.playerScale);

    // Advances for 4.0 seconds then enters cooldown
    ctrl.update(2.0);
    expect(ctrl.isActive()).toBe(true);
    expect(ctrl.getRemainingSec()).toBeCloseTo(2.0);
    expect(ctrl.tryActivate()).toBe(false);

    ctrl.update(2.0);
    expect(ctrl.isActive()).toBe(false);
    expect(ctrl.getWorldScale()).toBe(1.0);
    expect(ctrl.getPlayerScale()).toBe(1.0);
    expect(ctrl.getCooldownSec()).toBe(SLOW_MO_CONFIG.cooldownSec);

    // Blocked during cooldown
    expect(ctrl.tryActivate()).toBe(false);
    expect(notices.at(-1)).toContain('recharging');

    // Finishes cooldown and allows clean re-activation
    ctrl.update(SLOW_MO_CONFIG.cooldownSec);
    expect(ctrl.getCooldownSec()).toBe(0);
    expect(ctrl.tryActivate()).toBe(true);
    expect(ctrl.isActive()).toBe(true);
  });
});
