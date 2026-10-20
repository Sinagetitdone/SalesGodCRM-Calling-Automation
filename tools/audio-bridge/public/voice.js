/* Local setup only. The standard API key stays on the loopback server. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('token');
  const openerOrigin = params.get('origin');
  const allowedOrigins = ['https://www.salesgodcrm.net', 'https://salesgodcrm.net', location.origin];
  const pairRequested = Boolean(token && /^[a-f0-9-]{36}$/.test(token) && allowedOrigins.includes(openerOrigin) && window.opener);
  let active, pairPort, helloTimer, pairTimer, configured = false;
  let report = { dialingEnabled: false, physicalMicrophoneUsed: false, events: [] };
  const failureCodes = ['unsupported_country_region_territory', 'ip_not_authorized', 'invalid_api_key', 'insufficient_quota', 'rate_limit_exceeded', 'model_not_found', 'access_denied', 'upstream_error'];
  function event(type) { report.events.push({ time: new Date().toISOString(), type }); if (report.events.length > 60) report.events.shift(); render(); }
  function render() { $('evidence').textContent = JSON.stringify(report, null, 2); }
  function controls() {
    $('synthetic').disabled = !configured || Boolean(active) || pairRequested;
    $('paired').hidden = !pairRequested;
    $('routing').hidden = !pairRequested;
    $('routing').disabled = !pairPort || Boolean(active);
    $('paired').disabled = !configured || !pairPort || Boolean(active);
    $('stop').disabled = !active;
  }
  async function stats(pc) {
    const result = { sentPackets: 0, receivedPackets: 0, receivedAudioEnergy: 0 };
    for (const item of (await pc.getStats()).values()) {
      if (item.kind !== 'audio') continue;
      if (item.type === 'outbound-rtp') result.sentPackets += item.packetsSent ?? 0;
      if (item.type === 'inbound-rtp') { result.receivedPackets += item.packetsReceived ?? 0; result.receivedAudioEnergy += item.totalAudioEnergy ?? 0; }
    }
    return result;
  }
  async function stop(reason = 'Disconnected') {
    const run = active; if (!run || run.stopping) return; run.stopping = true;
    clearTimeout(run.limit); for (const timer of run.meterTimers) clearInterval(timer);
    run.controller.abort();
    try { report.openAI = await stats(run.pc); if (run.linkPc) report.localLink = await stats(run.linkPc); } catch {}
    run.link?.send({ type: 'setup-report', mode: report.mode, passed: report.passed,
      customerPeak: report.customerPeak, microphonePeak: report.crmMicrophonePeak,
      sentPackets: report.localLink?.sentPackets, receivedPackets: report.localLink?.receivedPackets });
    run.channel.close(); run.pc.close(); run.link?.close();
    for (const oscillator of run.oscillators) oscillator.stop();
    for (const renderer of run.renderers) { renderer.pause(); renderer.srcObject = null; }
    for (const node of run.nodes) node.disconnect();
    run.customer.stream.getTracks().forEach(track => track.stop()); run.ai.stream.getTracks().forEach(track => track.stop());
    await run.context.close().catch(() => {});
    if (active === run) active = undefined;
    report.stopReason = reason; report.endedAt = new Date().toISOString();
    $('state').textContent = reason; event('session.stopped'); controls();
    if (pairRequested) $('pairing').textContent = 'Pairing ended. Reopen voice setup from the extension to run another paired test.';
  }
  async function start(paired, localOnly = false) {
    if (active || (!configured && !localOnly) || (paired && !pairPort)) return;
    $('error').textContent = '';
    report = { startedAt: new Date().toISOString(), mode: localOnly ? 'paired-routing-only' : paired ? 'paired-idle-CRM' : 'standalone-silent-input', openAIAttempted: !localOnly, dialingEnabled: false,
      physicalMicrophoneUsed: false, passed: false, audioPeak: 0, responseCompleted: false, events: [] };
    const context = new AudioContext({ sampleRate: 48000 });
    const customer = context.createMediaStreamDestination(), ai = context.createMediaStreamDestination();
    const pc = new RTCPeerConnection(), channel = pc.createDataChannel('oai-events');
    const run = { context, customer, ai, pc, channel, controller: new AbortController(), renderers: [], nodes: [], oscillators: [], meterTimers: [], stopping: false };
    active = run; controls(); $('state').textContent = 'Connecting to OpenAI…';
    function consume(stream, destination, measure) {
      const source = context.createMediaStreamSource(stream); source.connect(destination); run.nodes.push(source);
      const sink = context.createGain(); sink.gain.value = 0; source.connect(sink).connect(context.destination); run.nodes.push(sink);
      const renderer = new Audio(); renderer.autoplay = true; renderer.volume = 0; renderer.srcObject = stream;
      run.renderers.push(renderer); renderer.play().catch(() => {});
      if (measure) {
        const analyser = context.createAnalyser(); analyser.fftSize = 2048; source.connect(analyser); run.nodes.push(analyser);
        const samples = new Float32Array(2048);
        report[measure] = 0;
        run.meterTimers.push(setInterval(() => {
          if (run.stopping) return;
          analyser.getFloatTimeDomainData(samples);
          for (const sample of samples) report[measure] = Math.max(report[measure], Math.abs(sample));
          report[measure] = Number(report[measure].toFixed(5));
          void finishIfReady();
        }, 50));
      }
    }
    async function finishIfReady() {
      if (localOnly) {
        if (run.stopping || !(report.customerPeak > 0.001) || !(report.crmMicrophonePeak > 0.001)) return;
        const received = await stats(run.linkPc); if (run.stopping) return;
        if (received.sentPackets > 0 && received.receivedPackets > 0) {
          report.passed = true; event('local.routing.passed'); await stop('Local audio routing passed · disconnected');
        }
        return;
      }
      if (run.stopping || !report.responseCompleted || !report.outputDrained || report.audioPeak < 0.001) return;
      if (paired && (!(report.customerPeak > 0.001) || !(report.crmMicrophonePeak > 0.001))) return;
      const received = await stats(pc); if (run.stopping) return;
      if (received.receivedPackets > 0 && (!run.linkPc || run.linkPc.connectionState === 'connected')) {
        report.passed = true; event('test.passed'); await stop('AI audio test passed · disconnected');
      }
    }
    run.limit = setTimeout(() => { $('error').textContent = 'The test did not complete within 45 seconds.'; void stop('Test timed out'); }, 45000);
    try {
      await context.resume();
      if (paired) {
        $('state').textContent = 'Connecting local CRM audio…';
        run.linkPc = new RTCPeerConnection();
        const port = pairPort; pairPort = undefined;
        port.postMessage({ type: 'start' });
        run.link = window[Symbol.for('salesgod.window.rtc.v1')].connect(port, {
          pc: run.linkPc, stream: ai.stream, offerer: true,
          onTrack: stream => consume(stream, customer, 'customerPeak'),
          onMessage: data => {
            if (data?.type === 'bridge-evidence' && Number.isFinite(data.microphonePeak) && data.microphonePeak >= 0 && data.microphonePeak <= 1) {
              report.crmMicrophonePeak = data.microphonePeak; render(); void finishIfReady();
            }
          },
          onClose: error => { if (!run.stopping) { $('error').textContent = error.message; void stop('Pairing disconnected'); } },
        });
        await run.link.ready; event('local.audio.connected');
      }
      if (run.stopping) return;
      if (localOnly) {
        const tone = context.createOscillator(); tone.frequency.value = 660;
        const gain = context.createGain(); gain.gain.value = 0.05; tone.connect(gain).connect(ai);
        run.nodes.push(tone, gain); run.oscillators.push(tone); tone.start();
        $('state').textContent = 'Testing synthetic audio in both local directions…'; return;
      }
      for (const track of customer.stream.getAudioTracks()) pc.addTrack(track, customer.stream);
      pc.addEventListener('track', ({ streams, track }) => { if (!run.stopping) consume(streams[0] ?? new MediaStream([track]), ai, 'audioPeak'); });
      pc.addEventListener('connectionstatechange', () => {
        if (run.stopping) return;
        report.connectionState = pc.connectionState; render();
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) void stop('OpenAI audio disconnected');
      });
      channel.addEventListener('open', () => {
        if (run.stopping) return;
        event('openai.channel.open'); $('state').textContent = 'OpenAI connected · checking generated speech…';
        channel.send(JSON.stringify({ type: 'response.create', response: { instructions: 'Say exactly one short sentence: I am an AI assistant, and the audio setup test is working.' } }));
      });
      channel.addEventListener('message', ({ data }) => {
        if (run.stopping) return;
        let message; try { message = JSON.parse(data); } catch { return; }
        if (['session.created', 'session.updated', 'response.created', 'response.done', 'output_audio_buffer.stopped'].includes(message.type)) event(message.type);
        if (message.type === 'output_audio_buffer.stopped') { report.outputDrained = true; void finishIfReady(); }
        if (message.type === 'error') { $('error').textContent = 'OpenAI reported a session error. Check model access and billing.'; void stop('OpenAI session error'); }
        if (message.type === 'response.done') {
          report.responseCompleted = message.response?.status === 'completed';
          if (!report.responseCompleted) { $('error').textContent = 'OpenAI did not complete the test response.'; void stop('AI response failed'); }
          else void finishIfReady();
        }
      });
      await pc.setLocalDescription(await pc.createOffer());
      if (run.stopping) return;
      const response = await fetch('/session', { method: 'POST', headers: { 'Content-Type': 'application/sdp', 'X-Audio-Test': '1' }, body: pc.localDescription.sdp, signal: run.controller.signal });
      if (!response.ok) {
        const error = await response.json();
        report.failure = { stage: 'openai_session', httpStatus: response.status,
          ...(Number.isInteger(error.upstreamStatus) && error.upstreamStatus >= 100 && error.upstreamStatus <= 599 ? { upstreamStatus: error.upstreamStatus } : {}),
          errorCode: failureCodes.includes(error.errorCode) ? error.errorCode : 'connection_failed' };
        throw new Error(error.error || 'OpenAI connection failed.');
      }
      if (run.stopping) return;
      await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() });
      event('openai.sdp.accepted');
    } catch (error) {
      if (!run.stopping) { $('error').textContent = error.message; report.failed = true; report.failure ??= { stage: 'audio_connection', errorCode: 'connection_failed' }; await stop('Connection failed'); }
    }
  }
  window.addEventListener('message', event => {
    if (!pairRequested || event.source !== window.opener || event.origin !== openerOrigin || event.data?.source !== 'salesgod-voice-link-v1' || event.data?.token !== token || event.data?.type !== 'paired' || pairPort || active) return;
    const port = event.ports[0]; if (!port) return;
    pairPort = port; clearInterval(helloTimer); clearTimeout(pairTimer);
    $('pairing').textContent = 'CRM audio paired · still disconnected from OpenAI'; controls();
  });
  if (pairRequested) {
    $('pairing').textContent = 'Waiting for the idle CRM audio bridge…';
    const hello = () => window.opener.postMessage({ source: 'salesgod-voice-link-v1', type: 'hello', token }, openerOrigin);
    helloTimer = setInterval(hello, 500); hello();
    pairTimer = setTimeout(() => { clearInterval(helloTimer); $('pairing').textContent = 'Pairing timed out. Reload the updated extension and reopen voice setup from its panel.'; }, 15000);
  }
  $('synthetic').onclick = () => void start(false); $('paired').onclick = () => void start(true); $('stop').onclick = () => void stop();
  $('routing').onclick = () => void start(true, true);
  $('save').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'salesgod-ai-voice-test.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  window.addEventListener('pagehide', () => {
    clearInterval(helloTimer); clearTimeout(pairTimer); pairPort?.postMessage({ type: 'close' }); pairPort?.close();
    if (active) { active.pc.close(); active.link?.close(); void active.context.close(); }
  });
  fetch('/status').then(response => response.json()).then(status => {
    configured = status.keyConfigured;
    $('configuration').textContent = configured ? `Local key configured · ${status.model} · AI voice: marin` : 'Add OPENAI_API_KEY to the local .env file and restart the bridge.';
    controls();
  }).catch(() => { $('configuration').textContent = 'The local setup server is unavailable.'; });
})();
