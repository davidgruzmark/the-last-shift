import { GRAPHICS_PRESETS, type GraphicsQuality } from '../config/graphicsPresets';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { GameState } from '../game/GameState';

/**
 * Minimal functional HUD for Phase 1:
 * - Controls legend
 * - Working Graphics Quality toggle (Low / Med / High)
 * - Working Fullscreen button
 * - Pointer lock prompt
 * - Toggleable F3 Debug Overlay
 */
export class PrototypeHUD {
  private readonly root: HTMLElement;
  private readonly eventBus: EventBus<GameEvents>;

  private qualityButtons = new Map<GraphicsQuality, HTMLButtonElement>();
  private fullscreenButton!: HTMLButtonElement;
  private pointerPrompt!: HTMLElement;
  private debugPanel!: HTMLElement;
  private debugContent!: HTMLElement;

  constructor(root: HTMLElement, eventBus: EventBus<GameEvents>, initialQuality: GraphicsQuality) {
    this.root = root;
    this.eventBus = eventBus;
    this.render(initialQuality);
  }

  update(state: GameState): void {
    this.pointerPrompt.classList.toggle('hidden', state.isPointerLocked);
    this.debugPanel.classList.toggle('hidden', !state.debugVisible);

    if (state.debugVisible) {
      const p = state.playerPosition;
      const v = state.playerVelocity;
      this.debugContent.innerHTML = [
        `FPS: ${Math.round(state.fps)}`,
        `Pos: (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`,
        `Vel: (${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`,
        `Anim: ${state.playerAnimState}`,
        `Grounded: ${state.playerGrounded}`,
        `CamDist: ${state.cameraDistance.toFixed(2)}m`,
        `Quality: ${state.graphicsQuality}`,
      ].join('<br/>');
    }
  }

  setActiveQuality(quality: GraphicsQuality): void {
    for (const [key, btn] of this.qualityButtons.entries()) {
      btn.classList.toggle('active', key === quality);
    }
  }

  dispose(): void {
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.root.innerHTML = '';
  }

  private render(initialQuality: GraphicsQuality): void {
    this.root.innerHTML = `
      <div class="hud-panel hud-top-left">
        <div class="hud-title-row">
          <span class="ikea-badge">IKEA SECURITY</span>
          <span class="hud-title">KFIR: THE LAST SHIFT</span>
        </div>
        <div class="hud-controls">
          <span><span class="hud-key">WASD</span> Move</span>
          <span><span class="hud-key">Shift</span> Run</span>
          <span><span class="hud-key">Space</span> Jump</span>
          <span><span class="hud-key">Mouse</span> Look</span>
          <span><span class="hud-key">F3</span> Debug</span>
        </div>
      </div>

      <div class="hud-top-right">
        <div class="hud-panel hud-btn-group" role="group" aria-label="Graphics quality">
          <button type="button" class="hud-btn" data-quality="low">${GRAPHICS_PRESETS.low.label}</button>
          <button type="button" class="hud-btn" data-quality="medium">${GRAPHICS_PRESETS.medium.label}</button>
          <button type="button" class="hud-btn" data-quality="high">${GRAPHICS_PRESETS.high.label}</button>
        </div>
        <button type="button" class="hud-panel hud-btn hud-btn-standalone" id="btn-fullscreen">
          Fullscreen
        </button>
      </div>

      <div class="hud-panel hud-debug hidden" id="debug-panel">
        <div class="hud-debug-title">PHASE 1 DEBUG (F3)</div>
        <div id="debug-content"></div>
      </div>

      <div class="hud-panel hud-pointer-prompt" id="pointer-prompt">
        Click canvas to lock mouse · or drag to look around
      </div>
    `;

    const buttons = this.root.querySelectorAll<HTMLButtonElement>('[data-quality]');
    buttons.forEach((btn) => {
      const quality = btn.dataset.quality as GraphicsQuality;
      this.qualityButtons.set(quality, btn);
      btn.addEventListener('click', () => {
        this.setActiveQuality(quality);
        this.eventBus.emit('graphics:changed', { quality });
      });
    });
    this.setActiveQuality(initialQuality);

    this.fullscreenButton = this.root.querySelector<HTMLButtonElement>('#btn-fullscreen')!;
    this.fullscreenButton.addEventListener('click', this.toggleFullscreen);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);

    this.pointerPrompt = this.root.querySelector<HTMLElement>('#pointer-prompt')!;
    this.debugPanel = this.root.querySelector<HTMLElement>('#debug-panel')!;
    this.debugContent = this.root.querySelector<HTMLElement>('#debug-content')!;
  }

  private toggleFullscreen = (): void => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Ignore fullscreen rejection in restricted contexts.
      });
    } else {
      document.exitFullscreen?.().catch(() => {
        // Ignore fullscreen exit error.
      });
    }
  };

  private handleFullscreenChange = (): void => {
    this.fullscreenButton.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
  };
}
