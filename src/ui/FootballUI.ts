import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { FootballMiniGame, FootballSnapshot } from '../minigames/FootballMiniGame';

function formatClock(totalSeconds: number): string {
  const sec = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * TV broadcast-style IKEA Cup football scoreboard, animated GOAL! banner,
 * kick/pass controls strip, and end-of-match / rematch overlay.
 */
export class FootballUI {
  private readonly container: HTMLElement;
  private readonly football: FootballMiniGame;
  private scoreboardEl!: HTMLElement;
  private kfirScoreEl!: HTMLElement;
  private oppScoreEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private hintEl!: HTMLElement;
  private goalBannerEl!: HTMLElement;
  private resultCardEl!: HTMLElement;
  private resultTitleEl!: HTMLElement;
  private resultSubEl!: HTMLElement;
  private rematchBtnEl!: HTMLButtonElement;
  private lastState?: FootballSnapshot;
  private unsubscribers: Array<() => void> = [];

  constructor(
    hudRoot: HTMLElement,
    eventBus: EventBus<GameEvents>,
    football: FootballMiniGame,
  ) {
    this.football = football;
    this.container = document.createElement('div');
    this.container.id = 'football-ui-layer';
    hudRoot.appendChild(this.container);

    this.render();

    this.unsubscribers.push(
      eventBus.on('football:stateChanged', (snap) => {
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

  private applyState(state: FootballSnapshot): void {
    this.lastState = state;
    const showHud = state.visible;
    this.scoreboardEl.classList.toggle('hidden', !showHud || state.mode !== 'match');
    this.hintEl.classList.toggle(
      'hidden',
      !showHud || state.phase === 'ended' || (!state.ballInRange && state.mode !== 'match'),
    );

    if (state.mode === 'match') {
      this.kfirScoreEl.textContent = String(state.kfirScore);
      this.oppScoreEl.textContent = String(state.opponentScore);
      this.timerEl.textContent = formatClock(state.timeRemaining);
    }

    const showGoal = state.mode === 'match' && state.phase === 'goal_pause';
    this.goalBannerEl.classList.toggle('hidden', !showGoal);
    if (showGoal) {
      this.goalBannerEl.textContent = i18n.t('football.goalBanner');
    }

    const showRetry =
      state.mode === 'match' &&
      state.phase === 'ended' &&
      state.winner !== 'kfir';
    this.resultCardEl.classList.toggle('hidden', !showRetry);
    if (showRetry) {
      this.resultTitleEl.textContent = i18n.t(
        state.winner === 'draw' ? 'football.resultDraw' : 'football.resultLoss',
      );
      this.resultSubEl.textContent = `${i18n.t('football.teamKfir')} ${state.kfirScore} - ${state.opponentScore} ${i18n.t('football.teamYossi')}`;
    }
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.container.remove();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="hud-panel football-scoreboard hidden" id="football-scoreboard">
        <span class="football-league-tag">${i18n.t('football.league')}</span>
        <div class="football-score-teams">
          <span class="football-team football-team-kfir">${i18n.t('football.teamKfir')}</span>
          <span class="football-score-num" id="football-score-kfir">0</span>
          <span class="football-score-sep">-</span>
          <span class="football-score-num" id="football-score-opp">0</span>
          <span class="football-team football-team-opp">${i18n.t('football.teamYossi')}</span>
        </div>
        <span class="football-timer" id="football-timer">01:00</span>
      </div>

      <div class="hud-panel football-goal-banner hidden" id="football-goal-banner"></div>

      <div class="hud-panel football-controls-pill hidden" id="football-controls-pill">
        <span><span class="hud-key">F</span> ${i18n.t('hud.controls.kick')}</span>
        <span>·</span>
        <span><span class="hud-key">G</span> ${i18n.t('hud.controls.pass')}</span>
      </div>

      <div class="hud-panel football-result-card hidden" id="football-result-card">
        <div class="football-result-title" id="football-result-title"></div>
        <div class="football-result-sub" id="football-result-sub"></div>
        <button type="button" class="hud-btn active" id="btn-football-rematch">${i18n.t('football.rematch')}</button>
      </div>
    `;

    this.scoreboardEl = this.container.querySelector('#football-scoreboard')!;
    this.kfirScoreEl = this.container.querySelector('#football-score-kfir')!;
    this.oppScoreEl = this.container.querySelector('#football-score-opp')!;
    this.timerEl = this.container.querySelector('#football-timer')!;
    this.hintEl = this.container.querySelector('#football-controls-pill')!;
    this.goalBannerEl = this.container.querySelector('#football-goal-banner')!;
    this.resultCardEl = this.container.querySelector('#football-result-card')!;
    this.resultTitleEl = this.container.querySelector('#football-result-title')!;
    this.resultSubEl = this.container.querySelector('#football-result-sub')!;
    this.rematchBtnEl = this.container.querySelector('#btn-football-rematch')!;

    this.rematchBtnEl.addEventListener('click', () => {
      this.football.restartMatch();
    });
  }
}
