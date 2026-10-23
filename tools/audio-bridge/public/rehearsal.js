/* Two independent Realtime agents exchange text; audio is output-only.
   This module has no CRM, microphone, dial, or campaign-dispatch capability. */
(() => {
  'use strict';
  class Rehearsal {
    constructor({ onUpdate = () => {}, onRecording = () => {} } = {}) {
      Object.assign(this, { onUpdate, onRecording });
    }
    async unlock() {
      if (!window.MediaRecorder) throw new Error('This browser cannot record rehearsal audio. Use current Chrome.');
      this.context ??= new AudioContext();
      await this.context.resume();
      if (this.context.state !== 'running') throw new Error('Allow audio playback in this browser, then press Start again.');
    }
    async close() { await this.context?.close(); this.context = null; }
    stop() {
      const run = this.active; if (!run || run.cancelled) return;
      run.cancelled = true; run.controller.abort();
      run.reject?.(new Error('Rehearsal stopped.'));
      for (const peer of run.peers) { peer.reject?.(new Error('Rehearsal stopped.')); peer.channel.close(); peer.pc.close(); }
    }
    async connect(run, role, options) {
      const pc = new RTCPeerConnection(), channel = pc.createDataChannel('oai-events');
      const peer = { pc, channel, role, peak: 0 }; run.peers.push(peer);
      // Receive only: no local microphone, generated input track or audio loop.
      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.ontrack = ({ streams, track }) => {
        if (run.cancelled) return;
        const stream = streams[0] || new MediaStream([track]);
        const source = this.context.createMediaStreamSource(stream);
        source.connect(this.context.destination); source.connect(run.mix);
        const analyser = this.context.createAnalyser(); source.connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const timer = setInterval(() => { analyser.getFloatTimeDomainData(samples); for (const v of samples) peer.peak = Math.max(peer.peak, Math.abs(v)); }, 50);
        run.nodes.push(source, analyser); run.timers.push(timer);
        const renderer = new Audio(); renderer.srcObject = stream; renderer.volume = 0;
        renderer.play().catch(() => {}); run.renderers.push(renderer);
      };
      channel.onmessage = ({ data }) => {
        if (run.cancelled) return;
        let event; try { event = JSON.parse(data); } catch { return; }
        if (event.type === 'error') {
          const error = new Error('OpenAI could not complete a rehearsal turn. Check model access and API billing.');
          peer.reject?.(error); run.reject?.(error); return;
        }
        const turn = peer.turn; if (!turn) return;
        if (event.type === 'response.created') turn.responseId = event.response?.id;
        if (event.response_id && turn.responseId && event.response_id !== turn.responseId) return;
        if (event.type === 'response.output_audio_transcript.delta') {
          turn.text += event.delta || ''; this.onUpdate({ type: 'delta', role, text: turn.text, index: turn.index });
        }
        if (event.type === 'response.output_audio_transcript.done') turn.text = event.transcript || turn.text;
        if (event.type === 'response.done') {
          turn.text = (event.response.output || []).flatMap(item => item.content || []).map(part => part.transcript || '').join('').trim() || turn.text;
          if (event.response?.status !== 'completed') return peer.reject?.(new Error('The AI did not finish its reply. Partial transcript retained.'));
          turn.done = true;
        }
        if (event.type === 'output_audio_buffer.stopped') turn.drained = true;
        // Model completion can arrive before playback. Never start the next
        // speaker or disconnect until both events have arrived, in either order.
        if (turn.done && turn.drained) {
          if (!turn.text.trim()) return peer.reject?.(new Error('No transcript was returned for this audio turn.'));
          turn.resolve(turn.text.trim()); peer.turn = null;
        }
      };
      const ready = new Promise((resolve, reject) => {
        peer.reject = reject;
        channel.onopen = resolve;
        channel.onclose = () => { if (!run.cancelled && !run.cleaning) { const e = new Error('A rehearsal agent disconnected.'); peer.reject?.(e); run.reject?.(e); } };
        pc.onconnectionstatechange = () => { if (['failed', 'disconnected'].includes(pc.connectionState) && !run.cancelled && !run.cleaning) { const e = new Error('Rehearsal audio connection lost.'); peer.reject?.(e); run.reject?.(e); } };
      });
      // Attach immediately so a failed handshake cannot create an unhandled rejection.
      ready.catch(() => {});
      await pc.setLocalDescription(await pc.createOffer());
      const response = await fetch('/rehearsal-session', { method: 'POST', headers: {
        'Content-Type': 'application/sdp', 'X-Rehearsal-Role': role, 'X-Rehearsal-Session': options.session,
        'X-Campaign-Id': options.campaignId, 'X-Contact-Id': options.contact.id, 'X-Worker-Id': options.workerId,
      }, body: pc.localDescription.sdp, signal: run.controller.signal });
      if (!response.ok) throw new Error((await response.json()).error || 'Rehearsal connection failed.');
      if (run.cancelled) throw new Error('Rehearsal stopped.');
      await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() });
      await ready; peer.reject = null;
      return peer;
    }
    reply(peer, text, index, closing, config = {}) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Rehearsal turn timed out. Partial results retained.')), (config.turnSeconds || 20) * 1000);
        const settle = fn => value => { clearTimeout(timer); peer.reject = null; fn(value); };
        peer.reject = settle(reject);
        peer.turn = { text: '', index, resolve: settle(resolve), done: false, drained: false };
        this.onUpdate({ type: 'speaking', role: peer.role, index, text: '' });
        peer.channel.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } }));
        if (closing) peer.channel.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: peer.role === 'assistant'
            ? 'This is your final rehearsal turn. Follow your assigned office role and brief, acknowledge the customer, and close politely. Say they can contact Cena to talk more unless they asked not to be contacted. Do not ask another question.'
            : 'This is your final rehearsal turn. As the fictional customer, naturally answer or acknowledge the office assistant and say a brief goodbye. Do not introduce a new topic.' }] } }));
        peer.channel.send(JSON.stringify({ type: 'response.create', response: { output_modalities: ['audio'] } }));
      });
    }
    async run(options) {
      if (this.active) throw new Error('A rehearsal is already running.');
      if (!this.context || this.context.state !== 'running') throw new Error('Press Start to enable rehearsal sound.');
      const run = { peers: [], nodes: [], renderers: [], timers: [], chunks: [], turns: [], turnSeconds: [], controller: new AbortController(), cancelled: false };
      this.active = run;
      run.mix = this.context.createMediaStreamDestination();
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(x => MediaRecorder.isTypeSupported(x));
      let outcome = 'completed', failure;
      const failed = new Promise((_, reject) => { run.reject = reject; }); failed.catch(() => {});
      const config = options.settings.rehearsalConfig || {};
      const limit = setTimeout(() => run.reject(new Error('Rehearsal reached its five-minute limit. Partial results retained.')), 300000);
      try {
        this.onUpdate({ type: 'starting', contact: options.contact });
        run.recorder = new MediaRecorder(run.mix.stream, mimeType ? { mimeType } : {});
        run.recorder.ondataavailable = e => { if (e.data.size) run.chunks.push(e.data); };
        run.recorder.onerror = () => run.reject(new Error('Rehearsal recording failed. Transcript retained.'));
        // Bound setup separately, including SDP and data-channel negotiation.
        const setupTimer = setTimeout(() => run.reject(new Error('Rehearsal connection timed out.')), 45000);
        try {
          [run.assistant, run.customer] = await Promise.race([Promise.all([
            this.connect(run, 'assistant', options), this.connect(run, 'customer', options),
          ]), failed]);
        } finally { clearTimeout(setupTimer); }
        run.recorder.start(1000);
        let text = 'The fictional customer has answered. Begin your brief office introduction now.';
        const count = options.settings.rehearsalTurns || 8;
        for (let index = 0; index < count; index++) {
          if (run.cancelled) { outcome = 'cancelled'; break; }
          const role = index % 2 ? 'customer' : 'assistant';
          const started = Date.now();
          text = await Promise.race([this.reply(run[role], text, index, index >= count - 2, config), failed]);
          const seconds = (Date.now() - started) / 1000; run.turnSeconds.push(seconds);
          const turn = { session: options.session, item: 'rehearsal_' + index, speaker: role, text };
          await options.saveTurn(turn); run.turns.push(turn);
          this.onUpdate({ type: 'turn', role, index, text, saved: true, seconds });
        }
      } catch (e) { outcome = run.cancelled ? 'cancelled' : 'failed'; failure = run.cancelled ? undefined : e.message; }
      finally {
        clearTimeout(limit); run.cleaning = true; run.controller.abort();
        // Retain text already shown even if Stop, timeout or disconnect interrupts
        // audio. Its distinct item label makes the partial nature clear on export.
        for (const peer of run.peers) {
          const partial = peer.turn;
          if (partial?.text?.trim() && !run.turns.some(t => t.item === 'rehearsal_' + partial.index)) {
            try { await options.saveTurn({ session: options.session, item: 'rehearsal_partial_' + partial.index, speaker: peer.role, text: '[Interrupted audio] ' + partial.text.trim() }); }
            catch { outcome = 'failed'; failure = 'Some transcript could not be saved. Export the visible transcript before closing.'; }
          }
          peer.reject?.(new Error('Rehearsal finished.')); peer.channel.close(); peer.pc.close();
        }
        if (run.recorder && run.recorder.state !== 'inactive') await new Promise(resolve => { run.recorder.onstop = resolve; run.recorder.stop(); });
        for (const timer of run.timers) clearInterval(timer);
        for (const renderer of run.renderers) { renderer.pause(); renderer.srcObject = null; }
        for (const node of run.nodes) node.disconnect();
        run.mix.stream.getTracks().forEach(t => t.stop());
        const peaks = Object.fromEntries(run.peers.map(p => [p.role, Number(p.peak.toFixed(5))]));
        if (outcome === 'completed' && !(peaks.assistant > 0.001 && peaks.customer > 0.001)) { outcome = 'failed'; failure = 'Generated text completed, but audible audio from both agents was not verified.'; }
        if (run.chunks.length) {
          try {
            this.onUpdate({ type: 'recording' });
            const blob = await window.SalesGodMP3.fromRecording(new Blob(run.chunks, { type: run.recorder.mimeType }), this.context);
            this.onRecording({ contact: options.contact, outcome, blob });
          } catch { outcome = 'failed'; failure = 'MP3 conversion failed. Your transcript is retained; audio could not be exported.'; }
        }
        this.active = null;
        this.onUpdate({ type: 'finished', outcome, error: failure, peaks, turns: run.turns.length, longestTurn: Math.max(0, ...run.turnSeconds) });
      }
      return outcome;
    }
  }
  window.SalesGodRehearsal = Rehearsal;
})();
