import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../campaign-driver.js', import.meta.url), 'utf8');
const attempt = '11111111-1111-4111-8111-111111111111', phone = '+12025550101', caller = '+12025550100';
function fixture() {
  const window = {}; let state = 'idle', target = phone, calls = 0, hangups = 0, view = 'Keypad';
  class Input { get value() { return this.saved; } set value(v) { this.saved = v; } dispatchEvent() {} }
  const input = new Input(), mic = { value: 'physical', options: [{ value: 'physical' }, { value: 'salesgod-ai-bridge-local-v1' }], dispatchEvent() {} }, from = { value: '', options: [{ value: 'caller', textContent: '+1 202-555-0100' }], dispatchEvent() {} };
  const button = (text, click = () => {}) => ({ textContent: text, disabled: false, getAttribute: () => null, click });
  const call = button('Call', () => { calls++; state = 'dialing'; }), end = button('End call', () => { hangups++; state = 'idle'; });
  const panel = { textContent: 'Ready', querySelectorAll(selector) {
    if (selector === 'h5') return state === 'idle' ? [] : [{ textContent: target }];
    if (selector !== 'button') return [];
    return [button('Calls' + (state === 'idle' ? '' : ' 1')), button('Keypad', () => { view = 'Keypad'; }), button('Settings', () => { view = 'Settings'; }), ...(state === 'idle' ? [call] : [end])];
  }, querySelector(selector) { return ({ '#contactNumber': input, '#calling-number': from, '#call-microphone': mic })[selector]; } };
  const document = { getElementById: id => id === 'page-header-call-control-dropdown' ? { getAttribute: () => 'true' } : id === 'call-control-panel' ? panel : null };
  vm.runInNewContext(source, { window, document, HTMLInputElement: Input, Event });
  return { driver: new window.SalesGodCampaignDialer(document), mic, from, input, call, setState(s, t = phone) { state = s; target = t; }, counts: () => ({ calls, hangups }), panel };
}
test('synthetic DOM dispatch uses generated microphone, verifies target, deduplicates and hangs up owned call only', async () => {
  const f = fixture(); await f.driver.dial({ attempt, phone, caller });
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
    await assert.rejects(f.driver.dial({ attempt, phone, caller })); assert.equal(f.counts().calls, 0);
    await assert.rejects(f.driver.hangup(attempt)); assert.equal(f.counts().hangups, 0);
  }
});
test('target mismatch after dispatch prevents hanging up a foreign or uncertain call', async () => {
  const f = fixture(); await f.driver.dial({ attempt, phone, caller }); f.setState('active', '+12025550109');
  assert.equal((await f.driver.status()).state, 'unknown'); await assert.rejects(f.driver.hangup(attempt), /identity is uncertain/); assert.equal(f.counts().hangups, 0);
});
test('a Call button disabled on an empty input is checked after entering the target; a still-disabled button never dispatches', async () => {
  const f = fixture(); f.call.disabled = true;
  f.input.dispatchEvent = () => { f.call.disabled = !f.input.value; };
  await f.driver.dial({ attempt, phone, caller }); assert.equal(f.counts().calls, 1);
  const blocked = fixture(); blocked.call.disabled = true;
  await assert.rejects(blocked.driver.dial({ attempt, phone, caller })); assert.equal(blocked.counts().calls, 0);
});
