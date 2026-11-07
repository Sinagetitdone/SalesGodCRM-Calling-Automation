import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../campaign-driver.js', import.meta.url), 'utf8');
const attempt = '11111111-1111-4111-8111-111111111111', phone = '+12025550101', caller = '+12025550100';
function fixture({ missingInput = false, disabledCall = false, wrongEcho = false, clickFails = false, path = '/dashboard' } = {}) {
  let state = 'idle', target = phone, calls = 0, hangups = 0, view = 'Keypad';
  class Input { constructor() { this.stored = ''; this.events = []; } get value() { return this.stored; } set value(v) { this.stored = wrongEcho ? '+12025550199' : v; } dispatchEvent(e) { this.events.push(e.type); } }
  const input = new Input(), mic = { options: [{ value: 'salesgod-ai-bridge-local-v1' }], dispatchEvent() {} }, from = { options: [{ value: 'caller', textContent: '+1 202-555-0100' }], dispatchEvent() {} };
  const button = (text, click = () => {}) => ({ textContent: text, getAttribute: () => null, click });
  const call = { ...button('Call', () => { calls++; state = 'dialing'; if (clickFails) throw new Error('Uncertain click'); }), disabled: disabledCall };
  const end = button('End call', () => { hangups++; state = 'idle'; });
  const panel = { textContent: 'Ready', querySelectorAll(selector) {
    if (selector === 'h5') return state === 'idle' ? [] : [{ textContent: target }];
    return selector === 'button' ? [button('Calls' + (state === 'idle' ? '' : ' 1')), button('Settings', () => { view = 'Settings'; }), button('Keypad', () => { view = 'Keypad'; }), ...(state === 'idle' ? [call] : [end])] : [];
  }, querySelector(selector) { return ({ '#contactNumber': view === 'Keypad' && !missingInput ? input : null, '#call-microphone': view === 'Settings' ? mic : null, '#calling-number': view === 'Keypad' ? from : null })[selector]; } };
  const window = { HTMLInputElement: Input }, location = { pathname: path };
  const document = { defaultView: window, getElementById: id => id === 'page-header-call-control-dropdown' ? { getAttribute: () => 'true' } : id === 'call-control-panel' ? panel : null,
    querySelector() { throw new Error('Contact page accessed'); }, querySelectorAll() { throw new Error('Contact page accessed'); } };
  vm.runInNewContext(source, { window, document, location, Event });
  return { driver: new window.SalesGodCampaignDialer(document), input, mic, from, panel, state(s, t = phone) { state = s; target = t; }, counts: () => ({ calls, hangups }) };
}
test('global keypad works on all CRM pages without contacts and releases only the owned phone call', async () => {
  for (const path of ['/dashboard', '/contacts', '/calendar', '/messenger']) {
    const f = fixture({ path }); await f.driver.dial({ attempt, phone, caller });
    assert.equal(f.input.value, phone); assert.deepEqual(f.input.events, ['input', 'change']);
    assert.equal(f.mic.value, 'salesgod-ai-bridge-local-v1'); assert.equal(f.from.value, 'caller');
    assert.equal((await f.driver.status()).state, 'active'); assert.equal(f.counts().calls, 1);
    await f.driver.hangup(attempt); await f.driver.release(attempt); assert.equal((await f.driver.status()).state, 'idle');
  }
});
test('missing number field, wrong echoed number or disabled Call prevents dispatch', async () => {
  for (const options of [{ missingInput: true }, { wrongEcho: true }, { disabledCall: true }]) {
    const f = fixture(options); await assert.rejects(f.driver.dial({ attempt, phone, caller }));
    assert.equal(f.counts().calls, 0); assert.equal(f.driver.owned, null);
  }
});
test('busy or disconnected phone, missing bridge microphone and wrong caller prevent dispatch', async () => {
  for (const condition of ['busy', 'offline', 'mic', 'caller']) {
    const f = fixture();
    if (condition === 'busy') f.state('active'); if (condition === 'offline') f.panel.textContent = 'Phone connection closed';
    if (condition === 'mic') f.mic.options = []; if (condition === 'caller') f.from.options = [];
    await assert.rejects(f.driver.dial({ attempt, phone, caller })); assert.equal(f.counts().calls, 0);
  }
});
test('uncertain keypad click consumes the attempt and cannot redial', async () => {
  const f = fixture({ clickFails: true }); await assert.rejects(f.driver.dial({ attempt, phone, caller }), /Uncertain click/);
  await assert.rejects(f.driver.dial({ attempt, phone, caller }), /already been dispatched/); assert.equal(f.counts().calls, 1);
});
test('foreign number or name-only target cannot be treated as the owned call', async () => {
  for (const target of ['+12025550199', 'Test Person']) {
    const f = fixture(); await f.driver.dial({ attempt, phone, caller }); f.state('active', target);
    assert.equal((await f.driver.status()).state, 'unknown'); await assert.rejects(f.driver.hangup(attempt), /identity is uncertain/);
    await f.driver.release(attempt); assert.ok(f.driver.owned); assert.equal(f.counts().hangups, 0);
  }
});
test('invalid number and foreign attempt cannot dial or hang up', async () => {
  const f = fixture(); await assert.rejects(f.driver.dial({ attempt, phone: 'invalid', caller })); assert.equal(f.counts().calls, 0);
  await f.driver.dial({ attempt, phone, caller }); await assert.rejects(f.driver.hangup('22222222-2222-4222-8222-222222222222'), /does not own/); assert.equal(f.counts().hangups, 0);
});
