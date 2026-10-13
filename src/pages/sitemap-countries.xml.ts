import { ALL_COUNTRY_CODES, COUNTRIES } from '../scripts/countries';
import { urlsetResponse } from '../lib/sitemap';

export const prerender = false;

const API = 'https://de1.api.radio-browser.info/json';
const FETCH_HEADERS = { 'User-Agent': 'WorldRadioStations/1.0 (+https://worldradiostations.org)' };
// Below this a country page is a handful of links; keep those out of the index.
const MIN_STATIONS = 10;

/** Every country page with enough live stations to be worth indexing. */
export async function GET() {
  const known = new Set(ALL_COUNTRY_CODES);
  let codes: string[] = [];
  try {
    const res = await fetch(`${API}/countries?hidebroken=true`, { headers: FETCH_HEADERS });
    if (res.ok) {
      const list = await res.json();
      codes = (Array.isArray(list) ? list : [])
        .filter((c: any) => c?.stationcount >= MIN_STATIONS)
        .map((c: any) => String(c.iso_3166_1 || '').toUpperCase())
        .filter((code: string) => known.has(code))
        .sort((a: string, b: string) => a.localeCompare(b));
    }
  } catch { /* fall back below */ }
  if (!codes.length) codes = COUNTRIES.map((c) => c.code);

  return urlsetResponse(
    [...new Set(codes)].map((code) => `/country/${code.toLowerCase()}`),
    'public, max-age=86400',
  );
}
