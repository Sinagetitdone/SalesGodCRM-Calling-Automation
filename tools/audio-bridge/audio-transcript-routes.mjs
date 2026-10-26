import { openAIFailure } from './openai-errors.mjs';
import { diagnosticDetail } from './diagnostics.mjs';

export function audioTranscriptRoutes(app, { env, fetchImpl, campaigns }) {
  let busy = false;
  const uuid = { type: 'string', pattern: '^[a-f0-9-]{36}$' };
  app.post('/campaigns-api/:id/:contact/audio-transcript', { bodyLimit: 20000000, schema: {
    params: { type: 'object', required: ['id', 'contact'], properties: { id: uuid, contact: uuid } },
    body: { type: 'object', additionalProperties: false, required: ['workerId', 'session', 'segments'], properties: {
      workerId: uuid, session: uuid, segments: { type: 'array', maxItems: 160, items: { type: 'object', additionalProperties: false, required: ['speaker', 'start', 'end', 'audio'], properties: {
        speaker: { enum: ['assistant', 'customer'] }, start: { type: 'number', minimum: 0, maximum: 360 }, end: { type: 'number', minimum: 0, maximum: 360 }, audio: { type: 'string', maxLength: 2000000, minLength: 4, pattern: '^[A-Za-z0-9+/]+={0,2}$' }
      } } }
    } }
  } }, async (request, reply) => {
    if (busy) return reply.code(409).send({ error: 'Another recorded call is being transcribed.' });
    const { id, contact } = request.params, { workerId, session, segments } = request.body;
    const store = campaigns(); let started = false;
    try {
      for (const segment of segments) {
        const bytes = Buffer.from(segment.audio, 'base64');
        if (segment.end <= segment.start || segment.end - segment.start > 46 || bytes[0] !== 0xff || (bytes[1] & 0xe0) !== 0xe0) throw new Error('Invalid recorded audio segment.');
      }
      const prior = store.beginAudioTranscript(id, contact, workerId, session);
      if (prior === 'complete') return { saved: true, source: 'recorded_audio' };
      if (prior !== 'started') throw new Error('This audio transcription has already been attempted; review its saved result.');
      started = true; busy = true;
      if (!env.OPENAI_API_KEY?.trim()) throw new Error('Configure the local OpenAI key to transcribe the recorded call.');
      const signal = AbortSignal.timeout(180000), turns = [];
      for (const [index, segment] of segments.entries()) {
        const form = new FormData();
        form.set('model', 'gpt-transcribe');
        form.set('file', new Blob([Buffer.from(segment.audio, 'base64')], { type: 'audio/mpeg' }), 'call-segment.mp3');
        // Do not feed the planned script or the inaccurate draft into the recognizer.
        const response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY }, body: form, signal });
        if (!response.ok) { const failure = await openAIFailure(response); throw new Error(`Recorded-audio transcription: ${failure.error} [${failure.errorCode}; HTTP ${failure.upstreamStatus}]`); }
        const result = await response.json();
        if (typeof result.text !== 'string' || result.text.length > 20000) throw new Error('Transcription returned an invalid text result.');
        if (result.text.trim()) turns.push({ item: 'recorded_' + index, speaker: segment.speaker, text: result.text.trim(), start: segment.start, end: segment.end, source: 'recorded_audio' });
      }
      turns.sort((a, b) => a.start - b.start);
      if (!turns.length && store.liveTranscripts(id, contact).length) throw new Error('No speech was recovered from the recorded audio. Recording and live draft retained for review.');
      store.finishAudioTranscript(id, contact, turns); return { saved: true, source: 'recorded_audio' };
    } catch (error) {
      const reason = diagnosticDetail(error.name === 'TimeoutError' ? 'Recorded-audio transcription exceeded 180 seconds. Recording and live draft retained.' : error.message);
      if (started) { try { store.finishAudioTranscript(id, contact, [], reason); } catch {} }
      return reply.code(502).send({ error: reason });
    } finally { if (started) busy = false; }
  });
}
