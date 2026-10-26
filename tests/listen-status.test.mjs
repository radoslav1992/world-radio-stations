import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, test } from 'node:test';

let server;
let origin;
let output = '';

before(async () => {
  const portReservation = createServer().listen(0, '127.0.0.1');
  await once(portReservation, 'listening');
  const { port } = portReservation.address();
  await new Promise((resolve) => portReservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [
    '--import', fileURLToPath(new URL('./fixtures/radio-browser.mjs', import.meta.url)),
    'node_modules/astro/astro.js', 'dev', '--host', '127.0.0.1', '--port', String(port),
  ], { cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    try {
      const response = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Wait for the local development server. */ }
    await delay(200);
  }
  throw new Error(`Astro did not start: ${output}`);
});

after(async () => {
  if (server && server.exitCode === null) {
    const stopped = once(server, 'exit');
    if (process.platform === 'win32') server.kill('SIGTERM');
    else process.kill(-server.pid, 'SIGTERM');
    await stopped;
    server.stdout.destroy();
    server.stderr.destroy();
  }
});

test('a live station remains indexable with a self canonical', async () => {
  const path = '/listen/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const response = await fetch(origin + path);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /max-age=300/);
  assert.match(html, /Test radio/);
  assert.ok(html.includes(`href="https://worldradiostations.org${path}"`));
  assert.doesNotMatch(html, /content="noindex/);
});

for (const uuid of ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'invalid']) {
  test(`a missing or invalid station remains a real 404 (${uuid})`, async () => {
    const response = await fetch(`${origin}/listen/${uuid}`);
    assert.equal(response.status, 404);
    // Astro may render the global error page for a 404. The HTTP status is
    // authoritative; it must never redirect a missing station to a 200 page.
    assert.equal(response.headers.get('location'), null);
  });
}

for (const [prefix, reason] of [['c', 'upstream 503'], ['d', 'network failure'], ['e', 'invalid JSON'], ['f', 'unexpected JSON shape'], ['1', 'rate limit'], ['2', 'timeout']]) {
  test(`${reason} returns a retryable 503, not a cached noindex/404`, async () => {
    const uuid = `${prefix.repeat(8)}-${prefix.repeat(4)}-${prefix.repeat(4)}-${prefix.repeat(4)}-${prefix.repeat(12)}`;
    const response = await fetch(`${origin}/listen/${uuid}`);
    const html = await response.text();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '600');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(html, /content="noindex/);
    assert.match(html, /temporarily unavailable/i);
    assert.doesNotMatch(html, /This station is off the air/);
  });
}
