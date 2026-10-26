import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('public/call-recording.js', import.meta.url), 'utf8');

function fixture() {
  class Node {
    inputs = []; gain = { value: 1 };
    connect(other) { other.inputs.push(this); return other; }
    disconnect() { this.disconnected = true; }
    value() { return this.inputs.reduce((sum, input) => sum + input.value(), 0) * this.gain.value; }
  }
  const context = {
    createGain: () => new Node(),
    createMediaStreamSource: stream => ({ connect(other) { other.inputs.push(this); }, value: () => stream.value(), disconnect() {} }),
    createMediaStreamDestination() { const node = new Node(); node.stream = { value: () => node.value(), getTracks: () => [{ stop() {} }] }; return node; }
  };
  const captures = [], conversions = [];
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(stream, options) { this.stream = stream; this.mimeType = options.mimeType; this.state = 'inactive'; captures.push(this); }
    start() { this.state = 'recording'; this.samples = []; }
    sample() { this.samples.push(this.stream.value()); }
    stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable({ data: new Blob([JSON.stringify(this.samples)]) }); this.onstop(); }); }
  }
  const window = { SalesGodMP3: { async fromRecording(blob) { const samples = JSON.parse(await blob.text()); conversions.push(samples); return new Blob(['mp3'], { type: 'audio/mpeg' }); } } };
  vm.runInNewContext(source, { window, MediaRecorder: Recorder, Blob, setTimeout, clearTimeout });
  return { context, window, captures, conversions };
}

test('one mixed timeline includes customer, gated AI and voicemail, with overlap headroom and no local playback', async () => {
  const f = fixture(); let customer = 0, ai = 0, voicemail = 0, gate = 0;
  const recording = new f.window.SalesGodCallRecording(f.context, { value: () => ai * gate + voicemail });
  recording.addStream({ value: () => customer }); recording.start();
  customer = 0.8; ai = 1; f.captures[0].sample(); // muted AI must be absent
  customer = 0; ai = 0.6; gate = 1; f.captures[0].sample();
  ai = 0; voicemail = 0.7; f.captures[0].sample();
  customer = 0.8; voicemail = 0; ai = 0.6; f.captures[0].sample();
  const first = recording.finish(), second = recording.finish(); assert.equal(first, second);
  assert.equal((await first).type, 'audio/mpeg');
  assert.deepEqual(f.conversions, [[0.4, 0.3, 0.35, 0.7]]);
  assert.ok(recording.nodes.every(node => node.disconnected || !('inputs' in node)));
});
test('recorder error cannot produce a falsely successful MP3', async () => {
  const f = fixture(); let failures = 0;
  const recording = new f.window.SalesGodCallRecording(f.context, { value: () => 0 }, () => failures++);
  recording.start(); f.captures[0].onerror();
  await assert.rejects(recording.finish(), /recording failed/);
  assert.equal(failures, 1); assert.equal(f.conversions.length, 0);
});
test('final transcription sees only each recorded speaker, including the interrupted part of an AI reply', async () => {
  const f = fixture(), heard = [];
  f.window.SalesGodAudioTranscript = { async fromRecording(blob, context, speaker) {
    const samples = JSON.parse(await blob.text()); heard.push({ speaker, samples });
    return [{ speaker, start: 0, end: 2, audio: 'synthetic' }];
  } };
  let ai = 0, customer = 0;
  const recording = new f.window.SalesGodCallRecording(f.context, { value: () => ai }, () => {}, true);
  recording.addStream({ value: () => customer }); recording.start();
  ai = 0.6; for (const r of f.captures) r.sample();
  customer = 0.7; ai = 0; for (const r of f.captures) r.sample();
  await recording.finish(); const turns = await recording.transcriptSegments();
  assert.deepEqual(heard, [{ speaker: 'assistant', samples: [0.6, 0] }, { speaker: 'customer', samples: [0, 0.7] }]);
  assert.equal(turns.length, 2); assert.ok(recording.legs.every(l => !l.parts.length));
});
