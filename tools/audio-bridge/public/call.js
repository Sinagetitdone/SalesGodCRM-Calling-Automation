/* Supervised first-call audio. Standard keys and business state stay on the local server. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('token'), openerOrigin = params.get('origin');
  const canPair = Boolean(window.opener && /^[a-f0-9-]{36}$/.test(token || '') &&
    ['https://www.salesgodcrm.net', 'https://salesgodcrm.net', location.origin].includes(openerOrigin));
  let port, run, configured = false, helloTimer, pairTimer;
  let report = { mode: 'supervised-call', phase: 'preparing', dialingEnabled: false, physicalMicrophoneUsed: false, events: [] };
  const controls = () => {
    $('prepare').disabled = !configured || !port || Boolean(run);
    $('answer').disabled = !run || !run.openaiReady || run.media.state !== 'ready' || !['ready', 'paused'].includes(report.phase);
    $('pause').disabled = !run || !['starting', 'talking'].includes(report.phase);
    $('stop').disabled = !run || run.stopping;
  };
  function render() { $('evidence').textContent = JSON.stringify(report, null, 2); controls(); }
  function phase(value, label) { report.phase = value; $('state').textContent = label; render(); }
  function log(event) {
    const current = run; if (!current) return Promise.resolve();
    report.events.push({ time: new Date().toISOString(), event }); if (report.events.length > 100) report.events.shift(); render();
    const body = { sessionId: report.sessionId, sequence: current.sequence++, event, phase: report.phase };
    current.journal = current.journal.then(async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch('/live-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true, signal: AbortSignal.timeout(5000) });
          if (!response.ok) throw new Error('Journal unavailable'); return;
        } catch { if (attempt) throw new Error('Local session log could not be saved.'); }
      }
    }).catch(() => {
      current.logFailed = true; $('error').textContent = 'The local event log is unavailable. AI has been stopped; end the phone call in SalesGodCRM.';
      if (!current.stopping) void finish('failed', 'Stopped because the event log failed');
    });
    return current.journal;
  }
  function send(message) { if (run?.dc.readyState === 'open') run.dc.send(JSON.stringify(message)); }
  function mute() {
    if (!run) return;
    run.input.enabled = false; run.output.gain.value = 0; run.vadPending = false; clearTimeout(run.vadTimer);
    run.link?.send({ type: 'live-gate', open: false });
    if (run.responseActive) send({ type: 'response.cancel' });
    send({ type: 'output_audio_buffer.clear' });
    send({ type: 'session.update', session: { type: 'realtime', audio: { input: { turn_detection: null } } } });
  }
  async function finish(finalPhase = 'stopped', label = 'AI stopped — end the phone call in SalesGodCRM') {
    const current = run; if (!current || current.stopping) return;
    current.stopping = true; mute(); current.abort.abort(); clearTimeout(current.limit); clearTimeout(current.connectDeadline);
    clearInterval(current.meterTimer); current.dc.close(); current.pc.close(); current.link?.close();
    current.renderers.forEach(audio => { audio.pause(); audio.srcObject = null; });
    current.nodes.forEach(node => node.disconnect());
    current.customer.stream.getTracks().forEach(track => track.stop()); current.ai.stream.getTracks().forEach(track => track.stop());
    await current.context.close().catch(() => {});
    phase(finalPhase, label); report.endedAt = new Date().toISOString(); await log('session.stopped');
    if (run === current) run = undefined;
    $('pairing').textContent = 'Pairing closed. Reopen supervised call from the extension for another call.';
    $('savedLog').disabled = false; render();
  }
  function ready() {
    if (!run || run.stopping || !['waiting', 'ready'].includes(report.phase)) return;
    phase(run.openaiReady && run.media.state === 'ready' ? 'ready' : 'waiting',
      run.openaiReady && run.media.state === 'ready' ? 'Audio ready · verify a person answered before starting AI' : 'AI prepared and silent · waiting for dialer audio');
  }
  async function confirmAnswer() {
    if (!run || $('answer').disabled) return;
    phase('starting', 'Starting AI after owner-confirmed answer…');
    await log('owner.answer_confirmed'); if (!run || run.stopping || run.logFailed || report.phase !== 'starting') return;
    run.link.send({ type: 'live-gate', open: true });
    run.vadTimer = setTimeout(() => { $('error').textContent = 'The speaking controls were not acknowledged. AI is stopped.'; void finish('failed'); }, 6000);
  }
  async function start() {
    if (!port || !configured || run) return;
    const context = new AudioContext({ sampleRate: 48000 });
    const customer = context.createMediaStreamDestination(), ai = context.createMediaStreamDestination();
    const output = context.createGain(); output.gain.value = 0; output.connect(ai);
    const pc = new RTCPeerConnection(), dc = pc.createDataChannel('oai-events');
    const current = { context, customer, ai, output, pc, dc, input: customer.stream.getAudioTracks()[0], abort: new AbortController(),
      nodes: [output], renderers: [], sequence: 0, journal: Promise.resolve(), stopping: false, openaiReady: false,
      media: { state: 'waiting', bridgeMicrophone: false }, responseActive: false, playback: false, logFailed: false };
    run = current; current.input.enabled = false;
    report = { mode: 'supervised-call', sessionId: crypto.randomUUID(), startedAt: new Date().toISOString(), phase: 'preparing',
      dialingEnabled: false, physicalMicrophoneUsed: false, customerTurns: 0, aiTurns: 0, interruptions: 0, aiAudioPeak: 0, events: [] };
    $('error').textContent = ''; phase('preparing', 'Preparing silent OpenAI audio…');
    current.limit = setTimeout(() => void finish('stopped', 'Five-minute AI session limit reached — end the phone call in SalesGodCRM'), 300000);
    current.connectDeadline = setTimeout(() => { $('error').textContent = 'Audio preparation timed out.'; void finish('failed'); }, 40000);
    function consume(stream, destination, measure = false) {
      if (current.stopping) return;
      const source = context.createMediaStreamSource(stream); source.connect(destination); current.nodes.push(source);
      const silent = context.createGain(); silent.gain.value = 0; source.connect(silent).connect(context.destination); current.nodes.push(silent);
      const audio = new Audio(); audio.autoplay = true; audio.volume = 0; audio.srcObject = stream; current.renderers.push(audio); audio.play().catch(() => {});
      if (measure) {
        const meter = context.createAnalyser(); meter.fftSize = 2048; source.connect(meter); current.nodes.push(meter);
        const values = new Float32Array(2048);
        current.meterTimer = setInterval(() => { meter.getFloatTimeDomainData(values); for (const value of values) report.aiAudioPeak = Math.max(report.aiAudioPeak, Math.abs(value)); report.aiAudioPeak = Number(report.aiAudioPeak.toFixed(5)); render(); }, 200);
      }
    }
    try {
      await context.resume(); await log('session.started'); if (current.stopping || current.logFailed) return;
      current.linkPc = new RTCPeerConnection(); const selectedPort = port; port = undefined;
      selectedPort.postMessage({ type: 'start', mode: 'live' });
      current.link = window[Symbol.for('salesgod.window.rtc.v1')].connect(selectedPort, {
        pc: current.linkPc, stream: ai.stream, offerer: true, onTrack: stream => consume(stream, customer),
        onClose: () => { if (!current.stopping) { void log('bridge.disconnected'); void finish('stopped', 'Dialer or bridge disconnected — end any remaining phone call in SalesGodCRM'); } },
        onMessage: async data => {
          if (current.stopping) return;
          if (data?.type === 'dialer-media-ended') { void log('dialer.media_ended'); void finish('stopped', 'Dialer audio ended · AI stopped'); return; }
          if (data?.type === 'call-media' && ['ready', 'connecting', 'waiting'].includes(data.state)) {
            current.media = { state: data.state, bridgeMicrophone: data.bridgeMicrophone === true };
            if (!current.media.bridgeMicrophone && current.media.state === 'ready') current.media.state = 'connecting';
            report.media = current.media; $('media').textContent = current.media.state === 'ready' ? 'Dialer audio connected · generated microphone verified' : 'Waiting for connected dialer audio and the generated microphone';
            if (current.media.state !== 'ready' && ['starting', 'talking', 'paused'].includes(report.phase)) {
              void finish('failed', 'Dialer audio lost · AI stopped'); return;
            }
            if (current.media.state === 'ready') void log('dialer.media_ready'); ready();
          }
          if (data?.type === 'gate-state' && report.phase === 'starting') {
            if (!data.open || current.media.state !== 'ready') { $('error').textContent = 'Dialer audio is not ready.'; void finish('failed'); return; }
            current.vadPending = true; send({ type: 'input_audio_buffer.clear' });
            send({ type: 'session.update', session: { type: 'realtime', audio: { input: { turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true, silence_duration_ms: 600, prefix_padding_ms: 300 } } } } });
          }
        },
      });
      await current.link.ready; if (current.stopping) return;
      pc.addTrack(current.input, customer.stream);
      pc.addEventListener('track', ({ streams, track }) => consume(streams[0] ?? new MediaStream([track]), output, true));
      pc.addEventListener('connectionstatechange', () => { if (!current.stopping && ['failed', 'closed', 'disconnected'].includes(pc.connectionState)) void finish('failed', 'OpenAI media lost — end the phone call in SalesGodCRM'); });
      dc.addEventListener('close', () => { if (!current.stopping) void finish('failed', 'OpenAI control channel closed — end the phone call in SalesGodCRM'); });
      dc.addEventListener('open', () => {
        if (current.stopping) return; current.openaiReady = true; clearTimeout(current.connectDeadline);
        $('pairing').textContent = 'CRM audio link connected · OpenAI connected';
        phase('waiting', 'AI prepared and silent · waiting for dialer audio'); void log('openai.ready'); ready();
      });
      dc.addEventListener('message', async ({ data }) => {
        if (current.stopping) return;
        let message; try { message = JSON.parse(data); } catch { return; }
        const vad = message.session?.audio?.input?.turn_detection;
        if (message.type === 'session.updated' && current.vadPending && report.phase === 'starting' && vad?.type === 'server_vad' && vad.create_response === true && vad.interrupt_response === true) {
          current.vadPending = false; clearTimeout(current.vadTimer); await log('conversation.started');
          if (current.stopping || current.logFailed || report.phase !== 'starting' || current.media.state !== 'ready' || !current.media.bridgeMicrophone) return;
          current.input.enabled = true; output.gain.value = 1; phase('talking', 'AI conversation active · customer may interrupt');
          send({ type: 'response.create', response: { instructions: 'Introduce yourself as an AI assistant calling for Sina for a brief audio test, then ask: Can you hear me clearly?' } });
        }
        if (message.type === 'input_audio_buffer.speech_started') {
          report.customerTurns++; void log('customer.speech_started');
          if (current.responseActive || current.playback) { report.interruptions++; void log('ai.interrupted'); }
        }
        if (message.type === 'input_audio_buffer.speech_stopped') void log('customer.speech_stopped');
        if (message.type === 'response.created') { current.responseActive = true; report.aiTurns++; void log('ai.response_started'); }
        if (message.type === 'response.done') {
          current.responseActive = false;
          if (message.response?.status === 'completed') { report.aiResponsesCompleted = (report.aiResponsesCompleted ?? 0) + 1; void log('ai.response_completed'); }
          else if (message.response?.status === 'cancelled') void log('ai.response_cancelled');
          else { $('error').textContent = 'The AI response failed. End the phone call in SalesGodCRM.'; void log('ai.response_failed'); void finish('failed'); }
        }
        if (message.type === 'output_audio_buffer.started') current.playback = true;
        if (openerOrigin === location.origin && message.type === 'response.output_audio_transcript.done' && /\borange\b/i.test(message.transcript || '')) {
          report.simulatedWordConfirmed = true;
        }
        if (['output_audio_buffer.stopped', 'output_audio_buffer.cleared'].includes(message.type)) current.playback = false;
        if (message.type === 'error' && !['response_cancel_not_active', 'output_audio_buffer_empty'].includes(message.error?.code)) {
          $('error').textContent = 'OpenAI reported a session error. AI has been stopped.'; void log('session.error'); void finish('failed');
        }
        render();
      });
      await pc.setLocalDescription(await pc.createOffer()); if (current.stopping) return;
      const response = await fetch('/session', { method: 'POST', headers: { 'Content-Type': 'application/sdp', 'X-Audio-Mode': 'supervised-call' }, body: pc.localDescription.sdp, signal: current.abort.signal });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'OpenAI setup failed.'); }
      if (!current.stopping) await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() });
    } catch (error) {
      if (!current.stopping) { $('error').textContent = error.message; void log('session.error'); await finish('failed'); }
    }
  }
  window.addEventListener('message', event => {
    if (!canPair || port || run || event.source !== window.opener || event.origin !== openerOrigin || event.data?.source !== 'salesgod-voice-link-v1' || event.data.type !== 'paired' || event.data.token !== token || !event.ports[0]) return;
    port = event.ports[0]; clearInterval(helloTimer); clearTimeout(pairTimer); $('pairing').textContent = 'CRM page paired · OpenAI not yet connected'; controls();
  });
  if (canPair) {
    const hello = () => window.opener.postMessage({ source: 'salesgod-voice-link-v1', type: 'hello', token }, openerOrigin);
    helloTimer = setInterval(hello, 500); hello();
    pairTimer = setTimeout(() => { clearInterval(helloTimer); $('pairing').textContent = 'Pairing timed out. Reload the latest extension and reopen this control tab.'; }, 15000);
  }
  $('prepare').onclick = () => void start(); $('answer').onclick = () => void confirmAnswer();
  $('pause').onclick = () => { if (!run || $('pause').disabled) return; mute(); phase('paused', 'AI paused · phone call remains connected'); void log('ai.paused'); };
  $('stop').onclick = () => void finish();
  $('save').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'salesgod-supervised-call.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  $('savedLog').onclick = async () => { const response = await fetch('/live-log/' + report.sessionId); if (!response.ok) return; $('journal').hidden = false; $('journal').textContent = JSON.stringify(await response.json(), null, 2); };
  window.addEventListener('pagehide', () => { clearInterval(helloTimer); clearTimeout(pairTimer); port?.postMessage({ type: 'close' }); port?.close(); void finish(); });
  fetch('/status').then(response => response.json()).then(status => { configured = status.keyConfigured; $('configuration').textContent = configured ? `Local key configured · ${status.model} · AI voice: marin` : 'Add the OpenAI key to the local .env file and restart the bridge.'; controls(); }).catch(() => { $('configuration').textContent = 'Local bridge unavailable'; });
})();
