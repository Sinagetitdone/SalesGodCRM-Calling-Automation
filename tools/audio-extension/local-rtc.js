/* Shared local-only signaling helper. No external signaling, STUN, TURN, or phone provider. */
(() => {
  'use strict';
  const key = Symbol.for('salesgod.local.rtc.v1');
  if (window[key]) return;
  function waitForConnected(pc, signal) {
    return new Promise((resolve, reject) => {
      function cleanup() { pc.removeEventListener('connectionstatechange', check); signal.removeEventListener('abort', abort); }
      function abort() { cleanup(); reject(signal.reason ?? new Error('Local WebRTC test stopped.')); }
      function check() {
        if (pc.connectionState === 'connected') { cleanup(); resolve(); }
        else if (['failed', 'closed'].includes(pc.connectionState)) { cleanup(); reject(new Error(`Local WebRTC peer ${pc.connectionState}.`)); }
      }
      pc.addEventListener('connectionstatechange', check); signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort(); else check();
    });
  }
  async function negotiate(a, b, { signal, timeoutMs = 10000 } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason ?? new Error('Local WebRTC test stopped.'));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(() => controller.abort(new Error('Local WebRTC connectivity timed out.')), timeoutMs);
    const details = { discoveredA: 0, discoveredB: 0, forwardedToA: 0, forwardedToB: 0, candidateErrors: [] };
    const pending = new Map([[a, []], [b, []]]);
    const chains = new Map([[a, Promise.resolve()], [b, Promise.resolve()]]);
    let stopped = false;
    function flush(target) {
      const next = chains.get(target).then(async () => {
        if (stopped || controller.signal.aborted || !target.remoteDescription) return;
        const queue = pending.get(target);
        while (queue.length && !stopped && !controller.signal.aborted) {
          const candidate = queue.shift();
          await target.addIceCandidate(candidate);
          if (candidate) details[target === a ? 'forwardedToA' : 'forwardedToB']++;
        }
      });
      chains.set(target, next);
      next.catch(error => {
        details.candidateErrors.push(error.name || 'CandidateError');
        controller.abort(new Error('A local ICE candidate could not be applied.'));
      });
      return next;
    }
    function forward(target, label, event) {
      if (stopped || controller.signal.aborted) return;
      const candidate = event.candidate;
      if (candidate) details[label]++;
      pending.get(target).push(candidate?.toJSON ? candidate.toJSON() : candidate);
      void flush(target);
    }
    const fromA = event => forward(b, 'discoveredA', event);
    const fromB = event => forward(a, 'discoveredB', event);
    a.addEventListener('icecandidate', fromA); b.addEventListener('icecandidate', fromB);
    let onAbort;
    const cancelled = new Promise((_, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, { once: true });
      if (controller.signal.aborted) onAbort();
    });
    try {
      const exchange = async () => {
        controller.signal.throwIfAborted();
        const offer = await a.createOffer();
        controller.signal.throwIfAborted();
        await a.setLocalDescription(offer);
        controller.signal.throwIfAborted();
        await b.setRemoteDescription(offer); await flush(b);
        controller.signal.throwIfAborted();
        const answer = await b.createAnswer();
        controller.signal.throwIfAborted();
        await b.setLocalDescription(answer);
        controller.signal.throwIfAborted();
        await a.setRemoteDescription(answer); await flush(a);
        await Promise.all([waitForConnected(a, controller.signal), waitForConnected(b, controller.signal)]);
        await Promise.all(chains.values());
        return details;
      };
      return await Promise.race([exchange(), cancelled]);
    } catch (error) {
      error.signalingDiagnostics = { ...details };
      throw error;
    } finally {
      stopped = true; clearTimeout(timer);
      a.removeEventListener('icecandidate', fromA); b.removeEventListener('icecandidate', fromB);
      controller.signal.removeEventListener('abort', onAbort);
      signal?.removeEventListener('abort', abort);
      if (!controller.signal.aborted) controller.abort(new Error('Local signaling completed.'));
    }
  }
  Object.defineProperty(window, key, { value: Object.freeze({ negotiate }) });
})();
