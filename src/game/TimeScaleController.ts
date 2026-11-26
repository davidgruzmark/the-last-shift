import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';

export const SLOW_MO_CONFIG = {
  durationSec: 4.0,
  cooldownSec: 12.0,
  worldScale: 0.35,
  playerScale: 0.78,
} as const;

/**
 * Controls the Legendary Watch slow-motion ability using unscaled real-time
 * duration and cooldown timers while returning deterministic world/player scales.
 */
export class TimeScaleController {
  private readonly eventBus?: EventBus<GameEvents>;
  private unlocked = false;
  private remainingSec = 0;
  private cooldownSec = 0;

  constructor(eventBus?: EventBus<GameEvents>) {
    this.eventBus = eventBus;
  }

  setUnlocked(unlocked: boolean): void {
    if (this.unlocked !== unlocked) {
      this.unlocked = unlocked;
      this.emitState();
    }
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  isActive(): boolean {
    return this.remainingSec > 0;
  }

  getRemainingSec(): number {
    return this.remainingSec;
  }

  getCooldownSec(): number {
    return this.cooldownSec;
  }

  getWorldScale(): number {
    return this.remainingSec > 0 ? SLOW_MO_CONFIG.worldScale : 1.0;
  }

  getPlayerScale(): number {
    return this.remainingSec > 0 ? SLOW_MO_CONFIG.playerScale : 1.0;
  }

  tryActivate(): boolean {
    if (!this.unlocked) {
      this.emitState(i18n.t('slowmo.notice.locked'));
      return false;
    }
    if (this.remainingSec > 0) {
      return false;
    }
    if (this.cooldownSec > 0) {
      this.emitState(
        i18n.t('slowmo.notice.cooldown', { sec: Math.ceil(this.cooldownSec) }),
      );
      return false;
    }

    this.remainingSec = SLOW_MO_CONFIG.durationSec;
    this.cooldownSec = 0;
    this.emitState(
      i18n.t('slowmo.notice.activated', { sec: SLOW_MO_CONFIG.durationSec.toFixed(0) }),
    );
    return true;
  }

  update(realDt: number): void {
    const dt = Math.max(0, realDt);
    let changed = false;

    if (this.remainingSec > 0) {
      this.remainingSec = Math.max(0, this.remainingSec - dt);
      if (this.remainingSec === 0) {
        this.cooldownSec = SLOW_MO_CONFIG.cooldownSec;
      }
      changed = true;
    } else if (this.cooldownSec > 0) {
      this.cooldownSec = Math.max(0, this.cooldownSec - dt);
      changed = true;
    }

    if (changed) {
      this.emitState();
    }
  }

  private emitState(notice?: string): void {
    this.eventBus?.emit('slowmo:changed', {
      unlocked: this.unlocked,
      active: this.remainingSec > 0,
      remainingSec: this.remainingSec,
      cooldownSec: this.cooldownSec,
      notice,
    });
  }
}
