import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../campaign-driver.js', import.meta.url), 'utf8');
const attempt = '11111111-1111-4111-8111-111111111111', phone = '+12025550101', caller = '+12025550100';
const digits = value => String(value || '').replace(/\D/g, '');
function fixture({ persistNotes = true } = {}) {
  let state = 'idle', target = phone, calls = 0, hangups = 0, view = 'Keypad', time = 0, formMode = '', editing;
  class Input { constructor(value = '') { this.saved = value; this.tagName = 'INPUT'; } get value() { return this.saved; } set value(v) { this.saved = v; } dispatchEvent() {} }
  const location = { pathname: '/contacts' }, window = { location, HTMLInputElement: Input, HTMLTextAreaElement: Input };
  const input = new Input(), mic = { value: 'physical', options: [{ value: 'physical' }, { value: 'salesgod-ai-bridge-local-v1' }], dispatchEvent() {} }, from = { value: '', options: [{ value: 'caller', textContent: '+1 202-555-0100' }], dispatchEvent() {} };
  const button = (text, click = () => {}) => ({ textContent: text, disabled: false, getAttribute: () => null, click });
  const keypadCall = button('Call'), end = button('End call', () => { hangups++; state = 'idle'; });
  const panel = { textContent: 'Ready', querySelectorAll(selector) {
    if (selector === 'h5') return state === 'idle' ? [] : [{ textContent: target }];
    if (selector !== 'button') return [];
    return [button('Calls' + (state === 'idle' ? '' : ' 1')), button('Keypad', () => { view = 'Keypad'; }), button('Settings', () => { view = 'Settings'; }), ...(state === 'idle' ? [keypadCall] : [end])];
  }, querySelector(selector) { return ({ '#contactNumber': input, '#calling-number': from, '#call-microphone': mic })[selector]; } };
  const contacts = [{ phone, firstName: 'Test', lastName: 'Person', notes: 'Existing owner note' }], search = new Input();
  const noRows = { textContent: 'No matching records found', querySelectorAll: selector => selector === 'td' ? [{}] : [], querySelector: () => null };
  const rowFor = contact => {
    const cells = Array.from({ length: 12 }, () => ({ textContent: '' })); cells[1].textContent = `${contact.firstName} ${contact.lastName}`.trim(); cells[3].textContent = contact.phone;
    const edit = { click() { formMode = 'edit'; editing = contact; makeForm(contact); } };
    const rowCall = button('Call', () => { calls++; state = 'dialing'; target = `${contact.firstName} ${contact.lastName}`.trim(); });
    const inlineNotes = { value: contact.notes || '' };
    return { textContent: cells.map(cell => cell.textContent).join(' '), querySelectorAll: selector => selector === 'td' ? cells : [],
      querySelector: selector => selector === 'a[title="Edit"]' ? edit : selector === 'button[title="Call"],button[aria-label="Call"]' ? rowCall : selector === 'textarea' ? inlineNotes : null };
  };
  let form;
  function makeForm(contact = { phone: '', firstName: '', lastName: '', notes: '' }) {
    const first = new Input(contact.firstName), last = new Input(contact.lastName), contactPhone = new Input(contact.phone), notes = new Input(contact.notes || ''); notes.tagName = 'TEXTAREA';
    const submit = button(formMode === 'add' ? 'Add Contact' : 'Save', () => {
      if (formMode === 'add') contacts.push({ phone: contactPhone.value, firstName: first.value, lastName: last.value, notes: notes.value });
      else Object.assign(editing, { firstName: first.value, lastName: last.value, ...(persistNotes ? { notes: notes.value } : {}) });
      form = null; formMode = ''; editing = null;
    });
    const close = button('Close', () => { form = null; formMode = ''; editing = null; }), notesTab = button('Tags & Notes');
    form = { first, querySelector: selector => ({ '#last_name': last, '#phone': contactPhone, '#notes': notes })[selector] || null,
      querySelectorAll: selector => selector === 'button' ? [notesTab, close, submit] : [] };
    first.closest = selector => selector === 'form' ? form : null;
  }
  const add = button('Add Contact', () => { formMode = 'add'; makeForm(); }); add.closest = () => null;
  const table = { textContent: '' };
  const rows = () => {
    const query = digits(search.value); const matching = contacts.filter(contact => !query || digits(contact.phone) === query);
    return matching.length ? matching.map(rowFor) : [noRows];
  };
  const document = { defaultView: window,
    getElementById: id => id === 'page-header-call-control-dropdown' ? { getAttribute: () => 'true' } : id === 'call-control-panel' ? panel : null,
    querySelector: selector => ({ '#dt_main_search': search, '#contactTable': table, '#first_name': form?.first || null })[selector] || null,
    querySelectorAll: selector => selector === '#contactTable tbody tr' ? rows() : selector === 'button' ? [add] : [] };
  vm.runInNewContext(source, { window, document, location, HTMLInputElement: Input, Event, setTimeout });
  return { driver: new window.SalesGodCampaignDialer(document, { wait: async ms => { time += ms; }, now: () => time }), contacts, location, mic, from, input, setState(s, t = phone) { state = s; target = t; }, counts: () => ({ calls, hangups }), panel };
}
test('synthetic DOM dispatch uses the imported contact row, generated microphone, verified name and owned hangup', async () => {
  const f = fixture(); await f.driver.dial({ attempt, phone, caller, firstName: 'Test', lastName: 'Person' });
  assert.equal(f.mic.value, 'salesgod-ai-bridge-local-v1'); assert.equal(f.input.value, ''); assert.equal(f.counts().calls, 1);
  assert.equal((await f.driver.status()).state, 'active', 'the CRM may identify the live target by imported name');
  await assert.rejects(f.driver.dial({ attempt, phone, caller }), /already been dispatched/);
  await f.driver.hangup(attempt); assert.equal(f.counts().hangups, 1); assert.equal((await f.driver.status()).state, 'ended');
  await f.driver.release(attempt); assert.equal((await f.driver.status()).state, 'idle');
});
test('another active call, unavailable phone, missing bridge mic or wrong caller prevents dispatch', async () => {
  for (const condition of ['busy', 'offline', 'mic', 'caller']) {
    const f = fixture();
    if (condition === 'busy') f.setState('active');
    if (condition === 'offline') f.panel.textContent = 'Phone connection closed';
    if (condition === 'mic') f.mic.options = [];
    if (condition === 'caller') f.from.options = [];
    await assert.rejects(f.driver.dial({ attempt, phone, caller, firstName: 'Test', lastName: 'Person' })); assert.equal(f.counts().calls, 0);
    await assert.rejects(f.driver.hangup(attempt)); assert.equal(f.counts().hangups, 0);
  }
});
test('target mismatch after dispatch prevents hanging up a foreign or uncertain call', async () => {
  const f = fixture(); await f.driver.dial({ attempt, phone, caller, firstName: 'Test', lastName: 'Person' }); f.setState('active', '+12025550109');
  assert.equal((await f.driver.status()).state, 'unknown'); await assert.rejects(f.driver.hangup(attempt), /identity is uncertain/); assert.equal(f.counts().hangups, 0);
});
test('a missing imported contact or name mismatch blocks before dialing and never edits CRM', async () => {
  const mismatch = fixture();
  await assert.rejects(mismatch.driver.dial({ attempt, phone, caller, firstName: 'Correct', lastName: 'Name' }), /not “Correct Name”/);
  assert.deepEqual(mismatch.contacts[0], { phone, firstName: 'Test', lastName: 'Person', notes: 'Existing owner note' });
  assert.equal(mismatch.counts().calls, 0);

  const missing = fixture(), newPhone = '+12025550155', newAttempt = '22222222-2222-4222-8222-222222222222';
  await assert.rejects(missing.driver.dial({ attempt: newAttempt, phone: newPhone, caller, firstName: 'New', lastName: 'Contact' }), /not available in SalesGodCRM yet/);
  assert.equal(missing.contacts.find(contact => contact.phone === newPhone), undefined); assert.equal(missing.counts().calls, 0);
});

