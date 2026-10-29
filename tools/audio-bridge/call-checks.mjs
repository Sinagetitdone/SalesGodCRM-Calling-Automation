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
const origin = 'http://127.0.0.1:28431';
const sessionId = '11111111-1111-4111-8111-111111111111';
const headers = { host: '127.0.0.1:28431', origin, 'content-type': 'application/json' };

function environment({ headless = false, failJournal = false, voicemail = false, failSpeech = false, recordingFinish, speechError = { error: 'Voicemail voice preparation failed. Do not start a call.' } } = {}) {
  const elements = new Map();
  for (const id of ['configuration', 'pairing', 'state', 'media', 'error', 'prepare', 'answer', 'pause', 'stop', 'save', 'savedLog', 'evidence', 'journal', 'voicemailEnabled', 'voicemailMessage', 'voicemailState', 'ownerInstruction', 'sendInstruction', 'instructionStatus']) elements.set(id, { disabled: true, textContent: '' });
  elements.get('voicemailEnabled').checked = voicemail; elements.get('voicemailMessage').value = 'Hi, this is a synthetic voicemail test message.';
  const tracks = [], contexts = [], peers = [], requests = [], listeners = new Map(), links = [], timers = new Set(), callbacks = new Map();
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
  const recorders = [];
  window.SalesGodCallRecording = class {
    constructor(context, outbound) { this.context = context; this.outbound = outbound; this.inbound = []; recorders.push(this); }
    addStream(stream) { this.inbound.push(stream); }
    async transcriptSegments() { return [{ speaker: 'customer', start: 0, end: 1, audio: '//sAAQ==' }]; }
    start() { this.started = true; }
    async finish() { this.finishes = (this.finishes || 0) + 1; return this.started ? (recordingFinish ? recordingFinish() : new Blob(['synthetic-mp3'])) : null; }
  };
  window[Symbol.for('salesgod.window.rtc.v1')] = { connect(port, options) { const link = { options, sent: [], ready: Promise.resolve(), send(data) { this.sent.push(data); }, close() { this.closed = true; } }; links.push(link); return link; } };
  const sandbox = { window, document: { body: { dataset: { workspace: headless ? 'live' : 'rehearsal' } }, createElement: () => ({ disabled: true, textContent: '' }), getElementById: id => headless && !['voicemailEnabled', 'voicemailMessage', 'state', 'media', 'error', 'configuration'].includes(id) ? null : elements.get(id) },
    location: { origin, hash: '#token=11111111-1111-4111-8111-111111111111&origin=https%3A%2F%2Fwww.salesgodcrm.net' },
    URLSearchParams, URL, AudioContext: Context, RTCPeerConnection: Peer, Audio: class { async play() {} pause() {} },
    MediaStream: Stream, Float32Array, AbortController, AbortSignal, crypto: { randomUUID: () => sessionId },
    setTimeout(fn, delay) { const timer = setTimeout(() => { callbacks.delete(timer); fn(); }, delay); timers.add(timer); callbacks.set(timer, { fn, delay }); return timer; },
    clearTimeout(timer) { callbacks.delete(timer); clearTimeout(timer); },
    setInterval(fn, delay) { const timer = setInterval(fn, delay); timers.add(timer); return timer; }, clearInterval,
    async fetch(url, options) {
      requests.push({ url, options });
      if (url === '/status') return { json: async () => ({ keyConfigured: true, model: 'synthetic' }) };
      if (url === '/session') return { ok: true, text: async () => 'v=0\r\nanswer' };
      if (url === '/voicemail-speech') return { ok: !failSpeech, status: failSpeech ? 502 : 200, json: async () => speechError, arrayBuffer: async () => new ArrayBuffer(1) };
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
  return { window, elements, peers, tracks, contexts, requests, links, detectors, recorders, api: window.SalesGodCall, setTime(value) { now = value; }, timers,
    async fireTimers(delay) { for (const [timer, cb] of [...callbacks]) if (cb.delay === delay && callbacks.has(timer)) { clearTimeout(timer); callbacks.delete(timer); cb.fn(); } await tick(); await tick(); },
    async start() { await tick(); elements.get('prepare').onclick(); await tick(); await tick(); await tick(); },
    async media(bridgeMicrophone = true) { await links[0].options.onMessage({ type: 'call-media', state: 'ready', bridgeMicrophone }); await tick(); },
    async confirm() { elements.get('answer').onclick(); await tick(); await links[0].options.onMessage({ type: 'gate-state', open: true }); await tick(); },
    async cleanup() { elements.get('stop').onclick?.(); await tick(); for (const timer of timers) { clearTimeout(timer); clearInterval(timer); } },
  };
}
const awaitVoicemailSource = await readFile(new URL('public/voicemail.js', import.meta.url), 'utf8');
const vadAck = { type: 'session.updated', session: { audio: { input: { turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true } } } } };
test('real call records incoming audio before the ASR gate, and concurrent stop waits for one saved MP3', async () => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const env = environment({ recordingFinish: () => pending }), saved = [];
  try {
    env.api.configure({ automatic: true, saveRecording: async blob => { saved.push(blob); } });
    await env.start(); env.api.startRecording();
    const incoming = { getTracks: () => [] };
    env.links[0].options.onTrack(incoming);
    assert.equal(env.recorders[0].outbound, env.links[0].options.stream);
    assert.equal(env.recorders[0].inbound[0], incoming);
    assert.equal(env.peers[0].input.enabled, false);
    const first = env.api.stop(), second = env.api.stop();
    assert.equal(first, second); assert.equal(env.api.status().audioStopped, true);
    assert.equal(env.api.status().recordingState, 'saving'); assert.equal(saved.length, 0);
    assert.equal(env.contexts[0].closed, undefined);
    const mp3 = new Blob(['synthetic']); release(mp3); await second;
    assert.deepEqual(saved, [mp3]); assert.equal(env.recorders[0].finishes, 1);
    assert.equal(env.api.status().recordingState, 'saved'); assert.equal(env.contexts[0].closed, true);
    assert.ok(env.api.status().events.some(e => e.event === 'recording.saved'));
  } finally { release(null); await env.cleanup(); }
});
test('failed recording uploads are retained as a failure and preparation alone saves no recording', async () => {
  for (const started of [false, true]) {
    const env = environment(); let attempts = 0;
    try {
      env.api.configure({ saveRecording: async () => { attempts++; throw new Error('Disk unavailable'); } });
      await env.start(); if (started) env.api.startRecording(); await env.api.stop();
      assert.equal(attempts, started ? 1 : 0);
      assert.equal(env.api.status().recordingState, started ? 'failed' : 'not_started');
      assert.equal(env.api.status().phase, started ? 'failed' : 'stopped');
      if (started) assert.match(env.api.status().stopReason, /recording could not be saved/);
    } finally { await env.cleanup(); }
  }
});
test('hangup and MP3 saving precede final transcription; failure preserves the recording and its exact cause', async () => {
  for (const fail of [false, true]) {
    const env = environment(), actions = [];
    try {
      env.api.configure({ saveRecording: async () => actions.push('mp3'), saveAudioTranscript: async body => {
        actions.push('transcribe'); assert.equal(env.api.status().audioStopped, true); assert.equal(env.api.status().transcriptState, 'processing');
        assert.equal(body.segments[0].speaker, 'customer'); assert.equal(env.contexts[0].closed, undefined);
        if (fail) throw new Error('Transcription quota exhausted (HTTP 429)');
      } });
      await env.start(); env.api.startRecording(); await env.api.stop();
      assert.deepEqual(actions, ['mp3', 'transcribe']); assert.equal(env.api.status().recordingState, 'saved');
      assert.equal(env.api.status().transcriptState, fail ? 'failed' : 'complete');
      if (fail) { assert.equal(env.api.status().phase, 'failed'); assert.match(env.api.status().stopReason, /quota exhausted \(HTTP 429\)/); }
    } finally { await env.cleanup(); }
  }
});
test('list audio engine works without manual controls and manual preparation cannot overlap rehearsal', async () => {
  const env = environment({ headless: true });
  try {
    await tick(); env.window.SalesGodRehearsalBusy = true;
    await env.api.prepare(); assert.equal(env.peers.length, 0);
    env.window.SalesGodRehearsalBusy = false;
    await env.api.prepare(); await tick(); await tick();
    assert.equal(env.api.status().prepared, true); assert.equal(env.api.status().active, true);
    assert.equal(env.peers[0].input.enabled, false);
    await env.api.stop(); assert.equal(env.api.status().active, false);
  } finally { await env.cleanup(); }
});
test('live conversation applies its configurable pause and measures response audio without shortening voicemail timing', async () => {
  for (const [requested, expected] of [[undefined, 250], [500, 500], [0, 250]]) {
    const env = environment({ voicemail: true });
    try {
      env.api.configure({ responsePauseMs: requested });
      await env.start(); await env.media();
      const screening = env.peers[0].channel.sent.find(m => m.type === 'session.update').session.audio.input.turn_detection;
      assert.equal(screening.silence_duration_ms, 350); assert.equal(screening.create_response, false);
      await env.confirm();
      const dc = env.peers[0].channel;
      assert.equal(dc.sent.filter(m => m.type === 'session.update').at(-1).session.audio.input.turn_detection.silence_duration_ms, expected);
      dc.message(vadAck); await tick(); await tick();
      dc.message({ type: 'input_audio_buffer.speech_stopped' });
      dc.message({ type: 'output_audio_buffer.started' }); await tick();
      assert.ok(env.api.status().lastReplyAfterVadMs >= 0);
      assert.ok(env.api.status().events.some(e => e.event === 'ai.audio_started'));
    } finally { await env.cleanup(); }
  }
});
test('regional denial during voicemail preparation is retained and prevents any live media preparation', async () => {
  const env = environment({ voicemail: true, failSpeech: true, speechError: { error: 'API access blocked for detected country or region.', errorCode: 'unsupported_country_region_territory', upstreamStatus: 403 } });
  try {
    env.api.configure({ automatic: true }); await env.start();
    const report = env.api.status();
    assert.equal(report.phase, 'failed'); assert.equal(report.failure.stage, 'voicemail_preparation');
    assert.equal(report.failure.errorCode, 'unsupported_country_region_territory'); assert.equal(report.failure.upstreamStatus, 403);
    assert.equal(env.requests.some(r => r.url === '/session'), false); assert.equal(env.links.length, 0);
    assert.match(env.elements.get('error').textContent, /blocked for detected country/);
  } finally { await env.cleanup(); }
});
test('owner instructions require a live human conversation, wait for matching acknowledgement and retain no instruction text', async () => {
  const env = environment();
  try {
    await env.start(); env.elements.get('ownerInstruction').value = 'Ask whether 4 PM San Diego time works, or ask their preferred time.'.padEnd(6000, '.');
    env.elements.get('sendInstruction').onclick(); await tick();
    assert.equal(env.peers[0].channel.sent.some(x => x.type === 'conversation.item.create'), false);
    await env.media(); await env.confirm(); env.peers[0].channel.message(vadAck); await tick(); await tick();
    env.elements.get('sendInstruction').onclick(); await tick(); await tick();
    const note = env.peers[0].channel.sent.find(x => x.type === 'conversation.item.create' && x.item.id);
    assert.equal(note.item.role, 'system'); assert.match(note.item.content[0].text, /San Diego/);
    assert.equal(env.elements.get('sendInstruction').disabled, true);
    env.peers[0].channel.message({ type: 'conversation.item.added', item: { id: 'unrelated' } }); await tick();
    assert.equal(env.elements.get('sendInstruction').disabled, true);
    env.peers[0].channel.message({ type: 'conversation.item.added', item: { id: note.item.id } }); await tick();
    assert.match(env.elements.get('instructionStatus').textContent, /AI accepted/);
    assert.equal(env.elements.get('sendInstruction').disabled, false);
    assert.doesNotMatch(env.elements.get('evidence').textContent, /San Diego/);
    assert.equal(env.elements.get('ownerInstruction').value, '');
    assert.equal(env.peers[0].channel.sent.filter(x => x.type === 'response.create').length, 1);
  } finally { await env.cleanup(); }
});
const listenAck = { type: 'session.updated', session: { audio: { input: { transcription: { model: 'gpt-4o-mini-transcribe' }, turn_detection: { type: 'server_vad', create_response: false, interrupt_response: false } } } } };
test('live owner guidance enforces both boundaries before sending and preserves rejected input', async () => {
  const env = environment();
  try {
    await env.start(); await env.media(); await env.confirm(); const dc = env.peers[0].channel;
    dc.message(vadAck); await tick(); await tick();
    for (const length of [0, 5999, 20001, 6000, 20000]) {
      const text = 'x'.repeat(length); env.elements.get('ownerInstruction').value = text;
      const before = dc.sent.filter(x => x.type === 'conversation.item.create' && x.item.id).length;
      env.elements.get('sendInstruction').onclick(); await tick(); await tick();
      const notes = dc.sent.filter(x => x.type === 'conversation.item.create' && x.item.id);
      if (length < 6000 || length > 20000) {
        assert.equal(notes.length, before); assert.equal(env.elements.get('ownerInstruction').value, text);
        assert.match(env.elements.get('instructionStatus').textContent, /6,000–20,000/);
      } else {
        assert.equal(notes.length, before + 1); assert.ok(notes.at(-1).item.content[0].text.endsWith(text));
        dc.message({ type: 'conversation.item.added', item: { id: notes.at(-1).item.id } }); await tick();
      }
    }
  } finally { await env.cleanup(); }
});
test('automatic human classification stays silent until acknowledged media gates; transcripts save before natural end', async () => {
  const env = environment({ voicemail: true }), saved = [];
  try {
    env.api.configure({ automatic: true, campaignId: sessionId, contactId: sessionId, workerId: sessionId, saveTurn: async turn => saved.push(turn) });
    await env.start(); await env.media(); const dc = env.peers[0].channel;
    const request = env.requests.find(r => r.url === '/session'); assert.equal(request.options.headers['X-Audio-Mode'], 'campaign-call');
    dc.message(listenAck); await tick();
    dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'hello', transcript: 'Hello, how can I help?' }); await tick();
    const classification = dc.sent.find(r => r.response?.metadata?.purpose === 'answer_classification'); assert.ok(classification); assert.equal(classification.response.conversation, 'none');
    dc.message({ type: 'response.created', response: { id: 'class1', metadata: classification.response.metadata } });
    dc.message({ type: 'response.output_text.done', response_id: 'class1', text: 'human' });
    dc.message({ type: 'response.done', response: { id: 'class1', status: 'completed' } });
    await new Promise(r => setTimeout(r, 1050)); await tick();
    assert.equal(env.api.status().phase, 'starting'); assert.equal(env.contexts[0].sources.length, 0); assert.equal(env.peers[0].input.enabled, true); // screening input stays enabled; output remains gated
    assert.equal(dc.sent.filter(r => r.type === 'response.create' && !r.response.metadata).length, 0);
    await env.links[0].options.onMessage({ type: 'gate-state', open: true }); dc.message(vadAck); await tick(); await tick();
    assert.equal(env.api.status().phase, 'talking');
    const introduction = dc.sent.find(r => r.type === 'conversation.item.create' && !r.item.id);
    assert.match(introduction.item.content[0].text, /approved background/);
    assert.doesNotMatch(introduction.item.content[0].text, /Jay Marketing Lab|Cena/);
    dc.message({ type: 'response.output_audio_transcript.done', item_id: 'reply', transcript: 'You can contact Cena if you would like to talk more. Goodbye.' }); await tick();
    dc.message({ type: 'response.created', response: { id: 'closing' } });
    dc.message({ type: 'output_audio_buffer.started' });
    dc.message({ type: 'response.function_call_arguments.done', name: 'finish_call', arguments: '{"reason":"completed"}' });
    dc.message({ type: 'response.done', response: { id: 'closing', status: 'completed' } }); await tick();
    assert.equal(env.api.status().phase, 'talking');
    dc.message({ type: 'output_audio_buffer.stopped' }); await new Promise(r => setTimeout(r, 2050)); await tick();
    assert.equal(env.api.status().phase, 'stopped'); assert.equal(env.api.status().conversationOutcome, 'completed');
    assert.deepEqual(saved.map(t => t.speaker), ['customer', 'assistant']); assert.equal(saved[0].text, 'Hello, how can I help?');
    assert.doesNotMatch(env.elements.get('evidence').textContent, /Hello, who is calling/);
  } finally { await env.cleanup(); }
});
test('hello can you hear me starts the gated human path without waiting for a classifier result', async () => {
  const env = environment({ voicemail: true });
  try {
    env.api.configure({ automatic: true }); await env.start(); await env.media(); const dc = env.peers[0].channel; dc.message(listenAck); await tick();
    dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'person', transcript: 'Hello, can you hear me?' }); await tick(); await tick();
    assert.equal(env.api.status().phase, 'starting');
    assert.equal(dc.sent.filter(m => m.response?.metadata?.purpose === 'answer_classification').length, 0);
    await env.links[0].options.onMessage({ type: 'gate-state', open: true }); dc.message(vadAck); await tick(); await tick();
    assert.equal(env.api.status().phase, 'talking'); assert.ok(env.api.status().events.some(e => e.event === 'answer.explicit_human_detected'));
  } finally { await env.cleanup(); }
});
test('a bare human hello uses a short bounded fallback when classification is delayed', async () => {
  const env = environment({ voicemail: true });
  try {
    env.api.configure({ automatic: true }); await env.start(); await env.media(); const dc = env.peers[0].channel; dc.message(listenAck); await tick();
    dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'hello', transcript: 'Hello.' }); await tick();
    assert.equal(env.api.status().humanAnswered, undefined); await env.fireTimers(750);
    assert.equal(env.api.status().phase, 'starting'); assert.equal(env.api.status().humanAnswered, true);
    assert.ok(env.api.status().events.some(e => e.event === 'answer.short_greeting_detected'));
  } finally { await env.cleanup(); }
});
test('recorded mailbox instructions never use the short human-greeting fallback', async () => {
  const env = environment({ voicemail: true });
  try {
    env.api.configure({ automatic: true }); await env.start(); await env.media(); const dc = env.peers[0].channel; dc.message(listenAck); await tick();
    dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'mailbox', transcript: 'Can you hear me? Leave a message after the beep.' });
    await env.fireTimers(750); assert.equal(env.api.status().humanAnswered, undefined); assert.equal(env.api.status().phase, 'voicemail-waiting');
  } finally { await env.cleanup(); }
});
test('a segmented recorded greeting cancels the bare-hello fallback even if the classifier initially says human', async () => {
  const env = environment({ voicemail: true });
  try {
    env.api.configure({ automatic: true }); await env.start(); await env.media(); const dc = env.peers[0].channel; dc.message(listenAck); await tick();
    dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'hello', transcript: 'Hello.' }); await tick();
    const request = dc.sent.filter(m => m.response?.metadata?.purpose === 'answer_classification').at(-1);
    dc.message({ type: 'response.done', response: { id: 'short-human', status: 'completed', metadata: request.response.metadata, output: [{ content: [{ type: 'output_text', text: 'human' }] }] } });
    dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'continued' });
    dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'continued' });
    dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'continued', transcript: 'You have reached the automated voice messaging system.' });
    await env.fireTimers(750); assert.equal(env.api.status().humanAnswered, undefined); assert.equal(env.api.status().phase, 'voicemail-waiting');
  } finally { await env.cleanup(); }
});
test('classification can be read from response.done alone and confirmed human evidence survives another speech segment', async () => {
  const env = environment({ voicemail: true });
  try {
    env.api.configure({ automatic: true }); await env.start(); await env.media(); const dc = env.peers[0].channel; dc.message(listenAck); await tick();
    dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'person' });
    dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'person', transcript: 'Hello, how can I help?' });
    const request = dc.sent.filter(m => m.response?.metadata?.purpose === 'answer_classification').at(-1);
    dc.message({ type: 'response.done', response: { id: 'classification', status: 'completed', metadata: request.response.metadata, output: [{ type: 'message', content: [{ type: 'output_text', text: 'human' }] }] } });
    dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'repeat' }); await tick();
    assert.equal(env.api.status().phase, 'screening');
    dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'repeat' }); await tick(); await tick();
    assert.equal(env.api.status().phase, 'starting'); assert.equal(env.api.status().aiTurns, 0);
    assert.ok(env.api.status().events.some(e => e.event === 'answer.classified_human'));
  } finally { await env.cleanup(); }
});
test('failed transcript persistence stops automatic conversation with a failure result', async () => {
  const env = environment();
  try {
    env.api.configure({ automatic: true, saveTurn: async () => { throw new Error('Synthetic storage failure'); } });
    await env.start(); await env.media(); await env.confirm(); env.peers[0].channel.message(vadAck); await tick(); await tick();
    env.peers[0].channel.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'turn', transcript: 'Synthetic private conversation.' });
    await tick(); await tick(); await tick(); assert.equal(env.api.status().phase, 'failed');
    assert.doesNotMatch(env.elements.get('evidence').textContent, /Synthetic private conversation/);
  } finally { await env.cleanup(); }
});
test('customer transcription failure cannot silently complete a calling-list conversation', async () => {
  const env = environment();
  try {
    env.api.configure({ automatic: true }); await env.start(); await env.media(); await env.confirm(); env.peers[0].channel.message(vadAck); await tick(); await tick();
    env.peers[0].channel.message({ type: 'conversation.item.input_audio_transcription.failed', item_id: 'unrecognized' });
    await tick(); await tick(); assert.equal(env.api.status().phase, 'failed');
  } finally { await env.cleanup(); }
});
async function beep(env) {
  const values = Float32Array.from({ length: 2048 }, (_, i) => 0.2 * Math.sin(2 * Math.PI * 1000 * i / 48000));
  env.setTime(100); env.detectors[0].samples(values, 48000); env.setTime(400); env.detectors[0].samples(values, 48000);
  env.setTime(550); env.detectors[0].samples(new Float32Array(2048), 48000); await tick(); await tick();
}
const screeningText = 'Hi, this is Alex, an AI assistant calling for Example Office about an appointment.';
async function screenedCall(introduction = screeningText) {
  const env = environment({ voicemail: true }), turns = [];
  env.api.configure({ automatic: true, screeningIntroduction: introduction, saveTurn: async turn => turns.push(turn) });
  await tick(); await env.api.prepare(); await env.media();
  const dc = env.peers[0].channel; dc.message(listenAck); await tick();
  return Object.assign(env, { dc, turns, async say(text, id = 'screen') {
    dc.message({ type: 'input_audio_buffer.speech_started', item_id: id });
    dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: id });
    dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: id, transcript: text }); await tick();
  }, async introduction() {
    await this.say("Please leave your name and reason for calling. I'll see if this person is available.");
    await this.fireTimers(600); await this.links[0].options.onMessage({ type: 'gate-state', open: true }); await tick(); await tick();
    return this.contexts[0].sources[0];
  } });
}
test('screening introduction plays once through the verified gate and waits for a human', async () => {
  const env = await screenedCall();
  try {
    const intro = await env.introduction(); assert.equal(intro.started, true);
    assert.equal(env.api.status().phase, 'call-screening-speaking');
    assert.equal(env.api.status().voicemailOutcome, 'not_started');
    intro.onended(); await tick(); env.dc.message(listenAck); await tick();
    assert.equal(env.api.status().phase, 'call-screening-waiting');
    await env.say('Thank you. Please hold while I check if they are available.', 'hold');
    await env.say('Please state your name and reason for calling.', 'repeat'); await env.fireTimers(600);
    assert.equal(env.contexts[0].sources.length, 1);
    await env.say('Hello, can you hear me?', 'person');
    assert.equal(env.api.status().phase, 'starting');
    await env.links[0].options.onMessage({ type: 'gate-state', open: true }); env.dc.message(vadAck); await tick(); await tick();
    assert.equal(env.api.status().phase, 'talking');
    assert.ok(env.turns.some(t => t.speaker === 'assistant' && t.text.includes(screeningText)));
    assert.ok(env.turns.some(t => t.item === 'person' && t.text.includes('hear me')));
  } finally { await env.cleanup(); }
});
test('screening can progress to a fresh mailbox greeting and play the full voicemail', async () => {
  const env = await screenedCall();
  try {
    const intro = await env.introduction(); intro.onended(); await tick(); env.dc.message(listenAck); await tick();
    await env.say('Please leave your message at the tone.', 'mailbox');
    assert.equal(env.api.status().phase, 'voicemail-waiting');
    await beep({ ...env, detectors: [env.detectors.at(-1)] });
    await env.links[0].options.onMessage({ type: 'gate-state', open: true }); await tick(); await tick();
    assert.equal(env.contexts[0].sources.length, 2); assert.equal(env.contexts[0].sources[1].started, true);
    assert.equal(env.api.status().phase, 'voicemail-playing');
    assert.ok(env.turns.some(t => t.item === 'mailbox'));
  } finally { await env.cleanup(); }
});
test('a human interrupting the screening introduction stops it and enters live conversation', async () => {
  const env = await screenedCall();
  try {
    const intro = await env.introduction(); await env.say('Hello, can you hear me?', 'interrupt');
    assert.equal(intro.stopped, true); assert.equal(env.api.status().phase, 'starting');
    assert.equal(env.api.status().humanAnswered, true);
  } finally { await env.cleanup(); }
});
test('screening without an introduction pauses with an explicit saved reason', async () => {
  const env = await screenedCall('');
  try {
    await env.say('Please say your name and reason for calling.'); await env.fireTimers(600);
    assert.equal(env.api.status().phase, 'paused'); assert.match(env.api.status().reviewReason, /no call-screening introduction/);
    assert.equal(env.contexts[0].sources.length, 0);
    const event = env.requests.filter(r => r.url === '/live-log').map(r => JSON.parse(r.options.body)).find(e => e.event === 'call_screening.missing_introduction');
    assert.match(event.detail, /no call-screening introduction/);
  } finally { await env.cleanup(); }
});
test('screening waits again if speech resumes before gate acknowledgement and bounds both waits', async () => {
  for (const gate of [false, true]) {
    const env = await screenedCall();
    try {
      await env.say('Please state your name and reason for calling.');
      await env.fireTimers(600);
      if (!gate) {
        env.dc.message({ type: 'input_audio_buffer.speech_started' });
        await env.links[0].options.onMessage({ type: 'gate-state', open: true }); await tick();
        assert.equal(env.contexts[0].sources.length, 0); assert.equal(env.api.status().phase, 'call-screening-prompt');
        await env.fireTimers(20000); assert.match(env.api.status().stopReason, /did not become quiet within 20 seconds/);
      } else { await env.fireTimers(6000); assert.match(env.api.status().stopReason, /acknowledgement timed out after 6 seconds/); }
      assert.equal(env.api.status().phase, 'failed');
    } finally { await env.cleanup(); }
  }
});
test('API failures preserve the exact safe reason, code and stage in the final report and journal', async () => {
  const env = environment();
  try {
    await env.start();
    env.peers[0].channel.message({ type: 'response.done', response: { status: 'failed', status_details: { error: { code: 'insufficient_quota', message: 'Project quota exhausted. sk-syntheticSecret' } } } });
    await tick(); await tick(); await tick();
    assert.equal(env.api.status().failure.stage, 'ai_response');
    assert.match(env.api.status().stopReason, /insufficient_quota.*Project quota exhausted/);
    assert.doesNotMatch(JSON.stringify(env.api.status()), /sk-syntheticSecret/);
    const body = env.requests.filter(r => r.url === '/live-log').map(r => JSON.parse(r.options.body)).find(e => e.event === 'session.stopped');
    assert.match(body.detail, /Project quota exhausted/);
  } finally { await env.cleanup(); }
});
async function automaticMailbox(greeting = 'Please leave a message after the beep.') {
  const env = environment({ voicemail: true }), turns = [];
  env.api.configure({ automatic: true, saveTurn: async turn => turns.push(turn) });
  await env.start(); await env.media(); const dc = env.peers[0].channel;
  dc.message(listenAck); await tick();
  dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'recorded-greeting' });
  dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'recorded-greeting' });
  dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'recorded-greeting', transcript: greeting }); await tick();
  return Object.assign(env, { dc, turns, async play() {
    await beep(env); await env.links[0].options.onMessage({ type: 'gate-state', open: true }); await tick(); await tick();
    return env.contexts[0].sources[0];
  }, classify(word, id = 'classifier') {
    const request = dc.sent.filter(e => e.response?.metadata?.purpose === 'answer_classification').at(-1);
    dc.message({ type: 'response.created', response: { id, metadata: request.response.metadata } });
    dc.message({ type: 'response.output_text.done', response_id: id, text: word });
    dc.message({ type: 'response.done', response: { id, status: 'completed' } });
  }, async liveGate() { await env.links[0].options.onMessage({ type: 'gate-state', open: true }); dc.message(vadAck); await tick(); await tick(); } });
}

