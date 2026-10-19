import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('public/voice.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function environment({ sessionStatus = 200, stall = false } = {}) {
  const elements = new Map();
  for (const id of ['configuration', 'pairing', 'state', 'error', 'synthetic', 'routing', 'paired', 'stop', 'save', 'evidence']) elements.set(id, { textContent: '', disabled: false, hidden: false });
  const tracks = [], peers = [], contexts = [], requests = [], nodes = [];
  class Stream {
    constructor() { this.track = { kind: 'audio', stop() { this.stopped = true; } }; tracks.push(this.track); }
    getAudioTracks() { return [this.track]; } getTracks() { return [this.track]; }
  }
  class Node {
    constructor() { this.gain = { value: 0 }; nodes.push(this); }
    connect() { return this; } disconnect() { this.disconnected = true; }
    getFloatTimeDomainData(values) { values[0] = 0.12; }
  }
  class Context {
    constructor() { this.destination = new Node(); contexts.push(this); }
    createMediaStreamDestination() { const node = new Node(); node.stream = new Stream(); return node; }
    createMediaStreamSource() { return new Node(); } createGain() { return new Node(); } createAnalyser() { return new Node(); }
    async resume() {} async close() { this.closed = true; }
  }
  class Channel extends EventTarget {
    sent = []; send(value) { this.sent.push(JSON.parse(value)); } close() { this.closed = true; }
    message(message) { const event = new Event('message'); event.data = JSON.stringify(message); this.dispatchEvent(event); }
  }
  class Peer extends EventTarget {
    connectionState = 'new'; channel = new Channel();
    constructor() { super(); peers.push(this); }
    createDataChannel() { return this.channel; } addTrack() {}
    async createOffer() { return { type: 'offer', sdp: 'v=0\r\nsynthetic-offer' }; }
    async setLocalDescription(description) { this.localDescription = description; }
    async setRemoteDescription() { this.connectionState = 'connected'; this.channel.dispatchEvent(new Event('open')); }
    async getStats() { return new Map([['inbound', { kind: 'audio', type: 'inbound-rtp', packetsReceived: 10, totalAudioEnergy: 0.1 }]]); }
    close() { this.connectionState = 'closed'; }
    audio() { const event = new Event('track'); event.streams = [new Stream()]; this.dispatchEvent(event); }
  }
  const window = { addEventListener() {} };
  const timers = new Set();
  const sandbox = {
    window, document: { getElementById: id => elements.get(id) }, location: { origin: 'http://127.0.0.1:4318', hash: '' },
    URLSearchParams, URL, AudioContext: Context, RTCPeerConnection: Peer, MediaStream: Stream,
    Audio: class { async play() {} pause() {} }, Float32Array, AbortController, JSON, Date, Math, Number, Boolean,
    setTimeout: (fn, delay) => { const timer = setTimeout(fn, delay); timers.add(timer); return timer; }, clearTimeout,
    setInterval: (fn, delay) => { const timer = setInterval(fn, delay); timers.add(timer); return timer; }, clearInterval,
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url === '/status') return { json: async () => ({ keyConfigured: true, model: 'synthetic-model' }) };
      if (stall) return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('Aborted'))));
      return { ok: sessionStatus === 200, text: async () => 'v=0\r\nsynthetic-answer', json: async () => ({ error: 'OpenAI rejected the API key.' }) };
    },
  };
  vm.runInNewContext(source, sandbox);
  return { elements, peers, tracks, contexts, requests, cleanup() { for (const timer of timers) { clearTimeout(timer); clearInterval(timer); } } };
}
test('an authentication failure is visible and closes all generated media resources', async () => {
  const env = environment({ sessionStatus: 502 });
  try {
    await tick(); env.elements.get('synthetic').onclick(); await tick(); await tick();
    assert.match(env.elements.get('error').textContent, /rejected/); assert.equal(env.peers[0].connectionState, 'closed');
    assert.equal(env.contexts[0].closed, true); assert.ok(env.tracks.every(track => track.stopped));
    assert.equal(env.elements.get('stop').disabled, true);
    assert.equal(env.requests[1].url, '/session'); assert.equal(env.requests[1].options.headers.Authorization, undefined);
  } finally { env.cleanup(); }
});
test('a successful response requires actual received audio and drained playback before passing', async () => {
  const env = environment();
  try {
    await tick(); env.elements.get('synthetic').onclick(); await tick(); await tick();
    const pc = env.peers[0]; assert.equal(pc.channel.sent[0].type, 'response.create');
    pc.channel.message({ type: 'response.done', response: { status: 'completed' } }); await tick();
    assert.equal(pc.connectionState, 'connected');
    pc.audio(); pc.channel.message({ type: 'output_audio_buffer.stopped' });
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(pc.connectionState, 'closed'); assert.match(env.elements.get('state').textContent, /passed/);
    const report = JSON.parse(env.elements.get('evidence').textContent);
    assert.equal(report.passed, true); assert.equal(report.openAI.receivedPackets, 10); assert.equal(report.physicalMicrophoneUsed, false);
  } finally { env.cleanup(); }
});
test('disconnect aborts an outstanding request and closes the peer without retrying', async () => {
  const env = environment({ stall: true });
  try {
    await tick(); env.elements.get('synthetic').onclick(); await tick();
    env.elements.get('stop').onclick(); await tick(); await tick();
    assert.equal(env.requests.length, 2); assert.equal(env.requests[1].options.signal.aborted, true);
    assert.equal(env.peers[0].connectionState, 'closed'); assert.equal(env.contexts[0].closed, true);
  } finally { env.cleanup(); }
});
