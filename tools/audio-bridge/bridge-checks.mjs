import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBridge } from './server.mjs';

const headers = { host: '127.0.0.1:28431', origin: 'http://127.0.0.1:28431', 'content-type': 'application/sdp' };
test('local status reports missing key without revealing credentials', async () => {
  const app = createBridge({ env: {} });
  const response = await app.inject({ url: '/status', headers });
  assert.equal(response.json().keyConfigured, false);
  assert.equal(response.json().dialingEnabled, false);
  await app.close();
});
test('cross-origin session creation and unexpected hosts are rejected', async () => {
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic-test-key' } });
  for (const changed of [{ origin: 'https://untrusted.example' }, { host: 'attacker.example' }, { origin: undefined }]) {
    const requestHeaders = Object.fromEntries(Object.entries({ ...headers, ...changed }).filter(([, value]) => value !== undefined));
    const response = await app.inject({ method: 'POST', url: '/session', headers: requestHeaders, payload: 'v=0\r\n' });
    assert.equal(response.statusCode, 403);
  }
  await app.close();
});
test('missing key prevents external requests', async () => {
  const app = createBridge({ env: {}, fetchImpl: () => { throw new Error('Must not contact OpenAI'); } });
  const response = await app.inject({ method: 'POST', url: '/session', headers, payload: 'v=0\r\n' });
  assert.equal(response.statusCode, 503);
  await app.close();
});
test('server exchanges SDP with fixed OpenAI endpoint and keeps the key server-side', async () => {
  let calls = 0;
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic-test-key' }, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/realtime/calls');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-test-key');
    assert.equal(options.body.get('sdp'), 'v=0\r\n');
    const session = JSON.parse(options.body.get('session'));
    assert.equal(session.type, 'realtime'); assert.equal(session.audio.output.voice, 'marin');
    assert.equal(session.audio.input.turn_detection, null);
    return new Response('v=0\r\nanswer');
  } });
  const response = await app.inject({ method: 'POST', url: '/session', headers, payload: 'v=0\r\n' });
  assert.equal(response.statusCode, 200); assert.equal(response.body, 'v=0\r\nanswer'); assert.equal(calls, 1);
  assert.equal(response.body.includes('synthetic-test-key'), false);
  await app.close();
});
test('upstream errors do not expose upstream bodies or credentials', async () => {
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic-test-key' }, fetchImpl: async () => new Response('private upstream details', { status: 401 }) });
  const response = await app.inject({ method: 'POST', url: '/session', headers, payload: 'v=0\r\n' });
  assert.equal(response.statusCode, 502); assert.equal(response.body.includes('private upstream'), false);
  assert.match(response.json().error, /rejected the API key/);
  assert.equal(response.json().upstreamStatus, 401);
  await app.close();
});

test('voice setup and signaling assets are served locally with no key embedded', async () => {
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic-secret-must-not-be-sent' } });
  try {
    for (const url of ['/voice-test', '/voice.js', '/extension-lab/window-rtc.js']) {
      const response = await app.inject({ url, headers });
      assert.equal(response.statusCode, 200); assert.equal(response.body.includes('synthetic-secret-must-not-be-sent'), false);
      assert.equal(response.headers['cache-control'], 'no-store');
    }
    assert.equal((await app.inject({ url: '/.env', headers })).statusCode, 404);
  } finally { await app.close(); }
});
test('panel serves with restrictions and has no dial endpoint', async () => {
  const app = createBridge({ env: {} });
  const response = await app.inject({ url: '/', headers });
  assert.equal(response.statusCode, 200); assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(response.body, /No dialing controls/);
  assert.equal((await app.inject({ method: 'POST', url: '/calls', headers })).statusCode, 404);
  await app.close();
});
