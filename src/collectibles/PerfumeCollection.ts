import type { PerfumeVariant } from '../assets/collectibles/PerfumeBottleModel';
import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { CollectibleManager } from './CollectibleManager';

export type PerfumeRarity = 'Rare' | 'Signature Rare' | 'Epic' | 'Legendary';

export interface PerfumeDefinition {
  readonly id: string;
  readonly modelId: PerfumeVariant;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly sourceKey: string;
  readonly flavorKey: string;
  readonly rarity: PerfumeRarity;
  readonly obtainableInBuild: boolean;
  readonly accentColor: string;
}

export interface PerfumeEntry extends PerfumeDefinition {
  readonly name: string;
  readonly description: string;
  readonly acquisitionSource: string;
  readonly flavorText: string;
  readonly rarityLabel: string;
  readonly collected: boolean;
}

export const PERFUME_CATALOG: readonly PerfumeDefinition[] = [
  {
    id: 'perfume-jpg-le-male',
    modelId: 'jpg-le-male',
    nameKey: 'item.perfume-jpg-le-male',
    descriptionKey: 'perfume.jpg-le-male.desc',
    sourceKey: 'perfume.jpg-le-male.source',
    flavorKey: 'perfume.jpg-le-male.flavor',
    rarity: 'Signature Rare',
    obtainableInBuild: true,
    accentColor: '#e6be53',
  },
  {
    id: 'perfume-armani-code',
    modelId: 'armani-code',
    nameKey: 'item.perfume-armani-code',
    descriptionKey: 'perfume.armani-code.desc',
    sourceKey: 'perfume.armani-code.source',
    flavorKey: 'perfume.armani-code.flavor',
    rarity: 'Legendary',
    obtainableInBuild: true,
    accentColor: '#34d399',
  },
  {
    id: 'perfume-dior-sauvage',
    modelId: 'dior-sauvage',
    nameKey: 'item.perfume-dior-sauvage',
    descriptionKey: 'perfume.dior-sauvage.desc',
    sourceKey: 'perfume.dior-sauvage.source',
    flavorKey: 'perfume.dior-sauvage.flavor',
    rarity: 'Epic',
    obtainableInBuild: true,
    accentColor: '#60a5fa',
  },
  {
    id: 'perfume-jimmy-choo-man',
    modelId: 'jimmy-choo-man',
    nameKey: 'item.perfume-jimmy-choo-man',
    descriptionKey: 'perfume.jimmy-choo-man.desc',
    sourceKey: 'perfume.jimmy-choo-man.source',
    flavorKey: 'perfume.jimmy-choo-man.flavor',
    rarity: 'Rare',
    obtainableInBuild: true,
    accentColor: '#94a3b8',
  },
] as const;

/**
 * Real-world 4-bottle Perfume Collection built on CollectibleManager
 * (single source of truth for collected state, duplicate protection, and localization).
 */
export class PerfumeCollection {
  private readonly collectibles: CollectibleManager;
  private readonly eventBus?: EventBus<GameEvents>;

  constructor(collectibles: CollectibleManager, eventBus?: EventBus<GameEvents>) {
    this.collectibles = collectibles;
    this.eventBus = eventBus;
  }

  getEntries(): PerfumeEntry[] {
    return PERFUME_CATALOG.map((def) => ({
      ...def,
      name: i18n.t(def.nameKey),
      description: i18n.t(def.descriptionKey),
      acquisitionSource: i18n.t(def.sourceKey),
      flavorText: i18n.t(def.flavorKey),
      rarityLabel: i18n.t(`rarity.${def.rarity}`),
      collected: def.obtainableInBuild && this.collectibles.hasCollected(def.id),
    }));
  }

  hasPerfume(id: string): boolean {
    const def = PERFUME_CATALOG.find((p) => p.id === id);
    if (!def || !def.obtainableInBuild) return false;
    return this.collectibles.hasCollected(def.id);
  }

  unlockPerfume(id: string): boolean {
    const def = PERFUME_CATALOG.find((p) => p.id === id);
    if (!def || !def.obtainableInBuild) return false;
    if (this.collectibles.hasCollected(def.id)) return false;
    this.collectibles.grantRewardItem(def.id, i18n.t(def.nameKey));
    this.eventBus?.emit('collection:changed', {
      category: 'perfumes',
      ...this.getProgress(),
    });
    return true;
  }

  getProgress(): { collected: number; total: number } {
    const obtainable = PERFUME_CATALOG.filter((p) => p.obtainableInBuild);
    const collected = obtainable.filter((p) => this.collectibles.hasCollected(p.id)).length;
    return { collected, total: obtainable.length };
  }
}
