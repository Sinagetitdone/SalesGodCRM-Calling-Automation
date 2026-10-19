import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createBridge } from './server.mjs';
import { SessionJournal } from './session-journal.mjs';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const source = await readFile(new URL('public/call.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const origin = 'http://127.0.0.1:4318';
const sessionId = '11111111-1111-4111-8111-111111111111';
const headers = { host: '127.0.0.1:4318', origin, 'content-type': 'application/json' };

function environment({ failJournal = false, voicemail = false, failSpeech = false } = {}) {
  const elements = new Map();
  for (const id of ['configuration', 'pairing', 'state', 'media', 'error', 'prepare', 'answer', 'pause', 'stop', 'save', 'savedLog', 'evidence', 'journal', 'voicemailEnabled', 'voicemailMessage', 'voicemailState']) elements.set(id, { disabled: true, textContent: '' });
  elements.get('voicemailEnabled').checked = voicemail; elements.get('voicemailMessage').value = 'Hi, this is a synthetic voicemail test message.';
  const tracks = [], contexts = [], peers = [], requests = [], listeners = new Map(), links = [], timers = new Set();
  class Stream { constructor() { this.track = { kind: 'audio', enabled: true, stop() { this.stopped = true; } }; tracks.push(this.track); } getTracks() { return [this.track]; } getAudioTracks() { return this.getTracks(); } }
  class Node { gain = { value: 1 }; connect() { return this; } disconnect() {} getFloatTimeDomainData() {} }
  class Context { sampleRate = 48000; sources = []; constructor() { contexts.push(this); this.destination = new Node(); } createMediaStreamDestination() { const node = new Node(); node.stream = new Stream(); return node; } createGain() { return new Node(); } createMediaStreamSource() { return new Node(); } createAnalyser() { return new Node(); } async decodeAudioData() { return { duration: 2 }; } createBufferSource() { const source = { connect() {}, disconnect() {}, start() { this.started = true; }, stop() { this.stopped = true; } }; this.sources.push(source); return source; } async resume() {} async close() { this.closed = true; } }
  class Channel extends EventTarget {
    readyState = 'connecting'; sent = [];
    send(body) { this.sent.push(JSON.parse(body)); } close() { this.readyState = 'closed'; this.dispatchEvent(new Event('close')); }
    message(body) { const event = new Event('message'); event.data = JSON.stringify(body); this.dispatchEvent(event); }
  }
  class Peer extends EventTarget {
    channel = new Channel(); connectionState = 'new';
    constructor() { super(); peers.push(this); } createDataChannel() { return this.channel; } addTrack(track) { this.input = track; }
    async createOffer() { return { type: 'offer', sdp: 'v=0\r\nsynthetic' }; } async setLocalDescription(value) { this.localDescription = value; }
    async setRemoteDescription() { this.connectionState = 'connected'; this.channel.readyState = 'open'; this.channel.dispatchEvent(new Event('open')); }
    close() { this.connectionState = 'closed'; }
  }
  const opener = { postMessage() {} };
  const window = { opener, addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); } };
  window[Symbol.for('salesgod.window.rtc.v1')] = { connect(port, options) { const link = { options, sent: [], ready: Promise.resolve(), send(data) { this.sent.push(data); }, close() { this.closed = true; } }; links.push(link); return link; } };
  const sandbox = { window, document: { getElementById: id => elements.get(id) },
    location: { origin, hash: '#token=11111111-1111-4111-8111-111111111111&origin=https%3A%2F%2Fwww.salesgodcrm.net' },
    URLSearchParams, URL, AudioContext: Context, RTCPeerConnection: Peer, Audio: class { async play() {} pause() {} },
    MediaStream: Stream, Float32Array, AbortController, AbortSignal, crypto: { randomUUID: () => sessionId },
    setTimeout(fn, delay) { const timer = setTimeout(fn, delay); timers.add(timer); return timer; }, clearTimeout,
    setInterval(fn, delay) { const timer = setInterval(fn, delay); timers.add(timer); return timer; }, clearInterval,
    async fetch(url, options) {
      requests.push({ url, options });
      if (url === '/status') return { json: async () => ({ keyConfigured: true, model: 'synthetic' }) };
      if (url === '/session') return { ok: true, text: async () => 'v=0\r\nanswer' };
      if (url === '/voicemail-speech') return { ok: !failSpeech, arrayBuffer: async () => new ArrayBuffer(1) };
      return { ok: !failJournal, json: async () => ({ saved: !failJournal }) };
    },
  };
  let now = 0; const detectors = [];
  vm.runInNewContext(awaitVoicemailSource, { window, performance: { now: () => now } });
  const Detector = window.SalesGodVoicemail.Detector;
  window.SalesGodVoicemail.Detector = class extends Detector { constructor(options) { super(options); detectors.push(this); } };
  vm.runInNewContext(source, sandbox);
  const port = { postMessage() {}, close() {} };
  for (const fn of listeners.get('message')) fn({ source: opener, origin: 'https://www.salesgodcrm.net', data: { source: 'salesgod-voice-link-v1', type: 'paired', token: sessionId }, ports: [port] });
  return { elements, peers, tracks, contexts, requests, links, detectors, setTime(value) { now = value; }, timers,
    async start() { await tick(); elements.get('prepare').onclick(); await tick(); await tick(); await tick(); },
    async media(bridgeMicrophone = true) { await links[0].options.onMessage({ type: 'call-media', state: 'ready', bridgeMicrophone }); await tick(); },
    async confirm() { elements.get('answer').onclick(); await tick(); await links[0].options.onMessage({ type: 'gate-state', open: true }); await tick(); },
    async cleanup() { elements.get('stop').onclick?.(); await tick(); for (const timer of timers) { clearTimeout(timer); clearInterval(timer); } },
  };
}
const awaitVoicemailSource = await readFile(new URL('public/voicemail.js', import.meta.url), 'utf8');
const vadAck = { type: 'session.updated', session: { audio: { input: { turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true } } } } };
const listenAck = { type: 'session.updated', session: { audio: { input: { transcription: { model: 'gpt-4o-mini-transcribe' }, turn_detection: { type: 'server_vad', create_response: false, interrupt_response: false } } } } };
async function beep(env) {
  const values = Float32Array.from({ length: 2048 }, (_, i) => 0.2 * Math.sin(2 * Math.PI * 1000 * i / 48000));
  env.setTime(100); env.detectors[0].samples(values, 48000); env.setTime(400); env.detectors[0].samples(values, 48000);
  env.setTime(550); env.detectors[0].samples(new Float32Array(2048), 48000); await tick(); await tick();
}
test('voicemail listens silently, waits for both greeting and beep, plays once and logs completion after playback drains', async () => {
  const env = environment({ voicemail: true });
  try {
    await env.start(); await env.media(); const pc = env.peers[0];
    assert.equal(pc.input.enabled, false); assert.equal(pc.channel.sent.filter(x => x.type === 'response.create').length, 0);
    pc.channel.message(listenAck); await tick(); assert.equal(pc.input.enabled, true);
    await beep(env); assert.equal(env.contexts[0].sources.length, 0);
    pc.channel.message({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Please leave a message after the beep.' }); await tick(); await tick();
    assert.equal(pc.input.enabled, false); assert.equal(env.contexts[0].sources.length, 0);
    await env.links[0].options.onMessage({ type: 'gate-state', open: true }); await tick(); await tick();
    const source = env.contexts[0].sources[0]; assert.equal(source.started, true);
    pc.channel.message({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Leave a message' });
    assert.equal(env.contexts[0].sources.length, 1);
    source.onended(); await new Promise(resolve => setTimeout(resolve, 1050)); await tick(); await tick();
    const report = JSON.parse(env.elements.get('evidence').textContent);
    assert.equal(report.voicemailOutcome, 'playback_completed'); assert.equal(report.phase, 'stopped');
    assert.ok(report.events.some(x => x.event === 'voicemail.playback_completed'));
    assert.equal(pc.connectionState, 'closed'); assert.equal(report.transcript, undefined);
  } finally { await env.cleanup(); }
});
test('voicemail pause prevents late gate acknowledgements or ASR from playing a message', async () => {
  const env = environment({ voicemail: true });
  try {
    await env.start(); await env.media(); env.peers[0].channel.message(listenAck); await tick();
    env.detectors[0].transcript('Please leave a message after the tone.'); await beep(env);
    env.elements.get('pause').onclick(); await env.links[0].options.onMessage({ type: 'gate-state', open: true }); await tick();
    assert.equal(env.contexts[0].sources.length, 0); assert.equal(env.peers[0].input.enabled, false);
    assert.equal(JSON.parse(env.elements.get('evidence').textContent).phase, 'paused');
  } finally { await env.cleanup(); }
});
test('voicemail preparation failure prevents creating OpenAI media or starting a call', async () => {
  const env = environment({ voicemail: true, failSpeech: true });
  try { await env.start(); assert.equal(env.requests.filter(x => x.url === '/session').length, 0); assert.match(env.elements.get('error').textContent, /Voicemail voice preparation failed/); }
  finally { await env.cleanup(); }
});

test('supervised mode stays silent until verified media, owner answer confirmation, gate acknowledgement and VAD acknowledgement', async () => {
  const env = environment();
  try {
    await env.start(); const pc = env.peers[0]; assert.equal(pc.input.enabled, false); assert.equal(pc.channel.sent.length, 0); assert.equal(env.elements.get('answer').disabled, true);
    await env.media(false); assert.equal(env.elements.get('answer').disabled, true);
    await env.media(); assert.equal(env.elements.get('answer').disabled, false);
    pc.channel.message(vadAck); await tick(); assert.equal(pc.input.enabled, false);
    await env.confirm(); assert.equal(pc.input.enabled, false); assert.ok(pc.channel.sent.some(item => item.type === 'session.update'));
    pc.channel.message(vadAck); await tick(); await tick();
    assert.equal(pc.input.enabled, true); assert.equal(pc.channel.sent.filter(item => item.type === 'response.create').length, 1);
    assert.match(env.elements.get('state').textContent, /conversation active/);
    assert.equal(env.requests.find(item => item.url === '/session').options.headers['X-Audio-Mode'], 'supervised-call');
  } finally { await env.cleanup(); }
});
test('pause during start immediately mutes and a delayed acknowledgement cannot restart AI', async () => {
  const env = environment();
  try {
    await env.start(); await env.media(); await env.confirm();
    env.elements.get('pause').onclick(); env.peers[0].channel.message(vadAck); await tick(); await tick();
    assert.equal(env.peers[0].input.enabled, false);
    assert.equal(env.peers[0].channel.sent.filter(item => item.type === 'response.create').length, 0);
    assert.equal(env.links[0].sent.at(-1).open, false); assert.match(env.elements.get('state').textContent, /paused/);
  } finally { await env.cleanup(); }
});
test('customer speech during AI playback records interruption and dialer closure ends the session without redial', async () => {
  const env = environment();
  try {
    await env.start(); await env.media(); await env.confirm(); env.peers[0].channel.message(vadAck); await tick(); await tick();
    env.peers[0].channel.message({ type: 'response.created' }); env.peers[0].channel.message({ type: 'input_audio_buffer.speech_started' });
    env.peers[0].channel.message({ type: 'response.done', response: { status: 'cancelled' } });
    await tick(); const report = JSON.parse(env.elements.get('evidence').textContent); assert.equal(report.interruptions, 1);
    assert.ok(report.events.some(item => item.event === 'ai.response_cancelled')); assert.equal(report.aiResponsesCompleted, undefined);
    env.links[0].options.onClose(); await tick(); await tick();
    assert.equal(env.peers[0].connectionState, 'closed'); assert.equal(env.contexts[0].closed, true); assert.ok(env.tracks.every(track => track.stopped));
    assert.equal(env.requests.filter(item => item.url === '/session').length, 1);
  } finally { await env.cleanup(); }
});
test('an unavailable event journal prevents an OpenAI session from being created', async () => {
  const env = environment({ failJournal: true });
  try { await env.start(); await tick(); assert.equal(env.requests.filter(item => item.url === '/session').length, 0); assert.match(env.elements.get('error').textContent, /event log/); }
  finally { await env.cleanup(); }
});
test('loss of verified media during answer confirmation prevents a delayed VAD acknowledgement from unmuting AI', async () => {
  const env = environment();
  try {
    await env.start(); await env.media(); await env.confirm(); await env.media(false);
    env.peers[0].channel.message(vadAck); await tick(); await tick();
    assert.equal(env.peers[0].input.enabled, false); assert.equal(env.peers[0].connectionState, 'closed');
    assert.equal(env.peers[0].channel.sent.filter(item => item.type === 'response.create').length, 0);
  } finally { await env.cleanup(); }
});
test('session events survive database reopen and records older than seven days are removed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'salesgod-audio-journal-')); const path = join(directory, 'events.db');
  let journal;
  try {
    journal = new SessionJournal(path); journal.append({ sessionId, sequence: 0, event: 'session.started', phase: 'preparing' });
    journal.close(); journal = new SessionJournal(path); assert.equal(journal.read(sessionId).length, 1);
    journal.db.prepare('UPDATE audio_events SET recorded_at=?').run('2000-01-01T00:00:00.000Z');
    assert.equal(journal.read(sessionId).length, 0);
  } finally { journal?.close(); for (const suffix of ['', '-wal', '-shm', '-journal']) await unlink(path + suffix).catch(() => {}); await rmdir(directory); }
});
test('event journal persists ordered events idempotently and rejects arbitrary fields and sequence replacement', async () => {
  const journal = new SessionJournal(':memory:'); const app = createBridge({ env: {}, journal });
  try {
    const entry = { sessionId, sequence: 0, event: 'session.started', phase: 'preparing' };
    for (let i = 0; i < 2; i++) assert.equal((await app.inject({ method: 'POST', url: '/live-log', headers, payload: entry })).statusCode, 200);
    assert.equal((await app.inject({ method: 'POST', url: '/live-log', headers, payload: { ...entry, event: 'session.stopped' } })).statusCode, 409);
    assert.equal((await app.inject({ method: 'POST', url: '/live-log', headers, payload: { ...entry, transcript: 'Must not be retained' } })).statusCode, 400);
    const response = await app.inject({ url: '/live-log/' + sessionId, headers }); assert.equal(response.json().events.length, 1);
    assert.equal((await app.inject({ method: 'POST', url: '/live-log', headers, payload: { ...entry, sequence: 3 } })).statusCode, 409);
  } finally { await app.close(); journal.close(); }
});
test('supervised API session starts with VAD disabled and first-call instructions; simulator uses only fixed synthetic speech', async () => {
  const requests = [];
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic-test-key' }, fetchImpl: async (url, options) => { requests.push({ url, options }); return new Response(url.endsWith('/speech') ? 'synthetic-audio' : 'v=0\r\nanswer'); } });
  try {
    const response = await app.inject({ method: 'POST', url: '/session', headers: { ...headers, 'content-type': 'application/sdp', 'x-audio-mode': 'supervised-call' }, payload: 'v=0\r\n' });
    assert.equal(response.statusCode, 200); const session = JSON.parse(requests[0].options.body.get('session'));
    assert.equal(session.audio.input.turn_detection, null); assert.match(session.instructions, /AI assistant calling for Sina/);
    assert.match(session.instructions, /Do not conduct sales/);
    for (let i = 0; i < 2; i++) assert.equal((await app.inject({ method: 'POST', url: '/simulation-speech', headers, payload: {} })).statusCode, 200);
    assert.equal(requests.length, 2); const speech = JSON.parse(requests[1].options.body); assert.match(speech.input, /word orange/);
  } finally { await app.close(); }
});

test('voicemail synthesis validates input, preserves owner text, exposes no upstream failures or credentials, and accepts new log events', async () => {
  const requests = []; let fail = false;
  const journal = new SessionJournal(':memory:');
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic-private-key' }, journal, fetchImpl: async (url, options) => {
    requests.push({ url, options }); return new Response(fail ? 'private upstream body' : 'synthetic wav', { status: fail ? 401 : 200 });
  } });
  try {
    for (const payload of [{ message: 'short' }, { message: ' '.repeat(20) }, { message: 'x'.repeat(1001) }, { message: 'A valid message', extra: true }]) {
      assert.equal((await app.inject({ method: 'POST', url: '/voicemail-speech', headers, payload })).statusCode, 400);
    }
    assert.equal(requests.length, 0);
    const message = 'Hi, this is a synthetic AI test message.';
    const response = await app.inject({ method: 'POST', url: '/voicemail-speech', headers, payload: { message } });
    assert.equal(response.statusCode, 200); assert.match(response.headers['content-type'], /audio\/wav/);
    assert.equal(JSON.parse(requests[0].options.body).input, message); assert.equal(JSON.parse(requests[0].options.body).voice, 'marin');
    fail = true;
    const failed = await app.inject({ method: 'POST', url: '/voicemail-speech', headers, payload: { message } });
    assert.equal(failed.statusCode, 502); assert.doesNotMatch(failed.body, /private upstream|synthetic-private-key/);
    for (const [sequence, event] of ['session.started', 'voicemail.listening', 'voicemail.greeting_detected', 'voicemail.beep_detected', 'voicemail.playback_started', 'voicemail.playback_completed'].entries()) {
      assert.equal((await app.inject({ method: 'POST', url: '/live-log', headers, payload: { sessionId, sequence, event, phase: 'voicemail-playing' } })).statusCode, 200);
    }
  } finally { await app.close(); journal.close(); }
});

test('hangup during voicemail playback records incomplete rather than successful delivery', async () => {
  const env = environment({ voicemail: true });
  try {
    await env.start(); await env.media(); env.peers[0].channel.message(listenAck); await tick();
    env.detectors[0].transcript('Leave a message after the beep'); await beep(env);
    await env.links[0].options.onMessage({ type: 'gate-state', open: true }); await tick(); await tick();
    const source = env.contexts[0].sources[0]; env.links[0].options.onClose(); await tick(); await tick();
    const report = JSON.parse(env.elements.get('evidence').textContent);
    assert.equal(source.stopped, true); assert.equal(report.voicemailOutcome, 'incomplete');
    assert.ok(report.events.some(x => x.event === 'voicemail.incomplete'));
    assert.ok(!report.events.some(x => x.event === 'voicemail.playback_completed'));
  } finally { await env.cleanup(); }
});
