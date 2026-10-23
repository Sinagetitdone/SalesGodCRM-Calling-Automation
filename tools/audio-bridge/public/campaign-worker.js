/* Sequential list runner. Dispatch is durable before the browser side effect. */
(() => {
  'use strict';
  class Worker {
    constructor({ api, driver, audio, rehearsal, expectedSimulation, onState = () => {}, wait = ms => new Promise(r => setTimeout(r, ms)), now = () => Date.now() }) {
      Object.assign(this, { api, driver, audio, rehearsal, expectedSimulation, onState, wait, now }); this.workerId = crypto.randomUUID();
    }
    async until(test, timeout) { const end = this.now() + timeout; while (!await test()) { if (this.now() > end) throw new Error('Operation timed out; no automatic retry.'); await this.wait(300); } }
    async post(suffix, body = {}) { return this.api('/campaigns-api/' + this.id + suffix, { workerId: this.workerId, ...body }); }
    diagnostic(message) {
      const status = this.simulation || !this.audioAttempt ? {} : this.audio.status();
      const detail = message || (this.simulation ? this.rehearsal?.lastError : status.stopReason);
      return { ...(status.sessionId ? { session: status.sessionId } : {}), ...(detail || status.failure ? { message: [detail, status.failure && JSON.stringify(status.failure)].filter(Boolean).join(' · ').slice(0, 1500) } : {}) };
    }
    async pause() { this.pauseRequested = true; if (this.running) await this.post('/pause'); }
    async stop() { this.cancelCurrent = true; this.rehearsal?.stop(); await this.pause(); if (!this.simulation) await this.audio.stop('stopped', 'Owner stopped the calling list'); }
    async run(id) {
      if (this.running) throw new Error('A list is already running.');
      this.id = id; this.pauseRequested = false; this.cancelCurrent = false; this.running = true;
      try {
        if (typeof this.expectedSimulation === 'boolean') {
          const campaign = await this.api('/campaigns-api/' + id);
          if (campaign.settings.simulation !== this.expectedSimulation) throw new Error('Open this list in the correct workspace.');
          this.simulation = campaign.settings.simulation;
        }
        await this.post('/start', { authorized: true });
        this.heartbeat = setInterval(() => { void this.post('/heartbeat').catch(() => { this.pauseRequested = true; this.cancelCurrent = true; this.rehearsal?.stop(); if (!this.simulation) void this.audio.stop('failed', 'Campaign connection lost'); }); }, 10000);
        while (!this.pauseRequested) {
          const next = await this.post('/next');
          if (next.finished) { this.onState({ state: 'finished', campaignId: id }); return; }
          if (next.waiting) { this.onState({ state: 'waiting', reason: next.waiting }); await this.wait(15000); continue; }
          this.simulation = next.settings.simulation;
          this.current = next.contact; this.onState({ state: 'preparing', contact: this.current });
          const contactPath = '/' + this.current.id; let dispatchAttempted = false, outcome, diagnostic;
          this.audioAttempt = false;
          try {
            if (next.settings.simulation) {
              const session = crypto.randomUUID(); await this.post(contactPath + '/dispatch', { session });
              this.onState({ state: 'simulation', contact: this.current });
              if (next.settings.simulationMode === 'agents') {
                if (!this.rehearsal) throw new Error('Live AI rehearsal is unavailable. Reopen the updated calling list.');
                outcome = this.cancelCurrent ? 'cancelled' : await this.rehearsal.run({ campaignId: id, contact: this.current, workerId: this.workerId, session,
                  settings: next.settings, saveTurn: turn => this.post(contactPath + '/transcript', turn), saveRecording: async blob => {
                    const r = await fetch('/campaigns-api/' + id + contactPath + '/recording', { method: 'POST', headers: { 'Content-Type': 'audio/mpeg', 'X-Worker-Id': this.workerId }, body: blob });
                    if (!r.ok) throw new Error('Recording save failed.');
                  } });
              } else {
                await this.wait(500);
                outcome = this.cancelCurrent ? 'cancelled' : this.current.position % 2 ? 'voicemail_played' : 'completed';
                if (outcome === 'completed') for (const [speaker, text] of [['assistant', 'This is a simulated office introduction.'], ['customer', 'This is a simulated reply.']]) await this.post(contactPath + '/transcript', { session, item: 'sim_' + speaker, speaker, text });
              }
            } else {
              await this.driver('inspect');
              this.audio.configure({ automatic: true, voice: next.settings.voice || 'cedar', responsePauseMs: next.settings.responsePauseMs ?? 250, campaignId: id, contactId: this.current.id, workerId: this.workerId,
                saveTurn: turn => this.post(contactPath + '/transcript', turn) });
              const token = crypto.randomUUID(); await this.driver('prepare', { token }); this.audio.pair(token);
              await this.until(() => this.audio.status().canPrepare, 15000);
              document.getElementById('voicemailEnabled').checked = true;
              document.getElementById('voicemailMessage').value = next.settings.voicemailMessage;
              this.audioAttempt = true;
              await this.audio.prepare(); await this.until(() => this.audio.status().prepared || ['failed', 'stopped'].includes(this.audio.status().phase), 40000);
              if (!this.audio.status().prepared) throw new Error('AI preparation failed.');
              if (this.pauseRequested) { outcome = 'cancelled'; }
              else {
                const permit = await this.post(contactPath + '/dispatch', { session: this.audio.status().sessionId });
                dispatchAttempted = true;
                await this.driver('dial', { attempt: this.current.id, phone: permit.phone, caller: next.settings.callerNumber });
                this.onState({ state: 'calling', contact: this.current });
                const started = this.now(), deadline = started + 330000; let observedCall = false;
                while (true) {
                  const status = this.audio.status(), phone = await this.driver('status');
                  if (phone.state === 'unknown' || phone.state === 'other_call') throw new Error('Call identity is uncertain.');
                  if (['active', 'dialing'].includes(phone.state)) observedCall = true;
                  if (!observedCall && ['idle', 'ended'].includes(phone.state)) {
                    if (this.now() - started > 10000) throw new Error('Dispatch was not observed; do not retry.');
                    await this.wait(300); continue;
                  }
                  if (this.cancelCurrent) { outcome = 'cancelled'; break; }
                  if (status.phase === 'paused') { outcome = 'needs_review'; break; }
                  if (status.phase === 'failed') { outcome = 'failed'; break; }
                  if (['stopped'].includes(status.phase) && !status.stopping) {
                    outcome = status.takeoverPending || ['needs_review', 'incomplete'].includes(status.voicemailOutcome) ? 'needs_review'
                      : status.voicemailOutcome === 'playback_completed' ? 'voicemail_played' : status.conversationOutcome === 'opt_out' ? 'opt_out'
                      : /limit/i.test(status.stopReason || '') || status.transcriptSaved === false ? 'needs_review'
                      : status.conversationOutcome === 'completed' ? 'completed'
                      : !['ended', 'idle'].includes(phone.state) ? 'needs_review'
                      : status.humanAnswered ? 'completed' : status.customerTurns > 0 || status.voicemailOutcome === 'incomplete' ? 'needs_review' : 'no_answer'; break;
                  }
                  if (phone.state === 'ended' || phone.state === 'idle') { await this.audio.stop('stopped', 'Telephone call ended'); continue; }
                  if (this.now() > deadline) throw new Error('Call exceeded its time limit.');
                  await this.wait(1000);
                }
              }
              diagnostic = this.diagnostic();
              await this.audio.stop('stopped', 'List contact finished');
              if (dispatchAttempted) {
                await this.driver('hangup', { attempt: this.current.id });
                await this.until(async () => ['ended', 'idle'].includes((await this.driver('status')).state), 12000);
              }
              await this.driver('release', { attempt: this.current.id });
            }
            await this.post(contactPath + '/finish', { outcome, ...(['failed', 'unknown', 'needs_review'].includes(outcome) ? { diagnostic: diagnostic || this.diagnostic() } : {}) });
            this.onState({ state: 'contact_finished', outcome, contact: this.current });
            if (['failed', 'unknown', 'needs_review'].includes(outcome)) this.pauseRequested = true;
          } catch (error) {
            const diagnostic = this.diagnostic(error.message || 'Attempt failed without an error message.');
            if (this.simulation) this.rehearsal?.stop();
            else {
              await this.audio.stop('failed', 'List paused after an uncertain attempt').catch(() => {});
              if (dispatchAttempted) await this.driver('hangup', { attempt: this.current.id }).catch(() => {});
              else await this.driver('release', { attempt: this.current.id }).catch(() => {});
            }
            await this.post(contactPath + '/finish', { outcome: dispatchAttempted ? 'unknown' : 'failed', diagnostic }).catch(() => {});
            await this.post('/pause').catch(() => {}); this.pauseRequested = true;
            this.onState({ state: 'needs_review', contact: this.current });
          }
          this.current = null;
        }
        this.onState({ state: 'paused' });
      } finally { clearInterval(this.heartbeat); this.running = false; }
    }
  }
  window.SalesGodCampaignWorker = Worker;
})();
