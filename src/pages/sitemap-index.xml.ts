import { SITE } from '../lib/sitemap';

export const prerender = true;

const SITEMAPS = ['sitemap-0.xml', 'sitemap-countries.xml', 'sitemap-listen.xml'];

export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAPS.map((s) => `  <sitemap>
    <loc>${SITE}/${s}</loc>
  </sitemap>`).join('\n')}
</sitemapindex>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
