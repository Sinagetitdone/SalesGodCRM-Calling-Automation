/* Local two-way phone recording. Never captures a physical microphone. */
(() => {
  'use strict';
  class CallRecording {
    constructor(context, outbound, onFailure) {
      if (!window.SalesGodMP3 || typeof MediaRecorder === 'undefined') throw new Error('Call recording is unavailable. Reopen the updated calling list in Chrome.');
      this.context = context; this.nodes = []; this.parts = []; this.onFailure = onFailure;
      this.destination = context.createMediaStreamDestination();
      this.mix = context.createGain(); this.mix.gain.value = 0.5; this.mix.connect(this.destination);
      this.nodes.push(this.mix);
      // Outbound is AFTER the AI speaking gate, and also contains prepared voicemail.
      this.addStream(outbound);
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) { this.dispose(); throw new Error('Chrome cannot record call audio on this computer.'); }
      this.recorder = new MediaRecorder(this.destination.stream, { mimeType, audioBitsPerSecond: 128000 });
      this.done = new Promise(resolve => { this.resolve = resolve; });
      this.recorder.ondataavailable = event => { if (event.data.size) this.parts.push(event.data); };
      this.recorder.onstop = () => this.resolve();
      this.recorder.onerror = () => { this.error = new Error('Call audio recording failed.'); this.resolve(); this.onFailure?.(); };
    }
    addStream(stream) {
      const source = this.context.createMediaStreamSource(stream); source.connect(this.mix); this.nodes.push(source);
    }
    start() {
      if (this.started) return;
      this.recorder.start(1000); this.started = true;
    }
    finish() {
      if (this.finishing) return this.finishing;
      this.finishing = (async () => {
        let timer;
        try {
          if (!this.started) return null;
          if (this.recorder.state !== 'inactive') this.recorder.stop();
          await Promise.race([this.done, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Call recording did not finish.')), 8000); })]);
          if (this.error) throw this.error;
          const blob = new Blob(this.parts, { type: this.recorder.mimeType });
          if (!blob.size) throw new Error('Call recording was empty.');
          return await window.SalesGodMP3.fromRecording(blob, this.context);
        } finally { clearTimeout(timer); this.dispose(); this.parts = []; }
      })();
      return this.finishing;
    }
    dispose() {
      this.nodes.forEach(node => node.disconnect());
      this.destination.stream.getTracks().forEach(track => track.stop());
    }
  }
  window.SalesGodCallRecording = CallRecording;
})();
