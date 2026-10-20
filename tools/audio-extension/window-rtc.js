/* A bounded two-way audio link over an explicitly paired MessagePort. No network signaling. */
(() => {
  'use strict';
  const key = Symbol.for('salesgod.window.rtc.v1');
  if (window[key]) return;
  function connect(port, { pc, stream, offerer, onTrack, onClose = () => {}, onMessage = () => {}, timeoutMs = 12000 }) {
    let stopped = false, settled = false, chain = Promise.resolve();
    const candidates = [];
    let resolve, reject;
    const ready = new Promise((yes, no) => { resolve = yes; reject = no; });
    // The caller may attach its await after the first asynchronous signaling step.
    ready.catch(() => {});
    const timer = setTimeout(() => close(new Error('Local audio pairing timed out.')), timeoutMs);
    function send(message) { if (!stopped) port.postMessage(message); }
    function close(error = new Error('Local audio pairing stopped.')) {
      if (stopped) return;
      send({ type: 'close', reason: error.message }); stopped = true; clearTimeout(timer);
      port.onmessage = null; port.onmessageerror = null; port.close(); pc.close();
      if (!settled) { settled = true; reject(error); }
      onClose(error);
    }
    async function flush() {
      if (!pc.remoteDescription) return;
      while (candidates.length && !stopped) await pc.addIceCandidate(candidates.shift());
    }
    pc.addEventListener('icecandidate', ({ candidate }) => send({ type: 'ice', candidate: candidate?.toJSON?.() ?? candidate }));
    pc.addEventListener('track', event => { if (!stopped && event.track.kind === 'audio') onTrack(event.streams[0] ?? new MediaStream([event.track])); });
    pc.addEventListener('connectionstatechange', () => {
      if (stopped) return;
      if (pc.connectionState === 'connected') {
        clearTimeout(timer); if (!settled) { settled = true; resolve(); }
      } else if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) close(new Error('Local audio pairing disconnected.'));
    });
    port.onmessageerror = () => close(new Error('Invalid local audio message.'));
    port.onmessage = ({ data }) => {
      if (stopped) return;
      chain = chain.then(async () => {
        if (stopped) return;
        if (data?.type === 'close') {
          const reason = typeof data.reason === 'string' && /^Local audio [A-Za-z ()\.]+$/.test(data.reason) && data.reason.length < 120 ? data.reason : 'Local audio pairing stopped.';
          close(new Error(reason)); return;
        }
        if (data?.type === 'ice') { candidates.push(data.candidate); await flush(); return; }
        if (data?.type !== 'description') { onMessage(data); return; }
        const description = data.description;
        if (description?.type !== (offerer ? 'answer' : 'offer') || typeof description.sdp !== 'string') throw new Error('Invalid local description.');
        await pc.setRemoteDescription(description); if (stopped) return; await flush();
        if (!offerer) {
          await pc.setLocalDescription(await pc.createAnswer());
          send({ type: 'description', description: pc.localDescription.toJSON() });
        }
      }).catch(error => close(new Error(`Local audio signaling failed (${['TypeError', 'InvalidStateError', 'OperationError', 'InvalidAccessError', 'NotSupportedError'].includes(error.name) ? error.name : 'Error'}).`)));
    };
    try {
    port.start();
    for (const track of stream.getAudioTracks()) pc.addTrack(track, stream);
    if (offerer) {
      chain = chain.then(async () => {
        await pc.setLocalDescription(await pc.createOffer());
        send({ type: 'description', description: pc.localDescription.toJSON() });
      }).catch(() => close(new Error('Local audio offer failed.')));
    }
    } catch { close(new Error('Local audio track setup failed.')); }
    return Object.freeze({ ready, close, send });
  }
  Object.defineProperty(window, key, { value: Object.freeze({ connect }) });
})();
