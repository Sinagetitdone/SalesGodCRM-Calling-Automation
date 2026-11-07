(() => {
  'use strict';
  // The browser observes. The backend owns sequencing, heartbeats and call control.
  class TwilioWorker {
    constructor({ api, onState = () => {} }) { this.api = api; this.onState = onState; }
    async run(id) {
      if (this.running) throw new Error('A list is already running.');
      this.id = id; this.running = true;
      try { await this.api(`/campaigns-api/${id}/twilio/start`, { authorized: true }); await this.watch(id); }
      finally { this.running = false; }
    }
    async watch(id) {
      this.id = id; this.running = true;
      try {
        while (true) {
          const campaign = await this.api('/campaigns-api/' + id);
          const active = campaign.contacts.find(c => ['preparing', 'dispatching', 'connected'].includes(c.state));
          const status = await this.api('/twilio/status');
          if (!active && status.activeCampaign !== id) { this.onState({ state: campaign.state === 'finished' ? 'finished' : 'paused' }); return; }
          this.onState({ state: active ? active.state : 'running', contact: active });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } finally { this.running = false; }
    }
    pause() { return this.api(`/campaigns-api/${this.id}/twilio/pause`, {}); }
    stop() { return this.api(`/campaigns-api/${this.id}/twilio/stop`, {}); }
  }
  window.TwilioCampaignWorker = TwilioWorker;
})();
