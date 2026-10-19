import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export function createBridge({ env = process.env, fetchImpl = fetch } = {}) {
  const app = Fastify({ logger: false, bodyLimit: 128 * 1024 });
  const host = '127.0.0.1:4318';
  const origin = `http://${host}`;
  let connecting = false;
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
    ['/', 'index.html', 'text/html; charset=utf-8'],
    ['/style.css', 'style.css', 'text/css; charset=utf-8'],
    ['/panel.css', 'panel.css', 'text/css; charset=utf-8'],
  ]) app.get(route, async (_request, reply) => reply.type(type).send(await readFile(new URL(`public/${name}`, import.meta.url))));
  app.get('/extension-lab', async (_request, reply) => reply.type('text/html; charset=utf-8').send(await readFile(new URL('../audio-extension/tests/lab.html', import.meta.url))));
  app.get('/audio-diagnostics', async (_request, reply) => reply.type('text/html; charset=utf-8').send(await readFile(new URL('../audio-extension/tests/lab.html', import.meta.url))));
  for (const name of ['local-rtc.js', 'audio-hook.js', 'panel.js']) app.get(`/extension-lab/${name}`, async (_request, reply) => reply.type('text/javascript; charset=utf-8').send(await readFile(new URL(`../audio-extension/${name}`, import.meta.url))));
  app.get('/extension-lab/lab.js', async (_request, reply) => reply.type('text/javascript; charset=utf-8').send(await readFile(new URL('../audio-extension/tests/lab.js', import.meta.url))));
  app.get('/status', async () => ({
    keyConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
    model: env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1',
    dialingEnabled: false,
  }));
  app.addContentTypeParser('application/sdp', { parseAs: 'string' }, (_req, body, done) => done(null, body));
  app.post('/session', async (request, reply) => {
    if (!env.OPENAI_API_KEY?.trim()) return reply.code(503).send({ error: 'Add OPENAI_API_KEY to the local .env file, then restart the bridge.' });
    if (typeof request.body !== 'string' || !request.body.startsWith('v=0')) return reply.code(400).send({ error: 'Invalid audio connection request.' });
    if (connecting) return reply.code(409).send({ error: 'An audio connection is already being created.' });
    connecting = true;
    try {
      const form = new FormData();
      form.set('sdp', request.body);
      form.set('session', JSON.stringify({
        type: 'realtime', model: env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1',
        instructions: 'You are an AI assistant in an audio setup test. Clearly identify yourself as an AI assistant. Help the owner verify hearing and speaking. Do not conduct sales conversations, make commitments, or invent business facts. No calls are authorized in this setup test.',
        audio: { input: { turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true } }, output: { voice: 'marin' } },
      }));
      const response = await fetchImpl('https://api.openai.com/v1/realtime/calls', {
        method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: form, signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) return reply.code(502).send({ error: `OpenAI connection failed (${response.status}). Check API access, model availability, and billing.` });
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
