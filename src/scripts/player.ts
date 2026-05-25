interface Station {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  codec: string;
  bitrate: number;
  hls: number;
  country: string;
}

const API = 'https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/BG';
const QUERY = '?limit=40&hidebroken=true&order=clickcount&reverse=true';
const STORAGE_KEY = 'br-last-station';
const MAX_STATIONS = 8;

class Player {
  private audio = new Audio();
  private current: Station | null = null;
  private stationsEl: HTMLElement;
  private statusEl: HTMLElement;
  private nowPlaying: HTMLElement;
  private npLogo: HTMLElement;
  private npName: HTMLElement;
  private npState: HTMLElement;
  private npToggle: HTMLButtonElement;
  private stationCards = new Map<string, HTMLElement>();

  constructor(root: HTMLElement) {
    this.stationsEl = root.querySelector<HTMLElement>('[data-stations]')!;
    this.statusEl = root.querySelector<HTMLElement>('[data-status]')!;
    this.nowPlaying = document.querySelector<HTMLElement>('[data-now-playing]')!;
    this.npLogo = this.nowPlaying.querySelector<HTMLElement>('[data-np-logo]')!;
    this.npName = this.nowPlaying.querySelector<HTMLElement>('[data-np-name]')!;
    this.npState = this.nowPlaying.querySelector<HTMLElement>('[data-np-state]')!;
    this.npToggle = this.nowPlaying.querySelector<HTMLButtonElement>('[data-np-toggle]')!;

    this.audio.preload = 'none';
    this.audio.addEventListener('playing', () => this.renderState('playing'));
    this.audio.addEventListener('pause', () => this.renderState('paused'));
    this.audio.addEventListener('waiting', () => this.renderState('loading'));
    this.audio.addEventListener('error', () => this.renderState('error'));
    this.npToggle.addEventListener('click', () => this.toggle());
  }

  async init() {
    try {
      const res = await fetch(API + QUERY);
      if (!res.ok) throw new Error('API ' + res.status);
      const raw: Station[] = await res.json();
      const playable = raw
        .filter((s) => s.url_resolved.startsWith('https://') && s.hls === 0)
        .slice(0, MAX_STATIONS);
      if (playable.length === 0) {
        this.showError('Няма налични станции за уеб възпроизвеждане.');
        return;
      }
      this.renderStations(playable);
    } catch (err) {
      console.error(err);
      this.showError('Не успяхме да заредим станциите.');
    }
  }

  private renderStations(stations: Station[]) {
    this.statusEl.style.display = 'none';
    this.stationsEl.innerHTML = '';
    const lastId = localStorage.getItem(STORAGE_KEY);

    for (const s of stations) {
      const card = document.createElement('button');
      card.className = 'station';
      card.type = 'button';
      const tag = (s.tags.split(',')[0] || s.codec || '').trim();
      const initial = s.name.charAt(0).toUpperCase();
      card.innerHTML = `
        <div class="station-logo">${
          s.favicon
            ? `<img src="${escapeAttr(s.favicon)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fallback',textContent:'${initial}'}))" />`
            : `<span class="fallback">${initial}</span>`
        }</div>
        <p class="station-name">${escapeHtml(s.name)}</p>
        <span class="station-tag">${escapeHtml(tag)}</span>
      `;
      card.addEventListener('click', () => this.play(s));
      this.stationCards.set(s.stationuuid, card);
      this.stationsEl.appendChild(card);

      if (s.stationuuid === lastId) {
        this.current = s;
        this.showNowPlaying(s, 'paused');
      }
    }
  }

  private showError(msg: string) {
    this.statusEl.innerHTML = `<p>${escapeHtml(msg)} <br>Свалете приложението за пълно изживяване.</p>`;
  }

  private play(s: Station) {
    if (this.current?.stationuuid === s.stationuuid && !this.audio.paused) {
      this.audio.pause();
      return;
    }
    this.current = s;
    this.audio.src = s.url_resolved;
    void this.audio.play().catch(() => this.renderState('error'));
    this.showNowPlaying(s, 'loading');
    this.updateActiveCard(s.stationuuid);
    localStorage.setItem(STORAGE_KEY, s.stationuuid);
  }

  private toggle() {
    if (!this.current) return;
    if (this.audio.paused) {
      if (!this.audio.src) this.audio.src = this.current.url_resolved;
      void this.audio.play().catch(() => this.renderState('error'));
    } else {
      this.audio.pause();
    }
  }

  private showNowPlaying(s: Station, state: PlayState) {
    this.nowPlaying.classList.add('visible');
    const initial = s.name.charAt(0).toUpperCase();
    this.npLogo.innerHTML = s.favicon
      ? `<img src="${escapeAttr(s.favicon)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fallback',textContent:'${initial}'}))" />`
      : `<span class="fallback">${initial}</span>`;
    this.npName.textContent = s.name;
    this.renderState(state);
  }

  private renderState(state: PlayState) {
    const label =
      state === 'playing'
        ? 'В ЕФИР'
        : state === 'loading'
          ? 'Зареждане…'
          : state === 'error'
            ? 'Грешка'
            : 'Пауза';
    this.npState.innerHTML = `<span class="dot"></span>${label}`;
    this.npToggle.innerHTML = state === 'playing' ? ICON_PAUSE : ICON_PLAY;
    this.npToggle.setAttribute('aria-label', state === 'playing' ? 'Пауза' : 'Пусни');
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

type PlayState = 'playing' | 'paused' | 'loading' | 'error';

const ICON_PLAY =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';

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
