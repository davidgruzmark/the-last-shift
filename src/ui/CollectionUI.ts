import type { PerfumeCollection, PerfumeEntry } from '../collectibles/PerfumeCollection';
import type { WatchCollection, WatchEntry } from '../collectibles/WatchCollection';
import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';

export type CollectionTab = 'perfumes' | 'watches';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const PERFUME_SVG_PALETTES: Record<string, { glass: string; cap: string; mono: string; style: string }> = {
  'perfume-jpg-le-male': { glass: '#161922', cap: '#f4c430', mono: 'JPG', style: 'torso' },
  'perfume-armani-code': { glass: '#101319', cap: '#cbd5e1', mono: 'AC', style: 'tall' },
  'perfume-dior-sauvage': { glass: '#0c2448', cap: '#0f172a', mono: 'DS', style: 'cyl' },
  'perfume-jimmy-choo-man': { glass: '#475569', cap: '#1e222b', mono: 'JC', style: 'flask' },
};

function renderBottleSvg(entry: PerfumeEntry): string {
  const pal = PERFUME_SVG_PALETTES[entry.id] ?? { glass: '#0d1b38', cap: '#d4af37', mono: 'PF', style: 'flask' };
  const glassFill = entry.collected ? pal.glass : '#1e293b';
  const stroke = entry.collected ? entry.accentColor : 'rgba(148,163,184,0.35)';
  const capFill = entry.collected ? pal.cap : '#334155';
  const label = entry.collected ? pal.mono : '?';

  if (pal.style === 'torso') {
    return `
      <svg class="perfume-card-svg" width="56" height="72" viewBox="0 0 56 72" aria-hidden="true">
        <rect x="24" y="5" width="8" height="9" rx="1.5" fill="${capFill}" />
        <rect x="21" y="14" width="14" height="5" rx="1.5" fill="${capFill}" />
        <path d="M13 21 L43 21 L40 42 L37 64 L19 64 L16 42 Z" fill="${glassFill}" stroke="${stroke}" stroke-width="2" />
        <line x1="17" y1="30" x2="39" y2="30" stroke="${capFill}" stroke-width="1.6" />
        <line x1="18" y1="37" x2="38" y2="37" stroke="${capFill}" stroke-width="1.6" />
        <line x1="19" y1="44" x2="37" y2="44" stroke="${capFill}" stroke-width="1.6" />
        <text x="28" y="57" text-anchor="middle" fill="${stroke}" font-size="8.5" font-weight="800" font-family="sans-serif">${label}</text>
      </svg>
    `;
  }

  return `
    <svg class="perfume-card-svg" width="56" height="72" viewBox="0 0 56 72" aria-hidden="true">
      <rect x="20" y="5" width="16" height="11" rx="2" fill="${capFill}" />
      <rect x="22" y="16" width="12" height="5" rx="1" fill="${stroke}" opacity="0.85" />
      <path d="M15 24 L41 24 L43 31 L43 64 L13 64 L13 31 Z" fill="${glassFill}" stroke="${stroke}" stroke-width="2" />
      <rect x="17" y="37" width="22" height="15" rx="2" fill="#090d16" stroke="${stroke}" stroke-width="1" />
      <text x="28" y="48" text-anchor="middle" fill="${stroke}" font-size="8.5" font-weight="800" font-family="sans-serif">${label}</text>
    </svg>
  `;
}

