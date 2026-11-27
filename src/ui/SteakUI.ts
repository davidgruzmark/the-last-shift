import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import { STEAK_ZONES, type SteakMiniGame, type SteakSnapshot } from '../minigames/SteakMiniGame';

/**
 * Mission 07 cooking overlay: sizzling pan card, doneness gauge with the
 * target grade highlighted, FLIP & SERVE action, and result/retry card.
 * Renders purely from 'steak:stateChanged' snapshots, mirroring FootballUI.
 */
export class SteakUI {
  private readonly container: HTMLElement;
  private readonly steak: SteakMiniGame;
  private modalEl!: HTMLElement;
  private gaugeFillEl!: HTMLElement;
  private gaugeNeedleEl!: HTMLElement;
  private zoneLabelEl!: HTMLElement;
  private targetLabelEl!: HTMLElement;
  private flipBtnEl!: HTMLButtonElement;
  private resultCardEl!: HTMLElement;
  private resultTitleEl!: HTMLElement;
  private resultSubEl!: HTMLElement;
  private retryBtnEl!: HTMLButtonElement;
  private closeBtnEl!: HTMLButtonElement;
  private lastState?: SteakSnapshot;
  private readonly unsubscribers: Array<() => void> = [];

  constructor(hudRoot: HTMLElement, eventBus: EventBus<GameEvents>, steak: SteakMiniGame) {
    this.steak = steak;
    this.container = document.createElement('div');
    this.container.id = 'steak-ui-layer';
    hudRoot.appendChild(this.container);

    this.render();

    this.unsubscribers.push(
      eventBus.on('steak:stateChanged', (snap) => {
        this.applyState(snap);
      }),
      i18n.onChange(() => {
        this.render();
        if (this.lastState) {
          this.applyState(this.lastState);
        }
      }),
    );
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.container.remove();
  }

  private render(): void {
    const zoneStops = STEAK_ZONES.map(
      ({ zone, min, max }) =>
        `<div class="steak-gauge-zone steak-zone-${zone}" style="left:${min}%;width:${max - min}%"></div>`,
    ).join('');

    this.container.innerHTML = `
      <div class="modal-backdrop hidden" id="steak-modal" role="dialog" aria-label="${i18n.t('steak.title')}">
        <div class="hud-panel steak-card">
          <div class="collection-header">
            <div>
              <div class="collection-tag">${i18n.t('steak.tag')}</div>
              <h2 class="collection-title">${i18n.t('steak.title')}</h2>
            </div>
          </div>

          <div class="steak-target-line" id="steak-target"></div>

          <div class="steak-gauge" aria-hidden="true">
            ${zoneStops}
            <div class="steak-gauge-fill" id="steak-gauge-fill"></div>
            <div class="steak-gauge-needle" id="steak-gauge-needle"></div>
          </div>
          <div class="steak-zone-label" id="steak-zone-label"></div>

          <div class="steak-actions">
            <button type="button" class="hud-btn steak-flip-btn" id="steak-flip-btn">
              ${i18n.t('steak.flipServe')}
            </button>
          </div>

          <div class="steak-result-card hidden" id="steak-result-card">
            <div class="steak-result-title" id="steak-result-title"></div>
            <div class="steak-result-sub" id="steak-result-sub"></div>
            <div class="steak-actions">
              <button type="button" class="hud-btn" id="steak-retry-btn">${i18n.t('steak.retry')}</button>
              <button type="button" class="hud-btn hidden" id="steak-close-btn">${i18n.t('steak.close')}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.modalEl = this.container.querySelector('#steak-modal')!;
    this.gaugeFillEl = this.container.querySelector('#steak-gauge-fill')!;
    this.gaugeNeedleEl = this.container.querySelector('#steak-gauge-needle')!;
    this.zoneLabelEl = this.container.querySelector('#steak-zone-label')!;
    this.targetLabelEl = this.container.querySelector('#steak-target')!;
    this.flipBtnEl = this.container.querySelector('#steak-flip-btn')!;
    this.resultCardEl = this.container.querySelector('#steak-result-card')!;
    this.resultTitleEl = this.container.querySelector('#steak-result-title')!;
    this.resultSubEl = this.container.querySelector('#steak-result-sub')!;
    this.retryBtnEl = this.container.querySelector('#steak-retry-btn')!;
    this.closeBtnEl = this.container.querySelector('#steak-close-btn')!;

    this.flipBtnEl.addEventListener('click', () => this.steak.finishCooking());
    this.retryBtnEl.addEventListener('click', () => this.steak.startRound());
    this.closeBtnEl.addEventListener('click', () => this.steak.close());
  }

  private applyState(state: SteakSnapshot): void {
    this.lastState = state;
    this.modalEl.classList.toggle('hidden', !state.visible);
    if (!state.visible) return;

    this.targetLabelEl.textContent = i18n.t('steak.targetLine', {
      target: i18n.t(`steak.doneness.${state.targetDoneness}`),
    });

    const pct = Math.max(0, Math.min(100, state.doneness));
    this.gaugeFillEl.style.width = `${pct}%`;
    this.gaugeNeedleEl.style.left = `${pct}%`;
    this.zoneLabelEl.textContent = i18n.t(`steak.zone.${state.currentZone}`);

    const cooking = state.phase === 'cooking';
    this.flipBtnEl.disabled = !cooking;
    this.flipBtnEl.classList.toggle('hidden', !cooking);

    const showResult = state.phase === 'ended';
    this.resultCardEl.classList.toggle('hidden', !showResult);
    if (showResult && state.result) {
      const success = state.result === 'perfect' || state.result === 'good';
      this.resultTitleEl.textContent = i18n.t(`steak.result.${state.result}.title`);
      this.resultSubEl.textContent = i18n.t(`steak.result.${state.result}.sub`);
      this.resultCardEl.classList.toggle('steak-result-success', success);
      this.retryBtnEl.classList.toggle('hidden', success);
      this.closeBtnEl.classList.toggle('hidden', !success);
    }
  }
}
