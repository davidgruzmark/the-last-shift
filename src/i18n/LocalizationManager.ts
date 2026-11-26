import type { EventBus, GameEvents } from '../core/EventBus';
import { TRANSLATIONS, type LanguageCode } from './translations';

const STORAGE_KEY = 'kfir_language';

type LanguageListener = (lang: LanguageCode) => void;

/**
 * Centralized bilingual localization manager supporting English ('en') and Hebrew ('he')
 * with automatic LTR/RTL document handling, English fallback, and localStorage persistence.
 */
export class LocalizationManager {
  private lang: LanguageCode = 'en';
  private eventBus?: EventBus<GameEvents>;
  private readonly listeners = new Set<LanguageListener>();

  constructor(initialLang?: LanguageCode) {
    if (initialLang) {
      this.lang = initialLang;
    } else {
      this.lang = this.loadPersistedLanguage();
    }
    this.syncDocumentDirection();
  }

  setEventBus(eventBus: EventBus<GameEvents>): void {
    this.eventBus = eventBus;
  }

  getLanguage(): LanguageCode {
    return this.lang;
  }

  getDirection(lang: LanguageCode = this.lang): 'ltr' | 'rtl' {
    return lang === 'he' ? 'rtl' : 'ltr';
  }

  isRtl(): boolean {
    return this.lang === 'he';
  }

  setLanguage(lang: LanguageCode): void {
    if (lang !== 'en' && lang !== 'he') return;
    const changed = this.lang !== lang;
    this.lang = lang;
    this.persistLanguage(lang);
    this.syncDocumentDirection();

    if (changed) {
      const dir = this.getDirection(lang);
      for (const listener of this.listeners) {
        listener(lang);
      }
      this.eventBus?.emit('language:changed', { lang, dir });
    }
  }

  onChange(listener: LanguageListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  t(key: string, params?: Record<string, string | number>): string {
    const activeTable = TRANSLATIONS[this.lang];
    const fallbackTable = TRANSLATIONS.en;
    let template = activeTable[key] ?? fallbackTable[key] ?? key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        template = template.split(`{${k}}`).join(String(v));
      }
    }
    return template;
  }

  private loadPersistedLanguage(): LanguageCode {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === 'en' || stored === 'he') {
          return stored;
        }
      }
    } catch {
      // Ignore storage restrictions in headless/private contexts
    }
    return 'en';
  }

  private persistLanguage(lang: LanguageCode): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, lang);
      }
    } catch {
      // Ignore storage restrictions
    }
  }

  private syncDocumentDirection(): void {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = this.lang;
      document.documentElement.dir = this.getDirection(this.lang);
    }
  }
}

export const i18n = new LocalizationManager();
