import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CampaignStore } from './campaign-store.mjs';
import { createBridge } from './server.mjs';
import { callVoices, apiVoice, speakingStyle } from './voice-settings.mjs';

const headers = { host: '127.0.0.1:28431', origin: 'http://127.0.0.1:28431', 'content-type': 'application/json' };
const settings = { simulation: false, callerNumber: '+12025550100', timeZone: 'UTC', startHour: 0, endHour: 24, brief: 'Approved synthetic brief.', voicemailMessage: 'Synthetic voicemail remains unchanged.' };
const draft = { name: 'Synthetic profile test', csv: 'first_name,last_name,phone\nAlex,Example,+12025550101', settings };
const profile = { background: 'Synthetic Example Office, represented person Alex.', guidance: 'Use only approved synthetic facts. '.repeat(200).slice(0, 6000) };
test('screening introduction is bounded, saved and snapshotted independently from voicemail and older lists', () => {
  const store = new CampaignStore(':memory:');
  try {
    const old = store.create(draft), introduction = 'Hi, this is Alex, an AI assistant calling for Example Office about an appointment.';
    assert.equal(store.callingProfile().screeningIntroduction, '');
    for (const text of ['short', 'x'.repeat(301)]) assert.throws(() => store.saveCallingProfile({ ...profile, screeningIntroduction: text }), /10–300/);
    store.saveCallingProfile({ ...profile, screeningIntroduction: introduction });
    const current = store.create(draft); assert.equal(current.settings.screeningIntroduction, introduction);
    assert.equal(current.settings.voicemailMessage, settings.voicemailMessage); assert.equal(store.read(old.id).settings.screeningIntroduction, undefined);
    store.applyCallingProfile(old.id, { ...profile, screeningIntroduction: introduction });
    assert.equal(store.read(old.id).settings.screeningIntroduction, introduction);
    store.saveCallingProfile({ ...profile, screeningIntroduction: '' }); assert.equal(store.read(current.id).settings.screeningIntroduction, introduction);
  } finally { store.close(); }
});
test('legacy male selections normalize to Marin for future preparations while historical settings remain unchanged', async () => {
  const store = new CampaignStore(':memory:');
  store.saveCallingProfile(profile); store.db.prepare("UPDATE calling_profile SET voice='cedar'").run();
  assert.equal(store.callingProfile().voice, 'marin');
  const c = store.create(draft), worker = randomUUID();
  store.db.prepare('UPDATE campaigns SET settings=? WHERE id=?').run(JSON.stringify({ ...c.settings, voice: 'ash' }), c.id);
  store.start(c.id, worker); const row = store.claim(c.id, worker).contact; let sent;
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic' }, campaignStore: store, fetchImpl: async (_url, options) => { sent = JSON.parse(options.body.get('session')); return new Response('v=0\r\n'); } });
  try {
    const response = await app.inject({ method: 'POST', url: '/session', headers: { ...headers, 'content-type': 'application/sdp', 'x-audio-mode': 'campaign-call', 'x-campaign-id': c.id, 'x-contact-id': row.id, 'x-worker-id': worker }, payload: 'v=0\r\n' });
    assert.equal(response.statusCode, 200); assert.equal(sent.audio.output.voice, 'marin'); assert.match(sent.instructions, /feminine/);
    assert.equal(store.read(c.id).settings.voice, 'ash');
  } finally { await app.close(); store.close(); }
});

test('all five selected voices reach real sessions, supervised sessions and voicemail; unknown voices are rejected', async () => {
  for (const voice of callVoices) {
    const store = new CampaignStore(':memory:'); const c = store.create({ ...draft, settings: { ...settings, voice } }), worker = randomUUID();
    store.start(c.id, worker); const contact = store.claim(c.id, worker).contact; const sent = [];
    const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic' }, campaignStore: store, fetchImpl: async (url, options) => {
      sent.push(typeof options.body === 'string' ? JSON.parse(options.body) : JSON.parse(options.body.get('session')));
      return new Response(url.endsWith('/speech') ? new Uint8Array([1, 2]) : 'v=0\r\n');
    } });
    try {
      for (const mode of ['campaign-call', 'supervised-call']) {
        const response = await app.inject({ method: 'POST', url: '/session', headers: { ...headers, 'content-type': 'application/sdp', 'x-audio-mode': mode, 'x-audio-voice': voice, 'x-campaign-id': c.id, 'x-contact-id': contact.id, 'x-worker-id': worker }, payload: 'v=0\r\n' });
        assert.equal(response.statusCode, 200); assert.equal(sent.at(-1).audio.output.voice, apiVoice(voice));
        assert.match(sent.at(-1).instructions, /confiden/);
        assert.match(sent.at(-1).instructions, /feminine/);
      }
      const speech = await app.inject({ method: 'POST', url: '/voicemail-speech', headers, payload: { message: settings.voicemailMessage, voice } });
      assert.equal(speech.statusCode, 200); assert.equal(sent.at(-1).voice, apiVoice(voice)); assert.equal(sent.at(-1).input, settings.voicemailMessage);
      assert.ok(sent.at(-1).instructions.includes(speakingStyle(voice)));
      assert.equal((await app.inject({ method: 'POST', url: '/session', headers: { ...headers, 'content-type': 'application/sdp', 'x-audio-mode': 'supervised-call', 'x-audio-voice': 'unsupported' }, payload: 'v=0\r\n' })).statusCode, 400);
      assert.equal((await app.inject({ method: 'POST', url: '/voicemail-speech', headers, payload: { message: settings.voicemailMessage, voice: 'unsupported' } })).statusCode, 400);
      assert.equal(sent.length, 3);
    } finally { await app.close(); store.close(); }
  }
});