function renderWatchSvg(entry: WatchEntry): string {
  const locked = !entry.collected;
  const stroke = locked ? 'rgba(148,163,184,0.4)' : entry.accentColor;
  const dialFill = locked ? '#111827' : '#090d16';
  const hands = !locked
    ? `<line x1="28" y1="36" x2="28" y2="26" stroke="${stroke}" stroke-width="2" stroke-linecap="round" />
       <line x1="28" y1="36" x2="34.5" y2="38" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" />
       <circle cx="28" cy="36" r="1.8" fill="${stroke}" />`
    : `<text x="28" y="39.5" text-anchor="middle" fill="${stroke}" font-size="10" font-weight="800" font-family="sans-serif">?</text>`;

  if (entry.rarity === 'Legendary') {
    // 18k Gold Rolex Daytona Ref. 126508: round gold Oyster case, 3 sub-dials, dual pushers, 3-link gold bracelet
    const strap = locked ? '#334155' : '#ca8a04';
    const goldMid = locked ? '#475569' : '#fef08a';
    return `
      <svg class="perfume-card-svg" width="56" height="72" viewBox="0 0 56 72" aria-hidden="true">
        <rect x="20" y="3" width="16" height="16" rx="2" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
        <rect x="25" y="3" width="6" height="16" fill="${goldMid}" opacity="0.88" />
        <rect x="20" y="53" width="16" height="16" rx="2" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
        <rect x="25" y="53" width="6" height="16" fill="${goldMid}" opacity="0.88" />
        <rect x="44" y="33.5" width="4" height="5" rx="1" fill="${stroke}" />
        <rect x="43" y="25" width="3" height="4" rx="1" fill="${stroke}" />
        <rect x="43" y="43" width="3" height="4" rx="1" fill="${stroke}" />
        <circle cx="28" cy="36" r="17.5" fill="${locked ? '#1e293b' : '#b45309'}" stroke="${stroke}" stroke-width="2.6" />
        <circle cx="28" cy="36" r="13.5" fill="${dialFill}" stroke="${stroke}" stroke-width="1.2" />
        ${!locked ? `<circle cx="22.5" cy="36" r="2.7" fill="#d4af37" opacity="0.85" /><circle cx="33.5" cy="36" r="2.7" fill="#d4af37" opacity="0.85" /><circle cx="28" cy="42.5" r="2.7" fill="#d4af37" opacity="0.85" />` : ''}
        ${hands}
      </svg>
    `;
  }

  if (entry.rarity === 'Epic') {
    // TAG Heuer Carrera Chronograph: steel lugs, dark racing tachymeter bezel, 3 sub-dials, dual pushers
    const strap = locked ? '#1e293b' : '#1e222b';
    return `
      <svg class="perfume-card-svg" width="56" height="72" viewBox="0 0 56 72" aria-hidden="true">
        <rect x="19" y="4" width="18" height="15" rx="2" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
        <rect x="19" y="53" width="18" height="15" rx="2" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
        <rect x="44" y="34" width="4" height="4" rx="1" fill="${stroke}" />
        <rect x="43" y="26" width="3" height="3.5" rx="1" fill="${stroke}" />
        <rect x="43" y="42.5" width="3" height="3.5" rx="1" fill="${stroke}" />
        <circle cx="28" cy="36" r="17" fill="#111827" stroke="${stroke}" stroke-width="2.4" />
        <circle cx="28" cy="36" r="13.2" fill="${dialFill}" stroke="${stroke}" stroke-width="1.2" />
        ${!locked ? `<circle cx="22.5" cy="36" r="2.5" fill="#1e293b" stroke="${stroke}" stroke-width="0.9" /><circle cx="33.5" cy="36" r="2.5" fill="#1e293b" stroke="${stroke}" stroke-width="0.9" /><circle cx="28" cy="42.5" r="2.5" fill="#1e293b" stroke="${stroke}" stroke-width="0.9" />` : ''}
        ${hands}
      </svg>
    `;
  }

  if (entry.rarity === 'Rare') {
    // Omega Seamaster Diver 300M: brushed steel case, navy bezel, 10-o'clock helium valve, 3-link steel bracelet
    const strap = locked ? '#334155' : '#64748b';
    return `
      <svg class="perfume-card-svg" width="56" height="72" viewBox="0 0 56 72" aria-hidden="true">
        <rect x="20" y="4" width="16" height="15" rx="1" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
        <rect x="20" y="53" width="16" height="15" rx="1" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
        <circle cx="13" cy="24" r="2.4" fill="#94a3b8" stroke="${stroke}" stroke-width="0.9" />
        <path d="M43 29 L47 32 L47 40 L43 43 Z" fill="#94a3b8" stroke="${stroke}" stroke-width="1" />
        <circle cx="28" cy="36" r="17.5" fill="${locked ? '#1e293b' : '#1e3a8a'}" stroke="${stroke}" stroke-width="2.6" stroke-dasharray="5 2" />
        <circle cx="28" cy="36" r="13" fill="${dialFill}" stroke="${stroke}" stroke-width="1" />
        ${!locked ? `<polygon points="28,20 26.2,23 29.8,23" fill="#e0f2fe" />` : ''}
        ${hands}
      </svg>
    `;
  }

  // Common — Casio G-Shock DW-5600E: matte-black octagonal shock bezel & rectangular LCD window
  const strap = locked ? '#334155' : '#181b22';
  return `
    <svg class="perfume-card-svg" width="56" height="72" viewBox="0 0 56 72" aria-hidden="true">
      <rect x="20" y="4" width="16" height="15" rx="2" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
      <rect x="20" y="53" width="16" height="15" rx="2" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
      <polygon points="20,18 36,18 45,27 45,45 36,54 20,54 11,45 11,27" fill="${locked ? '#1e293b' : '#1f242d'}" stroke="${stroke}" stroke-width="2.2" />
      <rect x="17" y="29" width="22" height="14" rx="2" fill="${locked ? '#111827' : '#88b09b'}" stroke="${stroke}" stroke-width="1" />
      ${!locked ? `<text x="28" y="39" text-anchor="middle" fill="#0f172a" font-size="8" font-weight="800" font-family="monospace">08:05</text>` : `<text x="28" y="39.5" text-anchor="middle" fill="${stroke}" font-size="10" font-weight="800" font-family="sans-serif">?</text>`}
    </svg>
  `;
}

