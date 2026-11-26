import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';

export interface DialogueLine {
  speaker: string;
  text: string;
  speakerKey?: string;
  textKey?: string;
  speakerPrefix?: string;
}

/**
 * Manages active NPC and scripted story conversations, line advancement,
 * optional close callbacks (used by MissionManager), and clean exit.
 */
export class DialogueManager {
  private active = false;
  private npcName = '';
  private lines: DialogueLine[] = [];
  private index = 0;
  private onCloseCallback: (() => void) | null = null;
  private readonly eventBus?: EventBus<GameEvents>;

  constructor(eventBus?: EventBus<GameEvents>) {
    this.eventBus = eventBus;
  }

  refreshLocale(): void {
    if (this.active) {
      this.emitState();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  getCurrentLine(): DialogueLine | null {
    if (!this.active) return null;
    const raw = this.lines[this.index];
    if (!raw) return null;
    return {
      ...raw,
      speaker: raw.speakerKey ? i18n.t(raw.speakerKey) : raw.speaker,
      text: raw.textKey ? i18n.t(raw.textKey) : raw.text,
    };
  }

  getState(): { active: boolean; npcName: string; index: number; total: number } {
    return {
      active: this.active,
      npcName: this.npcName,
      index: this.index,
      total: this.lines.length,
    };
  }

  start(npcName: string, lines: DialogueLine[], onClose?: () => void): void {
    if (lines.length === 0) return;
    this.active = true;
    this.npcName = npcName;
    this.lines = lines;
    this.index = 0;
    this.onCloseCallback = onClose ?? null;
    this.emitState();
  }

  advance(): boolean {
    if (!this.active) return false;
    if (this.index + 1 < this.lines.length) {
      this.index += 1;
      this.emitState();
      return true;
    }
    this.close();
    return false;
  }

  close(): void {
    if (!this.active) return;
    const cb = this.onCloseCallback;
    this.active = false;
    this.npcName = '';
    this.lines = [];
    this.index = 0;
    this.onCloseCallback = null;
    this.emitState();
    cb?.();
  }

  private emitState(): void {
    const current = this.getCurrentLine();
    this.eventBus?.emit('dialogue:changed', {
      active: this.active,
      npcName: this.npcName,
      speaker: current?.speaker ?? '',
      text: current?.text ?? '',
      index: this.index,
      total: this.lines.length,
    });
  }
}
