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

for (const simulation of [false, true]) test(`history saves ${simulation ? 'rehearsal' : 'real-call'} MP3s, protects active records and deletes only the selected conversation`, async () => {
  const f = fixture(simulation), app = createBridge({ campaignStore: f.store, env: {} });
  const headers = { host: '127.0.0.1:28431', origin: 'http://127.0.0.1:28431' };
  try {
    f.store.start(f.id, f.worker); const c = f.store.claim(f.id, f.worker).contact;
    const session = randomUUID(); f.store.dispatch(f.id, c.id, f.worker, session);
    const base = `/campaigns-api/${f.id}/${c.id}`;
    const upload = worker => app.inject({ method: 'POST', url: base + '/recording', headers: { ...headers, 'content-type': 'audio/mpeg', 'x-worker-id': worker }, payload: Buffer.from([0xff, 0xfb, 0x90, 0x00]) });
    assert.equal((await upload(randomUUID())).statusCode, 409);
    assert.equal((await upload(f.worker)).statusCode, 200);
    assert.equal(f.store.read(f.id).contacts[0].hasRecording, 1);
    const remove = () => app.inject({ method: 'POST', url: base + '/delete', headers, payload: { confirmed: true } });
    assert.equal((await remove()).statusCode, 409);
    f.store.finish(f.id, c.id, f.worker, 'failed', { message: 'Rehearsal turn timed out. sk-synthetic-secret' });
    assert.equal((await upload(f.worker)).statusCode, 409);
    const events = f.store.read(f.id).events;
    assert.match(events.at(-2).event, /timed out/); assert.doesNotMatch(JSON.stringify(events), /sk-synthetic/);
    f.store.archiveAudio(c.id, [{ time: '2026-10-20T19:00:00Z', event: 'session.error', phase: 'failed' }]);
    assert.equal((await app.inject({ url: base + '/events', headers })).json().events[0].event, 'session.error');
    assert.deepEqual((await app.inject({ url: base + '/recording', headers })).rawPayload, Buffer.from([0xff, 0xfb, 0x90, 0x00]));
    assert.equal((await app.inject({ url: '/conversation-history', headers })).json().campaigns.length, 1);
    assert.equal((await remove()).statusCode, 200);
    assert.equal(f.store.read(f.id).contacts.length, 1);
    assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM campaign_recordings').get().n, 0);
    assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM campaign_audio_archive').get().n, 0);
    assert.equal((await app.inject({ url: base + '/recording', headers })).statusCode, 404);
  } finally { await app.close(); f.store.close(); }
});

test('failure before dispatch retains its session and error without authorizing a phone call', () => {
  const f = fixture();
  try {
    f.store.start(f.id, f.worker); const c = f.store.claim(f.id, f.worker).contact, session = randomUUID();
    const result = f.store.finish(f.id, c.id, f.worker, 'failed', { session, message: 'AI preparation failed. httpStatus=403' });
    assert.equal(result.contacts[0].session, session); assert.equal(result.contacts[0].dispatched, null);
    assert.match(result.events.at(-2).event, /httpStatus=403/);
    assert.throws(() => f.store.dispatch(f.id, c.id, f.worker, session));
  } finally { f.store.close(); }
});