test('calling profile survives restart and pruning; imports keep independent snapshots and practice never inherits it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'salesgod-profile-'));
  let store;
  try {
    const path = join(dir, 'campaigns.db'); store = new CampaignStore(path);
    const original = store.create(draft); store.saveCallingProfile(profile);
    assert.equal(store.read(original.id).settings.guidance, undefined);
    const first = store.create(draft); assert.equal(first.settings.guidance, profile.guidance);
    store.saveCallingProfile({ ...profile, guidance: 'B'.repeat(20000), voice: 'coral' });
    assert.equal(store.read(first.id).settings.guidance, profile.guidance);
    assert.equal(store.create(draft).settings.guidance.length, 20000);
    assert.equal(store.create({ ...draft, settings: { ...settings, simulation: true } }).settings.guidance, undefined);
    store.close(); store = new CampaignStore(path, () => new Date('2099-01-01T12:00:00Z'));
    assert.equal(store.list().length, 4); assert.equal(store.callingProfile().guidance.length, 20000);
    assert.equal(store.callingProfile().background, profile.background);
    assert.equal(store.callingProfile().voice, 'coral');
  } finally {
    store?.close(); assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + '\\') || resolve(dir).startsWith(resolve(tmpdir()) + '/'));
    await rm(dir, { recursive: true });
  }
});

test('profile API enforces lengths and origin checks without API requests or call state changes', async () => {
  const store = new CampaignStore(':memory:'); let requests = 0;
  const app = createBridge({ env: {}, campaignStore: store, fetchImpl: async () => { requests++; throw new Error('Unexpected network'); } });
  const post = (payload, extra = {}) => app.inject({ method: 'POST', url: '/calling-profile', headers: { ...headers, ...extra }, payload });
  try {
    for (const n of [0, 5999, 20001]) assert.equal((await post({ ...profile, guidance: 'x'.repeat(n) })).statusCode, 400);
    assert.equal((await post({ ...profile, guidance: ' '.repeat(6000) })).statusCode, 409);
    assert.equal((await post({ ...profile, background: 'x'.repeat(20001) })).statusCode, 400);
    assert.equal((await post(profile, { origin: 'https://untrusted.example' })).statusCode, 403);
    assert.equal((await post({ ...profile, voice: 'unsupported' })).statusCode, 400);
    for (const n of [6000, 20000]) assert.equal((await post({ background: 'b'.repeat(20000), guidance: 'x'.repeat(n) })).statusCode, 200);
    const stored = await app.inject({ url: '/calling-profile', headers }); assert.equal(stored.json().guidance.length, 20000);
    const imported = await app.inject({ method: 'POST', url: '/campaigns-api/import', headers, payload: draft });
    assert.equal(imported.statusCode, 200); assert.equal(imported.json().settings.guidance.length, 20000); assert.equal(imported.json().state, 'draft');
    assert.equal(requests, 0);
  } finally { await app.close(); store.close(); }
});

test('applying guidance only changes idle real lists and never changes defaults or an active attempt', async () => {
  const store = new CampaignStore(':memory:'); const app = createBridge({ env: {}, campaignStore: store });
  const worker = randomUUID();
  try {
    store.saveCallingProfile(profile); const c = store.create(draft), newer = { ...profile, guidance: 'N'.repeat(6000) };
    const apply = () => app.inject({ method: 'POST', url: `/campaigns-api/${c.id}/guidance`, headers, payload: newer });
    assert.equal((await apply()).statusCode, 200); assert.equal(store.read(c.id).settings.guidance, newer.guidance);
    assert.equal(store.callingProfile().guidance, profile.guidance);
    store.start(c.id, worker); assert.equal((await apply()).statusCode, 409);
    const row = store.claim(c.id, worker).contact; store.pause(c.id, worker); assert.equal((await apply()).statusCode, 409);
    store.finish(c.id, row.id, worker, 'cancelled'); assert.equal((await apply()).statusCode, 200);
    const rehearsal = store.create({ ...draft, settings: { ...settings, simulation: true } });
    assert.throws(() => store.applyCallingProfile(rehearsal.id, newer));
  } finally { await app.close(); store.close(); }
});

test('real session receives the complete approved context and identity, without changing voicemail', async () => {
  const store = new CampaignStore(':memory:');
  const full = { background: 'Synthetic Example Office represented by Alex. '.padEnd(20000, '.'), guidance: 'Approved guide sentinel: '.padEnd(20000, 'g') };
  store.saveCallingProfile(full); const c = store.create(draft), worker = randomUUID();
  store.start(c.id, worker); const row = store.claim(c.id, worker).contact; let session;
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic-only' }, campaignStore: store, fetchImpl: async (_url, options) => { session = JSON.parse(options.body.get('session')); return new Response('v=0\r\nsynthetic'); } });
  try {
    const response = await app.inject({ method: 'POST', url: '/session', headers: { ...headers, 'content-type': 'application/sdp', 'x-audio-mode': 'campaign-call', 'x-campaign-id': c.id, 'x-contact-id': row.id, 'x-worker-id': worker }, payload: 'v=0\r\nsynthetic' });
    assert.equal(response.statusCode, 200);
    assert.ok(session.instructions.includes(JSON.stringify(full.background))); assert.ok(session.instructions.includes(JSON.stringify(full.guidance)));
    assert.doesNotMatch(session.instructions, /Jay Marketing Lab|Cena/);
    assert.match(session.instructions, /identify yourself as an AI assistant/); assert.equal(session.tools[0].name, 'finish_call');
    assert.equal(store.read(c.id).settings.voicemailMessage, settings.voicemailMessage);
    assert.deepEqual(store.read(c.id).events.map(e => e.event), ['imported', 'owner_started', 'claimed']);
  } finally { await app.close(); store.close(); }
});
