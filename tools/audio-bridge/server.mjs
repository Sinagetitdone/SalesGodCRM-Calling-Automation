import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SessionJournal, journalEvents, phases } from './session-journal.mjs';

export function createBridge({ env = process.env, fetchImpl = fetch, journal: suppliedJournal } = {}) {
  const app = Fastify({ logger: false, bodyLimit: 128 * 1024, ajv: { customOptions: { removeAdditional: false } } });
  const host = '127.0.0.1:4318';
  const origin = `http://${host}`;
  let connecting = false;
  let journal = suppliedJournal, simulationSpeech;
  const getJournal = () => journal ??= new SessionJournal(env.AUDIO_DATABASE_PATH || 'data/live-audio.db');
  app.addHook('onClose', async () => { if (!suppliedJournal) journal?.close(); });
  app.addHook('onRequest', async (request, reply) => {
    if (request.headers.host !== host ||
        (request.headers.origin && request.headers.origin !== origin) ||
        (request.method !== 'GET' && request.headers.origin !== origin)) {
      return reply.code(403).send({ error: 'Open the bridge on this computer at ' + origin });
    }
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'");
  });
  for (const [route, name, type] of [
    ['/', 'setup.html', 'text/html; charset=utf-8'],
    ['/style.css', 'style.css', 'text/css; charset=utf-8'],
    ['/panel.css', 'panel.css', 'text/css; charset=utf-8'],
    ['/voice-test', 'voice.html', 'text/html; charset=utf-8'],
    ['/voice.js', 'voice.js', 'text/javascript; charset=utf-8'],
    ['/supervised-call', 'call.html', 'text/html; charset=utf-8'],
    ['/call.js', 'call.js', 'text/javascript; charset=utf-8'],
    ['/call-simulator', 'simulator.html', 'text/html; charset=utf-8'],
    ['/simulator.js', 'simulator.js', 'text/javascript; charset=utf-8'],
  ]) app.get(route, async (_request, reply) => reply.type(type).send(await readFile(new URL(`public/${name}`, import.meta.url))));
  app.get('/extension-lab', async (_request, reply) => reply.type('text/html; charset=utf-8').send(await readFile(new URL('../audio-extension/tests/lab.html', import.meta.url))));
  app.get('/audio-diagnostics', async (_request, reply) => reply.type('text/html; charset=utf-8').send(await readFile(new URL('../audio-extension/tests/lab.html', import.meta.url))));
  for (const name of ['local-rtc.js', 'window-rtc.js', 'audio-hook.js', 'panel.js']) app.get(`/extension-lab/${name}`, async (_request, reply) => reply.type('text/javascript; charset=utf-8').send(await readFile(new URL(`../audio-extension/${name}`, import.meta.url))));
  app.get('/extension-lab/lab.js', async (_request, reply) => reply.type('text/javascript; charset=utf-8').send(await readFile(new URL('../audio-extension/tests/lab.js', import.meta.url))));
  app.get('/status', async () => ({
    keyConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
    model: env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1',
    dialingEnabled: false,
  }));
  const idPattern = '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$';
  app.post('/live-log', { schema: { body: { type: 'object', additionalProperties: false,
    required: ['sessionId', 'sequence', 'event', 'phase'], properties: {
      sessionId: { type: 'string', pattern: idPattern }, sequence: { type: 'integer', minimum: 0, maximum: 2000 },
      event: { type: 'string', enum: journalEvents }, phase: { type: 'string', enum: phases },
    } } } }, async (request, reply) => {
    try { getJournal().append(request.body); return { saved: true }; }
    catch { return reply.code(409).send({ error: 'The local session log could not be saved in sequence.' }); }
  });
  app.get('/live-log/:id', { schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: idPattern } } } } }, async request => ({ events: getJournal().read(request.params.id) }));
  app.post('/simulation-speech', async (_request, reply) => {
    if (!env.OPENAI_API_KEY?.trim()) return reply.code(503).send({ error: 'Configure the local OpenAI key first.' });
    try {
      simulationSpeech ??= (async () => {
        const response = await fetchImpl('https://api.openai.com/v1/audio/speech', { method: 'POST',
          headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'alloy', response_format: 'wav',
            input: 'Yes, I can hear you clearly. Please say the word orange so I know you can hear me too.' }), signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error('Synthetic speech unavailable.');
        return Buffer.from(await response.arrayBuffer());
      })();
      return reply.type('audio/wav').send(await simulationSpeech);
    } catch { simulationSpeech = undefined; return reply.code(502).send({ error: 'The synthetic customer voice could not be generated.' }); }
  });
  app.addContentTypeParser('application/sdp', { parseAs: 'string' }, (_req, body, done) => done(null, body));
  app.post('/session', async (request, reply) => {
    const live = request.headers['x-audio-mode'] === 'supervised-call';
    if (request.headers['x-audio-mode'] && !live) return reply.code(400).send({ error: 'Unknown audio mode.' });
    if (!env.OPENAI_API_KEY?.trim()) return reply.code(503).send({ error: 'Add OPENAI_API_KEY to the local .env file, then restart the bridge.' });
    if (typeof request.body !== 'string' || !request.body.startsWith('v=0')) return reply.code(400).send({ error: 'Invalid audio connection request.' });
    if (connecting) return reply.code(409).send({ error: 'An audio connection is already being created.' });
    connecting = true;
    try {
      const form = new FormData();
      form.set('sdp', request.body);
      form.set('session', JSON.stringify({
        type: 'realtime', model: env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1',
        instructions: live
          ? 'You are an AI assistant calling for Sina in a supervised audio test. Introduce yourself clearly as an AI assistant and ask whether the listener can hear you. Keep replies brief and natural. Help test two-way hearing and interruptions. Do not conduct sales, invent facts, make commitments, request private information, or pretend to be human. If the listener asks to stop or not be called, politely acknowledge and stop speaking. Do not treat a voicemail greeting as a human answer and do not leave a voicemail in this first-call test. You have no tools and cannot dial or hang up. The owner controls the phone.'
          : 'You are an AI assistant in an audio setup test. Clearly identify yourself as an AI assistant. Help the owner verify hearing and speaking. Do not conduct sales conversations, make commitments, or invent business facts. No calls are authorized in this setup test.',
        audio: { input: { turn_detection: null }, output: { voice: 'marin' } },
      }));
      const response = await fetchImpl('https://api.openai.com/v1/realtime/calls', {
        method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: form, signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        const hint = response.status === 401 ? 'OpenAI rejected the API key. Update OPENAI_API_KEY in the local .env file and restart the bridge.'
          : response.status === 429 ? 'OpenAI rate limit or billing quota reached. Check billing and retry later.'
          : `OpenAI connection failed (${response.status}). Check API access and model availability.`;
        return reply.code(502).send({ error: hint, upstreamStatus: response.status });
      }
      return reply.type('application/sdp').send(await response.text());
    } catch {
      return reply.code(502).send({ error: 'OpenAI connection could not be established. Check network access and retry.' });
    } finally { connecting = false; }
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createBridge();
  await app.listen({ host: '127.0.0.1', port: 4318 });
  console.log('Audio setup panel: http://127.0.0.1:4318 — no dialing controls.');
}
