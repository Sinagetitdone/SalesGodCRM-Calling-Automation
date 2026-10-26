// Optional developer smoke test: synthetic tones, no microphone, API or CRM.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = ['vendor/lame.min.js', 'rehearsal-mp3.js', 'audio-transcript.js', 'call-recording.js'];
const js = `document.querySelector('button').onclick = async () => {
  const result = document.querySelector('pre'); result.textContent = 'Checking actual browser recorders…';
  const context = new AudioContext(); await context.resume();
  try {
    const outbound = context.createMediaStreamDestination(), inbound = context.createMediaStreamDestination();
    const recorder = new window.SalesGodCallRecording(context, outbound.stream, () => {}, true); recorder.addStream(inbound.stream); recorder.start();
    const now = context.currentTime;
    for (const [destination, start, frequency] of [[outbound, 0.1, 900], [inbound, 1.2, 1300]]) {
      const tone = context.createOscillator(); tone.frequency.value = frequency;
      const volume = context.createGain(); volume.gain.value = 0.15; tone.connect(volume).connect(destination);
      const silent = context.createGain(); silent.gain.value = 0; volume.connect(silent).connect(context.destination);
      tone.start(now + start); tone.stop(now + start + 0.65);
    }
    await new Promise(resolve => setTimeout(resolve, 2400));
    const mp3 = await recorder.finish(), segments = await recorder.transcriptSegments();
    const assistant = segments.filter(s => s.speaker === 'assistant'), customer = segments.filter(s => s.speaker === 'customer');
    if (mp3.size < 1000 || assistant.length !== 1 || customer.length !== 1 || assistant[0].end >= customer[0].end || customer[0].start < 0.8) throw new Error('Recorded speaker separation or timing failed.');
    result.textContent = JSON.stringify({passed:true,mixedMp3Bytes:mp3.size,segments:segments.map(({audio,...data})=>({...data,encodedBytes:audio.length})),microphoneUsed:false,apiUsed:false,phoneCalls:0},null,2);
  } catch(error) { result.textContent = 'FAILED: ' + error.message; }
  finally { await context.close(); }
};`;
const server = createServer(async (req, res) => {
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>No-call recorder check</title><h1>Recorded speaker check</h1><p>Synthetic tones only. No microphone, OpenAI API or dialer.</p><button>Run no-call recorder check</button><pre>Ready</pre>' + files.map(f => `<script src="/${f}"></script>`).join('') + '<script src="/check.js"></script>'); }
  if (req.url === '/check.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(js); }
  if (files.includes(req.url.slice(1))) { res.setHeader('Content-Type', 'text/javascript'); return res.end(await readFile(new URL('public' + req.url, import.meta.url))); }
  res.statusCode = 404; res.end();
});
server.listen(28432, '127.0.0.1', () => console.log('Synthetic browser recorder check: http://127.0.0.1:28432'));
