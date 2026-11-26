import { GRAPHICS_PRESETS, type GraphicsQuality } from '../config/graphicsPresets';
import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { LanguageCode } from '../i18n/translations';

/**
 * IKEA-styled Settings modal supporting live language switching (English / עברית),
 * graphics quality selection, and fullscreen toggling without resetting game state.
 */
export class SettingsUI {
  private readonly container: HTMLElement;
  private readonly modalEl: HTMLElement;
  private readonly eventBus: EventBus<GameEvents>;
  private readonly onStateChange: () => void;

  private open = false;
  private activeQuality: GraphicsQuality;
  private unsubscribers: Array<() => void> = [];

  constructor(
    hudRoot: HTMLElement,
    eventBus: EventBus<GameEvents>,
    initialQuality: GraphicsQuality,
    onStateChange: () => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'settings-ui-layer';
    hudRoot.appendChild(this.container);

    this.eventBus = eventBus;
    this.activeQuality = initialQuality;
    this.onStateChange = onStateChange;

    this.render();
    this.modalEl = this.container.querySelector('#settings-modal')!;
    this.unsubscribers.push(
      i18n.onChange(() => {
        this.render();
      }),
      this.eventBus.on('graphics:changed', ({ quality }) => {
        this.activeQuality = quality;
        this.syncButtons();
      }),
    );
  }

  isOpen(): boolean {
    return this.open;
  }

  openModal(): void {
    this.open = true;
    this.modalEl.classList.remove('hidden');
    this.syncButtons();
    this.onStateChange();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.modalEl.classList.add('hidden');
    this.onStateChange();
  }

  toggle(): boolean {
    if (this.open) {
      this.close();
    } else {
      this.openModal();
    }
    return this.open;
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.container.remove();
  }

  private render(): void {
    const wasOpen = this.open;
    const isFullscreen =
      typeof document !== 'undefined' && Boolean(document.fullscreenElement);

    this.container.innerHTML = `
      <div class="modal-backdrop ${wasOpen ? '' : 'hidden'}" id="settings-modal" role="dialog" aria-label="${i18n.t('settings.title')}">
        <div class="hud-panel settings-card">
          <div class="collection-header">
            <div>
              <div class="collection-tag">${i18n.t('settings.tag')}</div>
              <h2 class="collection-title">${i18n.t('settings.title')}</h2>
            </div>
            <button type="button" class="hud-btn" id="btn-settings-close">${i18n.t('settings.close')}</button>
          </div>

          <div class="settings-section">
            <div class="settings-label">${i18n.t('settings.languageTitle')}</div>
            <p class="settings-desc">${i18n.t('settings.languageDesc')}</p>
            <div class="settings-btn-row">
              <button type="button" class="hud-btn settings-choice-btn" id="btn-lang-en" data-lang="en">
                ${i18n.t('settings.lang.en')}
              </button>
              <button type="button" class="hud-btn settings-choice-btn" id="btn-lang-he" data-lang="he">
                ${i18n.t('settings.lang.he')}
              </button>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-label">${i18n.t('settings.graphicsTitle')}</div>
            <div class="settings-btn-row">
              ${(['low', 'medium', 'high'] as const)
                .map(
                  (q) => `
                  <button type="button" class="hud-btn settings-choice-btn" data-settings-quality="${q}">
                    ${i18n.t(`settings.graphics.${q}`)}
                  </button>
                `,
                )
                .join('')}
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-label">${i18n.t('settings.displayTitle')}</div>
            <div class="settings-btn-row">
              <button type="button" class="hud-btn settings-choice-btn" id="btn-settings-fullscreen">
                ${isFullscreen ? i18n.t('hud.btn.exitFullscreen') : i18n.t('hud.btn.fullscreen')}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Rebind cached root reference after re-render
    (this as unknown as { modalEl: HTMLElement }).modalEl =
      this.container.querySelector('#settings-modal')!;

    this.container.querySelector('#btn-settings-close')!.addEventListener('click', () => {
      this.close();
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang as LanguageCode;
        i18n.setLanguage(lang);
      });
    });

    this.container
      .querySelectorAll<HTMLButtonElement>('[data-settings-quality]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const quality = btn.dataset.settingsQuality as GraphicsQuality;
          if (GRAPHICS_PRESETS[quality]) {
            this.activeQuality = quality;
            this.eventBus.emit('graphics:changed', { quality });
            this.syncButtons();
          }
        });
      });

    this.container
      .querySelector('#btn-settings-fullscreen')!
      .addEventListener('click', () => {
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          void document.exitFullscreen?.().catch(() => {});
        }
      });

    this.syncButtons();
  }

  private syncButtons(): void {
    const activeLang = i18n.getLanguage();
    this.container.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === activeLang);
    });
    this.container
      .querySelectorAll<HTMLButtonElement>('[data-settings-quality]')
      .forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.settingsQuality === this.activeQuality);
      });
  }
}
