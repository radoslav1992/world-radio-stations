import { getCollection } from 'astro:content';
import { MOODS } from '../data/moods';
import { SITE } from '../lib/sitemap';

export const prerender = true;

// Country and /listen pages are live data; they're listed in the
// server-rendered sitemap-countries.xml and sitemap-listen.xml.
// No <lastmod> on pages without a real modification date: stamping every URL
// with the build date teaches Google to ignore the field altogether.
const staticPages = [
  '/',
  '/stations',
  '/moods',
  '/country',
  '/blog',
  '/about',
  '/contact',
  '/privacy-policy',
  '/terms',
  '/copyright',
  ...MOODS.map((m) => `/moods/${m.slug}`),
];

export async function GET() {
  const [posts, stations] = await Promise.all([
    getCollection('blog'),
    getCollection('stations'),
  ]);

  const entries: { loc: string; lastmod?: string }[] = [
    ...staticPages.map((loc) => ({ loc })),
    ...stations
      .sort((a, b) => a.data.name.localeCompare(b.data.name, 'en'))
      .map((s) => ({ loc: `/stations/${s.slug}` })),
    ...posts
      .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
      .map((post) => ({ loc: `/blog/${post.slug}`, lastmod: post.data.updated || post.data.date })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => `  <url>
    <loc>${SITE}${e.loc}</loc>${e.lastmod ? `
    <lastmod>${e.lastmod}</lastmod>` : ''}
  </url>`)
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
