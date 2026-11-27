import type { GraphicsQuality } from '../config/graphicsPresets';
import type { LanguageCode } from '../i18n/translations';

export const SAVE_STORAGE_KEY = 'kfir-the-last-shift.save.v1';

/**
 * Persisted campaign snapshot. Everything the player keeps between sessions:
 * story progress, wallet, collection, and user preferences. Stored in
 * LocalStorage per the GAME_SPEC (no backend).
 */
export interface SaveData {
  version: 1;
  money: number;
  completedMissionIds: string[];
  collectibleIds: string[];
  graphicsQuality: GraphicsQuality;
  language: LanguageCode;
  savedAt: string;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const VALID_QUALITIES: readonly GraphicsQuality[] = ['low', 'medium', 'high'];
const VALID_LANGUAGES: readonly LanguageCode[] = ['en', 'he'];

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Loads, validates and writes the LocalStorage save file. The storage backend
 * is injectable so the whole flow is unit-testable outside the browser.
 */
export class SaveManager {
  private readonly storage?: KeyValueStorage;

  constructor(storage?: KeyValueStorage) {
    this.storage = storage;
  }

  private resolveStorage(): KeyValueStorage | null {
    if (this.storage) return this.storage;
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch {
      // Storage blocked (private mode etc.) — the game stays playable without saving.
    }
    return null;
  }

  load(): SaveData | null {
    const storage = this.resolveStorage();
    if (!storage) return null;

    let raw: string | null = null;
    try {
      raw = storage.getItem(SAVE_STORAGE_KEY);
    } catch {
      return null;
    }
    if (!raw) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (typeof parsed !== 'object' || parsed === null) return null;

    const candidate = parsed as Partial<SaveData>;
    if (candidate.version !== 1) return null;

    const graphicsQuality = VALID_QUALITIES.includes(candidate.graphicsQuality as GraphicsQuality)
      ? (candidate.graphicsQuality as GraphicsQuality)
      : 'medium';
    const language = VALID_LANGUAGES.includes(candidate.language as LanguageCode)
      ? (candidate.language as LanguageCode)
      : 'en';
    const money =
      typeof candidate.money === 'number' && Number.isFinite(candidate.money)
        ? Math.max(0, Math.floor(candidate.money))
        : 0;

    return {
      version: 1,
      money,
      completedMissionIds: sanitizeStringArray(candidate.completedMissionIds),
      collectibleIds: sanitizeStringArray(candidate.collectibleIds),
      graphicsQuality,
      language,
      savedAt: typeof candidate.savedAt === 'string' ? candidate.savedAt : '',
    };
  }

  save(data: Omit<SaveData, 'version' | 'savedAt'>): void {
    const storage = this.resolveStorage();
    if (!storage) return;

    const payload: SaveData = {
      version: 1,
      money: Math.max(0, Math.floor(data.money)),
      completedMissionIds: [...new Set(data.completedMissionIds)],
      collectibleIds: [...new Set(data.collectibleIds)],
      graphicsQuality: data.graphicsQuality,
      language: data.language,
      savedAt: new Date().toISOString(),
    };

    try {
      storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Quota or privacy-mode failures must never break gameplay.
    }
  }

  clear(): void {
    const storage = this.resolveStorage();
    if (!storage) return;
    try {
      storage.removeItem(SAVE_STORAGE_KEY);
    } catch {
      // Nothing to do — a failed clear behaves like a missing save.
    }
  }
}
