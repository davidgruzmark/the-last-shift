import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { MissionManager } from '../missions/MissionManager';
import type { ScreenNavState } from '../missions/ObjectiveMarker';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Renders the Active Mission HUD tracker, animated mission notifications,
 * off-screen directional navigation pill, and Mission Completion modal.
 */
export class MissionUI {
  private readonly container: HTMLElement;
  private readonly eventBus: EventBus<GameEvents>;
  private readonly missions: MissionManager;

  private trackerEl!: HTMLElement;
  private missionBadgeEl!: HTMLElement;
  private missionTitleEl!: HTMLElement;
  private objectiveTextEl!: HTMLElement;
  private moneyBadgeEl!: HTMLElement;
  private bannerEl!: HTMLElement;
  private navIndicatorEl!: HTMLElement;
  private completionModalEl!: HTMLElement;
  private completionTitleEl!: HTMLElement;
  private completionMsgEl!: HTMLElement;
  private completionRewardsEl!: HTMLElement;
  private bannerTimer = 0;
  private suppressObjectiveBanners = false;
  private lastModalPayload: GameEvents['mission:completionModal'] | null = null;
  private unsubscribers: Array<() => void> = [];

  constructor(hudRoot: HTMLElement, eventBus: EventBus<GameEvents>, missions: MissionManager) {
    this.container = document.createElement('div');
    this.container.id = 'mission-ui-layer';
    hudRoot.appendChild(this.container);

    this.eventBus = eventBus;
    this.missions = missions;

    this.render();
    this.bindEvents();
  }

  updateNavigation(nav: ScreenNavState): void {
    if (!nav.visible) {
      this.navIndicatorEl.classList.add('hidden');
      return;
    }
    this.navIndicatorEl.classList.remove('hidden');
    this.navIndicatorEl.style.left = `${nav.x}px`;
    this.navIndicatorEl.style.top = `${nav.y}px`;
    const deg = (nav.angleRad * 180) / Math.PI;
    const arrowEl = this.navIndicatorEl.querySelector<HTMLElement>('.nav-arrow')!;
    const distEl = this.navIndicatorEl.querySelector<HTMLElement>('.nav-dist')!;
    arrowEl.style.transform = `rotate(${deg}deg)`;
    distEl.textContent = `${Math.round(nav.distanceMeters)}m`;
  }