/**
 * Renders the tabbed IKEA-styled Personal Collections modal (Perfumes + Watches),
 * reflecting live ownership, rarity tiers, and full localization.
 */
export class CollectionUI {
  private readonly wrapper: HTMLElement;
  private modalEl!: HTMLElement;
  private progressEl!: HTMLElement;
  private gridEl!: HTMLElement;
  private bannerEl!: HTMLElement;
  private perfumeTabEl!: HTMLButtonElement;
  private watchTabEl!: HTMLButtonElement;
  private readonly perfumes: PerfumeCollection;
  private readonly watches: WatchCollection;
  private readonly eventBus: EventBus<GameEvents>;
  private readonly onStateChange: () => void;
  private activeTab: CollectionTab = 'perfumes';
  private open = false;
  private unsubscribers: Array<() => void> = [];

  constructor(
    hudRoot: HTMLElement,
    perfumes: PerfumeCollection,
    watches: WatchCollection,
    eventBus: EventBus<GameEvents>,
    onStateChange: () => void,
  ) {
    this.perfumes = perfumes;
    this.watches = watches;
    this.eventBus = eventBus;
    this.onStateChange = onStateChange;

    this.wrapper = document.createElement('div');
    this.wrapper.id = 'collection-ui-layer';
    hudRoot.appendChild(this.wrapper);

    this.renderShell();

    this.unsubscribers.push(
      this.eventBus.on('collectible:collected', () => this.refresh()),
      this.eventBus.on('collection:changed', () => this.refresh()),
      i18n.onChange(() => this.renderShell()),
    );

    this.refresh();
  }

  getActiveTab(): CollectionTab {
    return this.activeTab;
  }

  setActiveTab(tab: CollectionTab): void {
    this.activeTab = tab;
    this.refresh();
  }

  isOpen(): boolean {
    return this.open;
  }

  openModal(tab?: CollectionTab): void {
    if (tab) this.activeTab = tab;
    this.refresh();
    this.open = true;
    this.modalEl.classList.remove('hidden');
    this.onStateChange();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.modalEl.classList.add('hidden');
    this.onStateChange();
  }

  toggle(): boolean {
    if (this.open) {
      this.close();
    } else {
      this.openModal();
    }
    return this.open;
  }

