import type { GraphicsQuality } from '../config/graphicsPresets';

export type PlayerAnimState = 'idle' | 'walk' | 'run' | 'sprint' | 'jump';

export interface GameEvents {
  'player:stateChanged': { state: PlayerAnimState; grounded: boolean };
  'graphics:changed': { quality: GraphicsQuality };
  'debug:toggled': { visible: boolean };
  'pointerlock:changed': { locked: boolean };
  'input:interact': Record<string, never>;
  'input:phone': Record<string, never>;
  'input:collection': Record<string, never>;
  'input:settings': Record<string, never>;
  'input:slowmo': Record<string, never>;
  'input:kick': Record<string, never>;
  'input:pass': Record<string, never>;
  'input:headlights': Record<string, never>;
  'input:cancel': Record<string, never>;
  'football:stateChanged': {
    visible: boolean;
    phase: 'idle' | 'active' | 'goal_pause' | 'ended';
    mode: 'none' | 'match' | 'freeplay';
    kfirScore: number;
    opponentScore: number;
    timeRemaining: number;
    winner: 'kfir' | 'opponent' | 'draw' | null;
    lastScorer: 'kfir' | 'opponent' | null;
    ballInRange: boolean;
  };
  'collection:changed': { collected: number; total: number };
  'language:changed': { lang: 'en' | 'he'; dir: 'ltr' | 'rtl' };
  'phone:callChanged': { active: boolean };
  'slowmo:changed': {
    unlocked: boolean;
    active: boolean;
    remainingSec: number;
    cooldownSec: number;
    notice?: string;
  };
  'vehicle:stateChanged': {
    inVehicle: boolean;
    vehicleName: string | null;
    speedKmh: number;
    gear: 'P' | 'D' | 'R';
    handbrake: boolean;
    headlights: boolean;
    statusToast?: string;
  };
  'interaction:promptChanged': { prompt: string | null; targetId: string | null };
  'dialogue:changed': {
    active: boolean;
    npcName: string;
    speaker: string;
    text: string;
    index: number;
    total: number;
  };
  'collectible:collected': {
    id: string;
    name: string;
    collectedCount: number;
    totalCount: number;
  };
  'computer:changed': { open: boolean; activeCam: number };
  'phone:changed': {
    open: boolean;
    unreadCount: number;
    latestNotification: { sender: string; text: string } | null;
  };
  'mission:stateChanged': {
    missionId: string | null;
    missionNumber: number;
    title: string;
    objectiveTitle: string;
    progressText: string;
    money: number;
    status: 'idle' | 'active' | 'completed_screen' | 'campaign_complete';
    completedMissions: string[];
  };
  'mission:notification': {
    kind: 'started' | 'objective_done' | 'new_objective' | 'completed' | 'failed';
    title: string;
    subtitle: string;
  };
  'mission:completionModal': {
    open: boolean;
    title: string;
    message: string;
    moneyReward: number;
    itemReward?: string;
    isCampaignEnd: boolean;
  };
  'mission:scriptEvent': { eventId: string };
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