  dispose(): void {
    window.clearTimeout(this.bannerTimer);
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.container.remove();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="hud-panel mission-tracker" id="mission-tracker">
        <div class="mission-tracker-top">
          <span class="mission-num-badge" id="mission-num-badge">M01</span>
          <span class="mission-tracker-title" id="mission-tracker-title">ANOTHER DAY AT IKEA</span>
          <span class="mission-money-badge" id="mission-money-badge">$0</span>
        </div>
        <div class="mission-objective-line" id="mission-objective-line">Loading shift...</div>
      </div>

      <div class="hud-panel mission-banner hidden" id="mission-banner"></div>

      <div class="hud-panel mission-nav-indicator hidden" id="mission-nav-indicator">
        <span class="nav-arrow">➤</span>
        <span class="nav-dist">0m</span>
      </div>

      <div class="modal-backdrop hidden" id="mission-completion-modal" role="dialog" aria-label="${escapeHtml(i18n.t('mission.modal.tag'))}">
        <div class="hud-panel mission-complete-card">
          <div class="mission-complete-tag" id="mission-complete-tag">${escapeHtml(i18n.t('mission.modal.tag'))}</div>
          <h2 class="mission-complete-title" id="mission-complete-title"></h2>
          <p class="mission-complete-msg" id="mission-complete-msg"></p>
          <div class="mission-complete-rewards" id="mission-complete-rewards"></div>
          <button type="button" class="hud-btn active mission-continue-btn" id="btn-mission-continue">
            ${escapeHtml(i18n.t('mission.modal.continue'))}
          </button>
        </div>
      </div>
    `;

    this.trackerEl = this.container.querySelector('#mission-tracker')!;
    this.missionBadgeEl = this.container.querySelector('#mission-num-badge')!;
    this.missionTitleEl = this.container.querySelector('#mission-tracker-title')!;
    this.objectiveTextEl = this.container.querySelector('#mission-objective-line')!;
    this.moneyBadgeEl = this.container.querySelector('#mission-money-badge')!;
    this.bannerEl = this.container.querySelector('#mission-banner')!;
    this.navIndicatorEl = this.container.querySelector('#mission-nav-indicator')!;
    this.completionModalEl = this.container.querySelector('#mission-completion-modal')!;
    this.completionTitleEl = this.container.querySelector('#mission-complete-title')!;
    this.completionMsgEl = this.container.querySelector('#mission-complete-msg')!;
    this.completionRewardsEl = this.container.querySelector('#mission-complete-rewards')!;

    this.container.querySelector('#btn-mission-continue')!.addEventListener('click', () => {
      this.missions.continueAfterCompletion();
    });
  }

  private bindEvents(): void {
    this.unsubscribers.push(
      this.eventBus.on('mission:stateChanged', (snap) => {
        this.trackerEl.classList.toggle('hidden', snap.status === 'idle');
        this.missionBadgeEl.textContent =
          snap.status === 'campaign_complete' ? i18n.t('mission.badge.done') : `M0${snap.missionNumber}`;
        this.missionTitleEl.textContent = snap.title;
        this.moneyBadgeEl.textContent = `$${snap.money}`;
        const suffix = snap.progressText ? ` (${snap.progressText})` : '';
        this.objectiveTextEl.textContent = `${snap.objectiveTitle}${suffix}`;
      }),
      this.eventBus.on('football:stateChanged', (snap) => {
        const matchActiveHud = snap.visible && snap.mode === 'match';
        this.suppressObjectiveBanners = matchActiveHud;
        if (matchActiveHud) {
          window.clearTimeout(this.bannerTimer);
          this.bannerEl.classList.add('hidden');
        }
      }),
      this.eventBus.on('mission:notification', ({ kind, title, subtitle }) => {
        if (
          this.suppressObjectiveBanners &&
          (kind === 'objective_done' || kind === 'new_objective')
        ) {
          return;
        }
        this.showBanner(kind, title, subtitle);
      }),
      this.eventBus.on('mission:completionModal', (payload) => {
        this.lastModalPayload = payload.open ? payload : null;
        this.completionModalEl.classList.toggle('hidden', !payload.open);
        if (payload.open) {
          this.container.querySelector('#mission-complete-tag')!.textContent =
            i18n.t('mission.modal.tag');
          this.completionTitleEl.textContent = payload.title;
          this.completionMsgEl.textContent = payload.message;
          const rewards: string[] = [`<span class="reward-pill">+$${payload.moneyReward}</span>`];
          if (payload.itemReward) {
            rewards.push(`<span class="reward-pill reward-item">${escapeHtml(payload.itemReward)}</span>`);
          }
          this.completionRewardsEl.innerHTML = rewards.join('');
          const btn = this.container.querySelector<HTMLButtonElement>('#btn-mission-continue')!;
          btn.textContent = payload.isCampaignEnd
            ? i18n.t('mission.modal.finish')
            : i18n.t('mission.modal.continue');
        }
      }),
      i18n.onChange(() => {
        const snap = this.missions.getSnapshot();
        this.missionBadgeEl.textContent =
          snap.status === 'campaign_complete' ? i18n.t('mission.badge.done') : `M0${snap.missionNumber}`;
        this.missionTitleEl.textContent = snap.title;
        const suffix = snap.progressText ? ` (${snap.progressText})` : '';
        this.objectiveTextEl.textContent = `${snap.objectiveTitle}${suffix}`;
        if (this.lastModalPayload?.open) {
          const m = this.missions.getActiveMission();
          this.container.querySelector('#mission-complete-tag')!.textContent =
            i18n.t('mission.modal.tag');
          if (m) {
            this.completionTitleEl.textContent = i18n.t('mission.modal.title', {
              num: m.number,
              title: i18n.t(m.titleKey ?? m.title),
            });
            this.completionMsgEl.textContent = i18n.t(
              m.completionMessageKey ?? m.completionMessage,
            );
            const btn = this.container.querySelector<HTMLButtonElement>('#btn-mission-continue')!;
            btn.textContent = this.lastModalPayload.isCampaignEnd
              ? i18n.t('mission.modal.finish')
              : i18n.t('mission.modal.continue');
          }
        }
      }),
    );
  }

  private showBanner(
    kind: 'started' | 'objective_done' | 'new_objective' | 'completed' | 'failed',
    title: string,
    subtitle: string,
  ): void {
    window.clearTimeout(this.bannerTimer);
    this.bannerEl.className = `hud-panel mission-banner mission-banner-${kind}`;
    this.bannerEl.innerHTML = `
      <div class="mission-banner-title">${escapeHtml(title)}</div>
      <div class="mission-banner-sub">${escapeHtml(subtitle)}</div>
    `;
    this.bannerEl.classList.remove('hidden');
    this.bannerTimer = window.setTimeout(() => {
      this.bannerEl.classList.add('hidden');
    }, 3400);
  }
}
