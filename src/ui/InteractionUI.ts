import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import {
  SECURITY_CAMERA_FEEDS,
  type ComputerInteraction,
} from '../interaction/ComputerInteraction';
import type { DialogueManager } from '../npcs/DialogueManager';
import type { PhoneManager } from './PhoneManager';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Renders and manages all Phase 3–6.2 interaction UI overlays:
 * - Interaction prompt pill
 * - NPC Dialogue panel
 * - IKEA Security OS computer terminal modal (4 live 3D camera feeds)
 * - Modern 9:19 smartphone messaging + Incoming Call overlay (Shiran & Work Alerts)
 * - Collectible & incoming-message notification toasts
 */
export class InteractionUI {
  private readonly container: HTMLElement;
  private readonly eventBus: EventBus<GameEvents>;
  private readonly dialogue: DialogueManager;
  private readonly computer: ComputerInteraction;
  private readonly phone: PhoneManager;

  private promptEl!: HTMLElement;
  private dialogueEl!: HTMLElement;
  private dialogueSpeakerEl!: HTMLElement;
  private dialogueTextEl!: HTMLElement;
  private dialogueProgressEl!: HTMLElement;
  private dialogueNextBtnEl!: HTMLButtonElement;
  private dialogueCloseBtnEl!: HTMLButtonElement;
  private terminalBadgeEl!: HTMLElement;
  private terminalTitleEl!: HTMLElement;
  private terminalCloseBtnEl!: HTMLButtonElement;
  private computerEl!: HTMLElement;
  private camTabsEl!: HTMLElement;
  private camFeedEl!: HTMLElement;
  private cctvMainCanvas!: HTMLCanvasElement;
  private cctvThumbCanvases: HTMLCanvasElement[] = [];
  private cctvScreenEl!: HTMLElement;
  private cctvLabelEl!: HTMLElement;
  private cctvStatusEl!: HTMLElement;
  private cctvTimestampEl!: HTMLElement;
  private phoneEl!: HTMLElement;
  private phoneTabShiranEl!: HTMLButtonElement;
  private phoneTabWorkEl!: HTMLButtonElement;
  private phoneAvatarEl!: HTMLElement;
  private phoneContactNameEl!: HTMLElement;
  private phoneContactStatusEl!: HTMLElement;
  private phoneClosePillEl!: HTMLButtonElement;
  private phoneMessagesEl!: HTMLElement;
  private phoneInputEl!: HTMLInputElement;
  private phoneTimeEl!: HTMLElement;
  private callOverlayEl!: HTMLElement;
  private toastStackEl!: HTMLElement;
  private lastRenderedMsgCount = 0;
  private lastRenderedThread = '';
  private unsubscribers: Array<() => void> = [];

