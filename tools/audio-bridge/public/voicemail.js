/* Local signal processing and bounded voicemail decisions. No audio/transcript retention. */
(() => {
  'use strict';
  const mailboxUnavailable = text => /\b(mailbox (?:is )?full|cannot accept|not accepting|unable to (?:record|accept)|cannot be recorded)\b/i.test(String(text).slice(0, 4000));
  const greetingInvitation = text => /\b(leave (?:me |us |your |a )?(?:voice ?)?message|after (?:the )?(?:tone|beep)|at (?:the )?(?:tone|beep)|reached (?:the )?voice ?mail|voice ?mail (?:box|service)|not available.*(?:message|tone|beep))\b/i.test(String(text).slice(0, 4000));
  function tone(samples, sampleRate) {
    let energy = 0; for (const value of samples) energy += value * value;
    if (Math.sqrt(energy / samples.length) < 0.012) return false;
    const powers = [];
    for (let bin = Math.ceil(650 * samples.length / sampleRate); bin <= Math.floor(1800 * samples.length / sampleRate); bin++) {
      const coefficient = 2 * Math.cos(2 * Math.PI * bin / samples.length);
      let a = 0, b = 0;
      for (const value of samples) { const next = value + coefficient * a - b; b = a; a = next; }
      powers.push(a * a + b * b - coefficient * a * b);
    }
    let peak = 0;
    for (let i = 1; i < powers.length - 1; i++) peak = Math.max(peak, powers[i - 1] + powers[i] + powers[i + 1]);
    return 2 * peak / (samples.length * energy) > 0.75;
  }
  class Detector {
    constructor({ now = () => performance.now(), onGreeting, onReady, onTimeout, onUnavailable = () => {}, canFallback = () => true }) {
      Object.assign(this, { now, onGreeting, onReady, onTimeout, onUnavailable, canFallback }); this.active = true; this.started = now();
    }
    confirmVoicemail() {
      if (!this.active) return;
      this.confirmed = true;
      if (this.greeting === undefined) { this.greeting = this.now(); this.onGreeting(); }
      // Only count silence observed after the classification, not earlier ringing gaps.
      this.quietSince = undefined;
      this.check();
    }
    resetConfirmation() { this.confirmed = false; this.quietSince = undefined; }
    transcript(text) {
      if (!this.active || typeof text !== 'string') return;
      if (mailboxUnavailable(text)) {
        this.active = false; this.onUnavailable(); return;
      }
      // Restricted English greeting cues. Unknown speech is never guessed to be voicemail.
      if (greetingInvitation(text)) {
        if (this.greeting === undefined) { this.greeting = this.now(); this.onGreeting(); }
        this.check();
      }
    }
    samples(values, sampleRate) {
      if (!this.active) return;
      const now = this.now();
      const deadline = this.greeting === undefined ? this.started + 120000 : Math.max(this.started + 120000, this.greeting + 45000);
      if (now > deadline) { this.active = false; this.onTimeout(); return; }
      let energy = 0; for (const value of values) energy += value * value;
      if (Math.sqrt(energy / values.length) < 0.012) this.quietSince ??= now;
      else this.quietSince = undefined;
      if (tone(values, sampleRate)) { this.toneStart ??= now; this.lastTone = now; }
      else if (this.toneStart !== undefined && now - this.lastTone >= 100) {
        const duration = this.lastTone - this.toneStart;
        if (duration >= 60 && duration <= 1500) this.beep = this.lastTone;
        this.toneStart = undefined; this.check();
      }
      // A model-confirmed recorded greeting plus fresh sustained silence can
      // recover a missing/unsupported beep. Never use silence alone to guess voicemail.
      if (this.active && this.confirmed && this.quietSince !== undefined && now - this.quietSince >= 2500 && this.canFallback()) {
        this.active = false; this.onReady('confirmed_silence');
      }
    }
    check() {
      if (!this.active || this.greeting === undefined || this.beep === undefined) return;
      // ASR may complete shortly after the beep; never reuse an old ringing/DTMF tone.
      if (this.beep < this.greeting - 8000 || this.now() - this.beep > 8000 || this.beep > this.greeting + 30000) return;
      this.active = false; this.onReady('beep');
    }
    stop() { this.active = false; }
  }
  window.SalesGodVoicemail = { Detector, tone, mailboxUnavailable, greetingInvitation };
})();
