import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { CampaignStore } from './campaign-store.mjs';
import { createBridge } from './server.mjs';
import { callVoices } from './voice-settings.mjs';

const settings = { simulation: true, simulationMode: 'agents', rehearsalTurns: 4, rehearsalPersona: 'busy', timeZone: 'UTC', startHour: 0, endHour: 24, callerNumber: '+12025550100', brief: 'Introduce the office and collect questions for Cena.', voicemailMessage: 'Synthetic voicemail only.' };
function fixture(overrides = {}) {
  const store = new CampaignStore(':memory:');
  const campaign = store.create({ name: 'Fictional rehearsal', csv: 'first_name,last_name,phone\nAlex,Example,+12025550101', settings: { ...settings, ...overrides } });
  const worker = randomUUID(), session = randomUUID(); store.start(campaign.id, worker);
  const contact = store.claim(campaign.id, worker).contact; store.dispatch(campaign.id, contact.id, worker, session);
  const headers = { host: '127.0.0.1:28431', origin: 'http://127.0.0.1:28431', 'content-type': 'application/sdp', 'x-campaign-id': campaign.id, 'x-contact-id': contact.id, 'x-worker-id': worker, 'x-rehearsal-session': session, 'x-rehearsal-role': 'assistant' };
  return { store, campaign, contact, worker, session, headers };
}
test('each rehearsal role uses its selected voice from all five options', async () => {
  for (const [i, voice] of callVoices.entries()) {
    const customerVoice = callVoices[(i + 1) % callVoices.length], f = fixture({ voice, customerVoice }), sessions = [];
    const app = createBridge({ campaignStore: f.store, env: { OPENAI_API_KEY: 'synthetic-key' }, fetchImpl: async (_url, options) => { sessions.push(JSON.parse(options.body.get('session'))); return new Response('v=0\r\n'); } });
    try {
      for (const role of ['assistant', 'customer']) assert.equal((await app.inject({ method: 'POST', url: '/rehearsal-session', headers: { ...f.headers, 'x-rehearsal-role': role }, payload: 'v=0\r\n' })).statusCode, 200);
      assert.deepEqual(sessions.map(s => s.audio.output.voice), [voice, customerVoice]);
    } finally { await app.close(); f.store.close(); }
  }
});
test('rehearsal uses two distinct voices, isolated roles and no phone number or tools', async () => {
  const f = fixture(), sessions = [];
  const app = createBridge({ campaignStore: f.store, env: { OPENAI_API_KEY: 'synthetic-key' }, fetchImpl: async (_url, options) => { sessions.push(JSON.parse(options.body.get('session'))); return new Response('v=0\r\n'); } });
  try {
    for (const role of ['assistant', 'customer']) assert.equal((await app.inject({ method: 'POST', url: '/rehearsal-session', headers: { ...f.headers, 'x-rehearsal-role': role }, payload: 'v=0\r\n' })).statusCode, 200);
    assert.deepEqual(sessions.map(s => s.audio.output.voice), ['marin', 'cedar']);
    for (const s of sessions) { assert.equal(s.max_output_tokens, 600); assert.equal(s.audio.output.speed, 1.15); assert.equal(s.audio.input.turn_detection, null); assert.deepEqual(s.tools, []); assert.doesNotMatch(s.instructions, /12025550101|synthetic-key/); }
    assert.match(sessions[0].instructions, /approved brief/); assert.match(sessions[1].instructions, /fictional customer/);
    assert.equal((await app.inject({ method: 'POST', url: '/rehearsal-session', headers: f.headers, payload: 'v=0' })).statusCode, 409);
    assert.equal(sessions.length, 2);
  } finally { await app.close(); f.store.close(); }
});
test('rehearsal rejects other origins, wrong workers, live lists, offline lists and completed contacts before upstream', async () => {
  for (const overrides of [{}, { simulation: false }, { simulationMode: 'offline' }]) {
    const f = fixture(overrides); let calls = 0;
    const app = createBridge({ campaignStore: f.store, env: { OPENAI_API_KEY: 'synthetic' }, fetchImpl: async () => { calls++; throw new Error(); } });
    try {
      const request = headers => app.inject({ method: 'POST', url: '/rehearsal-session', headers, payload: 'v=0' });
      assert.equal((await request({ ...f.headers, origin: 'https://untrusted.invalid' })).statusCode, 403);
      assert.equal((await request({ ...f.headers, 'x-worker-id': randomUUID() })).statusCode, 403);
      assert.equal((await request({ ...f.headers, 'x-rehearsal-session': randomUUID() })).statusCode, 403);
      if (Object.keys(overrides).length) assert.equal((await request(f.headers)).statusCode, 403);
      f.store.finish(f.campaign.id, f.contact.id, f.worker, 'completed');
      assert.equal((await request(f.headers)).statusCode, 403); assert.equal(calls, 0);
    } finally { await app.close(); f.store.close(); }
  }
});
test('API errors are sanitized and a missing key never opens an agent', async () => {
  const f = fixture();
  for (const key of ['', 'synthetic']) {
    const app = createBridge({ campaignStore: f.store, env: { OPENAI_API_KEY: key }, fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'invalid_api_key', message: 'secret-do-not-return' } }), { status: 401 }) });
    try {
      const r = await app.inject({ method: 'POST', url: '/rehearsal-session', headers: f.headers, payload: 'v=0' });
      assert.equal(r.statusCode, key ? 502 : 503); assert.doesNotMatch(r.body, /secret-do-not-return|synthetic/);
    } finally { await app.close(); }
  }
  f.store.close();
});
test('import accepts bounded rehearsal settings and rejects unexpected persona or odd/unbounded turns', async () => {
  const store = new CampaignStore(':memory:'), app = createBridge({ campaignStore: store, env: {} });
  const headers = { host: '127.0.0.1:28431', origin: 'http://127.0.0.1:28431' };
  try {
    for (const [extra, status] of [[{}, 200], [{ rehearsalTurns: 1000 }, 400], [{ rehearsalTurns: 5 }, 400], [{ rehearsalPersona: 'injected' }, 400], [{ rehearsalConfig: { turnSeconds: 20 } }, 200], [{ rehearsalConfig: { turnSeconds: 9 } }, 400], [{ rehearsalConfig: { turnSeconds: 121 } }, 400], [{ rehearsalConfig: { turnSeconds: 20.5 } }, 400]]) {
      const r = await app.inject({ method: 'POST', url: '/campaigns-api/import', headers, payload: { name: 'Test', csv: 'first_name,last_name,phone\nAlex,Example,+12025550101', settings: { ...settings, ...extra } } });
      assert.equal(r.statusCode, status, r.body);
      if (status === 200 && extra.rehearsalConfig) assert.equal(store.read(r.json().id).settings.rehearsalConfig.turnSeconds, 20);
    }
  } finally { await app.close(); store.close(); }
});