for (const simulation of [false, true]) test(`history ZIP contains ${simulation ? 'rehearsal' : 'real-call'} transcripts, logs and one whole recording without credentials`, async () => {
  const f = fixture(simulation), app = createBridge({ campaignStore: f.store, env: {} });
  try {
    f.store.start(f.id, f.worker); const c = f.store.claim(f.id, f.worker).contact, session = randomUUID();
    f.store.dispatch(f.id, c.id, f.worker, session);
    f.store.transcript(f.id, c.id, f.worker, { session, item: 'one', speaker: 'assistant', text: 'Synthetic dialogue' });
    f.store.saveRecording(f.id, c.id, f.worker, Buffer.from([0xff, 0xfb, 0x90, 0]));
    f.store.finish(f.id, c.id, f.worker, 'completed');
    const r = await app.inject({ url: '/conversation-history.zip', headers: { host: '127.0.0.1:28431' } });
    assert.equal(r.statusCode, 200); assert.match(r.headers['content-type'], /application\/zip/);
    const bytes = r.rawPayload, files = new Map(); let offset = 0;
    while (bytes.readUInt32LE(offset) === 0x04034b50) {
      const size = bytes.readUInt32LE(offset + 18), length = bytes.readUInt16LE(offset + 26), start = offset + 30 + length;
      files.set(bytes.subarray(offset + 30, start).toString(), bytes.subarray(start, start + size)); offset = start + size;
    }
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50); assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
    assert.equal(files.size, 5); // README, list, two contact reports, one MP3.
    const report = JSON.parse(files.get(`${f.id}/${c.id}.json`));
    assert.equal(report.transcript[0].text, 'Synthetic dialogue'); assert.ok(report.events.length);
    assert.deepEqual(files.get(`${f.id}/${c.id}.mp3`), Buffer.from([0xff, 0xfb, 0x90, 0]));
    assert.doesNotMatch(files.get(`${f.id}/list.json`).toString(), new RegExp(f.worker));
    assert.equal((await app.inject({ url: '/conversation-history.zip', headers: { host: 'untrusted.invalid' } })).statusCode, 403);
  } finally { await app.close(); f.store.close(); }
});

test('real and rehearsal review panels show saved conversation and all logs together', async () => {
  const source = await readFile(new URL('public/campaign.js', import.meta.url), 'utf8');
  for (const practice of [false, true]) {
    const nodes = new Map(), requests = [];
    const node = () => ({ children: [], value: '', hidden: true, dataset: {}, append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; }, scrollIntoView() {} });
    const get = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
    const contact = { id: 'contact', firstName: 'Synthetic', lastName: 'Example', state: 'pending', session: null };
    const campaign = { id: 'list', name: 'Synthetic', state: 'draft', settings: { simulation: practice }, contacts: [contact], events: [{ contact: null, time: '2026-10-23T12:00:00Z', event: 'imported' }] };
    vm.runInNewContext(source, { document: { body: { dataset: { workspace: practice ? 'rehearsal' : 'live' } }, getElementById: get, createElement: node },
      window: { addEventListener() {}, SalesGodCall: { status: () => ({}) }, SalesGodCampaignWorker: class {}, SalesGodRehearsal: class {} },
      location: { hash: '' }, URLSearchParams, Option: class {}, setInterval() {},
      fetch: async path => {
        requests.push(path); let data = {};
        if (path.startsWith('/campaigns-api?')) data = { campaigns: [campaign] };
        else if (path === '/calling-profile') data = { background: '', guidance: '' };
        else if (path.endsWith('/transcript')) data = { turns: [{ speaker: 'assistant', text: 'Completed speech' }, { speaker: 'customer', text: 'Customer partial reply', time: '2026-10-23T12:00:01Z' }] };
        else if (path.endsWith('/events')) data = { events: Array.from({ length: 125 }, (_, sequence) => ({ sequence, time: '2026-10-23T12:00:01Z', event: 'session.error', phase: 'failed' })) };
        else data = campaign;
        return { ok: true, json: async () => data };
      } });
    await new Promise(resolve => setImmediate(resolve));
    for (const state of ['pending', 'failed', 'needs_review', 'unknown', 'completed']) {
      contact.state = state; contact.session = state === 'pending' ? null : 'session';
      if (state === 'failed') campaign.events.push({ contact: 'contact', time: '2026-10-23T12:00:02Z', event: 'failure_detail: Rehearsal connection timed out.' });
      get('savedLists').value = 'list'; await get('savedLists').onchange();
      const button = get('contactRows').children[0].children[3].children[0];
      assert.equal(button.textContent, state === 'completed' ? 'View transcript' : state === 'pending' ? 'View log' : 'View full details');
      button.onclick(); await new Promise(resolve => setImmediate(resolve));
      const text = get('selectedTranscript').textContent;
      if (state === 'pending') assert.match(text, /imported[\s\S]*has not been attempted/);
      if (['failed', 'needs_review', 'unknown'].includes(state)) {
        assert.match(text, /session.error · phase=failed/); assert.match(text, /Rehearsal connection timed out/);
        assert.match(text, /assistant: Completed speech/); assert.match(text, /2026-10-23T12:00:01Z customer: Customer partial reply/);
        assert.match(text, /sequence=124/); assert.match(text, /Contact ID: contact/);
      }
      if (state === 'completed') assert.match(text, /assistant: Completed speech/);
    }
  }
});
test('CSV handles quoted names, BOM and duplicate normalized numbers; malformed imports fail', () => {
  const parsed = parseContacts('\uFEFFfirst_name,last_name,phone\r\n"Alex, A",Example,(202) 555-0101\r\nAlex,Example,+12025550101');
  assert.equal(parsed.contacts[0].firstName, 'Alex, A'); assert.equal(parsed.duplicates, 1);
  for (const bad of ['first_name,phone\nA,+12025550101', 'first_name,last_name,phone\n"Unclosed,x,3', 'first_name,last_name,phone\nA,B,not-a-number', 'first_name,last_name,phone\nA,B,+12025550101,extra']) assert.throws(() => parseContacts(bad));
  assert.throws(() => parseContacts('first_name,last_name,phone\n,,+12025550101'), /Row 2: first name is required/);
});