test('a clear voicemail invitation with a missed beep plays once after fresh silence without waiting for classifier output', async () => {
  const env = await automaticMailbox();
  try {
    const quiet = new Float32Array(2048);
    env.setTime(100); env.detectors[0].samples(quiet, 48000);
    env.setTime(2700); env.detectors[0].samples(quiet, 48000); await tick(); await tick();
    assert.equal(env.api.status().phase, 'voicemail-playing');
    await env.links[0].options.onMessage({ type: 'gate-state', open: true }); await tick(); await tick();
    const source = env.contexts[0].sources[0]; assert.equal(source.started, true);
    assert.equal(env.api.status().voicemailOutcome, 'playing');
    const events = env.requests.filter(r => r.url === '/live-log').map(r => JSON.parse(r.options.body).event);
    assert.ok(events.includes('voicemail.silence_fallback')); assert.ok(!events.includes('voicemail.beep_detected'));
    assert.equal(events.filter(e => e === 'voicemail.playback_started').length, 1);
    source.onended(); await env.fireTimers(1000);
    assert.equal(env.api.status().voicemailOutcome, 'playback_completed');
    assert.equal(env.api.status().phase, 'voicemail-complete');
  } finally { await env.cleanup(); }
});

test('voicemail beep-tail speech cannot cancel playback while its gate is opening', async () => {
  const env = await automaticMailbox();
  try {
    await beep(env); assert.equal(env.api.status().phase, 'voicemail-playing');
    env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'beep-tail' });
    env.dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'beep-tail' });
    env.dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'beep-tail', transcript: 'Tone.' });
    await tick(); await tick(); assert.equal(env.api.status().phase, 'voicemail-playing');
    await env.links[0].options.onMessage({ type: 'gate-state', open: true }); await tick(); await tick();
    assert.equal(env.contexts[0].sources[0].started, true); assert.equal(env.api.status().voicemailOutcome, 'playing');
    assert.ok(env.api.status().events.some(e => e.event === 'voicemail.transition_audio_ignored'));
  } finally { await env.cleanup(); }
});

