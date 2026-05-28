import {
  type Station,
  STORE_EVENT,
  addToHistory,
  getFavorites,
  getHistory,
  isFavorite,
  toggleFavorite,
} from './store';
import { COUNTRIES } from './countries';

const API_STATIONS = '/api/stations';
const API_VOTE = '/api/vote';
const API_NOW_PLAYING = '/api/now-playing';
const STORAGE_KEY = 'wrs-last-station';
const VOLUME_KEY = 'wrs-volume';
const VIEW_KEY = 'wrs-view';
const COUNTRY_KEY = 'wrs-country';
const PAGE_SIZE = 24;
// Upper bound of stations loaded per country in one request. Large countries are
// returned ordered by popularity, so this is effectively "the top N stations".
const FETCH_LIMIT = 1000;
const SONG_POLL_MS = 30_000;

// Maps Radio Browser tag keywords to a tidy display genre.
const GENRE_MAP: Record<string, string> = {
  pop: 'Pop', rock: 'Rock', jazz: 'Jazz', classical: 'Classical', classic: 'Classical',
  news: 'News', talk: 'Talk', dance: 'Dance', electronic: 'Electronic', house: 'Electronic',
  techno: 'Electronic', 'hip hop': 'Hip-Hop', hiphop: 'Hip-Hop', rap: 'Hip-Hop',
  country: 'Country', folk: 'Folk', metal: 'Metal', '80s': 'Oldies', '90s': 'Oldies',
  oldies: 'Oldies', retro: 'Oldies', sport: 'Sports', sports: 'Sports',
  ambient: 'Chill', chillout: 'Chill', lounge: 'Chill', chill: 'Chill',
  reggae: 'Reggae', blues: 'Blues', soul: 'Soul', 'r&b': 'R&B', rnb: 'R&B',
};

type View = 'list' | 'grid';
type Mode = 'browse' | 'favorites' | 'history';
type PlayState = 'playing' | 'paused' | 'loading' | 'error';

class Player {
  private mode: Mode;
  private audio = new Audio();
  private all: Station[] = [];
  private filtered: Station[] = [];
  private page = 1;
  private current: Station | null = null;
  private state: PlayState = 'paused';

  // Player section refs
  private rootEl: HTMLElement;
  private statusEl: HTMLElement;
  private stationsEl: HTMLElement;
  private searchEl: HTMLInputElement | null;
  private countEl: HTMLElement;
  private pagerEl: HTMLElement | null;
  private viewButtons: NodeListOf<HTMLButtonElement>;
  private view: View = 'list';
  private stationCards = new Map<string, HTMLElement>();
  private activeGenre = 'all';
  private genreContainer: HTMLElement | null = null;
  private countrySelect: HTMLSelectElement | null = null;
  private country = '';
  private loadToken = 0;

  // Sleep timer
  private sleepTimeout: ReturnType<typeof setTimeout> | null = null;
  private sleepEnd = 0;
  private sleepInterval: ReturnType<typeof setInterval> | null = null;

  // Now-playing song
  private songPollTimer: ReturnType<typeof setInterval> | null = null;
  private npSongEl: HTMLElement | null = null;

  // Mini bar refs
  private nowPlaying: HTMLElement;
  private npLogo: HTMLElement;
  private npName: HTMLElement;
  private npState: HTMLElement;
  private npToggle: HTMLButtonElement;
  private npExpand: HTMLButtonElement;
  private npPrev: HTMLButtonElement;
  private npNext: HTMLButtonElement;

  // Modal refs
  private modal: HTMLElement;
  private modalLogo: HTMLElement;
  private modalName: HTMLElement;
  private modalLang: HTMLElement;
  private modalState: HTMLElement;
  private modalTags: HTMLElement;
  private modalToggle: HTMLButtonElement;
  private modalPrev: HTMLButtonElement;
  private modalNext: HTMLButtonElement;
  private modalVolume: HTMLInputElement;
  private modalClose: HTMLButtonElement;
  private modalFav: HTMLButtonElement;
  private modalVu: HTMLElement;
  private modalVote: HTMLButtonElement;
  private modalVoteLabel: HTMLElement;
  private modalVoteCount: HTMLElement;

