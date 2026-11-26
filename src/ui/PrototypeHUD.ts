import type { EventBus, GameEvents } from '../core/EventBus';
import type { GameState } from '../game/GameState';
import { i18n } from '../i18n/LocalizationManager';

/**
 * Main HUD bar:
 * - Current IKEA store area & collectible count (localized)
 * - Controls legend (foot / driving + Legendary Slow-Mo hint when unlocked)
 * - Slow-Mo ability status pill
 * - Working Collection, Phone, and Settings toggle buttons
 * - Toggleable F3 Debug Overlay
 */
export class PrototypeHUD {
  private readonly container: HTMLElement;
  private readonly eventBus: EventBus<GameEvents>;

  private settingsButton!: HTMLButtonElement;
  private phoneButton!: HTMLButtonElement;
  private phoneBadge!: HTMLElement;
  private collectionButton!: HTMLButtonElement;
  private collectionBadge!: HTMLElement;
  private slowMoEl!: HTMLElement;
  private pointerPrompt!: HTMLElement;
  private zoneBadge!: HTMLElement;
  private itemsBadge!: HTMLElement;
  private controlsLegend!: HTMLElement;
  private vehicleHud!: HTMLElement;
  private vehicleSpeedEl!: HTMLElement;
  private vehicleGearEl!: HTMLElement;
  private vehicleLightsEl!: HTMLElement;
  private vehicleNoticeEl!: HTMLElement;
  private vehicleNoticeTimer = 0;
  private debugPanel!: HTMLElement;
  private debugContent!: HTMLElement;
  private lastControlsKey = '';
  private lastState?: GameState;
  private unsubLang?: () => void;

  constructor(hudRoot: HTMLElement, eventBus: EventBus<GameEvents>) {
    this.container = document.createElement('div');
    this.container.id = 'prototype-hud-layer';
    hudRoot.appendChild(this.container);
    this.eventBus = eventBus;
    this.render();
    this.unsubLang = i18n.onChange(() => {
      this.render();
      this.lastControlsKey = '';
      if (this.lastState) {
        this.update(this.lastState);
      }
    });
  }

