/**
 * Adsterra ad units. Banner keys come from the Adsterra dashboard; each one is
 * bound to a single size, so the size here must match the key.
 */
export const AD_HOST = 'https://bauval.org';

export type BannerSize = '728x90' | '320x50' | '300x250';

export const BANNERS: Record<BannerSize, { key: string; width: number; height: number }> = {
  '728x90': { key: '5da1edd17ce7164825443d6cb0c1928b', width: 728, height: 90 },
  '320x50': { key: '70e27b4152487a26357d4b0ecad0476c', width: 320, height: 50 },
  '300x250': { key: '61aa7a10a7287e3ce28c593ef871d320', width: 300, height: 250 },
};

export const NATIVE_KEY = '9f2c9ddc0d49837f001a3bfa50507b6c';
export const NATIVE_SRC = `${AD_HOST}/21/${NATIVE_KEY}`;

export const bannerSrc = (key: string) => `${AD_HOST}/22/${key}`;

/** The leaderboard slot switches from 320x50 to 728x90 at this width. */
export const LEADERBOARD_MIN_WIDTH = 780;

/**
 * Visitors who pick "Necessary only" in the cookie banner get no ads at all.
 * Set to false to show ads to everyone.
 */
export const RESPECT_CONSENT_REJECT = true;

/** Same key the cookie banner in Base.astro writes. */
export const CONSENT_KEY = 'wrs-consent-v1';
