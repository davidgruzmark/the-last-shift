import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';

export type PhoneThreadId = 'shiran' | 'work';

export interface PhoneMessage {
  id: string;
  threadId: PhoneThreadId;
  sender: string;
  senderKey?: string;
  direction: 'incoming' | 'outgoing';
  text: string;
  textKey?: string;
  time: string;
  read: boolean;
}

export interface IncomingCallOptions {
  id: string;
  callerKey: string;
  subtitleKey: string;
  onAnswer?: () => void;
  onDecline?: () => void;
}

export interface ActiveCallState {
  id: string;
  callerName: string;
  subtitle: string;
  status: 'ringing' | 'connected';
}

export const CALL_SCENARIOS = {
  shift_manager: {
    id: 'call-shift-manager',
    callerKey: 'call.shiftManager.caller',
    subtitleKey: 'call.shiftManager.subtitle',
  },
  ikea_security: {
    id: 'call-ikea-security',
    callerKey: 'call.ikeaSecurity.caller',
    subtitleKey: 'call.ikeaSecurity.subtitle',
  },
} as const;

const SHIRAN_MILESTONE_KEYS: Record<string, string> = {
  'm2-complete': 'shiran.msg.m2',
  'm4-complete': 'shiran.msg.m4',
  'm5-complete': 'shiran.msg.m5',
  // Future Phase 6.4 / 6.5 milestone hooks (not fired prematurely in Phase 6.2)
  'm7-complete': 'shiran.msg.m7',
  'm9-trigger': 'shiran.msg.m9',
};

/**
 * In-game smartphone message manager supporting separated personal ('shiran')
 * and work ('work') threads, milestone-paced Shiran messages, and reusable Incoming Call UI.
 */
export class PhoneManager {
  private messages: PhoneMessage[] = [];
  private activeThread: PhoneThreadId = 'shiran';
  private open = false;
  private msgCounter = 0;
  private readonly sentMilestones = new Set<string>();
  private activeCallOptions: IncomingCallOptions | null = null;
  private callStatus: 'ringing' | 'connected' | null = null;
  private readonly eventBus?: EventBus<GameEvents>;

  constructor(eventBus?: EventBus<GameEvents>, seedDefaultMessages = true) {
    this.eventBus = eventBus;
    if (seedDefaultMessages) {
      this.messages.push({
        id: `msg-${++this.msgCounter}`,
        threadId: 'shiran',
        sender: 'SHIRAN',
        senderKey: 'phone.contact.shiranName',
        direction: 'incoming',
        text: i18n.t('shiran.msg.seed1'),
        textKey: 'shiran.msg.seed1',
        time: '08:05',
        read: false,
      });
      this.messages.push({
        id: `msg-${++this.msgCounter}`,
        threadId: 'shiran',
        sender: 'KFIR',
        senderKey: 'speaker.KFIR',
        direction: 'outgoing',
        text: i18n.t('shiran.msg.seed2'),
        textKey: 'shiran.msg.seed2',
        time: '08:07',
        read: true,
      });
    }
  }

  isOpen(): boolean {
    return this.open;
  }

  getActiveThread(): PhoneThreadId {
    return this.activeThread;
  }

  setActiveThread(threadId: PhoneThreadId): void {
    this.activeThread = threadId;
    if (this.open) {
      for (const msg of this.messages) {
        if (msg.threadId === threadId) {
          msg.read = true;
        }
      }
    }
    this.emitState(null);
  }

  getMessages(threadId?: PhoneThreadId): readonly PhoneMessage[] {
    const filtered = threadId
      ? this.messages.filter((m) => m.threadId === threadId)
      : this.messages;
    return filtered.map((m) => ({
      ...m,
      sender: m.senderKey ? i18n.t(m.senderKey) : m.sender,
      text: m.textKey ? i18n.t(m.textKey) : m.text,
    }));
  }

  getUnreadCount(threadId?: PhoneThreadId): number {
    return this.messages.filter(
      (m) => m.direction === 'incoming' && !m.read && (!threadId || m.threadId === threadId),
    ).length;
  }