  update(state: GameState): void {
    this.lastState = state;
    const hidePointerPrompt = state.isPointerLocked || state.activeOverlay !== 'none';
    this.pointerPrompt.classList.toggle('hidden', hidePointerPrompt);
    this.debugPanel.classList.toggle('hidden', !state.debugVisible);
    const zoneKey = `zone.${state.currentZone}`;
    const zoneTranslated = i18n.t(zoneKey);
    this.zoneBadge.textContent = zoneTranslated === zoneKey ? state.currentZone : zoneTranslated;
    this.itemsBadge.textContent = `${state.collectedItems.length}/${state.totalCollectibles}`;

    this.phoneBadge.textContent = String(state.unreadMessages);
    this.phoneBadge.classList.toggle('hidden', state.unreadMessages <= 0);
    this.phoneButton.classList.toggle('active', state.activeOverlay === 'phone');

    const totalPersonalCollected = state.perfumesCollected + state.watchesCollected;
    const totalPersonalItems = state.perfumesTotal + state.watchesTotal;
    this.collectionBadge.textContent = `${totalPersonalCollected}/${totalPersonalItems}`;
    this.collectionButton.classList.toggle('active', state.activeOverlay === 'collection');
    this.settingsButton.classList.toggle('active', state.activeOverlay === 'settings');

    // Slow-Mo status pill
    this.slowMoEl.classList.toggle('hidden', !state.slowMoUnlocked);
    if (state.slowMoUnlocked) {
      const textEl = this.slowMoEl.querySelector<HTMLElement>('.slowmo-hud-status');
      this.slowMoEl.classList.toggle('active', state.slowMoActive);
      this.slowMoEl.classList.toggle('cooldown', !state.slowMoActive && state.slowMoCooldown > 0);
      if (textEl) {
        textEl.textContent = state.slowMoActive
          ? i18n.t('slowmo.active', { sec: state.slowMoRemaining.toFixed(1) })
          : state.slowMoCooldown > 0
            ? i18n.t('slowmo.cooldown', { sec: Math.ceil(state.slowMoCooldown) })
            : i18n.t('slowmo.ready');
      }
    }

    this.vehicleHud.classList.toggle('hidden', !state.inVehicle);
    if (state.inVehicle) {
      this.vehicleSpeedEl.textContent = String(state.vehicleSpeedKmh);
      this.vehicleGearEl.textContent = state.vehicleHandbrake
        ? i18n.t('vehicle.brake')
        : state.vehicleGear;
      this.vehicleGearEl.classList.toggle('brake-on', state.vehicleHandbrake);
      this.vehicleLightsEl.textContent = state.vehicleHeadlights
        ? i18n.t('vehicle.lightsOn')
        : i18n.t('vehicle.lightsOff');
      this.vehicleLightsEl.classList.toggle('lights-off', !state.vehicleHeadlights);
    }

    const controlsKey = `${state.inVehicle}-${state.slowMoUnlocked}-${i18n.getLanguage()}`;
    if (controlsKey !== this.lastControlsKey) {
      this.lastControlsKey = controlsKey;
      const slowMoHint = state.slowMoUnlocked
        ? `<span><span class="hud-key">Q</span> ${i18n.t('hud.controls.slowmo')}</span>`
        : '';
      this.controlsLegend.innerHTML = state.inVehicle
        ? `
          <span><span class="hud-key">W/S</span> ${i18n.t('hud.controls.gasBrake')}</span>
          <span><span class="hud-key">A/D</span> ${i18n.t('hud.controls.steer')}</span>
          <span><span class="hud-key">Shift</span> ${i18n.t('hud.controls.boost')}</span>
          <span><span class="hud-key">Space</span> ${i18n.t('hud.controls.handbrake')}</span>
          <span><span class="hud-key">H</span> ${i18n.t('hud.controls.lights')}</span>
          <span><span class="hud-key">E</span> ${i18n.t('hud.controls.exitCar')}</span>
        `
        : `
          <span><span class="hud-key">WASD</span> ${i18n.t('hud.controls.move')}</span>
          <span><span class="hud-key">Shift</span> ${i18n.t('hud.controls.runSprint')}</span>
          <span><span class="hud-key">Space</span> ${i18n.t('hud.controls.jump')}</span>
          <span><span class="hud-key">E</span> ${i18n.t('hud.controls.interact')}</span>
          <span><span class="hud-key">P</span> ${i18n.t('hud.controls.phone')}</span>
          <span><span class="hud-key">C</span> ${i18n.t('hud.controls.collection')}</span>
          ${slowMoHint}
          <span><span class="hud-key">F3</span> ${i18n.t('hud.controls.debug')}</span>
        `;
    }

    if (state.debugVisible) {
      const p = state.playerPosition;
      const v = state.playerVelocity;
      const modeText = state.inVehicle
        ? i18n.t('debug.modeDriving', {
            speed: state.vehicleSpeedKmh,
            gear: state.vehicleGear,
          })
        : i18n.t('debug.modeFoot');
      this.debugContent.innerHTML = [
        `${i18n.t('debug.zone')}: ${this.zoneBadge.textContent}`,
        `${i18n.t('debug.fps')}: ${Math.round(state.fps)}`,
        `${i18n.t('debug.mode')}: ${modeText}`,
        `${i18n.t('debug.pos')}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`,
        `${i18n.t('debug.vel')}: (${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`,
        `${i18n.t('debug.anim')}: ${state.playerAnimState}`,
        `${i18n.t('debug.grounded')}: ${state.playerGrounded}`,
        `${i18n.t('debug.camDist')}: ${state.cameraDistance.toFixed(2)}m`,
        `${i18n.t('debug.overlay')}: ${state.activeOverlay}`,
        `${i18n.t('debug.items')}: ${state.collectedItems.length}/${state.totalCollectibles}`,
        `${i18n.t('debug.slowmo')}: ${
          state.slowMoActive
            ? `${state.slowMoRemaining.toFixed(1)}s`
            : state.slowMoCooldown > 0
              ? `cooldown ${Math.ceil(state.slowMoCooldown)}s`
              : state.slowMoUnlocked
                ? 'ready'
                : 'locked'
        }`,
        `${i18n.t('debug.lang')}: ${i18n.getLanguage()}`,
        `${i18n.t('debug.quality')}: ${state.graphicsQuality}`,
      ].join('<br/>');
    }
  }

  showVehicleNotice(message: string): void {
    window.clearTimeout(this.vehicleNoticeTimer);
    this.vehicleNoticeEl.textContent = message;
    this.vehicleNoticeEl.classList.remove('hidden');
    this.vehicleNoticeTimer = window.setTimeout(() => {
      this.vehicleNoticeEl.classList.add('hidden');
    }, 2200);
  }

