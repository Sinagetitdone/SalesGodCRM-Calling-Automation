import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { CampaignStore } from './campaign-store.mjs';
import { createBridge } from './server.mjs';
import { SessionJournal } from './session-journal.mjs';

const headers = { host: '127.0.0.1:28431', origin: 'http://127.0.0.1:28431', 'content-type': 'application/json' };
const mp3 = Buffer.from([0xff, 0xfb, 0, 1]);
function setup() {
  const store = new CampaignStore(':memory:'), workerId = randomUUID(), session = randomUUID();
  const campaign = store.create({ name: 'Synthetic recorded transcript', csv: 'first_name,last_name,phone\nAlex,Example,+12025550101', settings: { simulation: false, timeZone: 'UTC', startHour: 0, endHour: 24, callerNumber: '+12025550100', brief: 'Synthetic only', voicemailMessage: 'A synthetic voicemail message.' } });
  store.start(campaign.id, workerId); const contact = store.claim(campaign.id, workerId).contact;
  store.dispatch(campaign.id, contact.id, workerId, session); store.saveRecording(campaign.id, contact.id, workerId, mp3);
  store.transcript(campaign.id, contact.id, workerId, { session, item: 'draft', speaker: 'assistant', text: 'Generated words never actually spoken' });
  const segments = [{ speaker: 'customer', start: 2, end: 3, audio: mp3.toString('base64') }, { speaker: 'assistant', start: 0, end: 1, audio: mp3.toString('base64') }];
  return { store, campaign, contact, workerId, session, segments, url: `/campaigns-api/${campaign.id}/${contact.id}/audio-transcript` };
}
test('recorded transcript replaces the displayed draft atomically, preserves speaker order and never sends generated text to ASR', async () => {
  const s = setup(), requests = [], journal = new SessionJournal(':memory:');
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic' }, campaignStore: s.store, journal, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/audio/transcriptions'); assert.equal(options.body.get('model'), 'gpt-transcribe');
    assert.equal(options.body.has('prompt'), false); assert.equal(options.body.get('file').type, 'audio/mpeg');
    requests.push(url); return Response.json({ text: requests.length === 1 ? 'Yes, tomorrow works.' : 'Would tomorrow work?' });
  } });
  const request = { method: 'POST', url: s.url, headers, payload: { workerId: s.workerId, session: s.session, segments: s.segments } };
  try {
    const response = await app.inject(request); assert.equal(response.statusCode, 200, response.body);
    const info = s.store.transcriptInfo(s.campaign.id, s.contact.id);
    assert.equal(info.source, 'recorded_audio'); assert.deepEqual(info.turns.map(t => t.speaker), ['assistant', 'customer']);
    assert.equal(info.turns[0].text, 'Would tomorrow work?'); assert.match(info.liveDraft[0].text, /never actually spoken/);
    assert.equal((await app.inject(request)).statusCode, 200); assert.equal(requests.length, 2);
    const get = await app.inject({ url: s.url.replace('/audio-transcript', '/transcript'), headers }); assert.equal(get.json().source, 'recorded_audio');
    s.store.finish(s.campaign.id, s.contact.id, s.workerId, 'completed'); s.store.pause(s.campaign.id, s.workerId);
    s.store.deleteConversation(s.campaign.id, s.contact.id); assert.equal(s.store.db.prepare('SELECT COUNT(*) AS n FROM campaign_audio_transcripts').get().n, 0);
  } finally { await app.close(); s.store.close(); journal.close(); }
});
test('a failed transcription preserves the live draft, recording, error category and status; unauthorized requests never reach OpenAI', async () => {
  const s = setup(); let requests = 0;
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic' }, campaignStore: s.store, fetchImpl: async () => { requests++; return Response.json({ error: { code: 'insufficient_quota', message: 'secret upstream details' } }, { status: 429 }); } });
  const request = { method: 'POST', url: s.url, headers, payload: { workerId: s.workerId, session: s.session, segments: s.segments } };
  try {
    assert.equal((await app.inject({ ...request, headers: { ...headers, origin: 'https://untrusted.example' } })).statusCode, 403);
    assert.equal((await app.inject({ ...request, payload: { ...request.payload, workerId: randomUUID() } })).statusCode, 502); assert.equal(requests, 0);
    const response = await app.inject(request); assert.equal(response.statusCode, 502); assert.match(response.json().error, /insufficient_quota.*429/); assert.doesNotMatch(response.body, /secret upstream/);
    const info = s.store.transcriptInfo(s.campaign.id, s.contact.id);
    assert.equal(info.source, 'live_draft'); assert.equal(info.state, 'failed'); assert.match(info.error, /quota/);
    assert.equal(s.store.recording(s.campaign.id, s.contact.id).length, mp3.length);
    assert.equal(info.turns[0].text, 'Generated words never actually spoken');
  } finally { await app.close(); s.store.close(); }
});
test('audio slicing uses the captured timeline, skips silence and never overlaps consecutive chunks', async () => {
  const window = {};
  vm.runInNewContext(await readFile(new URL('public/audio-transcript.js', import.meta.url), 'utf8'), { window, Float32Array });
  const intervals = window.SalesGodAudioTranscript.intervals;
  assert.equal(intervals(new Float32Array(10000), 1000).length, 0);
  const samples = new Float32Array(100000).fill(0.2); const ranges = intervals(samples, 1000);
  assert.equal(ranges[0][0], 0); assert.equal(ranges.at(-1)[1], samples.length);
  for (let i = 1; i < ranges.length; i++) assert.equal(ranges[i][0], ranges[i - 1][1]);
  const speech = new Float32Array(5000); speech.fill(0.2, 1000, 1800); speech.fill(0.2, 3500, 4000);
  const separate = intervals(speech, 1000); assert.equal(separate.length, 2); assert.equal(separate[0][0], 800); assert.equal(separate[1][0], 3300);
});
test('saved journal failure details are redacted, idempotent and included in archived reads', () => {
  const journal = new SessionJournal(':memory:');
  try {
    const sessionId = randomUUID(); journal.append({ sessionId, sequence: 0, event: 'session.started', phase: 'preparing' });
    const event = { sessionId, sequence: 1, event: 'session.stopped', phase: 'failed', detail: 'HTTP 429 insufficient_quota sk-syntheticSecret Bearer syntheticToken' };
    journal.append(event); journal.append(event);
    const detail = journal.read(sessionId)[1].detail;
    assert.match(detail, /429 insufficient_quota/); assert.doesNotMatch(detail, /syntheticSecret|syntheticToken/);
    assert.throws(() => journal.append({ ...event, detail: 'Changed explanation' }), /conflict/);
  } finally { journal.close(); }
});
