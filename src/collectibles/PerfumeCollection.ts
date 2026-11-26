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
    id: 'perfume-midnight-noir',
    modelId: 'midnight-noir',
    nameKey: 'item.perfume-midnight-noir',
    descriptionKey: 'perfume.midnight-noir.desc',
    sourceKey: 'perfume.midnight-noir.source',
    flavorKey: 'perfume.midnight-noir.flavor',
    rarity: 'Signature Rare',
    obtainableInBuild: true,
    accentColor: '#d4af37',
  },
  {
    id: 'perfume-ocean-king',
    modelId: 'ocean-king',
    nameKey: 'item.perfume-ocean-king',
    descriptionKey: 'perfume.ocean-king.desc',
    sourceKey: 'perfume.ocean-king.source',
    flavorKey: 'perfume.ocean-king.flavor',
    rarity: 'Rare',
    obtainableInBuild: true,
    accentColor: '#38bdf8',
  },
  {
    id: 'perfume-royal-essence',
    modelId: 'royal-essence',
    nameKey: 'item.perfume-royal-essence',
    descriptionKey: 'perfume.royal-essence.desc',
    sourceKey: 'perfume.royal-essence.source',
    flavorKey: 'perfume.royal-essence.flavor',
    rarity: 'Epic',
    obtainableInBuild: true,
    accentColor: '#a855f7',
  },
  {
    id: 'perfume-the-boss',
    modelId: 'the-boss',
    nameKey: 'item.perfume-the-boss',
    descriptionKey: 'perfume.the-boss.desc',
    sourceKey: 'perfume.the-boss.source',
    flavorKey: 'perfume.the-boss.flavor',
    rarity: 'Epic',
    obtainableInBuild: true,
    accentColor: '#f59e0b',
  },
  {
    id: 'perfume-kfir-signature',
    modelId: 'kfir-signature',
    nameKey: 'item.perfume-kfir-signature',
    descriptionKey: 'perfume.kfir-signature.desc',
    sourceKey: 'perfume.kfir-signature.source',
    flavorKey: 'perfume.kfir-signature.flavor',
    rarity: 'Legendary',
    obtainableInBuild: true,
    accentColor: '#2ecc71',
  },
] as const;

/**
 * Reusable perfume collection built directly on top of CollectibleManager
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
