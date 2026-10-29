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
  s.at(120001, silence); assert.equal(s.counts().timeouts, 1);
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

test('late voicemail greeting survives ringing past sixty seconds and a short completed beep', () => {
  const s = setup(); s.at(85000, silence);
  assert.equal(s.counts().timeouts, 0);
  s.detector.transcript('Leave your message after the tone');
  s.at(85100, wave(1000)); s.at(85180, wave(1000)); s.at(85300, silence);
  assert.equal(s.counts().ready, 1);
});

test('an ambiguous greeting needs model confirmation before missed-beep silence can open voicemail', () => {
  const s = setup();
  s.detector.transcript('The person is not here right now.');
  s.at(1000, silence); s.at(6000, silence);
  assert.equal(s.counts().ready, 0);
  s.detector.confirmVoicemail();
  s.at(6100, silence); s.at(8500, silence); assert.equal(s.counts().ready, 0);
  s.at(8700, silence); assert.equal(s.counts().ready, 1);
  s.at(10000, silence); assert.equal(s.counts().ready, 1);
});

test('a deterministic carrier invitation confirms voicemail and recovers a missed beep after fresh silence', () => {
  const s = setup();
  s.detector.transcript('Your call was forwarded to an automated voice messaging system. At the tone, please record your message.');
  s.at(100, silence); s.at(2700, silence);
  assert.equal(s.counts().ready, 1);
});

test('speech and pending human classification prevent the silence fallback', () => {
  let now = 0, allow = false, played = 0;
  const detector = new Detector({ now: () => now, onGreeting() {}, onReady: reason => { assert.equal(reason, 'confirmed_silence'); played++; }, onTimeout() {}, canFallback: () => allow });
  detector.confirmVoicemail();
  const at = (time, values) => { now = time; detector.samples(values, 48000); };
  at(100, silence); at(3000, silence); assert.equal(played, 0);
  allow = true; at(3100, wave(350)); at(3200, silence); at(5500, silence); assert.equal(played, 0);
  at(5800, silence); assert.equal(played, 1);
});

test('full mailbox cannot use fallback and greeting extends the bounded deadline', () => {
  const s = setup(); s.at(115000, silence); s.detector.confirmVoicemail();
  s.at(121000, wave(350)); assert.equal(s.counts().timeouts, 0);
  s.at(160001, wave(350)); assert.equal(s.counts().timeouts, 1);
  let played = 0;
  const detector = new Detector({ now: () => 0, onGreeting() {}, onReady: () => played++, onTimeout() {} });
  detector.transcript('The mailbox is full'); detector.confirmVoicemail();
  detector.samples(silence, 48000); assert.equal(played, 0); assert.equal(detector.active, false);
});
