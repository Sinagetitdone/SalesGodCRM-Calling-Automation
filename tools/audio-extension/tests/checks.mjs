import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { MessageChannel } from 'node:worker_threads';
const source = await readFile(new URL('../audio-hook.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
const panelSource = await readFile(new URL('../panel.js', import.meta.url), 'utf8');

test('panel accepts the installed manifest version and enables supervised controls only when armed', () => {
  const nodes = new Map(); const listeners = new Map();
  const node = () => ({ disabled: false, textContent: '', before() {}, after() {}, prepend() {} });
  const get = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const root = { innerHTML: '', querySelector: get, getElementById: get };
  const document = { getElementById() { return null; }, documentElement: { append() {} },
    createElement() { return { ...node(), set id(value) { nodes.set(value, this); }, style: {}, attachShadow() { return root; } }; } };
  const window = { postMessage() {}, addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); } };
  vm.runInNewContext(panelSource, { document, window, location: { origin: 'https://www.salesgodcrm.net' }, crypto: { randomUUID: () => 'test-id' } });
  const report = { version: manifest.version, armed: false, testing: false, voiceState: 'disconnected' };
  const publish = () => listeners.get('message').forEach(fn => fn({ source: window, origin: 'https://www.salesgodcrm.net',
    data: { source: 'salesgod-local-audio-v1', type: 'result', status: report } }));
  publish(); assert.equal(get('state').textContent, 'Local routing disabled · OpenAI disconnected');
  assert.equal(get('callVoice').disabled, true);
  report.armed = true; publish();
  assert.equal(get('callVoice').disabled, false); assert.equal(get('voice').disabled, false);
  assert.equal(get('callVoice').textContent, 'AI Agents Test Call'); assert.equal(get('callingList').textContent, 'Open calling list');
});
function environment() {
  const listeners = new Map(); const messages = []; const originals = { requests: 0 };
  class Track extends EventTarget {
    kind = 'audio'; readyState = 'live';
    clone() { return new Track(); }
    stop() { this.readyState = 'ended'; }
    getSettings() { return { sampleRate: 48000 }; }
  }
  class Stream {
    constructor(tracks = [new Track()]) { this.tracks = tracks; }
    getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
    getTracks() { return this.tracks; }
  }
  class Context {
    createMediaStreamDestination() { return { stream: new Stream() }; }
    createGain() { return { gain: { value: 1 }, connect() { return this; }, disconnect() {} }; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    async resume() {} async close() {}
  }
  class Peer extends EventTarget {
    connectionState = 'new'; senders = [];
    getSenders() { return this.senders; } addTrack(track) { this.senders.push({ track }); }
    close() { this.connectionState = 'closed'; this.dispatchEvent(new Event('connectionstatechange')); }
  }
  const mediaDevices = {
    async enumerateDevices() { return [{ deviceId: 'physical', kind: 'audioinput', label: 'Physical microphone' }]; },
    async getUserMedia() { originals.requests++; return new Stream(); },
  };
  const window = { RTCPeerConnection: Peer, AudioContext: Context,
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
    postMessage(message) { messages.push(message); },
  };
  const sandbox = vm.createContext({ window, navigator: { mediaDevices }, MediaStream: Stream, DOMException,
    Symbol, Set, Proxy, Reflect, Date, Object, Array, JSON, Math, Promise, Float32Array,
    location: { origin: 'https://www.salesgodcrm.net' }, setTimeout, clearTimeout, setInterval, clearInterval, MessageChannel, performance });
  vm.runInContext(source, sandbox);
  async function command(name, overrides = {}) {
    for (const fn of listeners.get('message') ?? []) await fn({ source: window, origin: 'https://www.salesgodcrm.net', data: { source: 'salesgod-local-audio-v1', type: 'command', command: name }, ...overrides });
    return messages.at(-1)?.status;
  }
  async function message(event) { for (const fn of listeners.get('message') ?? []) await fn(event); }
  return { mediaDevices, originals, command, messages, window, sandbox, message, Stream, Track };
}
test('manifest is limited to SalesGodCRM and the local test page, with no broad permissions', () => {
  assert.equal(manifest.permissions, undefined); assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background, undefined);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.salesgodcrm.net/*', 'https://salesgodcrm.net/*', 'http://127.0.0.1:28431/extension-lab*']);
  assert.equal(manifest.content_scripts[0].world, 'MAIN'); assert.equal(manifest.content_scripts[0].run_at, 'document_start');
});
test('starts disabled, disconnected, with no dialing capability', async () => {
  const env = environment(); const status = await env.command('status');
  assert.equal(status.armed, false); assert.equal(status.openAIConnected, false); assert.equal(status.dialingEnabled, false);
  assert.equal(env.originals.requests, 0);
});
test('enumerates generated input without discarding physical devices', async () => {
  const env = environment(); const devices = await env.mediaDevices.enumerateDevices();
  assert.equal(devices[0].deviceId, 'physical'); assert.equal(devices[1].kind, 'audioinput');
  assert.equal(devices[1].deviceId, 'salesgod-ai-bridge-local-v1');
});
test('only intercepts explicitly selected generated microphone; physical input passes through', async () => {
  const env = environment();
  await env.mediaDevices.getUserMedia({ audio: true }); assert.equal(env.originals.requests, 1);
  await assert.rejects(env.mediaDevices.getUserMedia({ audio: { deviceId: { exact: 'salesgod-ai-bridge-local-v1' } } }), /Enable/);
  assert.equal(env.originals.requests, 1);
});
test('armed generated microphone never opens physical microphone and disarm stops tracks', async () => {
  const env = environment(); await env.command('arm');
  const stream = await env.mediaDevices.getUserMedia({ audio: { deviceId: { exact: 'salesgod-ai-bridge-local-v1' } } });
  assert.equal(stream.getAudioTracks()[0].readyState, 'live');
  assert.equal(stream.getAudioTracks()[0].getSettings().deviceId, 'salesgod-ai-bridge-local-v1');
  assert.equal(env.originals.requests, 0);
  assert.equal((await env.command('status')).dialerRequests, 1);
  await env.command('disarm'); assert.equal(stream.getAudioTracks()[0].readyState, 'ended');
});
test('ignores messages from another origin or another window', async () => {
  const env = environment();
  await env.command('arm', { origin: 'https://other.example' });
  await env.command('arm', { source: {} });
  assert.equal((await env.command('status')).armed, false);
});
test('duplicate execution does not wrap the media APIs again', () => {
  const env = environment(); const get = env.mediaDevices.getUserMedia;
  vm.runInContext(source, env.sandbox); assert.equal(env.mediaDevices.getUserMedia, get);
});

async function prepareVoice(env, mode = 'setup') {
  await env.command('arm');
  const token = '12345678-1234-1234-1234-123456789abc';
  await env.command('prepare-voice', { data: { source: 'salesgod-local-audio-v1', type: 'command', command: 'prepare-voice', token, mode } });
  env.window[Symbol.for('salesgod.window.rtc.v1')] = { connect() { throw new Error('A peer must not start merely by pairing'); } };
  const popup = { closed: false, postMessage(data, origin, ports) { this.pairing = { data, origin, ports }; } };
  const hello = { origin: 'http://127.0.0.1:28431', source: popup, data: { source: 'salesgod-voice-link-v1', type: 'hello', token } };
  return { popup, hello };
}
test('voice pairing requires the prepared nonce and exact loopback origin; pairing alone starts no audio peer', async () => {
  const env = environment(); const { popup, hello } = await prepareVoice(env);
  try {
    await env.message({ ...hello, origin: 'https://other.example' });
    await env.message({ ...hello, data: { ...hello.data, token: 'wrong-token' } });
    assert.equal(popup.pairing, undefined);
    await env.message(hello);
    assert.equal((await env.command('status')).voiceState, 'paired');
    assert.equal(popup.pairing.origin, 'http://127.0.0.1:28431');
    assert.equal(env.originals.requests, 0); assert.equal((await env.command('status')).observedPeers, 0);
  } finally { await env.command('disarm'); popup.pairing?.ports[0].close(); }
});

test('live bridge permits the next dialer peer but blocks physical microphone fallback, requires real generated sender and remote track, and closes on hangup', async () => {
  const env = environment(); const { popup, hello } = await prepareVoice(env, 'live');
  const sent = []; let callbacks;
  env.window[Symbol.for('salesgod.window.rtc.v1')] = { connect(_port, options) { callbacks = options; return { ready: Promise.resolve(), send(data) { sent.push(data); }, close() {} }; } };
  try {
    await env.message(hello); popup.pairing.ports[0].postMessage({ type: 'start', mode: 'live' });
    await new Promise(resolve => setTimeout(resolve, 20));
    for (const audio of [true, { echoCancellation: true }]) {
      const probe = await env.mediaDevices.getUserMedia({ audio });
      assert.equal(probe.getAudioTracks()[0].getSettings().deviceId, 'salesgod-ai-bridge-local-v1');
      probe.getTracks().forEach(track => track.stop());
    }
    assert.equal(env.originals.requests, 0);
    await assert.rejects(env.mediaDevices.getUserMedia({ audio: { deviceId: { exact: 'physical' } } }), /Select SalesGod AI Bridge/);
    await assert.rejects(env.mediaDevices.getUserMedia({ audio: true, video: true }), /audio-only/);
    const peer = new env.window.RTCPeerConnection();
    assert.equal((await env.command('status')).voiceState, 'audio-connected');
    await callbacks.onMessage({ type: 'live-gate', open: true }); assert.equal(sent.at(-1).open, false);
    const mic = await env.mediaDevices.getUserMedia({ audio: { deviceId: { exact: 'salesgod-ai-bridge-local-v1' } } }); peer.addTrack(mic.getAudioTracks()[0]);
    peer.connectionState = 'connected'; peer.dispatchEvent(new Event('connectionstatechange'));
    assert.notEqual((await env.command('status')).callMedia.state, 'ready');
    const event = new Event('track'); event.track = new env.Track(); event.streams = [new env.Stream([event.track])]; peer.dispatchEvent(event);
    assert.equal((await env.command('status')).callMedia.state, 'ready');
    await callbacks.onMessage({ type: 'live-gate', open: true }); assert.equal(sent.at(-1).open, true);
    peer.close(); assert.equal((await env.command('status')).voiceState, 'disconnected'); assert.equal(env.originals.requests, 0);
  } finally { await env.command('disarm'); popup.pairing?.ports[0].close(); }
});
test('a new dialer peer immediately cancels paired setup and never opens a physical microphone', async () => {
  const env = environment(); const { popup, hello } = await prepareVoice(env);
  try {
    await env.message(hello); assert.equal((await env.command('status')).voiceState, 'paired');
    new env.window.RTCPeerConnection();
    const report = await env.command('status');
    assert.equal(report.voiceState, 'disconnected'); assert.equal(report.observedPeers, 1); assert.equal(env.originals.requests, 0);
  } finally { await env.command('disarm'); popup.pairing?.ports[0].close(); }
});

test('generic microphone probes outside live pairing keep the original behavior', async () => {
  const env = environment(); const { popup, hello } = await prepareVoice(env);
  try {
    await env.message(hello);
    await env.mediaDevices.getUserMedia({ audio: true });
    assert.equal(env.originals.requests, 1);
  } finally { await env.command('disarm'); popup.pairing?.ports[0].close(); }
});