  constructor(
    hudRoot: HTMLElement,
    eventBus: EventBus<GameEvents>,
    dialogue: DialogueManager,
    computer: ComputerInteraction,
    phone: PhoneManager,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'interaction-ui-layer';
    hudRoot.appendChild(this.container);

    this.eventBus = eventBus;
    this.dialogue = dialogue;
    this.computer = computer;
    this.phone = phone;

    this.render();
    this.bindEvents();
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.container.remove();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="toast-stack" id="toast-stack"></div>

      <div class="hud-panel interaction-prompt hidden" id="interaction-prompt"></div>

      <div class="hud-panel dialogue-panel hidden" id="dialogue-panel" role="dialog" aria-label="NPC Dialogue">
        <div class="dialogue-header">
          <span class="dialogue-speaker" id="dialogue-speaker">EMPLOYEE</span>
          <span class="dialogue-progress" id="dialogue-progress">1 / 3</span>
        </div>
        <div class="dialogue-text" id="dialogue-text"></div>
        <div class="dialogue-actions">
          <button type="button" class="hud-btn active" id="btn-dialogue-next"></button>
          <button type="button" class="hud-btn" id="btn-dialogue-close"></button>
        </div>
      </div>

      <div class="modal-backdrop hidden" id="computer-modal" role="dialog" aria-label="Security Workstation">
        <div class="hud-panel computer-terminal">
          <div class="terminal-topbar">
            <div class="terminal-title">
              <span class="ikea-badge" id="terminal-badge"></span>
              <span id="terminal-title-text"></span>
            </div>
            <button type="button" class="hud-btn terminal-close-btn" id="btn-computer-close"></button>
          </div>
          <div class="terminal-body">
            <div class="terminal-sidebar" id="terminal-cam-tabs"></div>
            <div class="terminal-viewport" id="terminal-cam-feed"></div>
          </div>
        </div>
      </div>

      <div class="smartphone-shell hidden" id="phone-panel" role="dialog" aria-label="Kfir Smartphone">
        <div class="smartphone-btn-vol-up" aria-hidden="true"></div>
        <div class="smartphone-btn-vol-down" aria-hidden="true"></div>
        <div class="smartphone-btn-power" aria-hidden="true"></div>

        <div class="smartphone-bezel">
          <div class="smartphone-screen">
            <div class="smartphone-notch" aria-hidden="true">
              <span class="notch-speaker"></span>
              <span class="notch-camera"></span>
            </div>

            <div class="smartphone-statusbar">
              <span class="statusbar-time" id="phone-status-time">08:07</span>
              <div class="statusbar-icons" aria-hidden="true">
                <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
                  <rect x="0" y="7" width="2.2" height="3" rx="0.6" />
                  <rect x="3.6" y="5" width="2.2" height="5" rx="0.6" />
                  <rect x="7.2" y="2.5" width="2.2" height="7.5" rx="0.6" />
                  <rect x="10.8" y="0" width="2.2" height="10" rx="0.6" />
                </svg>
                <svg width="13" height="10" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                  <path d="M1.5 4.2C5.2 1 10.8 1 14.5 4.2" />
                  <path d="M4.2 7C6.4 5 9.6 5 11.8 7" />
                  <circle cx="8" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
                </svg>
                <span class="battery-pill">
                  <span class="battery-level"></span>
                </span>
              </div>
            </div>

            <div class="chat-app-header">
              <button type="button" class="chat-back-btn" id="btn-phone-close" title="Close Phone (P / Esc)">
                ‹
              </button>
              <div class="chat-avatar">
                <span id="phone-avatar-letter">S</span>
                <span class="chat-online-dot"></span>
              </div>
              <div class="chat-contact-meta">
                <div class="chat-contact-name" id="phone-contact-name"></div>
                <div class="chat-contact-status" id="phone-contact-status"></div>
              </div>
              <button type="button" class="chat-close-pill" id="btn-phone-close-pill"></button>
            </div>

            <div class="phone-thread-tabs" role="tablist" aria-label="Conversations">
              <button type="button" class="phone-thread-tab active" id="phone-tab-shiran" role="tab"></button>
              <button type="button" class="phone-thread-tab" id="phone-tab-work" role="tab"></button>
            </div>

            <div class="phone-call-overlay hidden" id="phone-call-overlay" role="region" aria-label="Incoming Call"></div>

            <div class="chat-thread" id="phone-messages"></div>

            <form class="chat-composer" id="phone-composer">
              <input
                type="text"
                class="chat-input"
                id="phone-input"
                maxlength="120"
                autocomplete="off"
              />
              <button type="submit" class="chat-send-btn" id="btn-phone-send" aria-label="Send message">
                ↑
              </button>
            </form>

            <div class="smartphone-home-indicator" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    `;

    this.toastStackEl = this.container.querySelector('#toast-stack')!;
    this.promptEl = this.container.querySelector('#interaction-prompt')!;
    this.dialogueEl = this.container.querySelector('#dialogue-panel')!;
    this.dialogueSpeakerEl = this.container.querySelector('#dialogue-speaker')!;
    this.dialogueTextEl = this.container.querySelector('#dialogue-text')!;
    this.dialogueProgressEl = this.container.querySelector('#dialogue-progress')!;
    this.dialogueNextBtnEl = this.container.querySelector('#btn-dialogue-next')!;
    this.dialogueCloseBtnEl = this.container.querySelector('#btn-dialogue-close')!;
    this.terminalBadgeEl = this.container.querySelector('#terminal-badge')!;
    this.terminalTitleEl = this.container.querySelector('#terminal-title-text')!;
    this.terminalCloseBtnEl = this.container.querySelector('#btn-computer-close')!;
    this.computerEl = this.container.querySelector('#computer-modal')!;
    this.camTabsEl = this.container.querySelector('#terminal-cam-tabs')!;
    this.camFeedEl = this.container.querySelector('#terminal-cam-feed')!;
    this.phoneEl = this.container.querySelector('#phone-panel')!;
    this.phoneTabShiranEl = this.container.querySelector('#phone-tab-shiran')!;
    this.phoneTabWorkEl = this.container.querySelector('#phone-tab-work')!;
    this.phoneAvatarEl = this.container.querySelector('#phone-avatar-letter')!;
    this.phoneContactNameEl = this.container.querySelector('#phone-contact-name')!;
    this.phoneContactStatusEl = this.container.querySelector('#phone-contact-status')!;
    this.phoneClosePillEl = this.container.querySelector('#btn-phone-close-pill')!;
    this.phoneMessagesEl = this.container.querySelector('#phone-messages')!;
    this.phoneInputEl = this.container.querySelector('#phone-input')!;
    this.phoneTimeEl = this.container.querySelector('#phone-status-time')!;
    this.callOverlayEl = this.container.querySelector('#phone-call-overlay')!;

    this.phoneTabShiranEl.addEventListener('click', () => this.phone.setActiveThread('shiran'));
    this.phoneTabWorkEl.addEventListener('click', () => this.phone.setActiveThread('work'));

    this.dialogueNextBtnEl.addEventListener('click', () => this.dialogue.advance());
    this.dialogueCloseBtnEl.addEventListener('click', () => this.dialogue.close());
    this.terminalCloseBtnEl.addEventListener('click', () => this.computer.close());
    this.container.querySelector('#btn-phone-close')!.addEventListener('click', () => {
      this.phone.closePhone();
    });
    this.phoneClosePillEl.addEventListener('click', () => {
      this.phone.closePhone();
    });

    const composer = this.container.querySelector<HTMLFormElement>('#phone-composer')!;
    composer.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.phoneInputEl.value;
      if (this.phone.sendReply(text)) {
        this.phoneInputEl.value = '';
      }
    });

    this.phoneInputEl.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') {
        e.stopPropagation();
      }
    });

    this.initSurveillanceDom();
    this.syncStaticLabels();
    this.updateComputerSelection(0);
    this.renderPhoneMessages();
    this.renderCallOverlay();
  }

  getSurveillanceCanvases(): {
    main: HTMLCanvasElement;
    thumbs: readonly HTMLCanvasElement[];
  } {
    return {
      main: this.cctvMainCanvas,
      thumbs: this.cctvThumbCanvases,
    };
  }

  updateSurveillanceClock(): void {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    this.cctvTimestampEl.textContent = `${hh}:${mm}:${ss}`;
  }

  private syncStaticLabels(): void {
    this.dialogueCloseBtnEl.textContent = i18n.t('dialogue.close');
    this.terminalBadgeEl.textContent = i18n.t('terminal.badge');
    this.terminalTitleEl.textContent = i18n.t('terminal.title');
    this.terminalCloseBtnEl.textContent = i18n.t('terminal.close');
    this.phoneClosePillEl.textContent = i18n.t('phone.close');
    this.updateComputerSelection(this.computer.getActiveCamera());
  }

  private bindEvents(): void {
    this.unsubscribers.push(
      this.eventBus.on('interaction:promptChanged', ({ prompt }) => {
        if (prompt) {
          this.promptEl.textContent = prompt;
          this.promptEl.classList.remove('hidden');
        } else {
          this.promptEl.classList.add('hidden');
        }
      }),
      this.eventBus.on('dialogue:changed', (payload) => {
        this.dialogueEl.classList.toggle('hidden', !payload.active);
        if (payload.active) {
          this.dialogueSpeakerEl.textContent = payload.speaker;
          this.dialogueTextEl.textContent = payload.text;
          this.dialogueProgressEl.textContent = `${payload.index + 1} / ${payload.total}`;
          this.dialogueNextBtnEl.textContent =
            payload.index + 1 < payload.total ? i18n.t('dialogue.next') : i18n.t('dialogue.finish');
        }
      }),
      this.eventBus.on('computer:changed', ({ open, activeCam }) => {
        this.computerEl.classList.toggle('hidden', !open);
        if (open) {
          this.updateComputerSelection(activeCam);
          this.updateSurveillanceClock();
        }
      }),
      this.eventBus.on('phone:changed', ({ open, latestNotification }) => {
        this.phoneEl.classList.toggle('hidden', !open);
        this.updateStatusClock();
        this.renderPhoneMessages();
        this.renderCallOverlay();
        if (latestNotification && !open) {
          this.showToast(
            i18n.t('phone.toast.newMessage', { sender: latestNotification.sender }),
            latestNotification.text,
            'phone',
          );
        }
      }),
      this.eventBus.on('phone:callChanged', () => {
        this.phoneEl.classList.toggle('hidden', !this.phone.isOpen());
        this.renderCallOverlay();
      }),
      this.eventBus.on('collectible:collected', ({ name, collectedCount, totalCount }) => {
        this.showToast(
          i18n.t('phone.toast.collected', { collected: collectedCount, total: totalCount }),
          name,
          'collectible',
        );
      }),
      i18n.onChange(() => {
        this.syncStaticLabels();
        this.renderPhoneMessages();
        this.renderCallOverlay();
      }),
    );
  }

  private updateStatusClock(): void {
    const messages = this.phone.getMessages();
    const last = messages[messages.length - 1];
    this.phoneTimeEl.textContent = last ? last.time : '08:07';
  }

  private initSurveillanceDom(): void {
    this.camTabsEl.innerHTML = SECURITY_CAMERA_FEEDS.map(
      (cam, idx) => `
        <button type="button" class="terminal-cam-btn" data-cam="${idx}">
          <canvas class="cctv-thumb-canvas" width="160" height="90"></canvas>
          <div class="terminal-cam-meta">
            <span class="cam-dot" style="background:${cam.accent}"></span>
            <span class="cam-tab-label">${escapeHtml(cam.id)} · ${escapeHtml(i18n.t(`cam.${idx}.name`))}</span>
          </div>
        </button>
      `,
    ).join('');

    this.cctvThumbCanvases = Array.from(
      this.camTabsEl.querySelectorAll<HTMLCanvasElement>('.cctv-thumb-canvas'),
    );

    this.camTabsEl.querySelectorAll<HTMLButtonElement>('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.cam);
        this.computer.selectCamera(idx);
      });
    });

    this.camFeedEl.innerHTML = `
      <div class="cctv-feed-screen" id="cctv-screen">
        <canvas class="cctv-main-canvas" id="cctv-main-canvas" width="384" height="216"></canvas>
        <div class="cctv-scanlines" aria-hidden="true"></div>
        <div class="cctv-feed-header">
          <span><span class="cctv-rec">● REC</span> <span id="cctv-label"></span></span>
          <span id="cctv-timestamp">08:07:00</span>
        </div>
        <div class="cctv-feed-footer">
          <span id="cctv-status"></span>
          <span>LIVE 3D FEED</span>
        </div>
      </div>
    `;

    this.cctvScreenEl = this.camFeedEl.querySelector('#cctv-screen')!;
    this.cctvMainCanvas = this.camFeedEl.querySelector('#cctv-main-canvas')!;
    this.cctvLabelEl = this.camFeedEl.querySelector('#cctv-label')!;
    this.cctvStatusEl = this.camFeedEl.querySelector('#cctv-status')!;
    this.cctvTimestampEl = this.camFeedEl.querySelector('#cctv-timestamp')!;
  }

  private updateComputerSelection(activeCam: number): void {
    this.camTabsEl.querySelectorAll<HTMLButtonElement>('[data-cam]').forEach((btn) => {
      const idx = Number(btn.dataset.cam);
      btn.classList.toggle('active', idx === activeCam);
      const cam = SECURITY_CAMERA_FEEDS[idx];
      const lbl = btn.querySelector('.cam-tab-label');
      if (cam && lbl) {
        lbl.textContent = `${cam.id} · ${i18n.t(`cam.${idx}.name`)}`;
      }
    });

    const cam = SECURITY_CAMERA_FEEDS[activeCam] ?? SECURITY_CAMERA_FEEDS[0];
    const camIdx = SECURITY_CAMERA_FEEDS.indexOf(cam);
    const resolvedIdx = camIdx >= 0 ? camIdx : 0;
    this.cctvScreenEl.style.setProperty('--cam-accent', cam.accent);
    this.cctvLabelEl.textContent = i18n.t(`cam.${resolvedIdx}.label`);
    this.cctvStatusEl.textContent = `${i18n.t(`cam.${resolvedIdx}.location`)} · ${i18n.t(`cam.${resolvedIdx}.status`)}`;
  }

  private renderPhoneMessages(): void {
    const activeThread = this.phone.getActiveThread();
    const isShiran = activeThread === 'shiran';
    this.phoneTabShiranEl.classList.toggle('active', isShiran);
    this.phoneTabWorkEl.classList.toggle('active', !isShiran);
    this.phoneTabShiranEl.textContent = i18n.t('phone.tab.shiran');

    const workUnread = this.phone.getUnreadCount('work');
    this.phoneTabWorkEl.innerHTML = `${escapeHtml(i18n.t('phone.tab.work'))} <span class="phone-tab-badge ${workUnread <= 0 ? 'hidden' : ''}" id="phone-work-unread">${workUnread}</span>`;

    this.phoneAvatarEl.textContent = isShiran ? (i18n.isRtl() ? 'ש' : 'S') : i18n.isRtl() ? 'א' : 'I';
    this.phoneContactNameEl.textContent = isShiran
      ? i18n.t('phone.contact.shiranName')
      : i18n.t('phone.contact.workName');
    this.phoneContactStatusEl.textContent = isShiran
      ? i18n.t('phone.contact.shiranStatus')
      : i18n.t('phone.contact.workStatus');
    this.phoneInputEl.placeholder = isShiran
      ? i18n.t('phone.placeholder.shiran')
      : i18n.t('phone.placeholder.work');

    const messages = this.phone.getMessages(activeThread);
    if (messages.length === 0) {
      this.phoneMessagesEl.innerHTML = `<div class="chat-day-divider">${escapeHtml(i18n.t('phone.empty'))}</div>`;
      this.lastRenderedMsgCount = 0;
      this.lastRenderedThread = activeThread;
      return;
    }

    const sameThread = this.lastRenderedThread === activeThread;
    const shouldAnimateLast = sameThread && messages.length > this.lastRenderedMsgCount;
    this.lastRenderedMsgCount = messages.length;
    this.lastRenderedThread = activeThread;

    const bubblesHtml = messages
      .map((m, i) => {
        const isOut = m.direction === 'outgoing';
        const animateClass = shouldAnimateLast && i === messages.length - 1 ? 'msg-pop-in' : '';
        const senderLabel =
          !isOut && !isShiran
            ? `<div class="chat-sender-tag">${escapeHtml(m.sender)}</div>`
            : '';
        return `
          <div class="chat-row ${isOut ? 'chat-row-out' : 'chat-row-in'} ${animateClass}">
            <div class="chat-bubble ${isOut ? 'chat-bubble-out' : 'chat-bubble-in'}">
              ${senderLabel}
              <div class="chat-bubble-text">${escapeHtml(m.text)}</div>
              <div class="chat-bubble-meta">
                <span>${escapeHtml(m.time)}</span>
                ${isOut ? '<span class="chat-ticks">✓✓</span>' : ''}
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    this.phoneMessagesEl.innerHTML = `<div class="chat-day-divider">${escapeHtml(i18n.t('phone.today'))}</div>${bubblesHtml}`;
    this.phoneMessagesEl.scrollTop = this.phoneMessagesEl.scrollHeight;
  }

