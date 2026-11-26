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

const PERFUME_SVG_PALETTES: Record<string, { glass: string; cap: string; mono: string }> = {
  'perfume-midnight-noir': { glass: '#0d1b38', cap: '#d4af37', mono: 'MN' },
  'perfume-ocean-king': { glass: '#0c4a6e', cap: '#38bdf8', mono: 'OK' },
  'perfume-royal-essence': { glass: '#4c1d95', cap: '#e9d5ff', mono: 'RE' },
  'perfume-the-boss': { glass: '#451a03', cap: '#f59e0b', mono: 'TB' },
  'perfume-kfir-signature': { glass: '#064e3b', cap: '#ffda1a', mono: 'KS' },
};

function renderBottleSvg(entry: PerfumeEntry): string {
  const pal = PERFUME_SVG_PALETTES[entry.id] ?? { glass: '#0d1b38', cap: '#d4af37', mono: 'PF' };
  const glassFill = entry.collected ? pal.glass : '#1e293b';
  const stroke = entry.collected ? entry.accentColor : 'rgba(148,163,184,0.35)';
  const capFill = entry.collected ? pal.cap : '#334155';
  const label = entry.collected ? pal.mono : '?';

  return `
    <svg class="perfume-card-svg" width="56" height="72" viewBox="0 0 56 72" aria-hidden="true">
      <rect x="21" y="4" width="14" height="10" rx="2" fill="${capFill}" />
      <rect x="23" y="14" width="10" height="6" rx="1" fill="${capFill}" opacity="0.85" />
      <path d="M16 24 L40 24 L44 32 L44 64 L12 64 L12 32 Z" fill="${glassFill}" stroke="${stroke}" stroke-width="2" />
      <rect x="17" y="37" width="22" height="15" rx="2" fill="#090d16" stroke="${stroke}" stroke-width="1" />
      <text x="28" y="48" text-anchor="middle" fill="${stroke}" font-size="9" font-weight="800" font-family="sans-serif">${label}</text>
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
    // Octagonal Gold Skeleton Chronometer + two-tone bracelet + dual pushers + tourbillon wheel
    const strap = locked ? '#334155' : '#475569';
    const goldMid = locked ? '#475569' : '#ffda1a';
    return `
      <svg class="perfume-card-svg" width="56" height="72" viewBox="0 0 56 72" aria-hidden="true">
        <rect x="20" y="3" width="16" height="16" rx="2" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
        <rect x="25" y="3" width="6" height="16" fill="${goldMid}" opacity="0.85" />
        <rect x="20" y="53" width="16" height="16" rx="2" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
        <rect x="25" y="53" width="6" height="16" fill="${goldMid}" opacity="0.85" />
        <rect x="44" y="33.5" width="4" height="5" rx="1" fill="${stroke}" />
        <rect x="43" y="25" width="3" height="4" rx="1" fill="${stroke}" />
        <rect x="43" y="43" width="3" height="4" rx="1" fill="${stroke}" />
        <polygon points="20,18 36,18 45,27 45,45 36,54 20,54 11,45 11,27" fill="#1e293b" stroke="${stroke}" stroke-width="2.4" />
        <circle cx="28" cy="36" r="13.5" fill="${dialFill}" stroke="${stroke}" stroke-width="1.2" />
        ${!locked ? `<circle cx="28" cy="43" r="4" fill="none" stroke="#ffda1a" stroke-width="1.4" stroke-dasharray="2 1.5" />` : ''}
        ${hands}
      </svg>
    `;
  }

  if (entry.rarity === 'Epic') {
    // Cushion Sport Chronograph + 3 sub-dials + dual pushers + ribbed strap
    const strap = locked ? '#1e293b' : '#312e81';
    return `
      <svg class="perfume-card-svg" width="56" height="72" viewBox="0 0 56 72" aria-hidden="true">
        <rect x="19" y="4" width="18" height="15" rx="2" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
        <rect x="19" y="53" width="18" height="15" rx="2" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
        <rect x="44" y="34" width="4" height="4" rx="1" fill="${stroke}" />
        <rect x="43" y="26" width="3" height="3.5" rx="1" fill="${stroke}" />
        <rect x="43" y="42.5" width="3" height="3.5" rx="1" fill="${stroke}" />
        <rect x="11" y="18" width="34" height="36" rx="8" fill="#1e1b4b" stroke="${stroke}" stroke-width="2.4" />
        <circle cx="28" cy="36" r="13.5" fill="${dialFill}" stroke="${stroke}" stroke-width="1.2" />
        ${!locked ? `<circle cx="22.5" cy="32.5" r="2.6" fill="#312e81" stroke="${stroke}" stroke-width="0.9" /><circle cx="33.5" cy="32.5" r="2.6" fill="#312e81" stroke="${stroke}" stroke-width="0.9" /><circle cx="28" cy="43" r="2.6" fill="#312e81" stroke="${stroke}" stroke-width="0.9" />` : ''}
        ${hands}
      </svg>
    `;
  }

  if (entry.rarity === 'Rare') {
    // Silver Guard Diver + notched navy bezel + crown guards + 3-link steel bracelet
    const strap = locked ? '#334155' : '#64748b';
    return `
      <svg class="perfume-card-svg" width="56" height="72" viewBox="0 0 56 72" aria-hidden="true">
        <rect x="20" y="4" width="16" height="15" rx="1" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
        <rect x="20" y="53" width="16" height="15" rx="1" fill="${strap}" stroke="${stroke}" stroke-width="1.2" />
        <path d="M43 29 L47 32 L47 40 L43 43 Z" fill="#94a3b8" stroke="${stroke}" stroke-width="1" />
        <circle cx="28" cy="36" r="17.5" fill="${locked ? '#1e293b' : '#1e3a8a'}" stroke="${stroke}" stroke-width="2.6" stroke-dasharray="5 2" />
        <circle cx="28" cy="36" r="13" fill="${dialFill}" stroke="${stroke}" stroke-width="1" />
        ${!locked ? `<polygon points="28,20 26.2,23 29.8,23" fill="#e0f2fe" />` : ''}
        ${hands}
      </svg>
    `;
  }

  // Common — Classic Field Watch + stitched dark leather strap + off-white dial
  const leather = locked ? '#334155' : '#4b2e1e';
  return `
    <svg class="perfume-card-svg" width="56" height="72" viewBox="0 0 56 72" aria-hidden="true">
      <rect x="21" y="4" width="14" height="16" rx="2" fill="${leather}" stroke="${stroke}" stroke-width="1.2" />
      <rect x="21" y="52" width="14" height="16" rx="2" fill="${leather}" stroke="${stroke}" stroke-width="1.2" />
      <rect x="44" y="34" width="3.5" height="4" rx="1" fill="${stroke}" />
      <circle cx="28" cy="36" r="16.5" fill="${locked ? '#1e293b' : '#f4f1ea'}" stroke="${stroke}" stroke-width="2.4" />
      ${!locked ? `<line x1="28" y1="22" x2="28" y2="25" stroke="#334155" stroke-width="1.6" /><line x1="28" y1="47" x2="28" y2="50" stroke="#334155" stroke-width="1.6" /><line x1="28" y1="36" x2="28" y2="26" stroke="#1e293b" stroke-width="2" stroke-linecap="round" /><line x1="28" y1="36" x2="34" y2="38" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round" />` : `<text x="28" y="39.5" text-anchor="middle" fill="${stroke}" font-size="10" font-weight="800" font-family="sans-serif">?</text>`}
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
