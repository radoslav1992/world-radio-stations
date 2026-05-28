import { getCollection } from 'astro:content';

export const prerender = true;

const SITE = 'https://worldradiostations.org';
const TITLE = 'World Radio Stations — Blog';
const DESC = 'Articles about radio around the world, music, internet streaming and tips for listeners.';

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!)
  );
}

export async function GET() {
  const posts = (await getCollection('blog')).sort(
    (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
  );

  const items = posts
    .map((post) => {
      const link = `${SITE}/blog/${post.slug}`;
      const pubDate = new Date(post.data.date).toUTCString();
      const categories = post.data.tags
        .map((t) => `      <category>${escapeXml(t)}</category>`)
        .join('\n');
      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(post.data.description)}</description>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(post.data.author)}</author>
${categories}
    </item>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(TITLE)}</title>
    <link>${SITE}/blog</link>
    <description>${escapeXml(DESC)}</description>
    <language>en</language>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
