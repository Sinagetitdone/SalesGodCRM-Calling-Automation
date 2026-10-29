import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../campaign-driver.js', import.meta.url), 'utf8');
const attempt = '11111111-1111-4111-8111-111111111111', phone = '+12025550101', caller = '+12025550100';
const digits = value => String(value || '').replace(/\D/g, '');
function fixture() {
  let state = 'idle', target = phone, calls = 0, hangups = 0, view = 'Keypad', time = 0, formMode = '', editing;
  class Input { constructor(value = '') { this.saved = value; this.tagName = 'INPUT'; } get value() { return this.saved; } set value(v) { this.saved = v; } dispatchEvent() {} }
  const location = { pathname: '/contacts' }, window = { location, HTMLInputElement: Input, HTMLTextAreaElement: Input };
  const input = new Input(), mic = { value: 'physical', options: [{ value: 'physical' }, { value: 'salesgod-ai-bridge-local-v1' }], dispatchEvent() {} }, from = { value: '', options: [{ value: 'caller', textContent: '+1 202-555-0100' }], dispatchEvent() {} };
  const button = (text, click = () => {}) => ({ textContent: text, disabled: false, getAttribute: () => null, click });
  const call = button('Call', () => { calls++; state = 'dialing'; }), end = button('End call', () => { hangups++; state = 'idle'; });
  const panel = { textContent: 'Ready', querySelectorAll(selector) {
    if (selector === 'h5') return state === 'idle' ? [] : [{ textContent: target }];
    if (selector !== 'button') return [];
    return [button('Calls' + (state === 'idle' ? '' : ' 1')), button('Keypad', () => { view = 'Keypad'; }), button('Settings', () => { view = 'Settings'; }), ...(state === 'idle' ? [call] : [end])];
  }, querySelector(selector) { return ({ '#contactNumber': input, '#calling-number': from, '#call-microphone': mic })[selector]; } };
  const contacts = [{ phone, firstName: 'Test', lastName: 'Person' }], search = new Input();
  const noRows = { textContent: 'No matching records found', querySelectorAll: selector => selector === 'td' ? [{}] : [], querySelector: () => null };
  const rowFor = contact => {
    const cells = Array.from({ length: 12 }, () => ({ textContent: '' })); cells[1].textContent = `${contact.firstName} ${contact.lastName}`.trim(); cells[3].textContent = contact.phone;
    const edit = { click() { formMode = 'edit'; editing = contact; makeForm(contact); } };
    return { textContent: cells.map(cell => cell.textContent).join(' '), querySelectorAll: selector => selector === 'td' ? cells : [], querySelector: selector => selector === 'a[title="Edit"]' ? edit : null };
  };
  let form;
  function makeForm(contact = { phone: '', firstName: '', lastName: '' }) {
    const first = new Input(contact.firstName), last = new Input(contact.lastName), contactPhone = new Input(contact.phone);
    const submit = button(formMode === 'add' ? 'Add Contact' : 'Save', () => {
      if (formMode === 'add') contacts.push({ phone: contactPhone.value, firstName: first.value, lastName: last.value });
      else Object.assign(editing, { firstName: first.value, lastName: last.value });
      form = null; formMode = ''; editing = null;
    });
    form = { first, querySelector: selector => ({ '#last_name': last, '#phone': contactPhone })[selector] || null,
      querySelectorAll: selector => selector === 'button' ? [submit] : [] };
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
  return { driver: new window.SalesGodCampaignDialer(document, { wait: async ms => { time += ms; }, now: () => time }), contacts, location, mic, from, input, call, setState(s, t = phone) { state = s; target = t; }, counts: () => ({ calls, hangups }), panel };
}
test('synthetic DOM dispatch uses generated microphone, verifies target, deduplicates and hangs up owned call only', async () => {
  const f = fixture(); await f.driver.dial({ attempt, phone, caller, firstName: 'Test', lastName: 'Person' });
  assert.equal(f.mic.value, 'salesgod-ai-bridge-local-v1'); assert.equal(f.input.value, phone); assert.equal(f.counts().calls, 1);
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
test('a Call button disabled on an empty input is checked after entering the target; a still-disabled button never dispatches', async () => {
  const f = fixture(); f.call.disabled = true;
  f.input.dispatchEvent = () => { f.call.disabled = !f.input.value; };
  await f.driver.dial({ attempt, phone, caller, firstName: 'Test', lastName: 'Person' }); assert.equal(f.counts().calls, 1);
  const blocked = fixture(); blocked.call.disabled = true;
  await assert.rejects(blocked.driver.dial({ attempt, phone, caller, firstName: 'Test', lastName: 'Person' })); assert.equal(blocked.counts().calls, 0);
});

test('contact name is updated before dialing and a missing contact is created with first and last name', async () => {
  const updated = fixture();
  await updated.driver.dial({ attempt, phone, caller, firstName: 'Correct', lastName: 'Name' });
  assert.deepEqual(updated.contacts[0], { phone, firstName: 'Correct', lastName: 'Name' });

  const created = fixture(), newPhone = '+12025550155', newAttempt = '22222222-2222-4222-8222-222222222222';
  await created.driver.dial({ attempt: newAttempt, phone: newPhone, caller, firstName: 'New', lastName: 'Contact' });
  assert.deepEqual(created.contacts.find(contact => contact.phone === newPhone), { phone: newPhone, firstName: 'New', lastName: 'Contact' });
});

test('calling from outside Contacts or without a first name fails before dispatch', async () => {
  const wrongPage = fixture(); wrongPage.location.pathname = '/dashboard';
  await assert.rejects(wrongPage.driver.dial({ attempt, phone, caller, firstName: 'Test', lastName: 'Person' }), /Open SalesGodCRM Contacts/);
  assert.equal(wrongPage.counts().calls, 0);
  const missingName = fixture();
  await assert.rejects(missingName.driver.dial({ attempt, phone, caller, firstName: '', lastName: '' }), /Invalid contact details/);
  assert.equal(missingName.counts().calls, 0);
});
