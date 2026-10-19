/* No API keys, call controls, or physical microphone capture. Voice setup pairs only to loopback. */
(() => {
  'use strict';
  const MARKER = Symbol.for('salesgod.local.audio.hook.v1');
  if (window[MARKER]) return;
  Object.defineProperty(window, MARKER, { value: true });
  const SOURCE = 'salesgod-local-audio-v1';
  const DEVICE = 'salesgod-ai-bridge-local-v1';
  const LABEL = 'SalesGod AI Bridge (local audio)';
  const media = navigator.mediaDevices;
  if (!media?.getUserMedia || !media?.enumerateDevices || !window.RTCPeerConnection) return;
  const originalGetUserMedia = media.getUserMedia.bind(media);
  const originalEnumerate = media.enumerateDevices.bind(media);
  const NativePeer = window.RTCPeerConnection;
  const NativeAudioContext = window.AudioContext;
  const clones = new Set();
  const inboundSources = new Set();
  let context, outgoing, incoming, armed = false, testing = false, cancelTest = false;
  let dialerRequests = 0, dialerEnumerations = 0, observedPeers = 0;
  let lastTest = null, lastPeerTest = null, lastVoiceTest = null, testController, microphonePermission = 'unknown';
  const peers = new Set();
  const peerAudio = new WeakMap();
  const events = [];
  let voiceToken, voiceExpiry = 0, voicePair, voiceState = 'disconnected', voiceKind = 'setup';
  const log = (event) => { events.push({ time: new Date().toISOString(), event }); if (events.length > 80) events.shift(); };
  function snapshot() {
    return { version: '0.3.0', installed: true, armed, testing, virtualDevice: LABEL,
      dialerRequests, dialerEnumerations, observedPeers,
      activeDialerConnections: [...peers].filter(pc => ['connected', 'connecting'].includes(pc.connectionState)).length,
      lastTest, lastPeerTest, lastVoiceTest, microphonePermission, voiceState, voiceKind, callMedia: voicePair?.media ?? null,
      openAIConnected: voiceState === 'disconnected' ? false : null, dialingEnabled: false, events: events.slice() };
  }
  const publish = (requestId, error) => window.postMessage({ source: SOURCE, type: 'result', requestId, status: snapshot(), ...(error ? { error } : {}) }, location.origin);
  async function arm() {
    if (!armed) {
      context = new NativeAudioContext({ sampleRate: 48000 });
      outgoing = context.createMediaStreamDestination();
      incoming = context.createMediaStreamDestination();
      armed = true; log('Local routing enabled. Generated microphone is silent except during the local test.');
    }
    await context.resume();
  }
  async function disarm() {
    voiceToken = undefined; voiceExpiry = 0; voicePair?.close(); voiceState = 'disconnected';
    cancelTest = true;
    testController?.abort(new Error('Local test stopped by owner.'));
    for (const track of clones) track.stop(); clones.clear();
    for (const source of inboundSources) source.disconnect(); inboundSources.clear();
    outgoing?.stream.getTracks().forEach(t => t.stop());
    incoming?.stream.getTracks().forEach(t => t.stop());
    armed = false;
    const oldContext = context; context = outgoing = incoming = undefined;
    await oldContext?.close(); log('Local routing disabled and generated audio tracks released.');
  }
  function virtualRequested(constraints) {
    const value = constraints?.audio?.deviceId;
    const ids = typeof value === 'object' && value ? value.exact ?? value.ideal : value;
    return Array.isArray(ids) ? ids.includes(DEVICE) : ids === DEVICE;
  }
  function generatedMicrophone() {
    if (!armed || !outgoing) throw new DOMException('Enable the SalesGod local audio bridge first.', 'NotAllowedError');
    const track = outgoing.stream.getAudioTracks()[0].clone();
    const settings = track.getSettings.bind(track);
    Object.defineProperty(track, 'getSettings', { value: () => ({ ...settings(), deviceId: DEVICE, groupId: DEVICE }) });
    clones.add(track); track.addEventListener('ended', () => clones.delete(track), { once: true });
    return new MediaStream([track]);
  }
  Object.defineProperty(media, 'enumerateDevices', { configurable: true, value: async () => {
    const devices = await originalEnumerate();
    dialerEnumerations++; publish();
    return [...devices, { deviceId: DEVICE, groupId: DEVICE, kind: 'audioinput', label: LABEL,
      toJSON() { return { deviceId: DEVICE, groupId: DEVICE, kind: 'audioinput', label: LABEL }; } }];
  } });
  Object.defineProperty(media, 'getUserMedia', { configurable: true, value: async (constraints) => {
    if (voicePair?.kind === 'live' && constraints?.audio && !virtualRequested(constraints)) {
      throw new DOMException('Select SalesGod AI Bridge (local audio) as the dialer microphone before the supervised call.', 'NotAllowedError');
    }
    if (!virtualRequested(constraints)) return originalGetUserMedia(constraints);
    if (constraints.video) throw new DOMException('The local bridge supports audio-only requests.', 'NotSupportedError');
    const stream = generatedMicrophone();
    dialerRequests++; log('The page requested the generated bridge microphone.'); publish();
    return stream;
  } });
  function attachIncoming(stream) {
    if (!armed || !context || !incoming) return null;
    const source = context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    source.connect(incoming); inboundSources.add(source);
    return source;
  }
  window.RTCPeerConnection = new Proxy(NativePeer, {
    construct(target, args) {
      // Setup mode must never forward a newly started dialer's telephone audio.
      if (voicePair && voicePair.kind !== 'live') { voicePair.close(); log('Voice setup stopped because the dialer created a peer.'); }
      const pc = Reflect.construct(target, args);
      peers.add(pc); peerAudio.set(pc, new Set()); observedPeers++; voicePair?.onPeerCreated?.(pc); publish();
      pc.addEventListener('track', ({ track, streams }) => {
        if (track.kind === 'audio') {
          peerAudio.get(pc).add(track);
          attachIncoming(streams[0] ?? new MediaStream([track]));
          track.addEventListener('ended', () => voicePair?.refresh?.());
          voicePair?.refresh?.();
          log('Incoming dialer audio track observed; routed locally only.'); publish();
        }
      });
      pc.addEventListener('connectionstatechange', () => {
        if (['closed', 'failed'].includes(pc.connectionState)) peers.delete(pc);
        voicePair?.refresh?.();
        publish();
      });
      return pc;
    }
  });
  function peerDiagnostics(pc) {
    const candidates = (pc.localDescription?.sdp.match(/^a=candidate:.*$/gm) ?? []).map(line => {
      const parts = line.trim().split(/\s+/);
      return { protocol: parts[2], candidateType: parts[parts.indexOf('typ') + 1],
        tcpType: parts.includes('tcptype') ? parts[parts.indexOf('tcptype') + 1] : null,
        mdns: parts[4]?.endsWith('.local') ?? false };
    });
    const transport = pc.getSenders()[0]?.transport?.iceTransport;
    return { connectionState: pc.connectionState, iceConnectionState: pc.iceConnectionState,
      iceGatheringState: pc.iceGatheringState, signalingState: pc.signalingState, candidates,
      remoteTransportCandidateCount: transport?.getRemoteCandidates?.().length ?? null };
  }
  async function audioPacketSummary(pc) {
    const summary = { sentPackets: 0, receivedPackets: 0, sentBytes: 0, receivedBytes: 0, sourceEnergy: 0, receivedEnergy: 0 };
    for (const report of (await pc.getStats()).values()) {
      if (report.type === 'outbound-rtp' && report.kind === 'audio') { summary.sentPackets += report.packetsSent ?? 0; summary.sentBytes += report.bytesSent ?? 0; }
      if (report.type === 'inbound-rtp' && report.kind === 'audio') { summary.receivedPackets += report.packetsReceived ?? 0; summary.receivedBytes += report.bytesReceived ?? 0; summary.receivedEnergy += report.totalAudioEnergy ?? 0; }
      if (report.type === 'media-source' && report.kind === 'audio') summary.sourceEnergy += report.totalAudioEnergy ?? 0;
    }
    return summary;
  }
  async function localPeerTest() {
    if (voicePair) throw new Error('Disconnect voice setup before running local diagnostics.');
    if (!armed) throw new Error('Enable local routing first.');
    if ([...peers].some(pc => pc.connectionState !== 'closed' && pc.connectionState !== 'failed')) throw new Error('A dialer peer exists. Run this test only with the dialer idle and no calls.');
    if (testing) throw new Error('A local test is already running.');
    testing = true; cancelTest = false; publish();
    const ctx = context;
    const a = new NativePeer({ iceServers: [] });
    const b = new NativePeer({ iceServers: [] });
    const mic = generatedMicrophone();
    const customer = ctx.createMediaStreamDestination();
    const voiceTone = ctx.createOscillator(); voiceTone.frequency.value = 440;
    const customerTone = ctx.createOscillator(); customerTone.frequency.value = 660;
    const voiceGain = ctx.createGain(); voiceGain.gain.value = 0.1;
    const customerGain = ctx.createGain(); customerGain.gain.value = 0.1;
    voiceTone.connect(voiceGain).connect(outgoing);
    customerTone.connect(customerGain).connect(customer);
    const outboundMeter = ctx.createAnalyser(); outboundMeter.fftSize = 2048;
    const inboundMeter = ctx.createAnalyser(); inboundMeter.fftSize = 2048;
    let incomingSource, outgoingSource, started = false, signaling, outboundPeak = 0, inboundPeak = 0;
    const inboundSource = ctx.createMediaStreamSource(incoming.stream);
    const silentSink = ctx.createGain(); silentSink.gain.value = 0;
    outboundMeter.connect(silentSink); inboundMeter.connect(silentSink); silentSink.connect(ctx.destination);
    const renderers = [];
    function consumeRemote(stream) {
      const element = document.createElement('audio'); element.volume = 0; element.autoplay = true; element.srcObject = stream;
      renderers.push(element);
      void element.play().catch(() => log('Silent remote renderer playback was not available.'));
    }
    testController = new AbortController();
    try {
      // Both peers use only local host ICE and synthetic audio. Nothing reaches a phone provider or OpenAI.
      a.addEventListener('track', ({ streams, track }) => {
        const stream = streams[0] ?? new MediaStream([track]);
        consumeRemote(stream); incomingSource = attachIncoming(stream);
      });
      b.addEventListener('track', ({ streams, track }) => {
        const stream = streams[0] ?? new MediaStream([track]); consumeRemote(stream);
        outgoingSource = ctx.createMediaStreamSource(stream);
        outgoingSource.connect(outboundMeter);
      });
      inboundSource.connect(inboundMeter);
      a.addTrack(mic.getAudioTracks()[0], mic);
      b.addTrack(customer.stream.getAudioTracks()[0], customer.stream);
      voiceTone.start(); customerTone.start(); started = true;
      const helper = window[Symbol.for('salesgod.local.rtc.v1')];
      if (!helper) throw new Error('Updated signaling helper missing. Reload the extension and refresh this page.');
      signaling = await helper.negotiate(a, b, { signal: testController.signal });
      if (cancelTest) throw new Error('Local test stopped.');
      const samples = new Float32Array(2048);
      const deadline = performance.now() + 3000;
      while (performance.now() < deadline) {
        if (cancelTest) throw new Error('Local test stopped.');
        outboundMeter.getFloatTimeDomainData(samples);
        for (const sample of samples) outboundPeak = Math.max(outboundPeak, Math.abs(sample));
        inboundMeter.getFloatTimeDomainData(samples);
        for (const sample of samples) inboundPeak = Math.max(inboundPeak, Math.abs(sample));
        if (outboundPeak > 0.005 && inboundPeak > 0.005) break;
        await new Promise(resolve => setTimeout(resolve, 40));
      }
      lastPeerTest = { time: new Date().toISOString(), passed: outboundPeak > 0.005 && inboundPeak > 0.005,
        outboundPeak: Number(outboundPeak.toFixed(4)), inboundPeak: Number(inboundPeak.toFixed(4)),
        signaling,
        audioContextState: ctx.state, packetsA: await audioPacketSummary(a), packetsB: await audioPacketSummary(b),
        scope: 'Synthetic two-way browser audio only; does not verify a phone call or OpenAI.' };
      log(lastPeerTest.passed ? 'Local WebRTC audio test passed.' : 'Local WebRTC test did not detect both directions.');
      if (!lastPeerTest.passed) throw new Error('One or both local audio directions were silent.');
    } catch (error) {
      lastPeerTest = { time: new Date().toISOString(), passed: false, error: error.message,
        microphonePermission,
        peerA: a.connectionState, peerB: b.connectionState,
        outboundPeak, inboundPeak, audioContextState: ctx.state,
        packetsA: await audioPacketSummary(a), packetsB: await audioPacketSummary(b),
        localCandidateCountA: (a.localDescription?.sdp.match(/^a=candidate:/gm) ?? []).length,
        localCandidateCountB: (b.localDescription?.sdp.match(/^a=candidate:/gm) ?? []).length,
        diagnosticsA: peerDiagnostics(a), diagnosticsB: peerDiagnostics(b), signaling: error.signalingDiagnostics ?? signaling };
      throw error;
    } finally {
      if (started) { voiceTone.stop(); customerTone.stop(); }
      voiceTone.disconnect(); customerTone.disconnect(); voiceGain.disconnect(); customerGain.disconnect();
      incomingSource?.disconnect(); if (incomingSource) inboundSources.delete(incomingSource);
      outgoingSource?.disconnect(); inboundSource.disconnect(); outboundMeter.disconnect(); inboundMeter.disconnect(); silentSink.disconnect();
      for (const renderer of renderers) { renderer.pause(); renderer.srcObject = null; }
      a.close(); b.close(); mic.getTracks().forEach(t => { t.stop(); clones.delete(t); });
      customer.stream.getTracks().forEach(t => t.stop()); testController = undefined; testing = false; publish();
    }
  }
  async function localTest() {
    if (voicePair) throw new Error('Disconnect voice setup before running local diagnostics.');
    if (!armed) throw new Error('Enable local routing first.');
    if (testing) throw new Error('A local test is already running.');
    if ([...peers].some(pc => !['closed', 'failed'].includes(pc.connectionState))) throw new Error('A dialer peer exists. Test only with the dialer idle and no calls.');
    testing = true; cancelTest = false; publish();
    const ctx = context;
    const microphone = generatedMicrophone();
    const customer = ctx.createMediaStreamDestination();
    const voiceTone = ctx.createOscillator(); voiceTone.frequency.value = 440;
    const customerTone = ctx.createOscillator(); customerTone.frequency.value = 660;
    const gainA = ctx.createGain(); gainA.gain.value = 0.1;
    const gainB = ctx.createGain(); gainB.gain.value = 0.1;
    const outboundMeter = ctx.createAnalyser(); outboundMeter.fftSize = 2048;
    const inboundMeter = ctx.createAnalyser(); inboundMeter.fftSize = 2048;
    const outboundSource = ctx.createMediaStreamSource(microphone);
    const inboundSource = ctx.createMediaStreamSource(incoming.stream);
    const customerSource = attachIncoming(customer.stream);
    let started = false;
    try {
      voiceTone.connect(gainA).connect(outgoing);
      customerTone.connect(gainB).connect(customer);
      outboundSource.connect(outboundMeter); inboundSource.connect(inboundMeter);
      voiceTone.start(); customerTone.start(); started = true;
      let outboundPeak = 0, inboundPeak = 0;
      const values = new Float32Array(2048);
      const deadline = performance.now() + 1200;
      while (performance.now() < deadline) {
        if (cancelTest) throw new Error('Local test stopped.');
        outboundMeter.getFloatTimeDomainData(values);
        for (const value of values) outboundPeak = Math.max(outboundPeak, Math.abs(value));
        inboundMeter.getFloatTimeDomainData(values);
        for (const value of values) inboundPeak = Math.max(inboundPeak, Math.abs(value));
        await new Promise(resolve => setTimeout(resolve, 40));
      }
      lastTest = { time: new Date().toISOString(), passed: outboundPeak > 0.005 && inboundPeak > 0.005,
        outboundPeak: Number(outboundPeak.toFixed(4)), inboundPeak: Number(inboundPeak.toFixed(4)),
        scope: 'Local generated-microphone and incoming-audio graph only. No WebRTC handshake, phone call, or OpenAI validation.' };
      log(lastTest.passed ? 'Both local audio graph directions passed.' : 'A local audio graph direction was silent.');
      if (!lastTest.passed) throw new Error('One or both local audio graph directions were silent.');
    } finally {
      if (started) { voiceTone.stop(); customerTone.stop(); }
      for (const node of [voiceTone, customerTone, gainA, gainB, outboundMeter, inboundMeter, outboundSource, inboundSource, customerSource]) node?.disconnect();
      if (customerSource) inboundSources.delete(customerSource);
      microphone.getTracks().forEach(t => { t.stop(); clones.delete(t); });
      customer.stream.getTracks().forEach(t => t.stop()); testing = false; publish();
    }
  }
  window.addEventListener('message', event => {
    if (event.origin !== 'http://127.0.0.1:4318' || event.source === window || !event.source ||
        event.data?.source !== 'salesgod-voice-link-v1' || event.data?.type !== 'hello' ||
        !voiceToken || event.data.token !== voiceToken || Date.now() > voiceExpiry || !armed || testing || voicePair) return;
    if ([...peers].some(pc => !['closed', 'failed'].includes(pc.connectionState))) { log('Voice setup refused: dialer peer exists. Keep the dialer idle.'); publish(); return; }
    const helper = window[Symbol.for('salesgod.window.rtc.v1')];
    if (!helper) { log('Voice setup helper missing. Reload the updated extension.'); publish(); return; }
    const channel = new MessageChannel();
    const popup = event.source, token = voiceToken;
    voiceToken = undefined;
    const live = voiceKind === 'live';
    let link, pc, source, tone, gain, meter, meterSource, silent, rendered, measurement, gate, closed = false;
    let wasReady = false, lastMedia = '', opened = false;
    const callPeers = new Set();
    const pair = {
      kind: live ? 'live' : 'setup', media: { state: 'waiting', bridgeMicrophone: false },
      onPeerCreated(peer) { callPeers.add(peer); },
      refresh() {
        if (!live || closed || !link) return;
        const candidates = [...callPeers].filter(peer => !['closed', 'failed'].includes(peer.connectionState));
        const audioPeers = candidates.filter(peer => (peerAudio.get(peer)?.size ?? 0) || peer.getSenders?.().some(sender => sender.track?.kind === 'audio'));
        if (audioPeers.length > 1) { log('Multiple audio peers observed; live bridge stopped.'); pair.close(); return; }
        if (callPeers.size && !candidates.length) { link.send({ type: 'dialer-media-ended' }); log('Dialer media ended; live bridge stopped.'); pair.close(); return; }
        const peer = audioPeers[0];
        const mic = peer?.getSenders?.().some(sender => sender.track?.readyState === 'live' && sender.track.enabled !== false &&
          (clones.has(sender.track) || sender.track.getSettings?.().deviceId === DEVICE)) ?? false;
        const remote = peer && [...(peerAudio.get(peer) ?? [])].some(track => track.readyState === 'live');
        const ready = Boolean(peer?.connectionState === 'connected' && mic && remote);
        if (wasReady && !ready) { log('Dialer media lost; live bridge stopped.'); pair.close(); return; }
        if (ready) wasReady = true;
        pair.media = { state: ready ? 'ready' : peer ? 'connecting' : 'waiting', bridgeMicrophone: mic };
        const next = JSON.stringify(pair.media);
        if (next !== lastMedia) { lastMedia = next; link.send({ type: 'call-media', ...pair.media }); publish(); }
      },
      close() {
        if (closed) return; closed = true; clearInterval(watch); clearTimeout(expiry);
        link?.close(); if (!link) channel.port1.postMessage({ type: 'close' }); pc?.close(); channel.port1.close();
        clearInterval(measurement); tone?.stop();
        if (gate) gate.gain.value = 0;
        for (const node of [source, tone, gain, meter, meterSource, silent, gate]) node?.disconnect();
        if (rendered) { rendered.pause(); rendered.srcObject = null; }
        if (voicePair === pair) voicePair = undefined;
        voiceState = 'disconnected'; log('Voice setup pairing closed.'); publish();
      },
    };
    voicePair = pair; voiceState = 'paired';
    const watch = setInterval(() => { if (popup.closed) pair.close(); else pair.refresh(); }, 500);
    const expiry = setTimeout(() => pair.close(), live ? 330000 : 90000);
    channel.port1.onmessage = async ({ data }) => {
      if (data?.type === 'close') { pair.close(); return; }
      if (data?.type !== 'start' || closed || link || (data.mode === 'live') !== live) return;
      if (!armed || testing || [...peers].some(pc => !['closed', 'failed'].includes(pc.connectionState))) { pair.close(); return; }
      try {
      pc = new NativePeer();
      // A synthetic customer-side tone verifies the local input leg without a telephone call.
      gate = context.createGain(); gate.gain.value = live ? 0 : 1; gate.connect(outgoing);
      if (!live) {
        tone = context.createOscillator(); tone.frequency.value = 550;
        gain = context.createGain(); gain.gain.value = 0.05; tone.connect(gain).connect(incoming); tone.start();
      }
      link = helper.connect(channel.port1, { pc, stream: incoming.stream, offerer: false,
        onTrack(stream) {
          if (closed || !context) return;
          source = context.createMediaStreamSource(stream); source.connect(gate);
          meter = context.createAnalyser(); meter.fftSize = 2048;
          meterSource = context.createMediaStreamSource(outgoing.stream); meterSource.connect(meter);
          silent = context.createGain(); silent.gain.value = 0; meter.connect(silent).connect(context.destination);
          rendered = new Audio(); rendered.autoplay = true; rendered.volume = 0; rendered.srcObject = stream; rendered.play().catch(() => {});
          let peak = 0; const values = new Float32Array(2048);
          measurement = setInterval(() => {
            meter.getFloatTimeDomainData(values); for (const value of values) peak = Math.max(peak, Math.abs(value));
            link?.send({ type: 'bridge-evidence', microphonePeak: Number(peak.toFixed(5)) });
          }, 100);
        },
        onClose(error) { log(error.message); pair.close(); },
        onMessage(data) {
          if (live && data?.type === 'live-gate' && typeof data.open === 'boolean') {
            pair.refresh(); if (closed) return;
            opened = data.open && pair.media.state === 'ready'; gate.gain.value = opened ? 1 : 0;
            link.send({ type: 'gate-state', open: opened });
            log(opened ? 'Owner opened supervised AI audio.' : 'Supervised AI audio muted.'); publish(); return;
          }
          if (data?.type !== 'setup-report' || !['paired-routing-only', 'paired-idle-CRM'].includes(data.mode) || typeof data.passed !== 'boolean') return;
          const peak = value => Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
          const packets = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
          lastVoiceTest = { time: new Date().toISOString(), mode: data.mode, passed: data.passed,
            customerPeak: peak(data.customerPeak), microphonePeak: peak(data.microphonePeak),
            sentPackets: packets(data.sentPackets), receivedPackets: packets(data.receivedPackets),
            scope: 'Synthetic setup only; actual telephone media remains unverified.' };
          log(lastVoiceTest.passed ? 'Paired audio setup test passed.' : 'Paired audio setup test did not pass.'); publish();
        },
      });
      await link.ready; if (!closed) { voiceState = 'audio-connected'; pair.refresh(); log('Local voice audio connected. OpenAI status is shown only in the setup window.'); publish(); }
      }
      catch (error) { log(`Voice setup failed (${['TypeError', 'InvalidStateError', 'OperationError', 'InvalidAccessError', 'NotSupportedError'].includes(error.name) ? error.name : 'Error'}).`); pair.close(); }
    };
    channel.port1.start();
    popup.postMessage({ source: 'salesgod-voice-link-v1', type: 'paired', token }, event.origin, [channel.port2]);
    log('Voice setup paired with the local window; OpenAI is not connected yet.'); publish();
  });
  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== SOURCE || event.data?.type !== 'command') return;
    const { command, requestId } = event.data;
    if (!['status', 'arm', 'disarm', 'test', 'peer-test', 'prepare-voice'].includes(command)) return;
    try {
      if (command === 'prepare-voice') {
        if (!armed || testing || voicePair) throw new Error('Enable local routing and finish any other tests before voice setup.');
        if (typeof event.data.token !== 'string' || !/^[a-f0-9-]{36}$/.test(event.data.token)) throw new Error('Invalid pairing token.');
        voiceToken = event.data.token; voiceExpiry = Date.now() + 15000;
        voiceKind = event.data.mode === 'live' ? 'live' : 'setup';
      }
      if (command === 'arm') await arm();
      if (command === 'disarm') await disarm();
      if (command === 'test') await localTest();
      if (command === 'peer-test') await localPeerTest();
      publish(requestId);
    } catch (error) { log(`Diagnostic error: ${error.message}`); publish(requestId, error.message); }
  });
  window.addEventListener('pagehide', () => { void disarm(); });
  navigator.permissions?.query({ name: 'microphone' }).then(permission => {
    microphonePermission = permission.state; publish();
  }).catch(() => {});
  log('Extension hook loaded. Routing disabled; OpenAI disconnected.');
})();
