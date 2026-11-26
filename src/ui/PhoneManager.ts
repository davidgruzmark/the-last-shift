import { getFriendDisplayName, type FriendMemberId } from '../config/friendsProfiles';
import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';

export type PhoneThreadId = 'shiran' | 'friends' | 'work';

export interface PhoneMessage {
  id: string;
  threadId: PhoneThreadId;
  sender: string;
  senderId?: FriendMemberId | 'kfir' | 'shiran' | 'manager' | 'system';
  senderKey?: string;
  senderColor?: string;
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

export type GroupChatEventId =
  | 'shift-start'
  | 'm2-complete'
  | 'm3-daytona'
  | 'jimmy-choo-found'
  | 'm6-complete';

interface QueuedGroupMessage {
  remainingSec: number;
  memberId: FriendMemberId;
  textKey: string;
}

const FRIENDS_BURST_SCRIPTS: Record<
  GroupChatEventId,
  Array<{ delaySec: number; memberId: FriendMemberId; textKey: string }>
> = {
  'shift-start': [
    { delaySec: 3.5, memberId: 'david', textKey: 'friends.msg.shift1' },
    { delaySec: 7.2, memberId: 'mor', textKey: 'friends.msg.shift2' },
  ],
  'm2-complete': [
    { delaySec: 0, memberId: 'lior', textKey: 'friends.msg.m2_1' },
    { delaySec: 3.4, memberId: 'david', textKey: 'friends.msg.m2_2' },
  ],
  'm3-daytona': [
    { delaySec: 0, memberId: 'mor', textKey: 'friends.msg.m3_1' },
    { delaySec: 3.2, memberId: 'david', textKey: 'friends.msg.m3_2' },
    { delaySec: 6.5, memberId: 'lior', textKey: 'friends.msg.m3_3' },
  ],
  'jimmy-choo-found': [
    { delaySec: 0, memberId: 'lior', textKey: 'friends.msg.jc1' },
    { delaySec: 3.0, memberId: 'mor', textKey: 'friends.msg.jc2' },
  ],
  'm6-complete': [
    { delaySec: 0, memberId: 'david', textKey: 'friends.msg.m6_1' },
    { delaySec: 3.2, memberId: 'lior', textKey: 'friends.msg.m6_2' },
    { delaySec: 6.4, memberId: 'mor', textKey: 'friends.msg.m6_3' },
  ],
};

/**
 * In-game smartphone message manager supporting separated personal ('shiran'),
 * Friends Group Chat ('friends'), and work ('work') threads, milestone-paced bursts,
 * and reusable Incoming Call UI.
 */
export class PhoneManager {
  private messages: PhoneMessage[] = [];
  private activeThread: PhoneThreadId = 'shiran';
  private open = false;
  private msgCounter = 0;
  private readonly sentMilestones = new Set<string>();
  private readonly sentGroupEvents = new Set<string>();
  private readonly pendingGroupQueue: QueuedGroupMessage[] = [];
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
      sender: m.senderId === 'david' || m.senderId === 'mor' || m.senderId === 'lior'
        ? getFriendDisplayName(m.senderId)
        : m.senderKey
          ? i18n.t(m.senderKey)
          : m.sender,
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
    senderId?: PhoneMessage['senderId'],
  ): PhoneMessage {
    const msg: PhoneMessage = {
      id: `msg-${++this.msgCounter}`,
      threadId,
      sender,
      senderId,
      senderKey,
      direction: 'incoming',
      text,
      textKey,
      time,
      read: this.open && this.activeThread === threadId,
    };
    this.messages.push(msg);
    const displaySender =
      senderId === 'david' || senderId === 'mor' || senderId === 'lior'
        ? getFriendDisplayName(senderId)
        : senderKey
          ? i18n.t(senderKey)
          : sender;
    const displayText = textKey ? i18n.t(textKey) : text;
    this.emitState(notify ? { sender: displaySender, text: displayText } : null);
    return { ...msg, sender: displaySender, text: displayText };
  }

  /**
   * Queues a staggered burst of Friends Group Chat banter for a story milestone,
   * delivering delaySec=0 items immediately and pacing subsequent replies via update(dt).
   */
  deliverFriendsMilestone(eventId: GroupChatEventId): void {
    const script = FRIENDS_BURST_SCRIPTS[eventId];
    if (!script || this.sentGroupEvents.has(eventId)) return;
    this.sentGroupEvents.add(eventId);

    for (const step of script) {
      if (step.delaySec <= 0) {
        this.deliverFriendLine(step.memberId, step.textKey);
      } else {
        this.pendingGroupQueue.push({
          remainingSec: step.delaySec,
          memberId: step.memberId,
          textKey: step.textKey,
        });
      }
    }
  }

  hasGroupEventSent(eventId: GroupChatEventId): boolean {
    return this.sentGroupEvents.has(eventId);
  }

  /**
   * Advances staggered group chat delivery timers cleanly in real time.
   */
  update(dt: number): void {
    if (dt <= 0 || this.pendingGroupQueue.length === 0) return;
    for (let i = this.pendingGroupQueue.length - 1; i >= 0; i--) {
      this.pendingGroupQueue[i].remainingSec -= dt;
      if (this.pendingGroupQueue[i].remainingSec <= 0) {
        const ready = this.pendingGroupQueue.splice(i, 1)[0];
        this.deliverFriendLine(ready.memberId, ready.textKey);
      }
    }
  }

  private deliverFriendLine(memberId: FriendMemberId, textKey: string): void {
    const displayName = getFriendDisplayName(memberId);
    this.receiveMessage(
      displayName,
      i18n.t(textKey),
      this.formatNow(),
      true,
      'friends',
      textKey,
      undefined,
      memberId,
    );
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
