import type { GraphicsQuality } from '../config/graphicsPresets';

export type PlayerAnimState = 'idle' | 'walk' | 'run' | 'jump';

export interface GameEvents {
  'player:stateChanged': { state: PlayerAnimState; grounded: boolean };
  'graphics:changed': { quality: GraphicsQuality };
  'debug:toggled': { visible: boolean };
  'pointerlock:changed': { locked: boolean };
}

type Listener<T> = (payload: T) => void;

/** Lightweight typed event bus decoupling engine, gameplay, and UI. */
export class EventBus<TEvents extends object> {
  private listeners = new Map<keyof TEvents, Set<Listener<never>>>();

  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => this.off(event, listener);
  }

  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      (listener as Listener<TEvents[K]>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
