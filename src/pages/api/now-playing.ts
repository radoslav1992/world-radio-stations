import type { APIRoute } from 'astro';

export const prerender = false;

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-cache',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: HEADERS });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
      return json({ error: 'invalid or non-HTTPS url' }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'Icy-MetaData': '1' },
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timeout);
      return json({ title: null });
    }

    const metaintHeader = res.headers.get('icy-metaint');
    if (!metaintHeader) {
      clearTimeout(timeout);
      // Consume and discard the body so the connection is released
      res.body?.cancel();
      return json({ title: null });
    }

    const metaint = parseInt(metaintHeader, 10);
    if (isNaN(metaint) || metaint <= 0) {
      clearTimeout(timeout);
      res.body?.cancel();
      return json({ title: null });
    }

    const bytesNeeded = metaint + 4096;
    const title = await readIcyTitle(res, metaint, bytesNeeded);

    clearTimeout(timeout);
    return json({ title });
  } catch {
    return json({ title: null });
  }
};

async function readIcyTitle(
  res: Response,
  metaint: number,
  bytesNeeded: number,
): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;

  try {
    const chunks: Uint8Array[] = [];
    let totalRead = 0;

    while (totalRead < bytesNeeded) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalRead += value.length;
    }

    // Combine all chunks into a single buffer
    const buffer = new Uint8Array(totalRead);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    // The metadata block starts right after `metaint` audio bytes
    if (buffer.length <= metaint) return null;

    const lengthByte = buffer[metaint];
    const metaLength = lengthByte * 16;

    if (metaLength === 0) return null;

    const metaStart = metaint + 1;
    const metaEnd = metaStart + metaLength;

    if (buffer.length < metaEnd) return null;

    const metaBytes = buffer.slice(metaStart, metaEnd);
    const metaString = new TextDecoder('utf-8').decode(metaBytes);

    const match = metaString.match(/StreamTitle='([^']*)'/);
    if (!match || !match[1]) return null;

    const title = cleanStreamTitle(match[1]) || match[1].trim();
    return title.length > 0 ? title : null;
  } finally {
    reader.cancel();
  }
}

/**
 * Normalize an ICY StreamTitle into a clean "Artist - Title".
 *
 * Some stations (notably iHeart) pack extra key="value" metadata into the
 * title, e.g.  `Taylor Swift - text="The Fate Of Ophelia" song_spot="M" ...`
 * or  `title="X",artist="Y"`. We extract the human-readable part and drop the
 * machine fields.
 */
function cleanStreamTitle(raw: string): string {
  let s = decodeEntities(raw.trim());
  if (!s) return '';

  // Structured fields: title="..." (+ optional artist="...").
  const titleField = s.match(/\btitle="([^"]*)"/i)?.[1]?.trim();
  if (titleField) {
    const artistField = s.match(/\bartist="([^"]*)"/i)?.[1]?.trim();
    return artistField ? `${artistField} - ${titleField}` : titleField;
  }

  // iHeart-style:  <artist> - text="<title>" <junk>...
  const textM = s.match(/\btext="([^"]*)"/i);
  if (textM) {
    const inner = textM[1].trim();
    const before = s.slice(0, s.indexOf(textM[0]))
      .replace(/["']/g, '')
      .replace(/[\s–—-]+$/, '')
      .trim();
    if (!before || /="/.test(before) || inner.includes(' - ')) return inner;
    return `${before} - ${inner}`;
  }

  // Generic: drop trailing `key="value"` metadata tokens.
  const kvIdx = s.search(/\s+[A-Za-z_][\w-]*="/);
  if (kvIdx > 0) s = s.slice(0, kvIdx);

  // Tidy stray quotes and any dangling separator.
  return s.replace(/^["']+|["']+$/g, '').replace(/\s*[-–—]\s*$/, '').trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}