test('an unavailable classifier label cannot hang up a normal leave-message invitation', async () => {
  const env = await automaticMailbox('Please leave your message at the tone.');
  try {
    env.classify('unavailable'); await tick();
    assert.equal(env.api.status().phase, 'voicemail-waiting');
    assert.notEqual(env.api.status().voicemailOutcome, 'mailbox_unavailable');
    env.setTime(100); env.detectors[0].samples(new Float32Array(2048), 48000);
    env.setTime(2800); env.detectors[0].samples(new Float32Array(2048), 48000); await tick(); await tick();
    await env.links[0].options.onMessage({ type: 'gate-state', open: true }); await tick(); await tick();
    assert.equal(env.contexts[0].sources[0].started, true);
    assert.equal(env.api.status().voicemailOutcome, 'playing');
  } finally { await env.cleanup(); }
});

test('human speech during the missed-beep quiet window prevents voicemail and starts live conversation', async () => {
  const env = await automaticMailbox();
  try {
    env.classify('voicemail'); await tick();
    env.setTime(100); env.detectors[0].samples(new Float32Array(2048), 48000);
    env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'human' });
    env.setTime(3000); env.detectors[0].samples(new Float32Array(2048), 48000); await tick();
    assert.equal(env.contexts[0].sources.length, 0);
    env.dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'human' });
    env.dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'human', transcript: 'Hello, can you hear me?' });
    await tick(); await tick(); await env.liveGate();
    assert.equal(env.api.status().phase, 'talking'); assert.equal(env.contexts[0].sources.length, 0);
  } finally { await env.cleanup(); }
});

