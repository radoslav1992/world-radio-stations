export const SITE = 'https://worldradiostations.org';

/** A <urlset> sitemap response for site-relative paths. */
export function urlsetResponse(paths: string[], cacheControl: string): Response {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': cacheControl },
  });
}

/** Tell crawlers to come back later rather than serving an empty sitemap. */
export function unavailableResponse(): Response {
  return new Response('Sitemap temporarily unavailable', {
    status: 503,
    headers: { 'Retry-After': '3600', 'Cache-Control': 'no-store' },
  });
}
