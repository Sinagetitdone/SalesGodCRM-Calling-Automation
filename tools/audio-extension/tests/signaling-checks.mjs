import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../local-rtc.js', import.meta.url), 'utf8');
function helper() {
  const window = {};
  vm.runInNewContext(source, { window, Symbol, Object, AbortController, Error, Promise, Map, setTimeout, clearTimeout });
  return window[Symbol.for('salesgod.local.rtc.v1')];
}
class Peer extends EventTarget {
  connectionState = 'new'; remoteDescription = null; added = []; localCalls = 0;
  async createOffer() { return { type: 'offer', sdp: 'v=0\r\n' }; }
  async createAnswer() { return { type: 'answer', sdp: 'v=0\r\n' }; }
  async setLocalDescription(description) {
    this.localCalls++; this.localDescription = description;
    const event = new Event('icecandidate');
    event.candidate = { toJSON: () => ({ candidate: 'synthetic-candidate', sdpMid: '0', sdpMLineIndex: 0 }) };
    this.dispatchEvent(event);
    const end = new Event('icecandidate'); end.candidate = null; this.dispatchEvent(end);
  }
  async setRemoteDescription(description) { this.remoteDescription = description; }
  async addIceCandidate(candidate) {
    assert.ok(this.remoteDescription, 'Candidate must wait for remote description'); this.added.push(candidate);
    if (candidate) { this.connectionState = 'connected'; this.dispatchEvent(new Event('connectionstatechange')); }
  }
}
test('queues early ICE events and forwards candidates plus end markers to both peers', async () => {
  const a = new Peer(), b = new Peer();
  const report = await helper().negotiate(a, b, { timeoutMs: 200 });
  assert.equal(a.connectionState, 'connected'); assert.equal(b.connectionState, 'connected');
  assert.equal(report.forwardedToA, 1); assert.equal(report.forwardedToB, 1);
  assert.equal(a.added.length, 2); assert.equal(b.added.length, 2);
  assert.equal(a.added[1], null); assert.equal(b.added[1], null);
});
test('candidate errors fail immediately with diagnostics instead of a generic timeout', async () => {
  const a = new Peer(), b = new Peer();
  b.addIceCandidate = async () => { throw new TypeError('synthetic rejection'); };
  await assert.rejects(helper().negotiate(a, b, { timeoutMs: 200 }), error => {
    assert.match(error.message, /candidate/);
    assert.equal(error.signalingDiagnostics.discoveredA, 1); return true;
  });
});
test('a peer that never connects has a bounded failure with candidate counts', async () => {
  const a = new Peer(), b = new Peer();
  a.addIceCandidate = b.addIceCandidate = async () => {};
  await assert.rejects(helper().negotiate(a, b, { timeoutMs: 15 }), error => {
    assert.match(error.message, /timed out/); assert.equal(error.signalingDiagnostics.forwardedToB, 1); return true;
  });
});
test('owner cancellation interrupts waits without waiting for the connection timeout', async () => {
  const a = new Peer(), b = new Peer(), controller = new AbortController();
  a.addIceCandidate = b.addIceCandidate = async () => {};
  const pending = helper().negotiate(a, b, { signal: controller.signal, timeoutMs: 1000 });
  controller.abort(new Error('Stopped by owner'));
  await assert.rejects(pending, /Stopped by owner/);
});
test('already cancelled tests do not start description exchange', async () => {
  const a = new Peer(), b = new Peer(), controller = new AbortController(); controller.abort(new Error('Already stopped'));
  await assert.rejects(helper().negotiate(a, b, { signal: controller.signal }), /Already stopped/);
  assert.equal(a.localCalls, 0); assert.equal(b.localCalls, 0);
});