  private renderCallOverlay(): void {
    const call = this.phone.getActiveCall();
    if (!call) {
      this.callOverlayEl.classList.add('hidden');
      this.callOverlayEl.innerHTML = '';
      return;
    }

    this.callOverlayEl.classList.remove('hidden');
    const isRinging = call.status === 'ringing';
    const statusLabel = isRinging ? i18n.t('call.ringing') : i18n.t('call.connected');
    const avatarChar = call.callerName.slice(0, 1).toUpperCase();

    this.callOverlayEl.innerHTML = `
      <div class="phone-call-card">
        <div class="phone-call-status">${escapeHtml(statusLabel)}</div>
        <div class="phone-call-avatar">${escapeHtml(avatarChar)}</div>
        <div class="phone-call-caller">${escapeHtml(call.callerName)}</div>
        <div class="phone-call-sub">${escapeHtml(call.subtitle)}</div>
        <div class="phone-call-actions">
          ${
            isRinging
              ? `
                <button type="button" class="call-action-btn call-btn-answer" id="btn-call-answer">${escapeHtml(i18n.t('call.answer'))}</button>
                <button type="button" class="call-action-btn call-btn-decline" id="btn-call-decline">${escapeHtml(i18n.t('call.decline'))}</button>
              `
              : `
                <button type="button" class="call-action-btn call-btn-decline" id="btn-call-hangup">${escapeHtml(i18n.t('call.hangup'))}</button>
              `
          }
        </div>
      </div>
    `;

    this.callOverlayEl.querySelector('#btn-call-answer')?.addEventListener('click', () => {
      this.phone.answerCall();
    });
    this.callOverlayEl.querySelector('#btn-call-decline')?.addEventListener('click', () => {
      this.phone.declineCall();
    });
    this.callOverlayEl.querySelector('#btn-call-hangup')?.addEventListener('click', () => {
      this.phone.endCall();
    });
  }

  private showToast(title: string, body: string, kind: 'phone' | 'collectible'): void {
    const toast = document.createElement('div');
    toast.className = `hud-panel hud-toast hud-toast-${kind}`;
    toast.innerHTML = `
      <div class="hud-toast-title">${escapeHtml(title)}</div>
      <div class="hud-toast-body">${escapeHtml(body)}</div>
    `;
    this.toastStackEl.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add('fade-out');
      window.setTimeout(() => toast.remove(), 280);
    }, 3600);
  }
}
