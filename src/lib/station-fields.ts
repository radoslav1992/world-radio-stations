// Radio Browser returns ~40 fields per station; the client only needs these.
// Trimming them keeps /api responses small enough to plot thousands of stations.

const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const geo = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);

export function slimStation(s: any) {
  return {
    stationuuid: str(s?.stationuuid),
    name: str(s?.name).trim(),
    url_resolved: str(s?.url_resolved),
    favicon: str(s?.favicon),
    tags: str(s?.tags),
    codec: str(s?.codec),
    bitrate: num(s?.bitrate),
    hls: num(s?.hls),
    country: str(s?.country),
    countrycode: str(s?.countrycode),
    state: str(s?.state),
    language: str(s?.language),
    votes: num(s?.votes),
    geo_lat: geo(s?.geo_lat),
    geo_long: geo(s?.geo_long),
  };
}
