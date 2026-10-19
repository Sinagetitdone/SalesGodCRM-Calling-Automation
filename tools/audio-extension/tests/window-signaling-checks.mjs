import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { MessageChannel } from 'node:worker_threads';
const source = await readFile(new URL('../window-rtc.js', import.meta.url), 'utf8');
const window = {};
vm.runInNewContext(source, { window, Symbol, Promise, Error, Object, setTimeout, clearTimeout });
const { connect } = window[Symbol.for('salesgod.window.rtc.v1')];
class Peer extends EventTarget {
  connectionState = 'new'; senders = []; candidates = [];
  async createOffer() { return { type: 'offer', sdp: 'synthetic-offer' }; }
  async createAnswer() { return { type: 'answer', sdp: 'synthetic-answer' }; }
  async setLocalDescription(description) {
    this.localDescription = { ...description, toJSON() { return { type: this.type, sdp: this.sdp }; } };
    const event = new Event('icecandidate'); event.candidate = { toJSON: () => ({ candidate: 'synthetic-local-candidate' }) }; this.dispatchEvent(event);
  }
  async setRemoteDescription(description) {
    this.remoteDescription = description;
    queueMicrotask(() => { this.connectionState = 'connected'; this.dispatchEvent(new Event('connectionstatechange')); });
  }
  async addIceCandidate(candidate) { assert.ok(this.remoteDescription); this.candidates.push(candidate); }
  addTrack(track) { this.senders.push(track); }
  close() { this.connectionState = 'closed'; this.dispatchEvent(new Event('connectionstatechange')); }
}
test('paired ports negotiate both peers and queue early ICE until remote SDP exists', async () => {
  const ports = new MessageChannel(), a = new Peer(), b = new Peer();
  const stream = { getAudioTracks: () => [{ kind: 'audio' }] };
  const first = connect(ports.port1, { pc: a, stream, offerer: true, onTrack() {} });
  const second = connect(ports.port2, { pc: b, stream, offerer: false, onTrack() {} });
  try {
    await Promise.all([first.ready, second.ready]);
    // The answerer announces connectivity before its answer has finished the signaling queue.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(a.remoteDescription.type, 'answer'); assert.equal(b.remoteDescription.type, 'offer');
    assert.equal(a.senders.length, 1); assert.equal(b.senders.length, 1);
    assert.equal(a.candidates.length, 1); assert.equal(b.candidates.length, 1);
  } finally { first.close(); second.close(); }
});
test('unresponsive pairing times out and releases its peer and port', async () => {
  const ports = new MessageChannel(), pc = new Peer();
  const link = connect(ports.port1, { pc, stream: { getAudioTracks: () => [] }, offerer: false, onTrack() {}, timeoutMs: 10 });
  await assert.rejects(link.ready, /timed out/); assert.equal(pc.connectionState, 'closed'); ports.port2.close();
});
test('closing either side cancels pending signaling on both sides', async () => {
  const ports = new MessageChannel(), a = new Peer(), b = new Peer();
  const options = { stream: { getAudioTracks: () => [] }, offerer: false, onTrack() {} };
  const first = connect(ports.port1, { ...options, pc: a }); const second = connect(ports.port2, { ...options, pc: b });
  first.close();
  await assert.rejects(first.ready, /stopped/); await assert.rejects(second.ready, /stopped/);
  assert.equal(a.connectionState, 'closed'); assert.equal(b.connectionState, 'closed');
});
test('malformed signaling closes the connection without accepting an arbitrary description', async () => {
  const ports = new MessageChannel(), pc = new Peer();
  const link = connect(ports.port1, { pc, stream: { getAudioTracks: () => [] }, offerer: false, onTrack() {} });
  ports.port2.postMessage({ type: 'description', description: { type: 'answer', sdp: 'wrong-role' } });
  await assert.rejects(link.ready, /signaling failed/); assert.equal(pc.remoteDescription, undefined); ports.port2.close();
});