  constructor(root: HTMLElement) {
    this.rootEl = root;
    this.mode = (root.dataset.mode as Mode) || 'browse';
    this.statusEl = root.querySelector<HTMLElement>('[data-status]')!;
    this.stationsEl = root.querySelector<HTMLElement>('[data-stations]')!;
    this.searchEl = root.querySelector<HTMLInputElement>('[data-search]');
    this.countEl = root.querySelector<HTMLElement>('[data-count]')!;
    this.pagerEl = root.querySelector<HTMLElement>('[data-pager]');
    this.viewButtons = root.querySelectorAll<HTMLButtonElement>('.vt-btn');
    this.countrySelect = root.querySelector<HTMLSelectElement>('[data-country]');

    const savedView = localStorage.getItem(VIEW_KEY) as View | null;
    this.view = savedView === 'grid' ? 'grid' : 'list';
    this.stationsEl.classList.add(`view-${this.view}`);
    this.viewButtons.forEach((b) => {
      b.classList.toggle('active', b.dataset.view === this.view);
      b.addEventListener('click', () => this.setView(b.dataset.view as View));
    });

    this.nowPlaying = document.querySelector<HTMLElement>('[data-now-playing]')!;
    this.npLogo = this.nowPlaying.querySelector<HTMLElement>('[data-np-logo]')!;
    this.npName = this.nowPlaying.querySelector<HTMLElement>('[data-np-name]')!;
    this.npState = this.nowPlaying.querySelector<HTMLElement>('[data-np-state]')!;
    this.npToggle = this.nowPlaying.querySelector<HTMLButtonElement>('[data-np-toggle]')!;
    this.npExpand = this.nowPlaying.querySelector<HTMLButtonElement>('[data-np-expand]')!;
    this.npPrev = this.nowPlaying.querySelector<HTMLButtonElement>('[data-np-prev]')!;
    this.npNext = this.nowPlaying.querySelector<HTMLButtonElement>('[data-np-next]')!;

    this.modal = document.querySelector<HTMLElement>('[data-modal]')!;
    this.modalLogo = this.modal.querySelector<HTMLElement>('[data-modal-logo]')!;
    this.modalName = this.modal.querySelector<HTMLElement>('[data-modal-name]')!;
    this.modalLang = this.modal.querySelector<HTMLElement>('[data-modal-lang]')!;
    this.modalState = this.modal.querySelector<HTMLElement>('[data-modal-state]')!;
    this.modalTags = this.modal.querySelector<HTMLElement>('[data-modal-tags]')!;
    this.modalToggle = this.modal.querySelector<HTMLButtonElement>('[data-modal-toggle]')!;
    this.modalPrev = this.modal.querySelector<HTMLButtonElement>('[data-modal-prev]')!;
    this.modalNext = this.modal.querySelector<HTMLButtonElement>('[data-modal-next]')!;
    this.modalVolume = this.modal.querySelector<HTMLInputElement>('[data-modal-volume]')!;
    this.modalClose = this.modal.querySelector<HTMLButtonElement>('[data-modal-close]')!;
    this.modalFav = this.modal.querySelector<HTMLButtonElement>('[data-modal-fav]')!;
    this.modalVu = this.modal.querySelector<HTMLElement>('[data-modal-vu]')!;
    this.modalVote = document.querySelector<HTMLButtonElement>('[data-modal-vote]')!;
    this.modalVoteLabel = document.querySelector<HTMLElement>('[data-vote-label]')!;
    this.modalVoteCount = document.querySelector<HTMLElement>('[data-vote-count]')!;

    this.audio.preload = 'none';
    const savedVol = parseFloat(localStorage.getItem(VOLUME_KEY) || '0.8');
    this.audio.volume = isNaN(savedVol) ? 0.8 : savedVol;
    this.modalVolume.value = String(this.audio.volume);

    this.audio.addEventListener('playing', () => this.setState('playing'));
    this.audio.addEventListener('pause', () => this.setState('paused'));
    this.audio.addEventListener('waiting', () => this.setState('loading'));
    this.audio.addEventListener('error', () => this.setState('error'));

    this.npToggle.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(); });
    this.npPrev.addEventListener('click', (e) => { e.stopPropagation(); this.step(-1); });
    this.npNext.addEventListener('click', (e) => { e.stopPropagation(); this.step(1); });
    this.npExpand.addEventListener('click', (e) => { e.stopPropagation(); this.openModal(); });
    this.nowPlaying.addEventListener('click', (e) => {
      if (e.target === this.nowPlaying || (e.target as HTMLElement).closest('.np-info')) {
        this.openModal();
      }
    });
    this.modalToggle.addEventListener('click', () => this.toggle());
    this.modalPrev.addEventListener('click', () => this.step(-1));
    this.modalNext.addEventListener('click', () => this.step(1));
    this.modalClose.addEventListener('click', () => this.closeModal());
    this.modalFav.addEventListener('click', () => {
      if (!this.current) return;
      toggleFavorite(this.current);
    });
    this.modalVote.addEventListener('click', () => this.vote());
    const shareBtn = document.querySelector<HTMLButtonElement>('[data-modal-share]');
    if (shareBtn) shareBtn.addEventListener('click', () => this.share());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('visible')) this.closeModal();
    });
    this.modalVolume.addEventListener('input', () => {
      const v = parseFloat(this.modalVolume.value);
      this.audio.volume = v;
      localStorage.setItem(VOLUME_KEY, String(v));
    });

    if (this.searchEl) this.searchEl.addEventListener('input', () => this.applyFilter());
    this.genreContainer = document.querySelector<HTMLElement>('[data-genres]');
    this.npSongEl = document.querySelector<HTMLElement>('[data-np-song]');

    // Genre filter (delegated, attached once)
    if (this.genreContainer) {
      this.genreContainer.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-genre]');
        if (!btn) return;
        this.activeGenre = btn.dataset.genre || 'all';
        this.genreContainer!.querySelectorAll('.genre-pill').forEach((b) =>
          b.classList.toggle('active', (b as HTMLElement).dataset.genre === this.activeGenre)
        );
        this.applyFilter();
      });
    }

    // Country selector (browse mode)
    if (this.countrySelect) {
      this.countrySelect.addEventListener('change', () => {
        if (this.searchEl) this.searchEl.value = '';
        void this.loadCountry(this.countrySelect!.value);
      });
    }

    // Pagination (delegated, attached once)
    if (this.pagerEl) {
      this.pagerEl.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-page]');
        if (!btn || btn.disabled) return;
        this.setPage(parseInt(btn.dataset.page || '1', 10));
      });
    }

    // Sleep timer
    const sleepToggle = document.querySelector<HTMLButtonElement>('[data-sleep-toggle]');
    const sleepOptions = document.querySelector<HTMLElement>('[data-sleep-options]');
    if (sleepToggle && sleepOptions) {
      sleepToggle.addEventListener('click', () => {
        sleepOptions.hidden = !sleepOptions.hidden;
      });
      sleepOptions.querySelectorAll<HTMLButtonElement>('[data-sleep-min]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mins = parseInt(btn.dataset.sleepMin || '0');
          this.setSleepTimer(mins);
          sleepOptions.hidden = true;
        });
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === ' ' && !this.modal.classList.contains('visible')) { e.preventDefault(); this.toggle(); }
      if (e.key === 'ArrowLeft') this.step(-1);
      if (e.key === 'ArrowRight') this.step(1);
      if (e.key === 'm' || e.key === 'M') { this.audio.muted = !this.audio.muted; }
    });

    document.addEventListener(STORE_EVENT, (e) => {
      const detail = (e as CustomEvent).detail as { kind: string };
      if (detail.kind === 'favorites') this.refreshFavStars();
      if (this.mode === 'favorites' && detail.kind === 'favorites') this.reloadFromStore();
      if (this.mode === 'history' && detail.kind === 'history') this.reloadFromStore();
    });
  }

  async init() {
    try {
      if (this.mode === 'browse') {
        this.country = localStorage.getItem(COUNTRY_KEY) || '';
        this.buildCountrySelect();
        this.showToolbar();
        await this.loadCountry(this.country);
        return;
      }

      this.all = this.mode === 'favorites' ? getFavorites() : getHistory().map((e) => e.station);
      if (this.all.length === 0) {
        this.showEmpty();
        return;
      }
      this.statusEl.style.display = 'none';
      this.showToolbar();
      this.restoreLast();
      this.applyFilter();
    } catch (err) {
      console.error(err);
      this.showError('We couldn’t load the stations.');
    }
  }

  private showToolbar() {
    const toolbar = document.querySelector<HTMLElement>('.player-toolbar');
    if (toolbar) toolbar.style.display = '';
  }

  private buildCountrySelect() {
    if (!this.countrySelect) return;
    const opts = ['<option value="">Top stations (worldwide)</option>']
      .concat(COUNTRIES.map((c) => `<option value="${escapeAttr(c.code)}">${escapeHtml(c.name)}</option>`));
    this.countrySelect.innerHTML = opts.join('');
    this.countrySelect.value = this.country;
  }

  /** Load all stations for a country at once (empty code = worldwide top). */
  private async loadCountry(code: string) {
    const token = ++this.loadToken;
    this.country = code;
    try { localStorage.setItem(COUNTRY_KEY, code); } catch { /* ignore */ }
    this.all = [];
    this.activeGenre = 'all';
    this.page = 1;
    this.stationCards.clear();
    this.stationsEl.innerHTML = '';
    if (this.pagerEl) { this.pagerEl.innerHTML = ''; this.pagerEl.style.display = 'none'; }
    this.statusEl.style.display = '';
    this.statusEl.innerHTML = '<div class="spinner"></div><p>Loading stations…</p>';

    let list: Station[];
    try {
      list = await this.fetchAll(code);
    } catch (err) {
      if (token !== this.loadToken) return;
      console.error(err);
      this.showError('We couldn’t load the stations.');
      return;
    }
    if (token !== this.loadToken) return;

    this.all = list;
    this.statusEl.style.display = 'none';
    if (this.all.length === 0) {
      this.showEmpty();
      if (this.genreContainer) { this.genreContainer.style.display = 'none'; this.genreContainer.innerHTML = ''; }
      this.filtered = [];
      this.updateCount(1);
      return;
    }
    this.buildGenreFilters();
    this.restoreLast();
    this.applyFilter();
  }

  /** Fetch the full station list for the current country in one request. */
  private async fetchAll(code: string): Promise<Station[]> {
    const params = new URLSearchParams({ limit: String(FETCH_LIMIT) });
    if (code) params.set('country', code);
    const res = await fetch(`${API_STATIONS}?${params}`);
    if (!res.ok) throw new Error('API ' + res.status);
    const list: Station[] = await res.json();
    const seen = new Set<string>();
    const deduped: Station[] = [];
    for (const s of list) {
      if (!s.stationuuid || seen.has(s.stationuuid)) continue;
      seen.add(s.stationuuid);
      deduped.push(s);
    }
    return deduped;
  }

  /** Restore the last-played station into the mini bar (paused), if present. */
  private restoreLast() {
    if (this.current) return;
    const lastId = localStorage.getItem(STORAGE_KEY);
    if (!lastId) return;
    const s = this.all.find((x) => x.stationuuid === lastId);
    if (s) {
      this.current = s;
      this.showNowPlaying(s, 'paused');
      this.updateNavButtons();
    }
  }

  /** Re-source the in-memory list from localStorage and re-render. */
  private reloadFromStore() {
    if (this.mode === 'favorites') this.all = getFavorites();
    else if (this.mode === 'history') this.all = getHistory().map((e) => e.station);
    if (this.all.length === 0) {
      this.showEmpty();
      const toolbar = document.querySelector<HTMLElement>('.player-toolbar');
      if (toolbar) toolbar.style.display = 'none';
      this.stationsEl.innerHTML = '';
      this.stationCards.clear();
      if (this.pagerEl) { this.pagerEl.innerHTML = ''; this.pagerEl.style.display = 'none'; }
      return;
    }
    this.statusEl.style.display = 'none';
    this.showToolbar();
    this.applyFilter();
  }

  private recomputeFiltered() {
    const q = this.searchEl ? this.searchEl.value.trim().toLowerCase() : '';
    let list = this.all;
    if (this.activeGenre !== 'all') {
      list = list.filter((s) => this.stationMatchesGenre(s, this.activeGenre));
    }
    this.filtered = q
      ? list.filter((s) =>
          s.name.toLowerCase().includes(q) || (s.tags || '').toLowerCase().includes(q)
        )
      : list;
  }

  private applyFilter() {
    this.recomputeFiltered();
    this.page = 1;
    this.renderPage();
    this.updateNavButtons();
  }

  private stationMatchesGenre(s: Station, genre: string): boolean {
    const tags = (s.tags || '').toLowerCase();
    for (const [key, label] of Object.entries(GENRE_MAP)) {
      if (label === genre && tags.includes(key)) return true;
    }
    return false;
  }

  private buildGenreFilters() {
    if (!this.genreContainer) return;
    const genreCounts = new Map<string, number>();
    for (const s of this.all) {
      const tags = (s.tags || '').toLowerCase();
      const matched = new Set<string>();
      for (const [key, label] of Object.entries(GENRE_MAP)) {
        if (tags.includes(key)) matched.add(label);
      }
      for (const label of matched) {
        genreCounts.set(label, (genreCounts.get(label) || 0) + 1);
      }
    }
    const sorted = [...genreCounts.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      this.genreContainer.style.display = 'none';
      this.genreContainer.innerHTML = '';
      return;
    }

    this.genreContainer.style.display = '';
    this.genreContainer.innerHTML = '<button class="genre-pill active" data-genre="all">All</button>'
      + sorted.map(([name]) =>
        `<button class="genre-pill" data-genre="${escapeAttr(name)}">${escapeHtml(name)}</button>`
      ).join('');
  }

  private setSleepTimer(minutes: number) {
    if (this.sleepTimeout) clearTimeout(this.sleepTimeout);
    if (this.sleepInterval) clearInterval(this.sleepInterval);
    this.sleepTimeout = null;
    this.sleepInterval = null;
    this.sleepEnd = 0;
    const label = document.querySelector<HTMLElement>('[data-sleep-label]');
    if (minutes <= 0) {
      if (label) label.textContent = 'Timer';
      return;
    }
    this.sleepEnd = Date.now() + minutes * 60_000;
    this.sleepTimeout = setTimeout(() => {
      this.audio.pause();
      this.setSleepTimer(0);
    }, minutes * 60_000);
    this.sleepInterval = setInterval(() => {
      const left = Math.max(0, Math.ceil((this.sleepEnd - Date.now()) / 60_000));
      if (label) label.textContent = `${left} min`;
    }, 10_000);
    if (label) label.textContent = `${minutes} min`;
  }

  private startSongPoll() {
    this.stopSongPoll();
    this.fetchNowPlaying();
    this.songPollTimer = setInterval(() => this.fetchNowPlaying(), SONG_POLL_MS);
  }

  private stopSongPoll() {
    if (this.songPollTimer) clearInterval(this.songPollTimer);
    this.songPollTimer = null;
  }

  private async fetchNowPlaying() {
    if (!this.current || this.state !== 'playing') return;
    try {
      const res = await fetch(API_NOW_PLAYING, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: this.current.url_resolved }),
      });
      const data = await res.json();
      const song = data.title || '';
      if (this.npSongEl) this.npSongEl.textContent = song;
      const modalSong = document.querySelector<HTMLElement>('[data-modal-song]');
      if (modalSong) modalSong.textContent = song;
    } catch { /* ignore */ }
  }

  private updateCount(totalPages: number) {
    const shown = this.filtered.length;
    const noun = this.mode === 'favorites' ? 'favorites' : this.mode === 'history' ? 'in history' : 'stations';
    let txt = `${shown} ${noun}`;
    if (totalPages > 1) txt += ` · Page ${this.page} of ${totalPages}`;
    this.countEl.textContent = txt;
  }

  private renderPage(scroll = false) {
    const total = this.filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (this.page > totalPages) this.page = totalPages;
    if (this.page < 1) this.page = 1;

    this.stationsEl.innerHTML = '';
    this.stationCards.clear();

    if (total === 0) {
      this.stationsEl.innerHTML = '<p class="empty">No stations match your filters.</p>';
      this.buildPager(1);
      this.updateCount(1);
      return;
    }

    const start = (this.page - 1) * PAGE_SIZE;
    const slice = this.filtered.slice(start, start + PAGE_SIZE);
    const frag = document.createDocumentFragment();
    for (const s of slice) {
      const card = this.makeStationCard(s);
      this.stationCards.set(s.stationuuid, card);
      frag.appendChild(card);
    }
    this.stationsEl.appendChild(frag);

    this.buildPager(totalPages);
    this.updateCount(totalPages);
    this.updateActiveCard(this.current && !this.audio.paused ? this.current.stationuuid : null);
    if (scroll) {
      const top = this.rootEl.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  private buildPager(totalPages: number) {
    if (!this.pagerEl) return;
    if (totalPages <= 1) {
      this.pagerEl.innerHTML = '';
      this.pagerEl.style.display = 'none';
      return;
    }
    this.pagerEl.style.display = '';
    const cur = this.page;
    const parts: string[] = [];
    parts.push(`<button class="pager-btn pager-nav" data-page="${cur - 1}" ${cur === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`);
    let prev = 0;
    for (const p of pageWindow(cur, totalPages)) {
      if (prev && p - prev > 1) parts.push('<span class="pager-gap">…</span>');
      parts.push(`<button class="pager-btn ${p === cur ? 'active' : ''}" data-page="${p}" ${p === cur ? 'aria-current="page"' : ''}>${p}</button>`);
      prev = p;
    }
    parts.push(`<button class="pager-btn pager-nav" data-page="${cur + 1}" ${cur === totalPages ? 'disabled' : ''} aria-label="Next page">›</button>`);
    this.pagerEl.innerHTML = parts.join('');
  }

  private setPage(p: number) {
    const totalPages = Math.max(1, Math.ceil(this.filtered.length / PAGE_SIZE));
    const next = Math.min(totalPages, Math.max(1, p));
    if (next === this.page) return;
    this.page = next;
    this.renderPage(true);
  }

  private makeStationCard(s: Station): HTMLElement {
    const card = document.createElement('div');
    card.className = 'station';
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    const tag = ((s.tags || '').split(',')[0] || s.codec || '').trim();
    const initial = s.name.charAt(0).toUpperCase();
    const logo = s.favicon
      ? `<img src="${escapeAttr(s.favicon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fallback',textContent:'${initial}'}))" />`
      : `<span class="fallback">${initial}</span>`;
    const fav = isFavorite(s.stationuuid);
    const votes = s.votes > 0 ? `<span class="station-votes" title="${s.votes} votes">★ ${s.votes}</span>` : '';
    const bitrate = s.bitrate > 0 ? `<span class="station-bitrate">${s.bitrate} kbps</span>` : '';
    const place = (s.country || '').trim();
    const placeChip = this.mode === 'browse' && place ? `<span class="station-bitrate">${escapeHtml(place)}</span>` : '';
    card.innerHTML = `
      <div class="station-logo">${logo}</div>
      <div class="station-meta">
        <p class="station-name">${escapeHtml(s.name)}</p>
        <span class="station-tag-row">${tag ? `<span class="station-tag">${escapeHtml(tag)}</span>` : ''}${placeChip}${bitrate}${votes}</span>
      </div>
      <button class="fav-btn ${fav ? 'active' : ''}" data-fav type="button" aria-label="${fav ? 'Remove from favorites' : 'Add to favorites'}" aria-pressed="${fav}">
        ${ICON_STAR}
      </button>
    `;
    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-fav]')) return;
      this.play(s);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.play(s);
      }
    });
    const favBtn = card.querySelector<HTMLButtonElement>('[data-fav]')!;
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(s);
    });
    return card;
  }

  private setView(view: View) {
    if (view !== 'list' && view !== 'grid') return;
    if (view === this.view) return;
    this.view = view;
    localStorage.setItem(VIEW_KEY, view);
    this.stationsEl.classList.remove('view-list', 'view-grid');
    this.stationsEl.classList.add(`view-${view}`);
    this.viewButtons.forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  }

  private showEmpty() {
    const msg =
      this.mode === 'favorites'
        ? 'You don’t have any favorites yet.<br>Tap the star on a station to save it here.'
        : this.mode === 'history'
          ? 'Your history is empty.<br>Start listening and stations will appear here.'
          : 'No stations found for this country.<br>Try another country from the menu above.';
    this.statusEl.style.display = '';
    this.statusEl.innerHTML = `<p class="empty">${msg}</p>${this.mode !== 'browse' ? '<a class="cta cta-secondary" href="/">Browse all stations</a>' : ''}`;
  }

  private showError(msg: string) {
    this.statusEl.style.display = '';
    this.statusEl.innerHTML = `<p>${escapeHtml(msg)}<br>Please try again or check your internet connection.</p>`;
  }

  private play(s: Station) {
    if (this.current?.stationuuid === s.stationuuid && !this.audio.paused) {
      this.audio.pause();
      return;
    }
    this.current = s;
    this.audio.src = s.url_resolved;
    void this.audio.play().catch(() => this.setState('error'));
    this.showNowPlaying(s, 'loading');
    this.goToStation(s);
    localStorage.setItem(STORAGE_KEY, s.stationuuid);
    addToHistory(s);
    this.updateNavButtons();
  }

  /** Make sure the station's page is shown and its card highlighted. */
  private goToStation(s: Station) {
    const idx = this.filtered.findIndex((x) => x.stationuuid === s.stationuuid);
    if (idx >= 0) {
      const p = Math.floor(idx / PAGE_SIZE) + 1;
      if (p !== this.page) {
        this.page = p;
        this.renderPage();
      }
    }
    this.updateActiveCard(s.stationuuid);
  }

  private toggle() {
    if (!this.current) return;
    if (this.audio.paused) {
      if (!this.audio.src) this.audio.src = this.current.url_resolved;
      void this.audio.play().catch(() => this.setState('error'));
    } else {
      this.audio.pause();
    }
  }

  /** Move to prev/next station within current filtered list, with wrap-around. */
  private step(delta: number) {
    if (this.filtered.length < 2) return;
    let idx = this.current
      ? this.filtered.findIndex((s) => s.stationuuid === this.current!.stationuuid)
      : -1;
    if (idx < 0) idx = 0;
    const len = this.filtered.length;
    const next = (idx + delta + len) % len;
    this.play(this.filtered[next]);
  }

  private updateNavButtons() {
    const enabled = this.filtered.length > 1;
    this.npPrev.disabled = !enabled;
    this.npNext.disabled = !enabled;
    this.modalPrev.disabled = !enabled;
    this.modalNext.disabled = !enabled;
  }

  private openModal() {
    if (!this.current) return;
    this.modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  private closeModal() {
    this.modal.classList.remove('visible');
    document.body.style.overflow = '';
  }

  private showNowPlaying(s: Station, state: PlayState) {
    this.nowPlaying.classList.add('visible');
    const initial = s.name.charAt(0).toUpperCase();
    const logoHtml = s.favicon
      ? `<img src="${escapeAttr(s.favicon)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fallback',textContent:'${initial}'}))" />`
      : `<span class="fallback">${initial}</span>`;
    this.npLogo.innerHTML = logoHtml;
    this.npName.textContent = s.name;
    this.modalLogo.innerHTML = logoHtml;
    this.modalName.textContent = s.name;
    this.modalLang.textContent = s.country || s.language || '';
    this.renderTags(s);
    this.refreshFavStars();
    this.updateVoteDisplay(s);
    this.setState(state);
  }

  private renderTags(s: Station) {
    const tags = (s.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 3);
    this.modalTags.innerHTML = tags
      .map((t) => `<span class="tag-chip">${escapeHtml(t.toUpperCase())}</span>`)
      .join('');
  }

  private updateVoteDisplay(s: Station) {
    this.modalVoteCount.textContent = s.votes > 0 ? `★ ${s.votes}` : '';
    this.modalVoteLabel.textContent = 'Vote';
    this.modalVote.disabled = false;
  }

  private async vote() {
    if (!this.current) return;
    this.modalVote.disabled = true;
    this.modalVoteLabel.textContent = '...';
    try {
      const res = await fetch(API_VOTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: this.current.stationuuid }),
      });
      const data = await res.json();
      if (data.ok === true) {
        this.current.votes = (this.current.votes || 0) + 1;
        this.modalVoteCount.textContent = `★ ${this.current.votes}`;
        this.modalVoteLabel.textContent = 'Thanks!';
      } else {
        this.modalVoteLabel.textContent = data.message || 'Already voted';
      }
    } catch {
      this.modalVoteLabel.textContent = 'Error';
    }
    setTimeout(() => {
      this.modalVoteLabel.textContent = 'Vote';
      this.modalVote.disabled = false;
    }, 3000);
  }

  private async share() {
    if (!this.current) return;
    const text = `I'm listening to ${this.current.name} on World Radio Stations`;
    const url = window.location.origin;
    const label = document.querySelector<HTMLElement>('[data-share-label]');
    if (navigator.share) {
      try { await navigator.share({ title: text, url }); } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${text} — ${url}`);
        if (label) { label.textContent = 'Copied!'; setTimeout(() => { label.textContent = 'Share'; }, 2000); }
      } catch { /* ignore */ }
    }
  }

  /** Sync star states on all rendered cards + modal star to localStorage truth. */
  private refreshFavStars() {
    for (const [id, el] of this.stationCards) {
      const fav = isFavorite(id);
      const btn = el.querySelector<HTMLButtonElement>('[data-fav]');
      if (btn) {
        btn.classList.toggle('active', fav);
        btn.setAttribute('aria-pressed', String(fav));
        btn.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Add to favorites');
      }
    }
    if (this.current) {
      const fav = isFavorite(this.current.stationuuid);
      this.modalFav.classList.toggle('active', fav);
      this.modalFav.setAttribute('aria-pressed', String(fav));
      this.modalFav.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Add to favorites');
    }
  }

  private setState(state: PlayState) {
    this.state = state;
    const label =
      state === 'playing'
        ? 'LIVE'
        : state === 'loading'
          ? 'Loading…'
          : state === 'error'
            ? 'Error'
            : 'PAUSED';
    this.npState.innerHTML = `<span class="dot ${state}"></span>${label}`;
    this.modalState.innerHTML = `<span class="dot ${state}"></span>${label}`;
    const icon = state === 'playing' ? ICON_PAUSE : ICON_PLAY;
    this.npToggle.innerHTML = icon;
    this.modalToggle.innerHTML = icon;
    const ariaLabel = state === 'playing' ? 'Pause' : 'Play';
    this.npToggle.setAttribute('aria-label', ariaLabel);
    this.modalToggle.setAttribute('aria-label', ariaLabel);
    this.modalVu.classList.toggle('animating', state === 'playing');
    if (state === 'playing') this.startSongPoll(); else this.stopSongPoll();
    if (this.current) {
      const isActive = !this.audio.paused;
      this.updateActiveCard(isActive ? this.current.stationuuid : null);
    }
  }

  private updateActiveCard(activeId: string | null) {
    for (const [id, el] of this.stationCards) {
      el.classList.toggle('active', id === activeId);
    }
  }
}

const ICON_PLAY =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
const ICON_STAR =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.3l-5.4 3.2 1.4-6.1L3 10.4l6.2-.5L12 4l2.8 5.9 6.2.5-5 4 1.4 6.1z"/></svg>';

/** Page numbers to show: first, last, and a ±2 window around the current page. */
function pageWindow(cur: number, total: number): number[] {
  const s = new Set<number>([1, total, cur - 2, cur - 1, cur, cur + 1, cur + 2]);
  return [...s].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function escapeAttr(s: string) {
  return escapeHtml(s);
}

const root = document.querySelector<HTMLElement>('[data-player]');
if (root) {
  const p = new Player(root);
  void p.init();
}
