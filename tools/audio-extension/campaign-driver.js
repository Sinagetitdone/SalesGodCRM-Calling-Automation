/* SalesGodCRM DOM adapter. Selectors are from the inspected dialer, never a provider API. */
(() => {
  'use strict';
  const digits = value => String(value || '').replace(/\D/g, '');
  const compact = value => String(value || '').trim().replace(/\s+/g, ' ');
  const nameKey = value => compact(value).toLocaleLowerCase();
  class Dialer {
    constructor(doc = document, { wait = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => Date.now() } = {}) {
      this.doc = doc; this.wait = wait; this.now = now; this.attempts = new Map(); this.owned = null;
    }
    async until(test, timeout = 10000, operation = 'CRM update') {
      const deadline = this.now() + timeout;
      while (this.now() <= deadline) {
        const result = test(); if (result) return result;
        await this.wait(100);
      }
      throw new Error(`${operation} timed out; no call was placed.`);
    }
    setInput(input, value) {
      if (!input) throw new Error('SalesGodCRM contact form changed; no call was placed.');
      const view = this.doc.defaultView || window;
      const prototype = input.tagName === 'TEXTAREA' ? view.HTMLTextAreaElement?.prototype : view.HTMLInputElement?.prototype;
      const setter = prototype && Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) setter.call(input, value); else input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    contactRows() { return [...this.doc.querySelectorAll('#contactTable tbody tr')]; }
    contactRow(phone) { return this.contactRows().find(row => digits(row.querySelectorAll('td')[3]?.textContent) === digits(phone)); }
    noContactRows() {
      const rows = this.contactRows();
      return rows.length === 1 && rows[0].querySelectorAll('td').length === 1 && /no|matching|record/i.test(rows[0].textContent || '');
    }
    async findContact(phone) {
      const search = this.doc.querySelector('#dt_main_search');
      if (!search || !this.doc.querySelector('#contactTable')) throw new Error('Open SalesGodCRM Contacts before starting the calling list so names can be saved.');
      this.setInput(search, phone);
      return this.until(() => this.contactRow(phone) || (this.noContactRows() ? { missing: true } : null), 12000, 'Contact lookup');
    }
    async contactForm(action) {
      return this.until(() => {
        const first = this.doc.querySelector('#first_name'), form = first?.closest('form');
        const submit = form && [...form.querySelectorAll('button')].find(button => compact(button.textContent) === action);
        return first && form && submit ? { first, last: form.querySelector('#last_name'), phone: form.querySelector('#phone'), form, submit } : null;
      }, 8000, `${action} form`);
    }
    async saveContact({ phone, firstName, lastName }) {
      const pageLocation = this.doc.defaultView?.location || location;
      if (pageLocation.pathname !== '/contacts') throw new Error('Open SalesGodCRM Contacts before starting the calling list so names can be saved.');
      firstName = compact(firstName); lastName = compact(lastName); const displayName = compact(`${firstName} ${lastName}`);
      if (!/^\+[1-9]\d{7,14}$/.test(phone) || !firstName || firstName.length > 100 || lastName.length > 100) throw new Error('Invalid contact details; no call was placed.');
      let row = await this.findContact(phone);
      if (row.missing) {
        const add = [...this.doc.querySelectorAll('button')].find(button => compact(button.textContent) === 'Add Contact' && !button.closest('form'));
        if (!add) throw new Error('SalesGodCRM Add Contact control is unavailable; no call was placed.');
        add.click(); const form = await this.contactForm('Add Contact');
        this.setInput(form.first, firstName); this.setInput(form.last, lastName); this.setInput(form.phone, phone); form.submit.click();
        await this.until(() => !this.doc.querySelector('#first_name'), 12000, 'Contact save');
        row = await this.findContact(phone);
        if (row.missing) throw new Error('SalesGodCRM did not confirm the new contact; no call was placed.');
        return { saved: true, created: true, name: displayName };
      }
      const currentName = compact(row.querySelectorAll('td')[1]?.textContent);
      if (nameKey(currentName) === nameKey(displayName)) return { saved: true, created: false, unchanged: true, name: displayName };
      const edit = row.querySelector('a[title="Edit"]');
      if (!edit) throw new Error('SalesGodCRM Edit contact control is unavailable; no call was placed.');
      edit.click(); const form = await this.contactForm('Save');
      if (digits(form.phone?.value) !== digits(phone)) throw new Error('SalesGodCRM opened a different contact; no call was placed.');
      this.setInput(form.first, firstName); this.setInput(form.last, lastName); form.submit.click();
      await this.until(() => !this.doc.querySelector('#first_name'), 12000, 'Contact name save');
      row = await this.findContact(phone);
      if (row.missing || nameKey(row.querySelectorAll('td')[1]?.textContent) !== nameKey(displayName)) throw new Error('SalesGodCRM did not confirm the contact name; no call was placed.');
      return { saved: true, created: false, unchanged: false, name: displayName };
    }
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
      const pageLocation = this.doc.defaultView?.location || location;
      if (pageLocation.pathname !== '/contacts' || !this.doc.querySelector('#contactTable')) throw new Error('Open SalesGodCRM Contacts before starting the calling list so names can be saved.');
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
    async dial({ attempt, phone, caller, firstName, lastName }) {
      if (!/^[a-f0-9-]{36}$/.test(attempt) || !/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Invalid call attempt.');
      if (this.attempts.has(attempt)) throw new Error('This attempt has already been dispatched; no retry.');
      await this.inspect(); await this.saveContact({ phone, firstName, lastName }); await this.configure(caller); const p = await this.panel();
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