  refresh(): void {
    const pProg = this.perfumes.getProgress();
    const wProg = this.watches.getProgress();

    this.perfumeTabEl.classList.toggle('active', this.activeTab === 'perfumes');
    this.watchTabEl.classList.toggle('active', this.activeTab === 'watches');
    this.perfumeTabEl.textContent = `${i18n.t('collection.tab.perfumes')} (${pProg.collected}/${pProg.total})`;
    this.watchTabEl.textContent = `${i18n.t('collection.tab.watches')} (${wProg.collected}/${wProg.total})`;

    if (this.activeTab === 'perfumes') {
      this.progressEl.textContent = `${pProg.collected} / ${pProg.total}`;
      this.bannerEl.classList.add('hidden');
      const entries = this.perfumes.getEntries();
      this.gridEl.innerHTML = entries
        .map((entry) => {
          const cardClass = entry.collected ? 'perfume-item-card collected' : 'perfume-item-card locked';
          const statusText = entry.collected
            ? i18n.t('collection.status.collected')
            : i18n.t('collection.status.locked');
          const descText = entry.collected
            ? escapeHtml(entry.description)
            : escapeHtml(i18n.t('collection.lockedDesc'));
          const metaText = entry.collected
            ? `${escapeHtml(entry.acquisitionSource)} · ${escapeHtml(entry.flavorText)}`
            : escapeHtml(i18n.t('collection.lockedSource'));

          return `
            <div class="${cardClass}" data-perfume-id="${escapeHtml(entry.id)}" data-collected="${entry.collected}">
              <div class="perfume-art-wrap">${renderBottleSvg(entry)}</div>
              <div class="perfume-info">
                <div class="perfume-top-row">
                  <span class="perfume-name">${escapeHtml(entry.name)}</span>
                  <span class="perfume-status-badge">${escapeHtml(statusText)}</span>
                </div>
                <div class="perfume-rarity">${escapeHtml(entry.rarityLabel)}</div>
                <p class="perfume-desc">${descText}</p>
                <div class="perfume-source">${metaText}</div>
              </div>
            </div>
          `;
        })
        .join('');
    } else {
      this.progressEl.textContent = `${wProg.collected} / ${wProg.total}`;
      this.bannerEl.textContent = i18n.t('collection.watchSlowMoBanner');
      this.bannerEl.classList.toggle('hidden', !this.watches.hasLegendaryWatch());

      const entries = this.watches.getEntries();
      this.gridEl.innerHTML = entries
        .map((entry) => {
          const cardClass = entry.collected ? 'perfume-item-card collected' : 'perfume-item-card locked';
          const statusText = entry.collected
            ? i18n.t('collection.status.collected')
            : i18n.t('collection.status.locked');
          const descText = entry.collected
            ? escapeHtml(entry.description)
            : escapeHtml(i18n.t('collection.lockedDesc'));
          const metaText = entry.collected
            ? `${escapeHtml(entry.acquisitionSource)} · ${escapeHtml(entry.flavorText)}`
            : escapeHtml(i18n.t('collection.lockedSource'));

          return `
            <div class="${cardClass}" data-watch-id="${escapeHtml(entry.id)}" data-rarity="${escapeHtml(entry.rarity)}" data-collected="${entry.collected}">
              <div class="perfume-art-wrap">${renderWatchSvg(entry)}</div>
              <div class="perfume-info">
                <div class="perfume-top-row">
                  <span class="perfume-name">${escapeHtml(entry.name)}</span>
                  <span class="perfume-status-badge">${escapeHtml(statusText)}</span>
                </div>
                <div class="perfume-rarity">${escapeHtml(entry.rarityLabel)}</div>
                <p class="perfume-desc">${descText}</p>
                <div class="perfume-source">${metaText}</div>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.wrapper.remove();
  }

  private renderShell(): void {
    this.wrapper.innerHTML = `
      <div class="modal-backdrop ${this.open ? '' : 'hidden'}" id="collection-modal" role="dialog" aria-label="${i18n.t('collection.title')}">
        <div class="hud-panel collection-card">
          <div class="collection-header">
            <div>
              <div class="collection-tag">${escapeHtml(i18n.t('collection.tag'))}</div>
              <h2 class="collection-title">${escapeHtml(i18n.t('collection.title'))}</h2>
            </div>
            <div class="collection-header-actions">
              <span class="collection-progress-pill" id="collection-progress">0 / 5</span>
              <button type="button" class="hud-btn" id="btn-collection-close">${escapeHtml(i18n.t('collection.close'))}</button>
            </div>
          </div>

          <div class="collection-tabs" role="tablist" aria-label="${escapeHtml(i18n.t('collection.title'))}">
            <button type="button" class="hud-btn collection-tab-btn active" id="tab-collection-perfumes" role="tab"></button>
            <button type="button" class="hud-btn collection-tab-btn" id="tab-collection-watches" role="tab"></button>
          </div>

          <div class="collection-slowmo-banner hidden" id="collection-slowmo-banner"></div>
          <div class="collection-grid" id="collection-grid"></div>
        </div>
      </div>
    `;

    this.modalEl = this.wrapper.querySelector('#collection-modal')!;
    this.progressEl = this.wrapper.querySelector('#collection-progress')!;
    this.gridEl = this.wrapper.querySelector('#collection-grid')!;
    this.bannerEl = this.wrapper.querySelector('#collection-slowmo-banner')!;
    this.perfumeTabEl = this.wrapper.querySelector('#tab-collection-perfumes')!;
    this.watchTabEl = this.wrapper.querySelector('#tab-collection-watches')!;

    this.wrapper.querySelector('#btn-collection-close')!.addEventListener('click', () => this.close());
    this.perfumeTabEl.addEventListener('click', () => this.setActiveTab('perfumes'));
    this.watchTabEl.addEventListener('click', () => this.setActiveTab('watches'));

    this.refresh();
  }
}