const source = await readFile(new URL('public/rehearsal.js', import.meta.url), 'utf8');
function clientFixture(timers = {}) {
  const window = {}, peers = [], updates = [];
  class PC {
    constructor() { peers.push(this); this.connectionState = 'new'; }
    createDataChannel() { this.channel = { send: text => this.sent.push(JSON.parse(text)), close() {} }; this.sent = []; return this.channel; }
    addTransceiver(kind, options) { this.transceiver = { kind, options }; }
    async createOffer() { return { type: 'offer', sdp: 'v=0' }; }
    async setLocalDescription(offer) { this.localDescription = offer; }
    async setRemoteDescription() { this.channel.onopen(); }
    close() { this.closed = true; }
  }
  vm.runInNewContext(source, { window, RTCPeerConnection: PC, setTimeout, clearTimeout, setInterval, clearInterval, AbortController, Blob,
    fetch: async () => new Response('v=0'), ...timers });
  const rehearsal = new window.SalesGodRehearsal({ onUpdate: u => updates.push(u) });
  return { rehearsal, peers, updates };
}
test('text relay waits for both response completion and audio drain in either order', async () => {
  for (const drainFirst of [false, true]) {
    const { rehearsal, peers, updates } = clientFixture();
    const run = { peers: [], controller: new AbortController() };
    const peer = await rehearsal.connect(run, 'assistant', { session: 'synthetic', campaignId: 'synthetic', contact: { id: 'synthetic' }, workerId: 'synthetic' });
    assert.equal(peers[0].transceiver.options.direction, 'recvonly');
    let resolved = false; const promise = rehearsal.reply(peer, 'Hello there', 0, false).then(t => { resolved = true; return t; });
    assert.equal(peers[0].sent[0].item.content[0].text, 'Hello there');
    const emit = e => peer.channel.onmessage({ data: JSON.stringify(e) });
    emit({ type: 'response.created', response: { id: 'response1' } });
    emit({ type: 'response.output_audio_transcript.delta', response_id: 'response1', delta: 'Hello back.' });
    assert.equal(updates.at(-1).text, 'Hello back.');
    const completed = { type: 'response.done', response: { id: 'response1', status: 'completed' } }, drained = { type: 'output_audio_buffer.stopped', response_id: 'response1' };
    emit(drainFirst ? drained : completed); await Promise.resolve(); assert.equal(resolved, false);
    emit(drainFirst ? completed : drained); assert.equal(await promise, 'Hello back.');
  }
});
test('Stop aborts connection and rejects an active turn immediately', async () => {
  const { rehearsal } = clientFixture(), run = { peers: [], controller: new AbortController() };
  rehearsal.active = run;
  const peer = await rehearsal.connect(run, 'customer', { session: 'x', campaignId: 'x', contact: { id: 'x' }, workerId: 'x' });
  const promise = rehearsal.reply(peer, 'Hello', 1, false);
  rehearsal.stop(); await assert.rejects(promise, /stopped/);
  assert.equal(run.controller.signal.aborted, true); assert.equal(peer.pc.closed, true);
});
test('configured reply timeout expires at the selected duration and preserves partial text', async () => {
  for (const [config, expected] of [[{}, 20000], [{ turnSeconds: 30 }, 30000], [{ turnSeconds: 120 }, 120000]]) {
    let expire, duration;
    const { rehearsal } = clientFixture({ setTimeout: (fn, ms) => { expire = fn; duration = ms; return 1; }, clearTimeout() {} });
    const peer = { role: 'assistant', channel: { send() {} } };
    const pending = rehearsal.reply(peer, 'Hello', 0, false, config);
    peer.turn.text = 'Partial reply';
    assert.equal(duration, expected); expire();
    await assert.rejects(pending, /timed out/);
    assert.equal(peer.turn.text, 'Partial reply');
  }
});
test('rehearsal encoder produces genuine MPEG audio frames and rejects empty input', async () => {
  const sandbox = { window: {}, Blob, setTimeout, console };
  vm.createContext(sandbox);
  vm.runInContext(await readFile(new URL('public/vendor/lame.min.js', import.meta.url), 'utf8'), sandbox);
  vm.runInContext(await readFile(new URL('public/rehearsal-mp3.js', import.meta.url), 'utf8'), sandbox);
  const samples = Float32Array.from({ length: 48000 }, (_, i) => Math.sin(i * 2 * Math.PI * 440 / 48000) * 0.2);
  const blob = await sandbox.window.SalesGodMP3.encode([samples, samples], 48000);
  assert.equal(blob.type, 'audio/mpeg');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.ok(bytes.length > 10000); assert.equal(bytes[0], 0xff); assert.equal(bytes[1] & 0xe0, 0xe0);
  await assert.rejects(sandbox.window.SalesGodMP3.encode([new Float32Array(0)], 48000), /empty/);
});
test('closing guidance retains the session role and approved brief instead of replacing them', () => {
  const { rehearsal } = clientFixture(); const sent = [];
  const peer = { role: 'assistant', channel: { send: data => sent.push(JSON.parse(data)) } };
  const promise = rehearsal.reply(peer, 'Thanks', 2, true);
  assert.equal(sent[1].item.role, 'system'); assert.match(sent[1].item.content[0].text, /final rehearsal turn/);
  assert.equal(sent[2].response.instructions, undefined);
  peer.turn.resolve('Goodbye.'); return promise;
});
