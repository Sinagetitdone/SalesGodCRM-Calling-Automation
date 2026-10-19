import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../audio-hook.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
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
    async resume() {} async close() {}
  }
  class Peer extends EventTarget { connectionState = 'new'; }
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
    location: { origin: 'https://www.salesgodcrm.net' }, setTimeout, clearTimeout, performance });
  vm.runInContext(source, sandbox);
  async function command(name, overrides = {}) {
    for (const fn of listeners.get('message') ?? []) await fn({ source: window, origin: 'https://www.salesgodcrm.net', data: { source: 'salesgod-local-audio-v1', type: 'command', command: name }, ...overrides });
    return messages.at(-1)?.status;
  }
  return { mediaDevices, originals, command, messages, window, sandbox };
}
test('manifest is limited to SalesGodCRM and the local test page, with no broad permissions', () => {
  assert.equal(manifest.permissions, undefined); assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background, undefined);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.salesgodcrm.net/*', 'https://salesgodcrm.net/*', 'http://127.0.0.1:4318/extension-lab*']);
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
