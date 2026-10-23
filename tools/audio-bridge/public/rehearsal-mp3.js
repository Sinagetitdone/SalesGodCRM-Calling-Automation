/* Convert the browser recording locally. No audio is uploaded for conversion. */
(() => {
  'use strict';
  async function encode(channels, sampleRate) {
    if (!channels.length || !channels[0].length) throw new Error('The rehearsal recording is empty.');
    const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128), parts = [];
    for (let offset = 0; offset < channels[0].length; offset += 1152) {
      const samples = new Int16Array(Math.min(1152, channels[0].length - offset));
      for (let i = 0; i < samples.length; i++) {
        let value = 0; for (const channel of channels) value += channel[offset + i] / channels.length;
        value = Math.max(-1, Math.min(1, value)); samples[i] = Math.round(value * (value < 0 ? 32768 : 32767));
      }
      const data = encoder.encodeBuffer(samples); if (data.length) parts.push(new Int8Array(data));
      // Keep Stop, rendering and the worker heartbeat responsive during encoding.
      if (offset % (1152 * 64) === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    const end = encoder.flush(); if (end.length) parts.push(new Int8Array(end));
    return new Blob(parts, { type: 'audio/mpeg' });
  }
  window.SalesGodMP3 = { encode, async fromRecording(blob, context) {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    return encode(Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i)), decoded.sampleRate);
  } };
})();