test('post-call status appends to existing CRM notes, verifies the save and retains ownership until release', async () => {
  const f = fixture(); f.contacts[0].notes = 'Existing owner note\n\n';
  await f.driver.dial({ attempt, phone, caller, firstName: 'Test', lastName: 'Person' });
  f.setState('idle'); await f.driver.hangup(attempt);
  const saved = await f.driver.saveNote({ attempt, phone, outcome: 'completed', disposition: 'meeting_set' });
  assert.equal(saved.saved, true); assert.equal(saved.status, 'Meeting set');
  assert.match(f.contacts[0].notes, /^Existing owner note\n\n\[AI call 1970-01-01T00:00:00\.000Z\] Status: Meeting set$/);
  assert.equal((await f.driver.status()).state, 'ended');
  await f.driver.release(attempt); assert.equal((await f.driver.status()).state, 'idle');
});

test('unsupported status and wrong call ownership cannot change CRM notes', async () => {
  const f = fixture(); await f.driver.dial({ attempt, phone, caller, firstName: 'Test', lastName: 'Person' });
  await assert.rejects(f.driver.saveNote({ attempt: '22222222-2222-4222-8222-222222222222', phone, outcome: 'completed' }), /does not own/);
  await assert.rejects(f.driver.saveNote({ attempt, phone, outcome: 'completed' }), /has not ended/);
  f.setState('idle');
  await assert.rejects(f.driver.saveNote({ attempt, phone, outcome: 'invented' }), /Unsupported call status/);
  assert.equal(f.contacts[0].notes, 'Existing owner note');
});

