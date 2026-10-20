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

test('recognized regional denial is actionable in session and voicemail setup without leaking upstream details', async () => {
  let requests = 0;
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic-private-key' }, fetchImpl: async () => {
    requests++; return Response.json({ error: { code: 'unsupported_country_region_territory', message: 'synthetic-private-key private upstream request details' } }, { status: 403 });
  } });
  try {
    for (const request of [
      { url: '/session', headers, payload: 'v=0\r\n' },
      { url: '/voicemail-speech', headers: { ...headers, 'content-type': 'application/json' }, payload: { message: 'This is a synthetic voice test message.' } }
    ]) {
      const response = await app.inject({ method: 'POST', ...request });
      assert.equal(response.statusCode, 502); assert.equal(response.json().upstreamStatus, 403);
      assert.equal(response.json().errorCode, 'unsupported_country_region_territory');
      assert.match(response.json().error, /detected country or region/); assert.match(response.json().error, /ChatGPT/);
      assert.doesNotMatch(response.body, /synthetic-private-key|private upstream request/);
    }
    assert.equal(requests, 2); // One attempt per request, no blind retry.
  } finally { await app.close(); }
});

test('unknown access denial does not claim a regional cause and rejects arbitrary error text/code', async () => {
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic-private-key' }, fetchImpl: async () => Response.json({ error: { code: 'synthetic-private-key', message: 'private upstream details' } }, { status: 403 }) });
  try {
    const response = await app.inject({ method: 'POST', url: '/session', headers, payload: 'v=0\r\n' });
    assert.equal(response.json().errorCode, 'access_denied'); assert.doesNotMatch(response.body, /synthetic-private-key|private upstream details|blocked for this connection/);
  } finally { await app.close(); }
});

test('API quota, rate, key, IP and model failures remain distinguishable without forwarding provider messages', async () => {
  let failure;
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic-private-key' }, fetchImpl: async () => Response.json({ error: { code: failure[1], message: 'synthetic-private-details' } }, { status: failure[0] }) });
  try {
    for (failure of [[401, 'invalid_api_key', 'invalid_api_key'], [401, 'ip_not_authorized', 'ip_not_authorized'], [429, 'insufficient_quota', 'insufficient_quota'], [429, 'credit_balance_exhausted', 'insufficient_quota'], [429, 'rate_limit_exceeded', 'rate_limit_exceeded'], [404, 'model_not_found', 'model_not_found'], [500, 'unrecognized', 'upstream_error']]) {
      const response = await app.inject({ method: 'POST', url: '/session', headers, payload: 'v=0\r\n' });
      assert.equal(response.json().errorCode, failure[2]); assert.equal(response.json().upstreamStatus, failure[0]);
      assert.doesNotMatch(response.body, /synthetic-private/);
    }
  } finally { await app.close(); }
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
