import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import twilio from 'twilio';
import { TwilioProvider, twilioConfiguration } from './twilio-provider.mjs';
import { TwilioAudio, pcm24ToMuLaw, greetingKind } from './twilio-audio.mjs';
import { TwilioService } from './twilio-service.mjs';
import { CampaignStore } from './campaign-store.mjs';
import { createBridge } from './server.mjs';
import { verifiedTunnelAsset, tunnelAssets } from './twilio-tunnel.mjs';
const env = { TWILIO_ACCOUNT_SID: 'AC' + '1'.repeat(32), TWILIO_AUTH_TOKEN: 'synthetic-token', TWILIO_FROM_NUMBER: '+12025550100', TWILIO_PUBLIC_URL: 'https://voice.example.test', OPENAI_API_KEY: 'synthetic' };
class Socket extends EventEmitter {
  readyState = 1; sent = [];
  send(raw) { this.sent.push(JSON.parse(raw)); }
  close() { this.readyState = 3; this.emit('close'); }
  message(data) { this.emit('message', JSON.stringify(data)); }
}
function audioFixture(attach = true) {
  const socket = new Socket(), phone = new Socket(), events = [], transcripts = [], finished = [], errors = [];
  const audio = new TwilioAudio({ socket, settings: { voice: 'marin', timeZone: 'America/Los_Angeles', brief: 'Test', voicemailMessage: 'Approved voicemail only.', screeningIntroduction: 'This is an AI assistant from the test office.' }, contact: { firstName: 'Example', lastName: 'Person' }, voicemail: Buffer.alloc(160, 255), event: e => events.push(e), transcript: t => transcripts.push(t), finish: o => finished.push(o), fail: e => errors.push(e) });
  if (attach) audio.attach(phone, 'MZtest');
  return { socket, phone, audio, events, transcripts, finished, errors };
}
test('Twilio adapter requires configuration and makes exactly one signed dial request', async () => {
  assert.equal(twilioConfiguration({}).ready, false);
  for (const url of ['http://example.test', 'https://example.test/admin', 'https://user:pass@example.test', 'https://example.test?key=x']) assert.equal(twilioConfiguration({ ...env, TWILIO_PUBLIC_URL: url }).ready, false);
  const requests = [];
  const provider = new TwilioProvider({ env, fetchImpl: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ sid: 'CA' + '2'.repeat(32), status: 'queued' }) }; } });
  await provider.dial({ session: 'synthetic-session', contact: { phone: '+12025550101' } });
  assert.equal(requests.length, 1);
  const form = requests[0].options.body;
  assert.equal(form.get('To'), '+12025550101'); assert.equal(form.get('From'), env.TWILIO_FROM_NUMBER);
  assert.equal(form.get('MachineDetection'), 'DetectMessageEnd'); assert.equal(form.get('AsyncAmd'), 'true');
  assert.match(form.get('Twiml'), /<Connect><Stream url="wss:\/\/voice.example.test\/twilio\/media\/synthetic-session"/);
  assert.equal(form.get('Record'), 'true'); assert.equal(form.getAll('StatusCallbackEvent').length, 4);
  const path = '/twilio/status/attempt', body = { CallSid: 'CA' + '2'.repeat(32) };
  const signature = twilio.getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN, env.TWILIO_PUBLIC_URL + path, body);
  assert.equal(provider.signed(path, signature, body), true); assert.equal(provider.signed(path, signature, { ...body, CallSid: 'changed' }), false);
  const mediaPath = '/twilio/media/attempt';
  const mediaSignature = twilio.getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN, env.TWILIO_PUBLIC_URL.replace('https:', 'wss:') + mediaPath + '/', {});
  assert.equal(provider.signedMedia(mediaPath, mediaSignature), true); assert.equal(provider.signedMedia('/twilio/media/another', mediaSignature), false);
});
test('human hello starts live conversation without waiting for AMD; interruptions clear buffered audio', () => {
  const f = audioFixture();
  f.socket.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'hello', transcript: 'Hello, can you hear me?' });
  assert.equal(f.audio.mode, 'live'); assert.equal(f.audio.humanAnswered, true);
  f.socket.message({ type: 'response.created', response: { id: 'response-1' } });
  f.socket.message({ type: 'response.output_audio.delta', item_id: 'item-1', delta: Buffer.alloc(800).toString('base64') });
  f.audio.media({ event: 'media', media: { timestamp: '50', payload: Buffer.alloc(160).toString('base64') } });
  f.socket.message({ type: 'input_audio_buffer.speech_started' });
  assert.equal(f.phone.sent.at(-1).event, 'clear'); assert(f.socket.sent.some(e => e.type === 'response.cancel'));
  assert(f.socket.sent.some(e => e.type === 'conversation.item.truncate' && e.audio_end_ms === 50));
  f.audio.close();
});
test('a current Twilio trial is reported explicitly before number lookup, tunnel setup or any dial request', async () => {
  const requests = [];
  const provider = new TwilioProvider({ env: { ...env, TWILIO_PUBLIC_URL: '' }, fetchImpl: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ status: 'active', type: 'Trial' }) }; } });
  await assert.rejects(provider.check(), /authentication succeeded.*trial account blocks Media Streams/);
  assert.equal(requests.length, 1); assert.equal(requests[0].options.method, 'GET'); assert(!requests[0].url.includes('/Calls'));
});
test('voicemail is delivered only after greeting end and playback acknowledgment; cleared marks never count as delivery', () => {
  const f = audioFixture(); f.audio.decision('machine_end_beep');
  assert.equal(f.audio.mode, 'voicemail'); assert.equal(f.finished.length, 0);
  const mark = f.phone.sent.find(e => e.event === 'mark');
  f.socket.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'pickup', transcript: 'Hello, can you hear me?' });
  assert.equal(f.audio.mode, 'live'); assert(f.events.includes('voicemail.human_takeover'));
  f.audio.media({ event: 'mark', mark: mark.mark });
  assert.equal(f.audio.voicemailPlayed, undefined); assert.equal(f.finished.length, 0);
  f.audio.decision('machine_end_beep'); assert.equal(f.audio.mode, 'live'); f.audio.close();
  const g = audioFixture(); g.audio.decision('machine_end_silence'); const completed = g.phone.sent.find(e => e.event === 'mark');
  g.audio.media({ event: 'mark', mark: completed.mark }); assert.equal(g.audio.voicemailPlayed, true); assert(g.events.includes('voicemail.playback_completed')); g.audio.close();
});
test('finish tool waits for Twilio playback and opt-out arguments are validated', () => {
  const f = audioFixture(); f.audio.live('Introduce yourself.');
  f.socket.message({ type: 'response.created', response: { id: 'response' } });
  f.socket.message({ type: 'response.function_call_arguments.done', name: 'finish_call', call_id: 'tool', arguments: '{"reason":"opt_out","disposition":"opt_out"}' });
  f.socket.message({ type: 'response.done', response: { status: 'completed' } });
  assert.equal(f.finished.length, 0);
  f.audio.media({ event: 'mark', mark: f.phone.sent.at(-1).mark }); assert.deepEqual(f.finished, ['opt_out']); f.audio.close();
});
test('PCM conversion and greeting classification preserve voicemail gating', () => {
  assert.deepEqual([...pcm24ToMuLaw(Buffer.alloc(12))], [255, 255]);
  assert.equal(greetingKind('Please leave your message at the tone.'), 'voicemail');
  assert.equal(greetingKind('State your name and reason for calling.'), 'screening');
  assert.equal(greetingKind('Hello?'), 'human');
  assert.equal(greetingKind('The mailbox is full.'), 'unavailable');
});