test('every supported technical and business outcome has a deterministic CRM note label', async () => {
  const cases = [
    ['completed', 'follow_up', 'Needs follow-up'], ['completed', 'not_interested', 'Not interested'], ['completed', 'wrong_number', 'Wrong number'],
    ['completed', undefined, 'Conversation completed'], ['opt_out', 'meeting_set', 'Opted out'], ['voicemail_played', undefined, 'Voicemail left'],
    ['no_answer', undefined, 'No answer'], ['needs_review', undefined, 'Needs review'], ['failed', undefined, 'Failed'],
    ['unknown', undefined, 'Unknown — manual review'], ['cancelled', undefined, 'Cancelled'],
  ];
  for (const [outcome, disposition, expected] of cases) {
    const f = fixture(); await f.driver.dial({ attempt, phone, caller, firstName: 'Test', lastName: 'Person' }); f.setState('idle');
    const result = await f.driver.saveNote({ attempt, phone, outcome, disposition });
    assert.equal(result.status, expected); assert.equal(f.contacts[0].notes.endsWith(`Status: ${expected}`), true);
  }
});

test('a CRM save that closes without retaining the note is detected and rejected', async () => {
  const f = fixture({ persistNotes: false }); await f.driver.dial({ attempt, phone, caller, firstName: 'Test', lastName: 'Person' }); f.setState('idle');
  await assert.rejects(f.driver.saveNote({ attempt, phone, outcome: 'completed', disposition: 'follow_up' }), /did not confirm/);
  assert.equal(f.contacts[0].notes, 'Existing owner note');
});

test('calling from outside Contacts or without a first name fails before dispatch', async () => {
  const wrongPage = fixture(); wrongPage.location.pathname = '/dashboard';
  await assert.rejects(wrongPage.driver.dial({ attempt, phone, caller, firstName: 'Test', lastName: 'Person' }), /Open SalesGodCRM Contacts/);
  assert.equal(wrongPage.counts().calls, 0);
  const missingName = fixture();
  await assert.rejects(missingName.driver.dial({ attempt, phone, caller, firstName: '', lastName: '' }), /Invalid contact details/);
  assert.equal(missingName.counts().calls, 0);
});
