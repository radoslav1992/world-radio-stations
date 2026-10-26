// Loaded only by the route regression test, never by the application build.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input);
  if (url.hostname !== 'de1.api.radio-browser.info') return originalFetch(input, init);
  const uuid = url.pathname.split('/').pop();
  switch (uuid) {
    case 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa':
      return Response.json([{ stationuuid: uuid, name: 'Test radio', url_resolved: 'https://example.com/live' }]);
    case 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb':
      return Response.json([]);
    case 'cccccccc-cccc-cccc-cccc-cccccccccccc':
      return new Response('Unavailable', { status: 503 });
    case 'dddddddd-dddd-dddd-dddd-dddddddddddd':
      throw new TypeError('Network request failed');
    case 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee':
      return new Response('not JSON');
    case 'ffffffff-ffff-ffff-ffff-ffffffffffff':
      return Response.json({ error: 'Unexpected response shape' });
    case '11111111-1111-1111-1111-111111111111':
      return new Response('Rate limited', { status: 429 });
    case '22222222-2222-2222-2222-222222222222':
      throw new DOMException('Request timed out', 'TimeoutError');
    default:
      throw new Error(`Unexpected Radio Browser call in test: ${url}`);
  }
};
