import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { CampaignStore, parseContacts } from './campaign-store.mjs';
import { createBridge } from './server.mjs';
const settings = { timeZone: 'America/Los_Angeles', startHour: 9, endHour: 17, callerNumber: '+12025550100', voicemailMessage: 'This is a synthetic voicemail message.', brief: 'Synthetic office introduction.', simulation: false };
const csv = 'first_name,last_name,phone\nAlex,Example,+12025550101\nSam,Example,+12025550102';
const fixture = (simulation = false, date = '2026-10-20T19:00:00Z') => {
  let now = new Date(date);
  const store = new CampaignStore(':memory:', () => now), worker = randomUUID();
  const c = store.create({ name: 'Synthetic', csv, settings: { ...settings, simulation } });
  return { store, worker, id: c.id, advance(ms) { now = new Date(now.getTime() + ms); } };
};
test('CSV handles quoted names, BOM and duplicate normalized numbers; malformed imports fail', () => {
  const parsed = parseContacts('\uFEFFfirst_name,last_name,phone\r\n"Alex, A",Example,(202) 555-0101\r\nAlex,Example,+12025550101');
  assert.equal(parsed.contacts[0].firstName, 'Alex, A'); assert.equal(parsed.duplicates, 1);
  for (const bad of ['first_name,phone\nA,+12025550101', 'first_name,last_name,phone\n"Unclosed,x,3', 'first_name,last_name,phone\nA,B,not-a-number', 'first_name,last_name,phone\nA,B,+12025550101,extra']) assert.throws(() => parseContacts(bad));
});
test('only the authorized worker can claim; dispatch is once and only one active attempt exists', () => {
  const f = fixture(); try {
    assert.throws(() => f.store.claim(f.id, f.worker));
    f.store.start(f.id, f.worker); assert.throws(() => f.store.claim(f.id, randomUUID()));
    const c = f.store.claim(f.id, f.worker).contact;
    assert.throws(() => f.store.claim(f.id, f.worker));
    const session = randomUUID(); f.store.dispatch(f.id, c.id, f.worker, session);
    assert.throws(() => f.store.dispatch(f.id, c.id, f.worker, session));
    f.store.finish(f.id, c.id, f.worker, 'completed'); f.store.finish(f.id, c.id, f.worker, 'completed');
    assert.throws(() => f.store.finish(f.id, c.id, f.worker, 'no_answer'));
    assert.equal(f.store.claim(f.id, f.worker).contact.position, 1);
  } finally { f.store.close(); }
});
test('suppression and calling window are checked again before dispatch', () => {
  const f = fixture(false, '2026-10-20T23:59:50Z'); try {
    f.store.start(f.id, f.worker); const c = f.store.claim(f.id, f.worker).contact;
    f.store.suppress(c.phone); assert.throws(() => f.store.dispatch(f.id, c.id, f.worker, randomUUID()));
    f.store.finish(f.id, c.id, f.worker, 'blocked');
    const next = f.store.claim(f.id, f.worker).contact; f.advance(20000);
    assert.throws(() => f.store.dispatch(f.id, next.id, f.worker, randomUUID()), /Outside calling window/);
  }
  finally { f.store.close(); }
});
test('outside-window contacts wait; simulation is independent of time and never needs provider access', () => {
  const f = fixture(); try {
    f.store.start(f.id, f.worker); f.advance(12 * 3600000); f.store.expire(); f.store.start(f.id, f.worker);
    assert.equal(f.store.claim(f.id, f.worker).waiting, 'calling_window');
  } finally { f.store.close(); }
  const sim = fixture(true); try {
    sim.store.start(sim.id, sim.worker); sim.advance(12 * 3600000); sim.store.expire(); sim.store.start(sim.id, sim.worker);
    assert.ok(sim.store.claim(sim.id, sim.worker).contact);
  } finally { sim.store.close(); }
});
test('transcripts are session-bound and idempotent; opt-outs suppress future imports', () => {
  const f = fixture(); try {
    f.store.start(f.id, f.worker); const c = f.store.claim(f.id, f.worker).contact, session = randomUUID(); f.store.dispatch(f.id, c.id, f.worker, session);
    const turn = { session, item: 'turn1', speaker: 'customer', text: 'Please stop calling.' };
    assert.throws(() => f.store.transcript(f.id, c.id, f.worker, { ...turn, session: randomUUID() }));
    f.store.transcript(f.id, c.id, f.worker, turn); f.store.transcript(f.id, c.id, f.worker, turn);
    assert.throws(() => f.store.transcript(f.id, c.id, f.worker, { ...turn, text: 'changed' }));
    assert.equal(f.store.transcripts(f.id, c.id).length, 1); f.store.finish(f.id, c.id, f.worker, 'opt_out');
    const c2 = f.store.claim(f.id, f.worker).contact; f.store.dispatch(f.id, c2.id, f.worker, randomUUID()); f.store.finish(f.id, c2.id, f.worker, 'voicemail_played');
    assert.equal(f.store.claim(f.id, f.worker).finished, true);
    const next = f.store.create({ name: 'Next', csv, settings }); f.store.start(next.id, f.worker);
    assert.equal(f.store.claim(next.id, f.worker).contact.phone, '+12025550102');
    assert.equal(f.store.read(next.id).contacts[0].state, 'blocked');
  } finally { f.store.close(); }
});
test('expired paused workers cannot strand active contacts or allow a competing list', () => {
  const f = fixture(); try {
    f.store.start(f.id, f.worker); const c = f.store.claim(f.id, f.worker).contact; f.store.dispatch(f.id, c.id, f.worker, randomUUID()); f.store.pause(f.id, f.worker);
    const next = f.store.create({ name: 'Other', csv, settings }); assert.throws(() => f.store.start(next.id, randomUUID()));
    f.advance(31000); f.store.expire(); assert.equal(f.store.read(f.id).contacts[0].state, 'unknown');
    f.store.start(f.id, f.worker); assert.equal(f.store.claim(f.id, f.worker).contact.position, 1);
  } finally { f.store.close(); }
});
test('restart retains transcript and converts interrupted dispatch to unknown without retry; retention cascades', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'salesgod-campaign-')), path = join(dir, 'campaigns.db'); let store;
  let now = new Date('2026-10-20T19:00:00Z');
  try {
    store = new CampaignStore(path, () => now); const c = store.create({ name: 'Synthetic', csv, settings }), worker = randomUUID();
    store.start(c.id, worker); const contact = store.claim(c.id, worker).contact, session = randomUUID(); store.dispatch(c.id, contact.id, worker, session);
    store.transcript(c.id, contact.id, worker, { session, item: '1', speaker: 'customer', text: 'Synthetic test.' }); store.close();
    store = new CampaignStore(path, () => now);
    assert.equal(store.read(c.id).contacts[0].state, 'unknown'); assert.equal(store.transcripts(c.id, contact.id).length, 1);
    store.start(c.id, worker); assert.equal(store.claim(c.id, worker).contact.position, 1); store.pause(c.id, worker);
    now = new Date('2026-10-28T19:00:00Z'); store.prune(); assert.equal(store.list().length, 0);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM campaign_transcripts').get().n, 0);
  } finally { store?.close(); await rm(dir, { recursive: true }); }
});
test('campaign API rejects cross-origin/start without authorization and exposes tools only to active real preparations', async () => {
  const f = fixture(); let calls = 0;
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic-test-key' }, campaignStore: f.store, fetchImpl: async (_url, options) => {
    calls++; const session = JSON.parse(options.body.get('session')); assert.equal(session.tools[0].name, 'finish_call'); assert.doesNotMatch(session.instructions, /owner has not supplied/); return new Response('v=0\r\nanswer');
  } });
  const headers = { host: '127.0.0.1:28431', origin: 'http://127.0.0.1:28431', 'content-type': 'application/json' };
  const post = (path, body, extra = {}) => app.inject({ method: 'POST', url: path, headers: { ...headers, ...extra }, payload: body });
  try {
    assert.equal((await post(`/campaigns-api/${f.id}/start`, { workerId: f.worker })).statusCode, 400);
    assert.equal((await post(`/campaigns-api/${f.id}/start`, { workerId: f.worker, authorized: true }, { origin: 'https://evil.example' })).statusCode, 403);
    const sessionHeaders = { 'content-type': 'application/sdp', 'x-audio-mode': 'campaign-call' };
    assert.equal((await post('/session', 'v=0\r\n', sessionHeaders)).statusCode, 403); assert.equal(calls, 0);
    await post(`/campaigns-api/${f.id}/start`, { workerId: f.worker, authorized: true });
    const contact = (await post(`/campaigns-api/${f.id}/next`, { workerId: f.worker })).json().contact;
    const prepared = await post('/session', 'v=0\r\n', { ...sessionHeaders, 'x-campaign-id': f.id, 'x-contact-id': contact.id, 'x-worker-id': f.worker });
    assert.equal(prepared.statusCode, 200); assert.equal(calls, 1);
    const page = await app.inject({ url: '/campaigns', headers }); assert.equal(page.statusCode, 200); assert.match(page.body, /id="listHeading"/); assert.match(page.body, /Simulation only/);
  } finally { await app.close(); f.store.close(); }
});
const workerSource = await readFile(new URL('public/campaign-worker.js', import.meta.url), 'utf8');
function workerFixture(simulation = true, failDial = false, terminal = {}) {
  const f = fixture(simulation), window = {}, states = [], commands = []; let now = 0, session = randomUUID(), status = { canPrepare: true, prepared: true, sessionId: session, phase: 'waiting' }, phone = 'idle';
  vm.runInNewContext(workerSource, { window, crypto: { randomUUID }, setInterval, clearInterval, document: { getElementById: () => ({}) } });
  const api = async (path, body) => {
    const bits = path.split('/').slice(3), op = bits.at(-1), id = bits.length > 1 ? bits[0] : undefined;
    switch (op) {
      case 'start': return f.store.start(f.id, body.workerId);
      case 'heartbeat': return f.store.heartbeat(f.id, body.workerId);
      case 'pause': return f.store.pause(f.id, body.workerId);
      case 'next': return f.store.claim(f.id, body.workerId);
      case 'dispatch': return f.store.dispatch(f.id, id, body.workerId, body.session);
      case 'transcript': return f.store.transcript(f.id, id, body.workerId, body);
      case 'finish': return f.store.finish(f.id, id, body.workerId, body.outcome);
      default: throw new Error('Unexpected API path ' + path);
    }
  };
  const audio = { configure() { status = { canPrepare: true, prepared: true, sessionId: randomUUID(), phase: 'waiting' }; }, pair() {}, async prepare() {}, status: () => status, async stop() { status = { ...status, phase: 'stopped', humanAnswered: true, stopping: false }; } };
  const driver = async (command, data) => {
    commands.push(command);
    if (command === 'dial') { phone = 'active'; if (failDial) throw new Error('Lost acknowledgement'); status = { ...status, phase: 'stopped', humanAnswered: true, conversationOutcome: 'completed', ...terminal }; }
    if (command === 'hangup') phone = 'ended';
    if (command === 'status') return { state: phone };
    return {};
  };
  const worker = new window.SalesGodCampaignWorker({ api, audio, driver, onState: s => states.push(s.state), wait: async ms => { now += ms; }, now: () => now });
  return { ...f, worker, commands, states };
}
test('simulated list finishes sequentially, saves transcripts and notifies without touching audio or dialer', async () => {
  const f = workerFixture(); try {
    await f.worker.run(f.id); assert.equal(f.store.read(f.id).state, 'finished'); assert.equal(f.commands.length, 0);
    assert.deepEqual(f.store.read(f.id).contacts.map(c => c.state), ['completed', 'voicemail_played']);
    assert.equal(f.store.transcripts(f.id, f.store.read(f.id).contacts[0].id).length, 2); assert.equal(f.states.at(-1), 'finished');
  } finally { f.store.close(); }
});
test('fake live driver hangs up before next dispatch, and lost dispatch acknowledgement pauses without retry', async () => {
  const f = workerFixture(false); try {
    await f.worker.run(f.id); assert.equal(f.commands.filter(x => x === 'dial').length, 2);
    const dial = f.commands.indexOf('dial'), next = f.commands.indexOf('dial', dial + 1); assert.ok(f.commands.indexOf('hangup', dial) < next); assert.equal(f.states.at(-1), 'finished');
  } finally { f.store.close(); }
  const uncertain = workerFixture(false, true); try {
    await uncertain.worker.run(uncertain.id); assert.equal(uncertain.commands.filter(x => x === 'dial').length, 1);
    assert.deepEqual(uncertain.store.read(uncertain.id).contacts.map(c => c.state), ['unknown', 'pending']); assert.equal(uncertain.store.read(uncertain.id).state, 'paused');
  } finally { uncertain.store.close(); }
});
test('unconfirmed late human pickup overrides voicemail playback and pauses before the next contact', async () => {
  const f = workerFixture(false, false, { voicemailOutcome: 'playback_completed', takeoverPending: true });
  try {
    await f.worker.run(f.id); assert.equal(f.commands.filter(c => c === 'dial').length, 1);
    assert.deepEqual(f.store.read(f.id).contacts.map(c => c.state), ['needs_review', 'pending']);
    assert.equal(f.store.read(f.id).state, 'paused');
  } finally { f.store.close(); }
});