test('ambiguous new speech invalidates an older voicemail silence-fallback approval', async () => {
  const env = await automaticMailbox();
  try {
    env.classify('voicemail'); await tick();
    env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'ambiguous' });
    env.dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'ambiguous' });
    env.dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'ambiguous', transcript: 'Hmm.' });
    env.classify('unknown', 'unknown-classifier'); await tick();
    env.setTime(100); env.detectors[0].samples(new Float32Array(2048), 48000);
    env.setTime(4000); env.detectors[0].samples(new Float32Array(2048), 48000); await tick();
    assert.equal(env.contexts[0].sources.length, 0); assert.equal(env.api.status().phase, 'voicemail-waiting');
  } finally { await env.cleanup(); }
});

test('repeated speech preserves the pending human decision and takeover starts at speech stop without a polling delay', async () => {
  const env = await automaticMailbox();
  try {
    const source = await env.play();
    env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'person' });
    env.dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'person' });
    env.dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'person', transcript: 'Hello, I just answered.' });
    env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'repeat' });
    env.classify('human'); await tick();
    assert.equal(source.stopped, true); assert.equal(env.api.status().phase, 'voicemail-complete');
    env.dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'repeat' }); await tick(); await tick();
    assert.equal(env.api.status().phase, 'starting');
    assert.equal(env.dc.sent.filter(m => m.type === 'response.create' && !m.response.metadata).length, 0);
    await env.liveGate(); assert.equal(env.api.status().phase, 'talking');
    const vad = env.dc.sent.filter(m => m.type === 'session.update').at(-1).session.audio.input.turn_detection;
    assert.equal(vad.silence_duration_ms, 250); assert.equal(vad.interrupt_response, true); assert.equal(vad.create_response, true);
  } finally { await env.cleanup(); }
});

