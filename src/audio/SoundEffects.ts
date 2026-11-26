/**
 * Lightweight procedural WebAudio sound effects for physical Control Room key
 * insertion, turning, locking, and door movement. Safely no-ops in headless/Node environments.
 */
export class SoundEffects {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.08,
    delaySec = 0,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  playKeyInsert(): void {
    this.playTone(1150, 720, 0.09, 'triangle', 0.07);
    this.playTone(1680, 1220, 0.06, 'sine', 0.04, 0.05);
  }

  playKeyTurn(): void {
    this.playTone(540, 880, 0.12, 'square', 0.05, 0.04);
    this.playTone(960, 460, 0.14, 'triangle', 0.07, 0.16);
  }

  playDoorOpen(): void {
    this.playTone(210, 145, 0.22, 'sine', 0.075);
  }

  playDoorClose(): void {
    this.playTone(165, 95, 0.18, 'triangle', 0.08);
  }

  playDoorLock(): void {
    this.playTone(680, 320, 0.1, 'square', 0.06, 0.05);
    this.playTone(460, 290, 0.11, 'triangle', 0.06, 0.14);
  }
}

export const sfx = new SoundEffects();
