import type { APIRoute } from 'astro';

export const prerender = false;

const HOST = 'https://de1.api.radio-browser.info/json/stations';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const FETCH_HEADERS = { 'User-Agent': 'WorldRadioStations/1.0 (+https://worldradiostations.org)' };

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = parseInt(value ?? '', 10);
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const GET: APIRoute = async ({ url }) => {
  // ISO 3166-1 alpha-2 code, e.g. "US", "GB", "DE". Empty = top stations worldwide.
  const country = (url.searchParams.get('country') || '').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
  const offset = clampInt(url.searchParams.get('offset'), 0, 0, 100_000);
  const limit = clampInt(url.searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);

  const params = new URLSearchParams({
    hidebroken: 'true',
    order: 'clickcount',
    reverse: 'true',
    offset: String(offset),
    limit: String(limit),
  });

  const endpoint = country
    ? `${HOST}/bycountrycodeexact/${country}?${params}`
    : `${HOST}/search?${params}`;

  let raw: any[] = [];
  try {
    const res = await fetch(endpoint, { headers: FETCH_HEADERS });
    if (res.ok) raw = await res.json();
  } catch {
    raw = [];
  }

  const seenUrl = new Set<string>();
  const deduped: any[] = [];
  for (const s of raw) {
    const u = s.url_resolved;
    if (!u || !u.startsWith('https://') || seenUrl.has(u)) continue;
    seenUrl.add(u);
    deduped.push(s);
  }

  return new Response(JSON.stringify(deduped), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
