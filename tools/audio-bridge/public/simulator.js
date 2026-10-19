/* Capture the original constructor before loading the extension hook; only the dialer leg is observed. */
(() => {
  'use strict';
  const NativePeer = window.RTCPeerConnection;
  window.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    let call, speechBuffer;
    let report = { realPhoneCalls: 0, physicalMicrophoneUsed: false, aiReceivedPeak: 0, connected: false };
    const render = () => { $('simEvidence').textContent = JSON.stringify(report, null, 2); };
    async function hangup() {
      const current = call; if (!current) return; call = undefined;
      current.abort.abort(); clearInterval(current.meterTimer); clearTimeout(current.limit);
      current.dialer.close(); current.customer.close(); current.speech?.stop();
      current.microphone?.getTracks().forEach(track => track.stop()); current.voice.stream.getTracks().forEach(track => track.stop());
      current.nodes.forEach(node => node.disconnect()); current.audio?.pause(); if (current.audio) current.audio.srcObject = null;
      await current.context.close();
      report.connected = false; report.ended = true; render(); $('simState').textContent = 'Simulated call ended';
      $('connectSim').disabled = false; $('speechSim').disabled = $('hangupSim').disabled = true;
    }
    $('connectSim').onclick = async () => {
      if (call) return;
      $('connectSim').disabled = true;
      const context = new AudioContext({ sampleRate: 48000 }), voice = context.createMediaStreamDestination();
      const dialer = new window.RTCPeerConnection({ iceServers: [] }), customer = new NativePeer({ iceServers: [] });
      const current = { context, voice, dialer, customer, nodes: [], abort: new AbortController() }; call = current;
      report = { realPhoneCalls: 0, physicalMicrophoneUsed: false, aiReceivedPeak: 0, connected: false };
      try {
        await context.resume();
        current.microphone = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: 'salesgod-ai-bridge-local-v1' } }, video: false });
        dialer.addTrack(current.microphone.getAudioTracks()[0], current.microphone); customer.addTrack(voice.stream.getAudioTracks()[0], voice.stream);
        customer.addEventListener('track', ({ streams, track }) => {
          const stream = streams[0] ?? new MediaStream([track]);
          const source = context.createMediaStreamSource(stream), meter = context.createAnalyser(), silent = context.createGain();
          meter.fftSize = 2048; silent.gain.value = 0; source.connect(meter).connect(silent).connect(context.destination); current.nodes.push(source, meter, silent);
          const audio = new Audio(); audio.autoplay = true; audio.volume = 0; audio.srcObject = stream; current.audio = audio; audio.play().catch(() => {});
          const values = new Float32Array(2048);
          current.meterTimer = setInterval(() => { meter.getFloatTimeDomainData(values); for (const value of values) report.aiReceivedPeak = Math.max(report.aiReceivedPeak, Math.abs(value)); report.aiReceivedPeak = Number(report.aiReceivedPeak.toFixed(5)); render(); }, 200);
        });
        await window[Symbol.for('salesgod.local.rtc.v1')].negotiate(dialer, customer, { signal: current.abort.signal });
        report.connected = true; render(); $('simState').textContent = 'Simulated dialer connected · waiting for owner-confirmed AI start';
        $('speechSim').disabled = $('hangupSim').disabled = false;
        current.limit = setTimeout(() => void hangup(), 180000);
      } catch (error) { $('simState').textContent = 'Simulation failed: ' + error.message; await hangup(); }
    };
    $('speechSim').onclick = async () => {
      const current = call; if (!current) return;
      $('speechSim').disabled = true;
      let stage = 'voice generation';
      try {
        if (!speechBuffer) {
          const response = await fetch('/simulation-speech', { method: 'POST', signal: current.abort.signal });
          if (!response.ok) throw new Error('Synthetic customer speech is unavailable.');
          speechBuffer = await response.arrayBuffer();
        }
        if (call !== current) return;
        stage = 'audio decoding'; const decoded = await current.context.decodeAudioData(speechBuffer.slice(0));
        if (call !== current) return;
        stage = 'audio playback'; current.speech?.stop(); const source = current.context.createBufferSource(); source.buffer = decoded; source.connect(current.voice);
        current.nodes.push(source); current.speech = source; source.start();
        report.customerSpeechPlayed = (report.customerSpeechPlayed ?? 0) + 1; render(); $('simState').textContent = 'Synthetic customer speech sent through the simulated dialer';
      } catch { $('simState').textContent = 'Synthetic customer speech failed during ' + stage + '. Retry the simulated speech when the service is available.'; }
      finally { if (call === current) $('speechSim').disabled = false; }
    };
    $('hangupSim').onclick = () => void hangup(); window.addEventListener('pagehide', () => void hangup()); render();
  });
})();
