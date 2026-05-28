import type { APIRoute } from 'astro';

export const prerender = false;

const BY_UUID = 'https://de1.api.radio-browser.info/json/stations/byuuid/';
const FETCH_HEADERS = { 'User-Agent': 'WorldRadioStations/1.0 (+https://worldradiostations.org)' };

/** Resolve a single station by its Radio Browser UUID (used by deep links). */
export const GET: APIRoute = async ({ url }) => {
  const uuid = (url.searchParams.get('uuid') || '').replace(/[^a-fA-F0-9-]/g, '').slice(0, 64);
  if (!uuid) {
    return new Response(JSON.stringify({ error: 'missing uuid' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let station: any = null;
  try {
    const res = await fetch(BY_UUID + encodeURIComponent(uuid), { headers: FETCH_HEADERS });
    if (res.ok) {
      const list = await res.json();
      const s = Array.isArray(list) ? list[0] : null;
      if (s && typeof s.url_resolved === 'string' && s.url_resolved.startsWith('https://')) {
        station = s;
      }
    }
  } catch {
    station = null;
  }

  if (!station) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(station), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
