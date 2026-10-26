/* Transcribe recorded audio, never the planned/generated script. */
(() => {
  function intervals(samples, rate) {
    const hop = Math.max(1, Math.round(rate * 0.02)), ranges = [];
    let start, last, boundary = 0;
    for (let i = 0; i < samples.length; i += hop) {
      let energy = 0; const size = Math.min(hop, samples.length - i);
      for (let j = 0; j < size; j++) energy += samples[i + j] ** 2;
      if (Math.sqrt(energy / size) >= 0.008) { start ??= Math.max(boundary, i - Math.round(rate * 0.2)); last = i + size; }
      if (start !== undefined && ((i - last > rate && i - start > rate * 0.3) || i - start >= rate * 45)) {
        const end = Math.min(samples.length, last + Math.round(rate * 0.2));
        ranges.push([start, end]); boundary = end; start = last = undefined;
      }
    }
    if (start !== undefined) ranges.push([start, Math.min(samples.length, last + Math.round(rate * 0.2))]);
    return ranges;
  }
  async function fromRecording(blob, context, speaker) {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const samples = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const data = decoded.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) samples[i] += data[i] / decoded.numberOfChannels;
    }
    const ranges = intervals(samples, decoded.sampleRate);
    if (ranges.length > 80) throw new Error('Too many audio segments to finalize the transcript. Recording and live draft are retained.');
    const segments = [];
    for (const [start, end] of ranges) {
      const audio = await window.SalesGodMP3.encode([samples.subarray(start, end)], decoded.sampleRate);
      const bytes = new Uint8Array(await audio.arrayBuffer()); let binary = '';
      for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
      segments.push({ speaker, start: start / decoded.sampleRate, end: end / decoded.sampleRate, audio: btoa(binary) });
    }
    return segments;
  }
  window.SalesGodAudioTranscript = { intervals, fromRecording };
})();