function workerFixture() {
  const store = new CampaignStore(':memory:');
  const campaign = store.create({ name: 'Synthetic list', csv: 'first_name,last_name,phone\nA,Example,+12025550101\nB,Example,+12025550102', settings: { simulation: false, callerNumber: env.TWILIO_FROM_NUMBER, timeZone: 'UTC', brief: 'Synthetic', voicemailMessage: 'A synthetic message.' } });
  const provider = new TwilioProvider({ env }); provider.check = async () => ({ ready: true });
  provider.status = async () => ({ status: 'busy' });
  const service = new TwilioService({ env, campaigns: () => store, provider, socketFactory: () => { const s = new Socket(); setImmediate(() => { s.message({ type: 'session.created' }); s.message({ type: 'session.updated' }); }); return s; }, fetchImpl: async () => ({ ok: true, json: async () => ({ instance: service.healthToken }) }), sleep: () => new Promise(r => setImmediate(r)) });
  service.ingress = { listening: true }; service.prepareVoicemail = async () => Buffer.alloc(160);
  return { store, campaign, provider, service };
}
test('a lost dial response pauses without retry and blocks another Start until the unknown attempt is resolved', async () => {
  const f = workerFixture(); let dials = 0;
  f.provider.dial = async () => { dials++; throw new Error('Synthetic lost response.'); };
  try {
    await f.service.start(f.campaign.id); await f.service.run.task;
    assert.equal(dials, 1); assert.deepEqual(f.store.read(f.campaign.id).contacts.map(c => c.state), ['unknown', 'pending']);
    await assert.rejects(f.service.start(f.campaign.id), /uncertain result/); assert.equal(dials, 1);
  } finally { f.store.close(); }
});
test('Pause finishes this contact and leaves the next pending; Stop during preparation never dials', async () => {
  const f = workerFixture(); let dials = 0;
  f.provider.dial = async () => { dials++; f.service.control(f.campaign.id, false); return { sid: 'CA' + '2'.repeat(32), status: 'queued' }; };
  try { await f.service.start(f.campaign.id); await f.service.run.task; assert.equal(dials, 1); assert.deepEqual(f.store.read(f.campaign.id).contacts.map(c => c.state), ['no_answer', 'pending']); } finally { f.store.close(); }
  const g = workerFixture(); let prepared;
  g.service.prepareVoicemail = () => new Promise(resolve => { prepared = resolve; });
  g.provider.dial = async () => { throw new Error('Should not dial'); };
  try { await g.service.start(g.campaign.id); const task = g.service.run.task; g.service.control(g.campaign.id, true); prepared(Buffer.alloc(160)); await task; assert.equal(g.store.read(g.campaign.id).contacts[0].dispatched, null); assert.equal(g.store.read(g.campaign.id).contacts[0].state, 'cancelled'); } finally { g.store.close(); }
});
test('answered calls save ID3-tagged MP3s before the next number; recording failures remain visible', async () => {
  const f = workerFixture(); let dials = 0, recordings = 0;
  f.provider.dial = async attempt => { assert.equal(recordings, dials); dials++; attempt.audio.humanAnswered = true; attempt.recordingSid = 'RE' + '3'.repeat(32); return { sid: 'CA' + String(dials).repeat(32), status: 'queued' }; };
  f.provider.status = async () => ({ status: 'completed' });
  f.provider.recording = async () => { recordings++; return Buffer.from('ID3\u0004\u0000\u0000\u0000\u0000\u0000\u0000synthetic'); };
  try { await f.service.start(f.campaign.id); await f.service.run.task; assert.equal(recordings, 2); assert(f.store.read(f.campaign.id).contacts.every(c => c.hasRecording && c.state === 'completed')); } finally { f.store.close(); }
  const g = workerFixture();
  g.provider.dial = async attempt => { attempt.audio.humanAnswered = true; attempt.recordingSid = 'RE' + '3'.repeat(32); return { sid: 'CA' + '2'.repeat(32), status: 'queued' }; };
  g.provider.status = async () => ({ status: 'completed' }); g.provider.recording = async () => { throw new Error('Synthetic recording fetch failed.'); };
  try { await g.service.start(g.campaign.id); await g.service.run.task; const state = g.store.read(g.campaign.id); assert.equal(state.contacts[0].state, 'needs_review'); assert.equal(state.contacts[1].state, 'pending'); assert(state.events.some(e => /recording fetch failed/.test(e.event))); } finally { g.store.close(); }
});
test('full mailbox does not play voicemail, and delayed old greeting text cannot trigger a false human takeover', () => {
  const f = audioFixture(); f.socket.message({ type: 'input_audio_buffer.speech_started', item_id: 'old' }); f.audio.decision('machine_end_beep');
  f.socket.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'old', transcript: 'Thank you very much.' }); assert.equal(f.audio.mode, 'voicemail');
  f.socket.message({ type: 'input_audio_buffer.speech_started', item_id: 'pickup' });
  f.socket.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'pickup', transcript: 'Stop calling.' }); assert.equal(f.audio.mode, 'live'); f.audio.close();
  const g = audioFixture(); g.socket.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'full', transcript: 'The mailbox is full.' }); assert.equal(g.errors.length, 1); assert(!g.phone.sent.some(e => e.event === 'media')); g.audio.close();
});
test('default API refuses the former browser-controlled live Start and tunnel assets reject corrupted bytes', async () => {
  const f = workerFixture(), app = createBridge({ campaignStore: f.store, env: {} });
  try {
    const response = await app.inject({ method: 'POST', url: `/campaigns-api/${f.campaign.id}/start`, headers: { host: '127.0.0.1:28431', origin: 'http://127.0.0.1:28431' }, payload: { workerId: crypto.randomUUID(), authorized: true } });
    assert.equal(response.statusCode, 409); assert.equal(f.store.read(f.campaign.id).state, 'draft');
    for (const [, hash] of Object.values(tunnelAssets)) assert.equal(verifiedTunnelAsset(Buffer.from('corrupt'), hash), false);
  } finally { await app.close(); f.store.close(); }
});
test('a failed public tunnel blocks Start while retaining the local desk and history service', async () => {
  const f = workerFixture();
  try { await f.service.tunnelLost(); assert.equal(f.service.status().ready, false); await assert.rejects(f.service.start(f.campaign.id), /connection ended/); assert.equal(f.store.read(f.campaign.id).state, 'draft'); assert.equal(f.store.list().length, 1); }
  finally { f.store.close(); }
});
test('backend advances the whole list, rejects duplicate Start and deduplicates callbacks without dialing twice', async () => {
  const store = new CampaignStore(':memory:'); let dials = 0;
  const campaign = store.create({ name: 'Synthetic list', csv: 'first_name,last_name,phone\nA,Example,+12025550101\nB,Example,+12025550102', settings: { simulation: false, callerNumber: env.TWILIO_FROM_NUMBER, timeZone: 'UTC', brief: 'Synthetic', voicemailMessage: 'A synthetic message.' } });
  const provider = new TwilioProvider({ env }); provider.check = async () => ({ ready: true });
  provider.dial = async attempt => { dials++; return { sid: 'CA' + String(dials).repeat(32), status: 'queued' }; };
  provider.status = async () => ({ status: 'busy' });
  const service = new TwilioService({ env, campaigns: () => store, provider, socketFactory: () => { const s = new Socket(); setImmediate(() => { s.message({ type: 'session.created' }); s.message({ type: 'session.updated' }); }); return s; }, fetchImpl: async () => ({ ok: true, json: async () => ({ instance: service.healthToken }) }), sleep: () => new Promise(r => setImmediate(r)) });
  service.ingress = { listening: true }; service.prepareVoicemail = async () => Buffer.alloc(160);
  await service.start(campaign.id); const running = service.run.task;
  await assert.rejects(service.start(campaign.id), /already running/); await running;
  assert.equal(dials, 2); assert.equal(store.read(campaign.id).state, 'finished');
  const attempt = store.db.prepare('SELECT * FROM twilio_attempts LIMIT 1').get();
  const body = { AccountSid: env.TWILIO_ACCOUNT_SID, CallSid: attempt.call_sid, CallStatus: 'completed', SequenceNumber: '4' };
  service.callback(attempt.session, 'status', body); service.callback(attempt.session, 'status', body);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM twilio_callbacks').get().n, 1);
  store.close();
});
test('public ingress cannot reach private controls, rejects unsigned callbacks and rejects unsigned media upgrades', async () => {
  const store = new CampaignStore(':memory:'); const service = new TwilioService({ env, campaigns: () => store });
  await service.listen({ port: 0 });
  const base = 'http://127.0.0.1:' + service.ingress.address().port;
  try {
    assert.equal((await fetch(base + '/campaigns')).status, 404);
    assert.equal((await fetch(base + '/campaigns-api', { method: 'POST' })).status, 404);
    assert.equal((await fetch(base + '/twilio/status/' + '1'.repeat(8) + '-1111-1111-1111-' + '1'.repeat(12), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'CallSid=fake' })).status, 403);
    const rejectSocket = new WebSocket(base.replace('http:', 'ws:') + '/twilio/media/11111111-1111-1111-1111-111111111111');
    await new Promise((resolve, reject) => { rejectSocket.on('unexpected-response', (_r, response) => { response.resume(); assert.equal(response.statusCode, 403); rejectSocket.terminate(); resolve(); }); rejectSocket.on('open', () => reject(new Error('Unsigned media was accepted.'))); rejectSocket.on('error', () => {}); });
  } finally { await service.close(); store.close(); }
});

