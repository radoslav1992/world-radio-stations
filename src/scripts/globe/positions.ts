// Decides where each station sits on the globe.
//
// Stations with coordinates use them (stacked duplicates fan out in a small
// sunflower spiral so every one stays hoverable). Stations without coordinates
// are placed approximately: next to a geolocated station from the same country
// when there is one (which follows where people actually live), otherwise
// around the country's centroid.
import type { Station } from '../store';
import { countryIndex, countryMeta } from './world';

export interface Placement {
  lat: number;
  lng: number;
  /** True when the position is an estimate rather than the station's own coordinates. */
  approx: boolean;
}

const GOLDEN_ANGLE = 2.399963229728653;

function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function validGeo(s: Station): [number, number] | null {
  const lat = s.geo_lat;
  const lng = s.geo_long;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return null; // "null island" placeholder
  return [lat, lng];
}

function offset(lat: number, lng: number, r: number, angle: number): Placement {
  const nLat = Math.max(-89, Math.min(89, lat + r * Math.sin(angle)));
  const cos = Math.max(0.2, Math.cos((nLat * Math.PI) / 180));
  let nLng = lng + (r * Math.cos(angle)) / cos;
  if (nLng > 180) nLng -= 360;
  if (nLng < -180) nLng += 360;
  return { lat: nLat, lng: nLng, approx: false };
}

export function placeStations(list: Station[]): (Placement | null)[] {
  const out: (Placement | null)[] = new Array(list.length).fill(null);
  const anchorsByCountry = new Map<string, [number, number][]>();
  const stackCount = new Map<string, number>();

  list.forEach((s, i) => {
    const geo = validGeo(s);
    if (!geo) return;
    const key = `${geo[0].toFixed(2)},${geo[1].toFixed(2)}`;
    const k = stackCount.get(key) || 0;
    stackCount.set(key, k + 1);
    out[i] = k === 0
      ? { lat: geo[0], lng: geo[1], approx: false }
      : offset(geo[0], geo[1], 0.07 * Math.sqrt(k), k * GOLDEN_ANGLE);
    const cc = (s.countrycode || '').toUpperCase();
    if (cc) {
      const arr = anchorsByCountry.get(cc) || [];
      arr.push(geo);
      anchorsByCountry.set(cc, arr);
    }
  });

  const centroidCount = new Map<string, number>();
  list.forEach((s, i) => {
    if (out[i]) return;
    const cc = (s.countrycode || '').toUpperCase();
    if (!cc) return;
    const h = hash(s.stationuuid || s.name);
    const anchors = anchorsByCountry.get(cc);
    if (anchors && anchors.length) {
      const [lat, lng] = anchors[h % anchors.length];
      const r = 0.3 + ((h >>> 8) % 1000) / 1000 * 0.9;
      const p = offset(lat, lng, r, ((h >>> 16) % 6283) / 1000);
      out[i] = { ...p, approx: true };
      return;
    }
    const meta = countryMeta(countryIndex(cc));
    if (!meta) return;
    const k = centroidCount.get(cc) || 0;
    centroidCount.set(cc, k + 1);
    const p = offset(meta.lat, meta.lng, 0.22 * Math.sqrt(k + 0.3), k * GOLDEN_ANGLE);
    out[i] = { ...p, approx: true };
  });

  return out;
}
