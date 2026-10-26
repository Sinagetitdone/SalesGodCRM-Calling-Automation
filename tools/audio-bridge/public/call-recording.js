/* Local two-way phone recording. Never captures a physical microphone. */
(() => {
  'use strict';
  class CallRecording {
    constructor(context, outbound, onFailure, transcribe = false) {
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
      this.legs = [];
      if (transcribe) {
        if (!window.SalesGodAudioTranscript) throw new Error('Audio transcript support is missing. Reopen the updated calling list.');
        for (const speaker of ['assistant', 'customer']) {
          const destination = context.createMediaStreamDestination(), parts = [];
          const recorder = new MediaRecorder(destination.stream, { mimeType, audioBitsPerSecond: 128000 });
          let resolve; const done = new Promise(r => { resolve = r; });
          const leg = { speaker, destination, recorder, parts, done };
          recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
          recorder.onstop = resolve;
          recorder.onerror = () => { this.transcriptionError = new Error('Separate speaker audio recording failed. Mixed MP3 and live draft are retained.'); resolve(); };
          this.legs.push(leg);
        }
        const source = context.createMediaStreamSource(outbound); source.connect(this.legs[0].destination); this.nodes.push(source);
      }
    }
    addStream(stream) {
      const source = this.context.createMediaStreamSource(stream); source.connect(this.mix); this.nodes.push(source);
      if (this.legs?.[1]) source.connect(this.legs[1].destination);
    }
    start() {
      if (this.started) return;
      this.recorder.start(1000); this.started = true;
      const start = this.context.currentTime;
      for (const leg of this.legs) { leg.offset = this.context.currentTime - start; leg.recorder.start(1000); }
    }
    finish() {
      if (this.finishing) return this.finishing;
      this.finishing = (async () => {
        let timer;
        try {
          if (!this.started) return null;
          if (this.recorder.state !== 'inactive') this.recorder.stop();
          for (const leg of this.legs) if (leg.recorder.state !== 'inactive') leg.recorder.stop();
          await Promise.race([Promise.all([this.done, ...this.legs.map(l => l.done)]), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Call recording did not finish.')), 8000); })]);
          if (this.error) throw this.error;
          const blob = new Blob(this.parts, { type: this.recorder.mimeType });
          if (!blob.size) throw new Error('Call recording was empty.');
          return await window.SalesGodMP3.fromRecording(blob, this.context);
        } finally { clearTimeout(timer); this.dispose(); this.parts = []; }
      })();
      return this.finishing;
    }
    async transcriptSegments() {
      if (this.transcriptionError) throw this.transcriptionError;
      const segments = [];
      try {
        for (const leg of this.legs) {
          const blob = new Blob(leg.parts, { type: leg.recorder.mimeType });
          if (!blob.size) throw new Error('Separate speaker recording is empty. Live draft retained.');
          segments.push(...(await window.SalesGodAudioTranscript.fromRecording(blob, this.context, leg.speaker)).map(segment => ({ ...segment, start: segment.start + (leg.offset || 0), end: segment.end + (leg.offset || 0) })));
        }
        return segments.sort((a, b) => a.start - b.start);
      } finally { for (const leg of this.legs) leg.parts = []; }
    }
    dispose() {
      this.nodes.forEach(node => node.disconnect());
      this.destination.stream.getTracks().forEach(track => track.stop());
      for (const leg of this.legs || []) leg.destination.stream.getTracks().forEach(track => track.stop());
    }
  }
  window.SalesGodCallRecording = CallRecording;
})();
