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
    id: 'watch-gshock',
    nameKey: 'item.watch-gshock',
    descriptionKey: 'watch.gshock.desc',
    sourceKey: 'watch.gshock.source',
    flavorKey: 'watch.gshock.flavor',
    rarity: 'Common',
    obtainableInBuild: true,
    accentColor: '#94a3b8',
  },
  {
    id: 'watch-omega-seamaster',
    nameKey: 'item.watch-omega-seamaster',
    descriptionKey: 'watch.omega-seamaster.desc',
    sourceKey: 'watch.omega-seamaster.source',
    flavorKey: 'watch.omega-seamaster.flavor',
    rarity: 'Rare',
    obtainableInBuild: true,
    accentColor: '#60a5fa',
  },
  {
    id: 'watch-tag-carrera',
    nameKey: 'item.watch-tag-carrera',
    descriptionKey: 'watch.tag-carrera.desc',
    sourceKey: 'watch.tag-carrera.source',
    flavorKey: 'watch.tag-carrera.flavor',
    rarity: 'Epic',
    obtainableInBuild: true,
    accentColor: '#c084fc',
  },
  {
    id: 'watch-rolex-daytona',
    nameKey: 'item.watch-rolex-daytona',
    descriptionKey: 'watch.rolex-daytona.desc',
    sourceKey: 'watch.rolex-daytona.source',
    flavorKey: 'watch.rolex-daytona.flavor',
    rarity: 'Legendary',
    obtainableInBuild: true,
    accentColor: '#ffda1a',
    grantsSlowMotion: true,
  },
] as const;

/**
 * Real-world 4-watch Collection wrapping CollectibleManager so Casio G-Shock,
 * Omega Seamaster Diver 300M, TAG Heuer Carrera, and M03 Gold Rolex Daytona (Slow-Mo) stay unified.
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
    return WATCH_CATALOG.some(
      (w) => w.grantsSlowMotion && w.obtainableInBuild && this.collectibles.hasCollected(w.id),
    );
  }

  unlockWatch(id: string): boolean {
    const def = WATCH_CATALOG.find((w) => w.id === id);
    if (!def || !def.obtainableInBuild) return false;
    if (this.collectibles.hasCollected(def.id)) return false;
    this.collectibles.grantRewardItem(def.id, i18n.t(def.nameKey));
    this.eventBus?.emit('collection:changed', {
      category: 'watches',
      ...this.getProgress(),
    });
    return true;
  }

  getProgress(): { collected: number; total: number } {
    const obtainable = WATCH_CATALOG.filter((w) => w.obtainableInBuild);
    const collected = obtainable.filter((w) => this.collectibles.hasCollected(w.id)).length;
    return { collected, total: obtainable.length };
  }
}