  dispose(): void {
    window.clearTimeout(this.vehicleNoticeTimer);
    this.unsubLang?.();
    this.container.remove();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="hud-left-column">
        <div class="hud-panel hud-top-left">
          <div class="hud-title-row">
            <span class="ikea-badge">${i18n.t('hud.badge')}</span>
            <span class="hud-title">${i18n.t('hud.title')}</span>
          </div>
          <div class="hud-zone-row">
            <span class="hud-zone-label">${i18n.t('hud.areaLabel')}</span>
            <span class="hud-zone-value" id="hud-zone">${i18n.t('zone.Control Room')}</span>
            <span class="hud-zone-sep">·</span>
            <span class="hud-zone-label">${i18n.t('hud.itemsLabel')}</span>
            <span class="hud-zone-value" id="hud-items">0/0</span>
          </div>
          <div class="hud-controls" id="hud-controls"></div>
          <div class="slowmo-hud hidden" id="slowmo-hud">
            <span class="slowmo-hud-label">${i18n.t('slowmo.label')}</span>
            <span class="slowmo-hud-status">${i18n.t('slowmo.ready')}</span>
          </div>
        </div>

        <div class="hud-panel hud-debug hidden" id="debug-panel">
          <div class="hud-debug-title">${i18n.t('hud.debugTitle')}</div>
          <div id="debug-content"></div>
        </div>
      </div>

      <div class="hud-top-right">
        <button type="button" class="hud-panel hud-btn hud-btn-standalone" id="btn-collection">
          ${i18n.t('hud.btn.collection')} <span class="hud-collection-badge" id="collection-count-badge">0/8</span>
        </button>
        <button type="button" class="hud-panel hud-btn hud-btn-standalone" id="btn-phone">
          ${i18n.t('hud.btn.phone')} <span class="hud-unread-badge hidden" id="phone-unread-badge">0</span>
        </button>
        <button type="button" class="hud-panel hud-btn hud-btn-standalone" id="btn-settings">
          ⚙ ${i18n.t('hud.btn.settings')}
        </button>
      </div>

      <div class="hud-panel vehicle-hud hidden" id="vehicle-hud">
        <div class="vehicle-speed-block">
          <span class="vehicle-speed-num" id="vehicle-speed">0</span>
          <span class="vehicle-speed-unit">${i18n.t('vehicle.kmh')}</span>
        </div>
        <div class="vehicle-meta">
          <span class="vehicle-gear-pill" id="vehicle-gear">P</span>
          <span class="vehicle-lights-pill" id="vehicle-lights">${i18n.t('vehicle.lightsOn')}</span>
        </div>
      </div>

      <div class="hud-panel vehicle-notice hidden" id="vehicle-notice"></div>

      <div class="hud-panel hud-pointer-prompt" id="pointer-prompt">
        ${i18n.t('hud.pointerPrompt')}
      </div>
    `;

    this.phoneButton = this.container.querySelector<HTMLButtonElement>('#btn-phone')!;
    this.phoneBadge = this.container.querySelector<HTMLElement>('#phone-unread-badge')!;
    this.phoneButton.addEventListener('click', () => {
      this.eventBus.emit('input:phone', {});
    });

    this.collectionButton = this.container.querySelector<HTMLButtonElement>('#btn-collection')!;
    this.collectionBadge = this.container.querySelector<HTMLElement>('#collection-count-badge')!;
    this.collectionButton.addEventListener('click', () => {
      this.eventBus.emit('input:collection', {});
    });

    this.settingsButton = this.container.querySelector<HTMLButtonElement>('#btn-settings')!;
    this.settingsButton.addEventListener('click', () => {
      this.eventBus.emit('input:settings', {});
    });

    this.slowMoEl = this.container.querySelector<HTMLElement>('#slowmo-hud')!;
    this.pointerPrompt = this.container.querySelector<HTMLElement>('#pointer-prompt')!;
    this.zoneBadge = this.container.querySelector<HTMLElement>('#hud-zone')!;
    this.itemsBadge = this.container.querySelector<HTMLElement>('#hud-items')!;
    this.controlsLegend = this.container.querySelector<HTMLElement>('#hud-controls')!;
    this.vehicleHud = this.container.querySelector<HTMLElement>('#vehicle-hud')!;
    this.vehicleSpeedEl = this.container.querySelector<HTMLElement>('#vehicle-speed')!;
    this.vehicleGearEl = this.container.querySelector<HTMLElement>('#vehicle-gear')!;
    this.vehicleLightsEl = this.container.querySelector<HTMLElement>('#vehicle-lights')!;
    this.vehicleNoticeEl = this.container.querySelector<HTMLElement>('#vehicle-notice')!;
    this.debugPanel = this.container.querySelector<HTMLElement>('#debug-panel')!;
    this.debugContent = this.container.querySelector<HTMLElement>('#debug-content')!;
  }
}