test('CSV import preserves escaped quotes, international numbers and its existing boundary limits', () => {
  const header = 'first_name,last_name,phone\n';
  const parsed = parseContacts(header + '"Alex ""A""",,+442079460000\n');
  assert.deepEqual(parsed.contacts, [{ firstName: 'Alex "A"', lastName: '', phone: '+442079460000' }]);
  assert.equal(parseContacts(header + 'A'.repeat(80) + ',Example,+12025550101').contacts.length, 1);
  assert.throws(() => parseContacts(header + 'A'.repeat(81) + ',Example,+12025550101'), /Row 2: invalid name/);
  const rows = Array.from({ length: 1000 }, (_, i) => `Alex,Example,+1202555${String(i).padStart(4, '0')}`);
  assert.equal(parseContacts(header + rows.join('\n')).contacts.length, 1000);
  assert.throws(() => parseContacts(header + [...rows, 'Alex,Example,+12025551000'].join('\n')), /1 and 1000/);
  assert.throws(() => parseContacts('x'.repeat(400001)), /CSV exceeds/);
});
test('Previous Conversations retains review transcript, reason and complete events even if one detail request fails', async () => {
  const source = await readFile(new URL('public/history.js', import.meta.url), 'utf8');
  for (const unavailable of [null, 'transcript', 'events']) {
    const nodes = new Map(), node = () => ({ children: [], value: '', append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; } });
    const get = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
    const contact = { id: 'contact', state: 'needs_review', firstName: 'Synthetic', lastName: 'Example', session: 'session', hasRecording: 1 };
    const list = { id: 'list', name: 'Synthetic', created: '2026-10-26', state: 'paused', settings: { simulation: false }, contacts: [contact], events: [{ contact: 'contact', time: '2026-10-26T12:00:00Z', event: 'failure_detail: Audio connection lost.' }] };
    vm.runInNewContext(source, { document: { getElementById: get, createElement: node }, Option: class {},
      fetch: async path => {
        if (unavailable && path.endsWith('/' + unavailable)) throw new Error('Synthetic load failure');
        const data = path === '/conversation-history' ? { campaigns: [list] } : path.endsWith('/transcript') ? { turns: [{ speaker: 'assistant', text: 'Office introduction' }, { speaker: 'customer', text: 'Partial customer reply', time: '2026-10-26T12:00:01Z' }] }
          : path.endsWith('/events') ? { events: Array.from({ length: 125 }, (_, sequence) => ({ sequence, time: '2026-10-26T12:00:02Z', event: 'bridge.disconnected', phase: 'failed' })) } : list;
        return { ok: true, json: async () => data };
      }
    });
    await new Promise(resolve => setImmediate(resolve)); get('historyList').value = 'list'; get('historyList').onchange();
    await new Promise(resolve => setImmediate(resolve)); get('historyContacts').children[0].onclick();
    await new Promise(resolve => setImmediate(resolve));
    const text = get('historyText').textContent;
    assert.match(text, /Audio connection lost/); assert.match(text, /Status: needs_review/);
    if (unavailable !== 'transcript') { assert.match(text, /Office introduction/); assert.match(text, /customer: Partial customer reply/); }
    if (unavailable !== 'events') assert.match(text, /sequence=124/);
    if (unavailable) assert.match(text, /Loading errors[\s\S]*Synthetic load failure/);
    assert.equal(get('historyAudio').children[0].src, '/campaigns-api/list/contact/recording');
    assert.equal(get('exportConversation').disabled, false);
  }
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
test('restart retains transcript and converts interrupted dispatch to unknown; history remains until deletion', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'salesgod-campaign-')), path = join(dir, 'campaigns.db'); let store;
  let now = new Date('2026-10-20T19:00:00Z');
  try {
    store = new CampaignStore(path, () => now); const c = store.create({ name: 'Synthetic', csv, settings }), worker = randomUUID();
    store.start(c.id, worker); const contact = store.claim(c.id, worker).contact, session = randomUUID(); store.dispatch(c.id, contact.id, worker, session);
    store.transcript(c.id, contact.id, worker, { session, item: '1', speaker: 'customer', text: 'Synthetic test.' }); store.close();
    store = new CampaignStore(path, () => now);
    assert.equal(store.read(c.id).contacts[0].state, 'unknown'); assert.equal(store.transcripts(c.id, contact.id).length, 1);
    store.start(c.id, worker); assert.equal(store.claim(c.id, worker).contact.position, 1); store.pause(c.id, worker);
    now = new Date('2026-10-28T19:00:00Z'); store.prune(); store.expire(); assert.equal(store.list().length, 1);
    for (const entry of store.read(c.id).contacts) store.deleteConversation(c.id, entry.id);
    assert.equal(store.list().length, 0);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM campaign_transcripts').get().n, 0);
  } finally { store?.close(); await rm(dir, { recursive: true }); }
});
test('campaign API rejects cross-origin/start without authorization and exposes tools only to active real preparations', async () => {
  const f = fixture(); let calls = 0;
  const app = createBridge({ env: { OPENAI_API_KEY: 'synthetic-test-key' }, campaignStore: f.store, fetchImpl: async (_url, options) => {
    calls++; const session = JSON.parse(options.body.get('session')); assert.equal(session.tools[0].name, 'finish_call');
    assert.deepEqual(session.tools[0].parameters.required, ['reason', 'disposition']);
    assert.deepEqual(session.tools[0].parameters.properties.disposition.enum, ['meeting_set', 'follow_up', 'not_interested', 'wrong_number', 'completed', 'opt_out']);
    assert.match(session.instructions, /exact date, time, and timezone/); assert.doesNotMatch(session.instructions, /owner has not supplied/); return new Response('v=0\r\nanswer');
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
    const page = await app.inject({ url: '/campaigns', headers }); assert.equal(page.statusCode, 200); assert.match(page.body, /id="listHeading"/); assert.match(page.body, /Real calls only/);
    assert.doesNotMatch(page.body, /id="rehearsalPanel"|id="simulation"|id="prepare"|rehearsal.js/);
    const practice = await app.inject({ url: '/supervised-call', headers });
    assert.match(practice.body, /id="rehearsalPanel"/); assert.match(practice.body, /id="prepare"/);
    assert.match(practice.body, /data-workspace="rehearsal"/);
    for (const html of [page.body, practice.body]) { const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]); assert.equal(ids.length, new Set(ids).size); }
  } finally { await app.close(); f.store.close(); }
});
const workerSource = await readFile(new URL('public/campaign-worker.js', import.meta.url), 'utf8');

