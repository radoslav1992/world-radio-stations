// Lookups over the generated country raster (see world-data.ts).
import { CODES, META, RASTER_H, RASTER_RLE, RASTER_W } from './world-data';

let grid: Uint8Array | null = null;
const indexByCode = new Map<string, number>(CODES.map((c, i) => [c, i]));

/** Decode the run-length encoded raster once (W*H country indices, 0 = ocean). */
export function getGrid(): Uint8Array {
  if (grid) return grid;
  const bin = atob(RASTER_RLE);
  const out = new Uint8Array(RASTER_W * RASTER_H);
  let o = 0;
  for (let i = 0; i + 2 < bin.length; i += 3) {
    const value = bin.charCodeAt(i);
    const len = bin.charCodeAt(i + 1) | (bin.charCodeAt(i + 2) << 8);
    if (value) out.fill(value, o, o + len);
    o += len;
  }
  grid = out;
  return out;
}

export function countryIndexAt(lat: number, lng: number): number {
  const g = getGrid();
  const col = ((Math.floor(((lng + 180) / 360) * RASTER_W) % RASTER_W) + RASTER_W) % RASTER_W;
  const row = Math.min(RASTER_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * RASTER_H)));
  return g[row * RASTER_W + col];
}

export function countryIndex(code: string | null | undefined): number {
  if (!code) return -1;
  return indexByCode.get(code.toUpperCase()) ?? -1;
}

export function countryCode(index: number): string {
  return CODES[index] || '';
}

/** Centroid of the country's largest polygon and its total area (steradians × 1e4). */
export function countryMeta(index: number): { lat: number; lng: number; area: number } | null {
  const m = META[index];
  if (!m || index <= 0) return null;
  return { lat: m[0], lng: m[1], area: m[2] };
}