  receiveMessage(
    sender: string,
    text: string,
    time = this.formatNow(),
    notify = true,
    threadId: PhoneThreadId = sender.toUpperCase() === 'SHIRAN' ? 'shiran' : 'work',
    textKey?: string,
    senderKey?: string,
  ): PhoneMessage {
    const msg: PhoneMessage = {
      id: `msg-${++this.msgCounter}`,
      threadId,
      sender,
      senderKey,
      direction: 'incoming',
      text,
      textKey,
      time,
      read: this.open && this.activeThread === threadId,
    };
    this.messages.push(msg);
    const displaySender = senderKey ? i18n.t(senderKey) : sender;
    const displayText = textKey ? i18n.t(textKey) : text;
    this.emitState(notify ? { sender: displaySender, text: displayText } : null);
    return { ...msg, sender: displaySender, text: displayText };
  }

  /**
   * Sends an understated Shiran message once per milestone key, strictly into
   * the 'shiran' conversation thread.
   */
  deliverShiranMilestone(milestoneId: string): PhoneMessage | null {
    const textKey = SHIRAN_MILESTONE_KEYS[milestoneId];
    if (!textKey || this.sentMilestones.has(milestoneId)) {
      return null;
    }
    this.sentMilestones.add(milestoneId);
    return this.receiveMessage(
      'SHIRAN',
      i18n.t(textKey),
      this.formatNow(),
      true,
      'shiran',
      textKey,
      'phone.contact.shiranName',
    );
  }

  hasMilestoneSent(milestoneId: string): boolean {
    return this.sentMilestones.has(milestoneId);
  }

  sendReply(text: string): PhoneMessage | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const msg = this.addOutgoing('KFIR', trimmed, this.formatNow(), this.activeThread);
    this.emitState(null);
    return msg;
  }

  // --- Reusable Incoming Call API (kept completely separate from chat history) ---

  triggerIncomingCall(options: IncomingCallOptions): void {
    this.activeCallOptions = options;
    this.callStatus = 'ringing';
    this.open = true;
    this.emitCallChanged();
    this.emitState(null);
  }

  getActiveCall(): ActiveCallState | null {
    if (!this.activeCallOptions || !this.callStatus) return null;
    return {
      id: this.activeCallOptions.id,
      callerName: i18n.t(this.activeCallOptions.callerKey),
      subtitle: i18n.t(this.activeCallOptions.subtitleKey),
      status: this.callStatus,
    };
  }

  answerCall(): void {
    if (!this.activeCallOptions || this.callStatus !== 'ringing') return;
    this.callStatus = 'connected';
    this.activeCallOptions.onAnswer?.();
    this.emitCallChanged();
  }

  declineCall(): void {
    if (!this.activeCallOptions) return;
    const cb = this.activeCallOptions.onDecline;
    this.activeCallOptions = null;
    this.callStatus = null;
    this.emitCallChanged();
    cb?.();
  }

  endCall(): void {
    if (!this.activeCallOptions) return;
    this.activeCallOptions = null;
    this.callStatus = null;
    this.emitCallChanged();
  }

  openPhone(): void {
    this.open = true;
    for (const msg of this.messages) {
      if (msg.threadId === this.activeThread) {
        msg.read = true;
      }
    }
    this.emitState(null);
  }

  closePhone(): void {
    if (this.activeCallOptions) {
      this.endCall();
    }
    if (!this.open) return;
    this.open = false;
    this.emitState(null);
  }

  toggle(): boolean {
    if (this.open) {
      this.closePhone();
    } else {
      this.openPhone();
    }
    return this.open;
  }

  private addOutgoing(
    sender: string,
    text: string,
    time: string,
    threadId: PhoneThreadId,
  ): PhoneMessage {
    const msg: PhoneMessage = {
      id: `msg-${++this.msgCounter}`,
      threadId,
      sender,
      senderKey: 'speaker.KFIR',
      direction: 'outgoing',
      text,
      time,
      read: true,
    };
    this.messages.push(msg);
    return msg;
  }

  private formatNow(): string {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private emitCallChanged(): void {
    this.eventBus?.emit('phone:callChanged', { active: this.activeCallOptions !== null });
  }

  private emitState(latestNotification: { sender: string; text: string } | null): void {
    this.eventBus?.emit('phone:changed', {
      open: this.open,
      unreadCount: this.getUnreadCount(),
      latestNotification,
    });
  }
}