test('stopped call outcomes retain evidence priority for voicemail, opt-out, partial speech and uncertain pickup', () => {
  const window = {};
  vm.runInNewContext(workerSource, { window });
  const decide = window.SalesGodCampaignWorker.prototype.stoppedCallOutcome;
  const cases = [
    ['late pickup needs review', { takeoverPending: true, voicemailOutcome: 'playback_completed' }, 'ended', 'needs_review'],
    ['partial voicemail needs review', { voicemailOutcome: 'incomplete', conversationOutcome: 'completed' }, 'ended', 'needs_review'],
    ['explicit voicemail review wins', { voicemailOutcome: 'needs_review', conversationOutcome: 'opt_out' }, 'ended', 'needs_review'],
    ['completed voicemail', { voicemailOutcome: 'playback_completed' }, 'active', 'voicemail_played'],
    ['opt-out survives time limit', { conversationOutcome: 'opt_out', stopReason: 'Time limit' }, 'active', 'opt_out'],
    ['time limit needs review', { conversationOutcome: 'completed', stopReason: 'Time limit' }, 'ended', 'needs_review'],
    ['missing transcript needs review', { conversationOutcome: 'completed', transcriptSaved: false }, 'ended', 'needs_review'],
    ['natural completion', { conversationOutcome: 'completed' }, 'active', 'completed'],
    ['active call without completion evidence', { humanAnswered: true }, 'active', 'needs_review'],
    ['confirmed human after hangup', { humanAnswered: true }, 'ended', 'completed'],
    ['unclassified speech after hangup', { customerTurns: 1 }, 'idle', 'needs_review'],
    ['no answer after hangup', { customerTurns: 0 }, 'ended', 'no_answer'],
    ['idle without answer', {}, 'idle', 'no_answer'],
  ];
  for (const [label, status, phoneState, expected] of cases) {
    assert.equal(decide(status, phoneState), expected, label);
  }
});
function workerFixture(simulation = true, failDial = false, terminal = {}, failNote = false) {
  const f = fixture(simulation), window = {}, states = [], commands = [], dialPayloads = [], notePayloads = [];
  const { phoneEndsAfterPoll = false, importNotReady = false, ...terminalStatus } = terminal;
  let now = 0, session = randomUUID(), statusReads = 0, status = { canPrepare: true, prepared: true, sessionId: session, phase: 'waiting' }, phone = 'idle';
  vm.runInNewContext(workerSource, { window, crypto: { randomUUID }, setInterval, clearInterval, document: { getElementById: () => ({}) } });
  const api = async (path, body) => {
    if (path === '/campaigns-api/' + f.id && !body) return f.store.read(f.id);
    const bits = path.split('/').slice(3), op = bits.at(-1), id = bits.length > 1 ? bits[0] : undefined;
    switch (op) {
      case 'start': return f.store.start(f.id, body.workerId);
      case 'heartbeat': return f.store.heartbeat(f.id, body.workerId);
      case 'pause': return f.store.pause(f.id, body.workerId);
      case 'next': return f.store.claim(f.id, body.workerId);
      case 'dispatch': return f.store.dispatch(f.id, id, body.workerId, body.session);
      case 'defer': return f.store.defer(f.id, id, body.workerId, body.message);
      case 'transcript': return f.store.transcript(f.id, id, body.workerId, body);
      case 'finish': return f.store.finish(f.id, id, body.workerId, body.outcome, body.diagnostic);
      default: throw new Error('Unexpected API path ' + path);
    }
  };
  const audio = { configure(options) { this.options = options; status = { canPrepare: true, prepared: true, sessionId: randomUUID(), phase: 'waiting' }; }, startRecording() { commands.push('record'); }, pair() {}, async prepare() {}, status: () => status, async stop() { status = { ...status, phase: 'stopped', stopping: false }; } };
  const driver = async (command, data) => {
    commands.push(command);
    if (command === 'contact' && importNotReady) throw new Error('CRM import not ready: synthetic contact is still processing.');
    if (command === 'dial') { dialPayloads.push(data); phone = 'active'; statusReads = 0; if (failDial) throw new Error('Lost acknowledgement'); status = { ...status, phase: phoneEndsAfterPoll ? 'waiting' : 'stopped', humanAnswered: true, conversationOutcome: 'completed', ...terminalStatus }; }
    if (command === 'note') { notePayloads.push(data); if (failNote) throw new Error('CRM note save rejected'); }
    if (command === 'hangup') phone = 'ended';
    if (command === 'status') {
      if (phoneEndsAfterPoll && phone === 'active' && statusReads++ > 0) phone = 'ended';
      return { state: phone };
    }
    return {};
  };
  const worker = new window.SalesGodCampaignWorker({ api, audio, driver, onState: s => states.push(s.state), wait: async ms => { now += ms; }, now: () => now });
  return { ...f, worker, commands, dialPayloads, notePayloads, states, audio };
}
test('simulated list finishes sequentially, saves transcripts and notifies without touching audio or dialer', async () => {
  const f = workerFixture(); try {
    await f.worker.run(f.id); assert.equal(f.store.read(f.id).state, 'finished'); assert.equal(f.commands.length, 0);
    assert.deepEqual(f.store.read(f.id).contacts.map(c => c.state), ['completed', 'voicemail_played']);
    assert.equal(f.store.transcripts(f.id, f.store.read(f.id).contacts[0].id).length, 2); assert.equal(f.states.at(-1), 'finished');
  } finally { f.store.close(); }
});
test('workspace mode mismatch cannot start a list or touch the dialer', async () => {
  for (const simulation of [true, false]) {
    const f = workerFixture(simulation);
    try {
      f.worker.expectedSimulation = !simulation;
      await assert.rejects(f.worker.run(f.id), /correct workspace/);
      assert.equal(f.store.read(f.id).state, 'draft'); assert.equal(f.commands.length, 0);
    } finally { f.store.close(); }
  }
});
test('saved list filters separate real calls and rehearsals without changing prior records', async () => {
  const f = fixture(true); const live = f.store.create({ name: 'Real draft', csv, settings: { ...settings, simulation: false } });
  const app = createBridge({ campaignStore: f.store, env: {} });
  try {
    const headers = { host: '127.0.0.1:28431' };
    const real = (await app.inject({ url: '/campaigns-api?mode=live', headers })).json().campaigns;
    const practice = (await app.inject({ url: '/campaigns-api?mode=rehearsal', headers })).json().campaigns;
    assert.deepEqual(real.map(c => c.id), [live.id]); assert.deepEqual(practice.map(c => c.id), [f.id]);
    assert.equal((await app.inject({ url: '/campaigns-api?mode=invalid', headers })).statusCode, 400);
    assert.equal(f.store.list().length, 2);
  } finally { await app.close(); f.store.close(); }
});
test('AI rehearsal runs sequentially, persists agent replies, and never touches real audio or CRM', async () => {
  const f = workerFixture(); const seen = [];
  f.store.db.prepare('UPDATE campaigns SET settings=? WHERE id=?').run(JSON.stringify({ ...settings, simulation: true, simulationMode: 'agents' }), f.id);
  f.audio.stop = async () => { throw new Error('Real audio must not be used'); };
  f.worker.rehearsal = { async run(options) {
    seen.push(options.contact.id);
    for (const [speaker, text] of [['assistant', 'What works for you?'], ['customer', 'A fictional afternoon.']]) await options.saveTurn({ session: options.session, item: speaker, speaker, text });
    return 'completed';
  } };
  try {
    await f.worker.run(f.id); const c = f.store.read(f.id);
    assert.deepEqual(seen, c.contacts.map(x => x.id)); assert.equal(f.commands.length, 0);
    assert.equal(c.state, 'finished'); for (const row of c.contacts) assert.equal(f.store.transcripts(f.id, row.id).length, 2);
  } finally { f.store.close(); }
});
test('AI rehearsal failure and Stop preserve pending rows and avoid even CRM release commands', async () => {
  for (const mode of ['fail', 'stop']) {
    const f = workerFixture(); let stopped = false;
    f.store.db.prepare('UPDATE campaigns SET settings=? WHERE id=?').run(JSON.stringify({ ...settings, simulation: true, simulationMode: 'agents' }), f.id);
    f.audio.stop = async () => { throw new Error('Real audio must not be used'); };
    f.worker.rehearsal = { stop() { stopped = true; }, async run() { if (mode === 'fail') throw new Error('API unavailable'); await f.worker.stop(); return 'cancelled'; } };
    try {
      await f.worker.run(f.id); const c = f.store.read(f.id);
      assert.deepEqual(c.contacts.map(x => x.state), [mode === 'fail' ? 'failed' : 'cancelled', 'pending']);
      assert.equal(c.state, 'paused'); assert.equal(f.commands.length, 0); assert.equal(stopped, true);
    } finally { f.store.close(); }
  }
});
test('fake live driver hangs up before next dispatch, and lost dispatch acknowledgement pauses without retry', async () => {
  const f = workerFixture(false, false, { callDisposition: 'meeting_set' }); try {
    await f.worker.run(f.id); assert.equal(f.commands.filter(x => x === 'dial').length, 2);
    assert.deepEqual(f.dialPayloads.map(({ firstName, lastName }) => ({ firstName, lastName })), [{ firstName: 'Alex', lastName: 'Example' }, { firstName: 'Sam', lastName: 'Example' }]);
    assert.deepEqual(f.notePayloads.map(({ outcome, disposition }) => ({ outcome, disposition })), [
      { outcome: 'completed', disposition: 'meeting_set' }, { outcome: 'completed', disposition: 'meeting_set' },
    ]);
    const dial = f.commands.indexOf('dial'), note = f.commands.indexOf('note', dial), release = f.commands.indexOf('release', note), next = f.commands.indexOf('dial', dial + 1);
    assert.ok(f.commands.indexOf('hangup', dial) < note); assert.ok(note < release && release < next); assert.equal(f.states.at(-1), 'finished');
  } finally { f.store.close(); }
  const uncertain = workerFixture(false, true); try {
    await uncertain.worker.run(uncertain.id); assert.equal(uncertain.commands.filter(x => x === 'dial').length, 1);
    assert.deepEqual(uncertain.store.read(uncertain.id).contacts.map(c => c.state), ['unknown', 'pending']); assert.equal(uncertain.store.read(uncertain.id).state, 'paused');
  } finally { uncertain.store.close(); }
});
test('unfinished CRM import returns the uncalled contact to pending and pauses before preparation or dispatch', async () => {
  const f = workerFixture(false, false, { importNotReady: true });
  try {
    await f.worker.run(f.id); const list = f.store.read(f.id);
    assert.deepEqual(list.contacts.map(contact => contact.state), ['pending', 'pending']);
    assert.equal(list.state, 'paused'); assert.deepEqual(f.commands, ['inspect', 'contact']);
    assert.ok(list.events.some(event => event.event === 'crm_import_waiting'));
    assert.ok(list.events.some(event => /failure_detail: CRM import not ready/.test(event.event)));
    assert.ok(f.states.includes('import_waiting'));
  } finally { f.store.close(); }
});
test('voicemail and no-answer outcomes are written to CRM notes before the list advances', async () => {
  for (const [terminal, expected] of [
    [{ voicemailOutcome: 'playback_completed', humanAnswered: false, conversationOutcome: undefined }, 'voicemail_played'],
    [{ humanAnswered: false, conversationOutcome: undefined, customerTurns: 0, phoneEndsAfterPoll: true }, 'no_answer'],
  ]) {
    const f = workerFixture(false, false, terminal);
    try { await f.worker.run(f.id); assert.deepEqual(f.notePayloads.map(item => item.outcome), [expected, expected]); }
    finally { f.store.close(); }
  }
});
test('an unconfirmed CRM note pauses after the call and preserves pending contacts', async () => {
  const f = workerFixture(false, false, { callDisposition: 'follow_up' }, true);
  try {
    await f.worker.run(f.id); const list = f.store.read(f.id);
    assert.equal(f.notePayloads.length, 1); assert.equal(f.notePayloads[0].disposition, 'follow_up');
    assert.deepEqual(list.contacts.map(contact => contact.state), ['needs_review', 'pending']);
    assert.match(list.events.find(event => /failure_detail/.test(event.event))?.event || '', /CRM note save rejected/);
    assert.equal(list.state, 'paused');
  } finally { f.store.close(); }
});
test('real worker starts recording before dialing, and stops the list if MP3 saving fails', async () => {
  const f = workerFixture(false, false, { recordingState: 'failed', stopReason: 'Call recording could not be saved' });
  try {
    await f.worker.run(f.id);
    assert.equal(typeof f.audio.options.saveRecording, 'function');
    assert.ok(f.commands.indexOf('record') < f.commands.indexOf('dial'));
    assert.equal(f.commands.filter(c => c === 'dial').length, 1);
    assert.deepEqual(f.store.read(f.id).contacts.map(c => c.state), ['needs_review', 'pending']);
    assert.equal(f.store.read(f.id).state, 'paused');
  } finally { f.store.close(); }
});
test('recorder startup failure prevents the phone side effect', async () => {
  const f = workerFixture(false);
  f.audio.startRecording = () => { throw new Error('Recorder unavailable'); };
  try {
    await f.worker.run(f.id);
    assert.equal(f.commands.includes('dial'), false);
    assert.equal(f.store.read(f.id).contacts[1].state, 'pending');
  } finally { f.store.close(); }
});
test('needs-review preserves the specific pause reason before generic audio cleanup', async () => {
  const f = workerFixture(false, false, { phase: 'paused', reviewReason: 'Speech after voicemail could not be confirmed · review required' });
  try {
    await f.worker.run(f.id);
    const list = f.store.read(f.id);
    assert.equal(list.contacts[0].state, 'needs_review');
    assert.ok(list.events.some(e => e.event.includes('failure_detail: Speech after voicemail could not be confirmed')));
  } finally { f.store.close(); }
});
test('phone hangup does not wait for encoding, but finishing and next dispatch wait for MP3 saving', async () => {
  const f = workerFixture(false, false, { audioStopped: true, stopping: true }); let release, stops = 0;
  const pending = new Promise(resolve => { release = resolve; }), stop = f.audio.stop;
  f.audio.stop = async () => { if (stops++ === 0) await pending; return stop(); };
  try {
    const task = f.worker.run(f.id);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.commands.filter(c => c === 'dial').length, 1);
    assert.ok(f.commands.includes('hangup'));
    assert.deepEqual(f.store.read(f.id).contacts.map(c => c.state), ['dispatching', 'pending']);
    release(); await task;
    assert.deepEqual(f.store.read(f.id).contacts.map(c => c.state), ['completed', 'completed']);
  } finally { release(); f.store.close(); }
});
test('unconfirmed late human pickup overrides voicemail playback and pauses before the next contact', async () => {
  const f = workerFixture(false, false, { voicemailOutcome: 'playback_completed', takeoverPending: true });
  try {
    await f.worker.run(f.id); assert.equal(f.commands.filter(c => c === 'dial').length, 1);
    assert.deepEqual(f.store.read(f.id).contacts.map(c => c.state), ['needs_review', 'pending']);
    assert.equal(f.store.read(f.id).state, 'paused');
  } finally { f.store.close(); }
});
