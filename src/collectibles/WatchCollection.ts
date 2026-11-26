import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { CollectibleManager } from './CollectibleManager';

export type WatchRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export interface WatchDefinition {
  readonly id: string;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly sourceKey: string;
  readonly flavorKey: string;
  readonly rarity: WatchRarity;
  readonly obtainableInBuild: boolean;
  readonly accentColor: string;
  readonly grantsSlowMotion?: boolean;
}

export interface WatchEntry extends WatchDefinition {
  readonly name: string;
  readonly description: string;
  readonly acquisitionSource: string;
  readonly flavorText: string;
  readonly rarityLabel: string;
  readonly collected: boolean;
}

export const WATCH_CATALOG: readonly WatchDefinition[] = [
  {
    id: 'watch-classic',
    nameKey: 'item.watch-classic',
    descriptionKey: 'watch.classic.desc',
    sourceKey: 'watch.classic.source',
    flavorKey: 'watch.classic.flavor',
    rarity: 'Common',
    obtainableInBuild: true,
    accentColor: '#94a3b8',
  },
  {
    id: 'silver-guard-watch',
    nameKey: 'item.silver-guard-watch',
    descriptionKey: 'watch.silver-guard.desc',
    sourceKey: 'watch.silver-guard.source',
    flavorKey: 'watch.silver-guard.flavor',
    rarity: 'Rare',
    obtainableInBuild: true,
    accentColor: '#60a5fa',
  },
  {
    id: 'watch-chronograph-pro',
    nameKey: 'item.watch-chronograph-pro',
    descriptionKey: 'watch.chrono-pro.desc',
    sourceKey: 'watch.chrono-pro.source',
    flavorKey: 'watch.chrono-pro.flavor',
    rarity: 'Epic',
    obtainableInBuild: true,
    accentColor: '#c084fc',
  },
  {
    id: 'watch-chrono-legend',
    nameKey: 'item.watch-chrono-legend',
    descriptionKey: 'watch.chrono-legend.desc',
    sourceKey: 'watch.chrono-legend.source',
    flavorKey: 'watch.chrono-legend.flavor',
    rarity: 'Legendary',
    obtainableInBuild: true,
    accentColor: '#ffda1a',
    grantsSlowMotion: true,
  },
] as const;

/**
 * Reusable Watch Collection wrapping CollectibleManager so ambient watches,
 * mission watches (M03 Silver Guard Watch), and Legendary Slow-Mo stay unified.
 */
export class WatchCollection {
  private readonly collectibles: CollectibleManager;
  private readonly eventBus?: EventBus<GameEvents>;

  constructor(collectibles: CollectibleManager, eventBus?: EventBus<GameEvents>) {
    this.collectibles = collectibles;
    this.eventBus = eventBus;
  }

  getEntries(): WatchEntry[] {
    return WATCH_CATALOG.map((def) => ({
      ...def,
      name: i18n.t(def.nameKey),
      description: i18n.t(def.descriptionKey),
      acquisitionSource: i18n.t(def.sourceKey),
      flavorText: i18n.t(def.flavorKey),
      rarityLabel: i18n.t(`rarity.${def.rarity}`),
      collected: def.obtainableInBuild && this.collectibles.hasCollected(def.id),
    }));
  }

  hasWatch(id: string): boolean {
    const def = WATCH_CATALOG.find((w) => w.id === id);
    if (!def || !def.obtainableInBuild) return false;
    return this.collectibles.hasCollected(def.id);
  }

  hasLegendaryWatch(): boolean {
    return WATCH_CATALOG.some((w) => w.grantsSlowMotion && this.hasWatch(w.id));
  }

  unlockWatch(id: string): boolean {
    const def = WATCH_CATALOG.find((w) => w.id === id);
    if (!def || !def.obtainableInBuild) return false;
    if (this.collectibles.hasCollected(def.id)) return false;

    this.collectibles.grantRewardItem(def.id, i18n.t(def.nameKey));
    const progress = this.getProgress();
    this.eventBus?.emit('collection:changed', progress);
    return true;
  }

  getProgress(): { collected: number; total: number } {
    const entries = this.getEntries();
    return {
      collected: entries.filter((e) => e.collected).length,
      total: entries.length,
    };
  }
}
