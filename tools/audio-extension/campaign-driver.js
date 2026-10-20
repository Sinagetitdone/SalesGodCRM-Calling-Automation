/* SalesGodCRM DOM adapter. Selectors are from the inspected dialer, never a provider API. */
(() => {
  'use strict';
  const digits = value => String(value || '').replace(/\D/g, '');
  class Dialer {
    constructor(doc = document) { this.doc = doc; this.attempts = new Map(); this.owned = null; }
    async panel() {
      const toggle = this.doc.getElementById('page-header-call-control-dropdown');
      if (!toggle) throw new Error('CRM dialer is unavailable.');
      if (toggle.getAttribute('aria-expanded') !== 'true') { toggle.click(); await Promise.resolve(); }
      const panel = this.doc.getElementById('call-control-panel'); if (!panel) throw new Error('Open the CRM dialer first.'); return panel;
    }
    button(panel, label) { return [...panel.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === label || b.textContent.trim() === label); }
    async view(label) { const p = await this.panel(), b = this.button(p, label); if (!b) throw new Error('Dialer layout changed.'); b.click(); await Promise.resolve(); return this.panel(); }
    busy(panel) { return [...panel.querySelectorAll('button')].some(b => /^Calls\s*[1-9]/.test(b.textContent.trim())) || Boolean(this.button(panel, 'End call') || this.button(panel, 'End dialing call')); }
    async inspect() {
      const p = await this.panel();
      if (/Unavailable|Phone connection closed/i.test(p.textContent)) throw new Error('Reconnect the CRM phone before starting a list.');
      if (this.busy(p) && !this.owned) throw new Error('Another call is active.');
      return this.status();
    }
    async configure(caller) {
      if (this.busy(await this.panel())) throw new Error('A call is already active.');
      let p = await this.view('Settings'), mic = p.querySelector('#call-microphone');
      if (!mic || ![...mic.options].some(o => o.value === 'salesgod-ai-bridge-local-v1')) throw new Error('Refresh CRM devices and select the bridge microphone.');
      mic.value = 'salesgod-ai-bridge-local-v1'; mic.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve(); p = await this.view('Keypad'); const from = p.querySelector('#calling-number');
      const option = from && [...from.options].find(o => digits(o.textContent).startsWith(digits(caller)));
      if (!option) throw new Error('The approved caller number is not available.');
      from.value = option.value; from.dispatchEvent(new Event('change', { bubbles: true }));
    }
    async dial({ attempt, phone, caller }) {
      if (!/^[a-f0-9-]{36}$/.test(attempt) || !/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Invalid call attempt.');
      if (this.attempts.has(attempt)) throw new Error('This attempt has already been dispatched; no retry.');
      await this.inspect(); await this.configure(caller); const p = await this.panel();
      if (this.busy(p)) throw new Error('A call is already active.');
      const input = p.querySelector('#contactNumber'), call = this.button(p, 'Call');
      if (!input || !call) throw new Error('Dialer is not ready.');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, phone);
      input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      if (digits(input.value) !== digits(phone) || call.disabled || this.busy(p)) throw new Error('Number verification failed or dialer became busy.');
      this.owned = { attempt, phone }; this.attempts.set(attempt, true);
      // Mark before the side effect. Uncertain results are never retried automatically.
      call.click(); return { dispatchAttempted: true };
    }
    async status() {
      const p = await this.panel(), active = this.busy(p);
      if (!this.owned) return { state: active ? 'other_call' : 'idle' };
      const target = [...p.querySelectorAll('h5')].some(h => digits(h.textContent) === digits(this.owned.phone));
      if (active && !target) return { state: 'unknown' };
      if (!active) return { state: 'ended', attempt: this.owned.attempt };
      return { state: this.button(p, 'End call') ? 'active' : 'dialing', attempt: this.owned.attempt };
    }
    async hangup(attempt) {
      if (!this.owned || this.owned.attempt !== attempt) throw new Error('This worker does not own that call.');
      const state = await this.status();
      if (state.state === 'ended') { this.owned = null; return { ended: true }; }
      if (!['active', 'dialing'].includes(state.state)) throw new Error('Call identity is uncertain; end it manually.');
      const p = await this.panel(), button = this.button(p, 'End call') || this.button(p, 'End dialing call');
      if (!button) throw new Error('Hangup control unavailable.'); button.click(); return { hangupAttempted: true };
    }
    async release(attempt) { if (this.owned?.attempt === attempt && (await this.status()).state === 'ended') this.owned = null; }
  }
  window.SalesGodCampaignDialer = Dialer;
})();
