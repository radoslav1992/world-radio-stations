import { unavailableResponse, urlsetResponse } from '../lib/sitemap';

export const prerender = false;

const API = 'https://de1.api.radio-browser.info/json';
const FETCH_HEADERS = { 'User-Agent': 'WorldRadioStations/1.0 (+https://worldradiostations.org)' };
const MAX_URLS = 1500;

/**
 * The most-listened stations' /listen pages. Radio Browser lists many stations
 * more than once (same stream, or same name re-submitted), so each stream and
 * each name-per-country appears only once to avoid near-duplicate pages.
 */
export async function GET() {
  let raw: any[] = [];
  try {
    const params = new URLSearchParams({
      hidebroken: 'true',
      is_https: 'true',
      order: 'clickcount',
      reverse: 'true',
      limit: String(MAX_URLS * 2),
    });
    const res = await fetch(`${API}/stations/search?${params}`, { headers: FETCH_HEADERS });
    if (res.ok) raw = await res.json();
  } catch { /* handled below */ }
  if (!Array.isArray(raw) || raw.length === 0) return unavailableResponse();

  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const seenUrls = new Set<string>();
  const seenNames = new Set<string>();
  const paths: string[] = [];
  for (const s of raw) {
    const uuid = typeof s?.stationuuid === 'string' ? s.stationuuid : '';
    const stream = typeof s?.url_resolved === 'string' ? s.url_resolved : '';
    if (!/^[a-fA-F0-9-]{8,64}$/.test(uuid) || !stream.startsWith('https://')) continue;
    const nameKey = `${s.countrycode || ''}:${norm(String(s.name || ''))}`;
    if (seenUrls.has(stream) || seenNames.has(nameKey)) continue;
    seenUrls.add(stream);
    seenNames.add(nameKey);
    paths.push(`/listen/${uuid}`);
    if (paths.length >= MAX_URLS) break;
  }

  return urlsetResponse(paths, 'public, max-age=86400');
}