test('a newer utterance supersedes a pending classification without treating speech activity alone as human', async () => {
  const env = await automaticMailbox();
  try {
    await env.play();
    env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'first' });
    env.dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'first' });
    env.dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'first', transcript: 'Unclear words.' });
    const old = env.dc.sent.filter(m => m.response?.metadata?.purpose === 'answer_classification').at(-1);
    env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'next' });
    env.dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'next' });
    env.dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'next', transcript: 'More unclear words.' });
    env.dc.message({ type: 'response.done', response: { id: 'old-human', status: 'completed', metadata: old.response.metadata, output: [{ content: [{ type: 'output_text', text: 'human' }] }] } });
    await tick(); assert.equal(env.api.status().humanAnswered, undefined);
    env.classify('unknown'); await tick(); assert.equal(env.api.status().phase, 'voicemail-complete');
    assert.equal(env.api.status().aiTurns, 0);
  } finally { await env.cleanup(); }
});
test('a human can supersede a recognized voicemail greeting before the beep', async () => {
  const env = await automaticMailbox();
  try {
    assert.equal(env.api.status().phase, 'voicemail-waiting');
    env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'person' });
    env.dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'person' });
    env.dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'person', transcript: 'Hello? I just picked up. Who is this?' });
    env.classify('human'); await env.fireTimers(1000); await env.liveGate();
    assert.equal(env.api.status().phase, 'talking'); assert.equal(env.contexts[0].sources.length, 0);
    assert.equal(env.turns.length, 2); assert.match(env.turns.find(t => t.item === 'person').text, /picked up/);
    assert.match(env.turns.find(t => t.item === 'recorded-greeting').text, /leave a message/);
  } finally { await env.cleanup(); }
});
test('speech during automatic voicemail stops playback, waits for human confirmation and keeps the same call alive', async () => {
  const env = await automaticMailbox();
  try {
    const source = await env.play(), lateEnd = source.onended;
    assert.equal(env.peers[0].input.enabled, true);
    assert.equal(env.dc.sent.filter(m => m.type === 'session.update').at(-1).session.audio.input.turn_detection.create_response, false);
    env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'person' }); await tick();
    assert.equal(source.stopped, true); assert.equal(env.api.status().phase, 'voicemail-complete');
    lateEnd(); await env.fireTimers(1000); await env.fireTimers(8000);
    assert.equal(env.peers[0].connectionState, 'connected'); assert.equal(env.api.status().voicemailOutcome, 'incomplete');
    env.dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'person', transcript: 'Hello, I am here. Can we talk?' }); env.classify('human');
    await env.fireTimers(1000); assert.equal(env.api.status().phase, 'voicemail-complete'); // never speak over a continuing utterance
    env.dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'person' }); await env.fireTimers(1000); await env.liveGate();
    assert.equal(env.api.status().phase, 'talking'); assert.equal(env.api.status().voicemailOutcome, 'human_takeover');
    await env.fireTimers(30000); assert.equal(env.api.status().phase, 'talking'); assert.equal(env.peers[0].connectionState, 'connected');
    assert.match(env.turns.find(t => t.item === 'person').text, /Can we talk/);
    assert.ok(env.api.status().events.some(e => e.event === 'voicemail.human_takeover'));
    assert.equal(env.api.status().events.some(e => e.event === 'voicemail.playback_completed'), false);
  } finally { await env.cleanup(); }
});
test('automatic voicemail completion waits through a quiet pickup window, then stops once', async () => {
  const env = await automaticMailbox();
  try {
    const source = await env.play(); source.onended(); await env.fireTimers(1000);
    assert.equal(env.api.status().phase, 'voicemail-complete'); assert.equal(env.peers[0].input.enabled, true);
    assert.equal(env.peers[0].connectionState, 'connected'); await env.fireTimers(8000);
    assert.equal(env.api.status().phase, 'stopped'); assert.equal(env.api.status().voicemailOutcome, 'playback_completed');
    assert.equal(env.api.status().events.filter(e => e.event === 'session.stopped').length, 1);
  } finally { await env.cleanup(); }
});
test('post-message speech cancels hangup even when transcription arrives after the quiet window', async () => {
  const env = await automaticMailbox();
  try {
    const source = await env.play(); source.onended(); await env.fireTimers(1000);
    env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'late-person' });
    env.dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'late-person' }); await env.fireTimers(8000);
    assert.equal(env.peers[0].connectionState, 'connected'); assert.equal(env.api.status().phase, 'voicemail-complete');
    env.dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'late-person', transcript: 'Wait, I answered. Who is calling?' }); env.classify('human');
    await env.fireTimers(1000); await env.liveGate(); assert.equal(env.api.status().phase, 'talking'); assert.equal(env.api.status().voicemailOutcome, 'human_takeover');
  } finally { await env.cleanup(); }
});
test('disconnect while checking a late pickup cannot preserve a successful voicemail outcome', async () => {
  const env = await automaticMailbox();
  try {
    const source = await env.play(); source.onended(); await env.fireTimers(1000);
    env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'late-person' });
    await env.links[0].options.onMessage({ type: 'dialer-media-ended' }); await tick(); await tick();
    assert.equal(env.api.status().phase, 'stopped'); assert.equal(env.api.status().takeoverPending, true);
    assert.equal(env.api.status().voicemailOutcome, 'needs_review');
  } finally { await env.cleanup(); }
});
test('unconfirmed voicemail interruption requires review instead of being reported as a successful voicemail', async () => {
  const env = await automaticMailbox();
  try {
    await env.play(); env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'noise' }); env.dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'noise' });
    env.dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'noise', transcript: 'Unclear speech.' }); env.classify('unknown'); await env.fireTimers(8000);
    assert.equal(env.peers[0].connectionState, 'connected'); await env.fireTimers(30000);
    assert.equal(env.api.status().phase, 'paused'); assert.equal(env.api.status().voicemailOutcome, 'needs_review');
    assert.match(env.api.status().reviewReason, /Speech after voicemail could not be confirmed/);
    assert.equal(env.api.status().events.some(e => e.event === 'voicemail.playback_completed'), false);
  } finally { await env.cleanup(); }
});
test('delayed pre-message greeting and stale classification cannot interrupt playback or start a false human conversation', async () => {
  const env = await automaticMailbox();
  try {
    const old = env.dc.sent.filter(m => m.response?.metadata?.purpose === 'answer_classification').at(-1);
    env.dc.message({ type: 'input_audio_buffer.speech_started', item_id: 'late-carrier' }); env.dc.message({ type: 'input_audio_buffer.speech_stopped', item_id: 'late-carrier' });
    const source = await env.play();
    env.dc.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'late-carrier', transcript: 'Please leave a message after the tone.' });
    env.dc.message({ type: 'response.created', response: { id: 'old', metadata: old.response.metadata } }); env.dc.message({ type: 'response.output_text.done', response_id: 'old', text: 'human' }); await env.fireTimers(1000);
    assert.equal(env.api.status().phase, 'voicemail-playing'); assert.equal(source.stopped, undefined); assert.equal(env.api.status().humanAnswered, undefined);
  } finally { await env.cleanup(); }
});
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
    const introduction = pc.channel.sent.find(item => item.type === 'conversation.item.create').item.content[0].text;
    assert.equal(pc.channel.sent.find(item => item.type === 'response.create').response.instructions, undefined);
    assert.match(introduction, /Jay Marketing Lab on behalf of Cena/);
    assert.doesNotMatch(introduction, /Can you hear me clearly/);
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
    assert.equal(session.audio.input.turn_detection, null); assert.match(session.instructions, /AI assistant calling from Jay Marketing Lab on behalf of Cena/);
    assert.equal(session.audio.output.speed, 1.1); assert.match(session.instructions, /one concise sentence/);
    assert.match(session.instructions, /do not invent a reason for the call/i);
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
    for (const [sequence, event] of ['session.started', 'voicemail.listening', 'voicemail.greeting_detected', 'voicemail.beep_detected', 'voicemail.transition_audio_ignored', 'voicemail.playback_started', 'voicemail.playback_completed', 'voicemail.human_takeover', 'voicemail.takeover_unconfirmed', 'answer.transcript_received', 'answer.explicit_human_detected', 'answer.short_greeting_detected', 'answer.classification_requested', 'answer.classification_timeout', 'answer.classified_human', 'answer.classified_voicemail', 'answer.classified_unavailable', 'answer.classified_unknown'].entries()) {
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
