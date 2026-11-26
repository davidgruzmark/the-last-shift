import { afterEach, describe, expect, it } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { LocalizationManager } from '../src/i18n/LocalizationManager';
import { TRANSLATIONS } from '../src/i18n/translations';

function installMemoryStorage(): void {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: mockStorage },
    configurable: true,
    writable: true,
  });
}

describe('Phase 6.2 LocalizationManager (English + Hebrew + RTL + Persistence)', () => {
  afterEach(() => {
    // Restore global window if needed cleanly
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('defaults to English LTR, interpolates params, and falls back to English for unknown keys', () => {
    const loc = new LocalizationManager('en');
    expect(loc.getLanguage()).toBe('en');
    expect(loc.getDirection()).toBe('ltr');
    expect(loc.isRtl()).toBe(false);

    expect(loc.t('hud.title')).toBe('KFIR: THE LAST SHIFT');
    expect(loc.t('mission.banner.started', { num: 3 })).toBe('MISSION 03 STARTED');
    expect(loc.t('non.existent.translation.key')).toBe('non.existent.translation.key');
  });

  it('maintains 100% key parity between English and Hebrew translation dictionaries', () => {
    const enKeys = Object.keys(TRANSLATIONS.en).sort();
    const heKeys = Object.keys(TRANSLATIONS.he).sort();
    expect(enKeys).toEqual(heKeys);
    expect(enKeys.length).toBeGreaterThanOrEqual(300);
  });

  it('switches immediately between English and Hebrew, updates direction, emits event, and persists to localStorage', () => {
    installMemoryStorage();
    const bus = new EventBus<GameEvents>();
    const loc = new LocalizationManager();
    loc.setEventBus(bus);

    const events: Array<{ lang: 'en' | 'he'; dir: 'ltr' | 'rtl' }> = [];
    bus.on('language:changed', (payload) => events.push(payload));

    expect(loc.getLanguage()).toBe('en');
    loc.setLanguage('he');

    expect(loc.getLanguage()).toBe('he');
    expect(loc.getDirection()).toBe('rtl');
    expect(loc.isRtl()).toBe(true);
    expect(loc.t('hud.title')).toBe('כפיר: המשמרת האחרונה');
    expect(events).toEqual([{ lang: 'he', dir: 'rtl' }]);

    // Fresh instance loads persisted Hebrew automatically
    const reloaded = new LocalizationManager();
    expect(reloaded.getLanguage()).toBe('he');
    expect(reloaded.getDirection()).toBe('rtl');

    // Switching back to English works immediately and persists
    reloaded.setLanguage('en');
    expect(reloaded.getLanguage()).toBe('en');
    expect(reloaded.getDirection()).toBe('ltr');
    const afterRestore = new LocalizationManager();
    expect(afterRestore.getLanguage()).toBe('en');
  });
});