test('a signed synthetic WebSocket binds only its owned call and moves PCMU audio in both directions without dialing', async () => {
  const f = workerFixture(), audio = audioFixture(false);
  const run = { id: f.campaign.id, worker: crypto.randomUUID() };
  f.store.start(run.id, run.worker); const contact = f.store.claim(run.id, run.worker).contact, session = crypto.randomUUID();
  f.store.dispatch(run.id, contact.id, run.worker, session); f.service.store();
  f.store.db.prepare("INSERT INTO twilio_attempts VALUES(?,?,?,NULL,'dispatching',?)").run(session, run.id, contact.id, f.store.stamp());
  const sid = 'CA' + '4'.repeat(32), attempt = { run, contact, session, audio: audio.audio, dispatched: true, event: () => {} };
  f.service.attempts.set(session, attempt); f.service.ingress = undefined;
  await f.service.listen({ port: 0 });
  const path = '/twilio/media/' + session, signature = twilio.getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN, env.TWILIO_PUBLIC_URL + path, {});
  const client = new WebSocket('ws://127.0.0.1:' + f.service.ingress.address().port + path, { headers: { 'X-Twilio-Signature': signature } });
  try {
    await new Promise((resolve, reject) => { client.once('open', resolve); client.once('error', reject); });
    client.send(JSON.stringify({ event: 'start', start: { accountSid: env.TWILIO_ACCOUNT_SID, callSid: sid, streamSid: 'MZsynthetic', mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 } } }));
    client.send(JSON.stringify({ event: 'media', streamSid: 'MZsynthetic', media: { timestamp: '20', payload: Buffer.alloc(160, 255).toString('base64') } }));
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(attempt.sid, sid); assert(audio.socket.sent.some(e => e.type === 'input_audio_buffer.append'));
    f.service.callStatus(attempt, 'ringing'); assert.equal(attempt.status, 'in-progress');
    const received = new Promise(resolve => client.once('message', raw => resolve(JSON.parse(raw))));
    audio.audio.mode = 'live'; audio.socket.message({ type: 'response.created', response: { id: 'synthetic-response' } });
    audio.socket.message({ type: 'response.output_audio.delta', item_id: 'synthetic-item', delta: Buffer.alloc(160, 255).toString('base64') });
    const outgoing = await received; assert.equal(outgoing.event, 'media'); assert.equal(outgoing.streamSid, 'MZsynthetic');
  } finally { attempt.ended = true; audio.audio.close(); client.terminate(); await f.service.close(); f.store.close(); }
});
