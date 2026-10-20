import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const window = {};
vm.runInNewContext(await readFile(new URL('public/voicemail.js', import.meta.url), 'utf8'), { window });
const { Detector, tone } = window.SalesGodVoicemail;
const wave = (frequency, rate = 48000) => Float32Array.from({ length: 2048 }, (_, i) => 0.2 * Math.sin(2 * Math.PI * frequency * i / rate));
const silence = new Float32Array(2048);
test('beep signal detection accepts mailbox tones and rejects silence, ringing and broadband audio', () => {
  for (const rate of [8000, 16000, 48000]) for (const frequency of [800, 1000, 1400]) assert.equal(tone(wave(frequency, rate), rate), true);
  assert.equal(tone(silence, 48000), false);
  for (const frequency of [350, 440, 480, 2000]) assert.equal(tone(wave(frequency), 48000), false);
  const mixed = Float32Array.from({ length: 2048 }, (_, i) => [180, 360, 540, 720, 900, 1080, 1260, 1440].reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * i / 48000) / 30, 0));
  assert.equal(tone(mixed, 48000), false);
});
function setup() {
  let now = 0, greetings = 0, ready = 0, timeouts = 0;
  const detector = new Detector({ now: () => now, onGreeting: () => greetings++, onReady: () => ready++, onTimeout: () => timeouts++ });
  return { detector, at(value, samples) { now = value; if (samples) detector.samples(samples, 48000); }, counts: () => ({ greetings, ready, timeouts }) };
}
test('greeting plus completed beep triggers once; greeting or beep alone never plays', () => {
  const s = setup(); s.detector.transcript('Hello, how are you?');
  s.at(100, wave(1000)); s.at(400, wave(1000)); s.at(520, silence);
  assert.equal(s.counts().ready, 0);
  s.detector.transcript('Please leave your message after the beep.');
  assert.deepEqual(s.counts(), { greetings: 1, ready: 1, timeouts: 0 });
  s.detector.transcript('Leave a message'); assert.equal(s.counts().ready, 1);
});
test('missing beep, short clicks, long tones and stale beeps do not trigger; detection expires', () => {
  const s = setup(); s.detector.transcript('Please leave a message.');
  s.at(100, wave(1000)); s.at(120, wave(1000)); s.at(250, silence);
  s.at(300, wave(1000)); s.at(2500, wave(1000)); s.at(2650, silence);
  assert.equal(s.counts().ready, 0);
  s.at(60001, silence); assert.equal(s.counts().timeouts, 1);
  const late = setup(); late.at(100, wave(1000)); late.at(400, wave(1000)); late.at(550, silence); late.at(10000);
  late.detector.transcript('Leave a message after the tone'); assert.equal(late.counts().ready, 0);
});
test('stopped detector ignores late transcripts and audio', () => {
  const s = setup(); s.detector.stop(); s.detector.transcript('Please leave a message after the beep');
  s.at(100, wave(1000)); s.at(400, wave(1000)); s.at(550, silence);
  assert.deepEqual(s.counts(), { greetings: 0, ready: 0, timeouts: 0 });
});
test('a full mailbox stops detection instead of accepting its beep', () => {
  let unavailable = false, played = false;
  const detector = new Detector({ now: () => 0, onGreeting() {}, onReady: () => played = true, onTimeout() {}, onUnavailable: () => unavailable = true });
  detector.transcript('The mailbox is full and cannot accept your message.');
  detector.transcript('Leave a message after the beep');
  assert.equal(unavailable, true); assert.equal(detector.active, false); assert.equal(played, false);
});
