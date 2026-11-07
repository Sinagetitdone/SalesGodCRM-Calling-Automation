import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { TwilioProvider, terminalCalls, openAIWebSocket } from './twilio-provider.mjs';
import { TwilioAudio, pcm24ToMuLaw } from './twilio-audio.mjs';
import { apiVoice, speakingStyle } from './voice-settings.mjs';
import { diagnosticDetail } from './diagnostics.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export class TwilioService {
  constructor({ env, campaigns, fetchImpl = fetch, provider, socketFactory = openAIWebSocket, sleep = wait }) {
    Object.assign(this, { env, campaigns, fetch: fetchImpl, socketFactory, sleep });
    this.provider = provider || new TwilioProvider({ env, fetchImpl }); this.attempts = new Map(); this.healthToken = randomUUID();
  }
  store() {
    const store = this.campaigns();
    store.db.exec(`CREATE TABLE IF NOT EXISTS twilio_attempts(session TEXT PRIMARY KEY, campaign TEXT NOT NULL, contact TEXT NOT NULL, call_sid TEXT, state TEXT NOT NULL, created TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS twilio_callbacks(session TEXT NOT NULL, event_key TEXT NOT NULL, PRIMARY KEY(session,event_key));`);
    return store;
  }
  status() {
    const config = this.provider.configuration();
    return { ...config, ready: config.ready && !this.networkError, provider: 'twilio', ingressListening: Boolean(this.ingress?.listening), activeCampaign: this.run?.id || null, fromNumber: this.env.TWILIO_FROM_NUMBER || '', error: this.networkError || config.error || (!this.ingress?.listening ? 'The Twilio callback service is not running. Restart the bridge.' : '') };
  }
  async tunnelLost() {
    this.networkError = 'The public Twilio audio connection ended. Restart the bridge or configure a stable HTTPS/WSS tunnel. No calls will be retried.';
    if (this.run) { this.run.pause = this.run.stop = true; if (this.run.attempt) { this.run.attempt.diagnostic = this.networkError; await this.end(this.run.attempt, 'needs_review'); } }
  }
  async check() {
    const result = await this.provider.check();
    if (this.networkError) throw new Error(this.networkError);
    if (!this.ingress?.listening) throw new Error('The Twilio callback service is not running.');
    let response;
    try { response = await this.fetch(this.provider.configuration().publicUrl + '/twilio/health', { signal: AbortSignal.timeout(10000), redirect: 'error' }); }
    catch { throw new Error('The public Twilio callback address is unreachable. Start the HTTPS tunnel to port 28432.'); }
    if (!response.ok || (await response.json()).instance !== this.healthToken) throw new Error('The public callback address does not reach this bridge. Point the tunnel at port 28432, never 28431.');
    const unresolved = this.store().db.prepare("SELECT session,call_sid FROM twilio_attempts WHERE state IN ('dispatching','active','uncertain')").all();
    for (const attempt of unresolved) {
      if (this.attempts.has(attempt.session)) continue;
      if (!attempt.call_sid) throw new Error('An earlier dial request has an uncertain result. Check Twilio Call Logs before any new calls; no automatic retry is permitted.');
      const call = await this.provider.status(attempt.call_sid);
      if (!terminalCalls.has(call.status)) throw new Error('An earlier Twilio call is still active. End it in Twilio before starting another list.');
      this.store().db.prepare("UPDATE twilio_attempts SET state='ended' WHERE session=?").run(attempt.session);
    }
    this.lastCheck = { ...result, at: Date.now() }; return result;
  }
  async prepareVoicemail(settings) {
    const response = await this.fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { Authorization: 'Bearer ' + this.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: apiVoice(settings.voice), input: settings.voicemailMessage, response_format: 'pcm', instructions: 'Read exactly the supplied message without adding words. ' + speakingStyle(settings.voice) }), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('OpenAI could not prepare the approved voicemail (HTTP ' + response.status + '); no call was placed.');
    const pcm = Buffer.from(await response.arrayBuffer());
    if (pcm.length < 2400 || pcm.length > 48000 * 120 || pcm.length % 2) throw new Error('OpenAI returned an invalid voicemail audio file.');
    return pcm24ToMuLaw(pcm);
  }
  async start(id) {
    if (this.run) throw new Error('A Twilio list is already running.');
    // Reserve before the network check, so concurrent Starts cannot both dispatch.
    const run = { id, worker: randomUUID(), phase: 'checking', pause: false, stop: false }; this.run = run;
    try {
      const campaign = this.store().read(id);
      if (campaign.settings.simulation) throw new Error('Use the rehearsal workspace for simulated lists.');
      if (campaign.settings.callerNumber !== this.env.TWILIO_FROM_NUMBER) throw new Error('This list uses a different caller number. Copy it to a new draft and select the Twilio calling number shown here.');
      await this.check();
      if (run.stop) throw new Error('Start cancelled.');
      this.store().start(id, run.worker); run.phase = 'running';
      run.task = this.loop(run).catch(error => { this.safeEvent(run, null, 'twilio.worker_failed: ' + diagnosticDetail(error.message)); }).finally(() => { if (this.run === run) this.run = null; });
      return { started: true };
    } catch (error) { if (this.run === run) this.run = null; throw error; }
  }
  safeEvent(run, contact, event) { try { this.store().event(run.id, contact, event); } catch {} }
  control(id, stop) {
    const run = this.run;
    if (!run || run.id !== id) throw new Error('No active Twilio list with this ID.');
    run.pause = true; run.stop ||= stop;
    if (run.phase === 'running') this.store().pause(id, run.worker);
    if (stop && run.attempt) void this.end(run.attempt, 'cancelled');
    return { stopping: stop, pausing: true };
  }
  async loop(run) {
    const heartbeat = setInterval(() => { try { this.store().heartbeat(run.id, run.worker); } catch { run.pause = run.stop = true; if (run.attempt) void this.end(run.attempt, 'unknown'); } }, 5000);
    try {
      while (!run.pause) {
        const next = this.store().claim(run.id, run.worker); if (next.finished) return;
        const contact = next.contact, session = randomUUID();
        const attempt = { run, contact, session, settings: next.settings, status: 'preparing', ended: false, dispatched: false, events: [], diagnostic: '' };
        run.attempt = attempt; this.attempts.set(session, attempt);
        const event = name => { attempt.events.push({ time: new Date().toISOString(), event: name, phase: attempt.status }); this.safeEvent(run, contact.id, name); };
        attempt.event = event;
        try {
          // Prepare both directions and the exact voicemail before the only dial side effect.
          const voicemail = await this.prepareVoicemail(next.settings);
          if (run.stop || run.pause) { attempt.outcome = 'cancelled'; }
          else {
            attempt.audio = new TwilioAudio({ socket: this.socketFactory(this.env), settings: next.settings, contact, voicemail, event,
              transcript: turn => { if (attempt.dispatched && !attempt.ended) this.store().transcript(run.id, contact.id, run.worker, { ...turn, session }); },
              finish: outcome => { void this.end(attempt, outcome); }, fail: error => { attempt.diagnostic = error.message; void this.end(attempt, 'needs_review'); },
            });
            await attempt.audio.prepare();
            if (run.stop || run.pause || attempt.ended) { attempt.outcome = 'cancelled'; }
            else {
              this.store().dispatch(run.id, contact.id, run.worker, session);
              this.store().db.prepare("INSERT INTO twilio_attempts VALUES(?,?,?,NULL,'dispatching',?)").run(session, run.id, contact.id, this.store().stamp());
              attempt.dispatched = true; attempt.status = 'dispatching';
              // No retry, including timeouts. Callback can arrive before this response.
              try {
                const call = await this.provider.dial(attempt); this.bind(attempt, call.sid); this.callStatus(attempt, call.status);
              } catch (error) {
                attempt.diagnostic = error.message;
                if (error.definiteRejection && !attempt.sid) { attempt.ended = true; attempt.outcome = 'failed'; this.store().db.prepare("UPDATE twilio_attempts SET state='ended' WHERE session=?").run(session); }
                else { attempt.outcome = 'unknown'; run.pause = true; await this.end(attempt, 'unknown'); }
              }
              const deadline = Date.now() + 370000; let lastPoll = 0;
              while (!attempt.ended) {
                if (attempt.answeredAt && !attempt.audio.phone && Date.now() - attempt.answeredAt > 12000) {
                  attempt.diagnostic = 'Twilio answered, but its audio stream did not connect within 12 seconds.'; run.pause = true; await this.end(attempt, 'needs_review');
                }
                if (attempt.answeredAt && attempt.audio.mode === 'listening' && Date.now() - attempt.answeredAt > 55000) {
                  attempt.diagnostic = 'No human answer or voicemail greeting end was confirmed within 55 seconds.'; await this.end(attempt, 'needs_review');
                }
                if (Date.now() > deadline) { attempt.diagnostic ||= 'Call exceeded its time limit.'; await this.end(attempt, 'needs_review'); }
                if (attempt.sid && Date.now() - lastPoll >= 3000) {
                  lastPoll = Date.now();
                  const call = await this.provider.status(attempt.sid);
                  this.callStatus(attempt, call.status);
                }
                if (attempt.ended) break;
                await this.sleep(250);
              }
              if (!attempt.terminalConfirmed) { attempt.outcome = 'unknown'; run.pause = true; }
              if (attempt.terminalConfirmed && (attempt.answered || ['completed', 'voicemail_played', 'opt_out'].includes(attempt.outcome))) {
                const until = Date.now() + 30000;
                while (!attempt.recordingSid && !attempt.recordingAbsent && Date.now() < until) await this.sleep(300);
                if (attempt.recordingSid) {
                  const audio = await this.provider.recording(attempt.recordingSid);
                  this.store().saveRecording(run.id, contact.id, run.worker, audio); event('recording.saved');
                } else { attempt.diagnostic ||= 'Twilio did not provide a completed recording before the save deadline.'; if (attempt.outcome !== 'opt_out') attempt.outcome = 'needs_review'; event('recording.failed'); }
              }
            }
          }
        } catch (error) {
          attempt.diagnostic ||= error.message; run.pause = true;
          if (attempt.dispatched && !attempt.terminalConfirmed) await this.end(attempt, 'unknown');
          attempt.outcome = attempt.outcome === 'opt_out' ? 'opt_out' : attempt.dispatched ? (attempt.terminalConfirmed ? 'needs_review' : 'unknown') : 'failed';
        } finally {
          attempt.audio?.close();
          this.store().finish(run.id, contact.id, run.worker, attempt.outcome || 'needs_review', { session, ...(attempt.diagnostic ? { message: attempt.diagnostic } : {}) });
          this.store().archiveAudio(contact.id, attempt.events);
          this.attempts.delete(session); run.attempt = null;
          if (run.pause) this.store().pause(run.id, run.worker);
        }
      }
    } finally { clearInterval(heartbeat); }
  }
  bind(attempt, sid) {
    this.provider.assertSid(sid);
    if (attempt.sid && attempt.sid !== sid) throw new Error('Twilio call identity conflict.');
    if (!attempt.sid) attempt.event('twilio.call_sid: ' + sid);
    attempt.sid = sid; this.store().db.prepare("UPDATE twilio_attempts SET call_sid=?,state='active' WHERE session=? AND state<>'ended'").run(sid, attempt.session);
  }
  callStatus(attempt, status) {
    if (attempt.terminalConfirmed) return;
    const rank = { queued: 0, initiated: 0, ringing: 1, 'in-progress': 2, completed: 3, busy: 3, failed: 3, 'no-answer': 3, canceled: 3 };
    if (rank[status] === undefined || rank[status] < (attempt.statusRank ?? -1)) return;
    attempt.statusRank = rank[status];
    attempt.status = status;
    if (attempt.lastLoggedStatus !== status) { attempt.lastLoggedStatus = status; attempt.event('twilio.call_' + status); }
    if (status === 'in-progress') { attempt.answered = true; attempt.answeredAt ??= Date.now(); }
    if (terminalCalls.has(status)) {
      attempt.terminalConfirmed = true; attempt.ended = true;
      if (status === 'completed' && attempt.answeredAt && Date.now() - attempt.answeredAt >= 329000 && !attempt.outcome) { attempt.outcome = 'needs_review'; attempt.diagnostic ||= 'The telephone call reached its time limit.'; }
      attempt.outcome ||= status === 'completed' ? (attempt.audio?.humanAnswered ? 'completed' : attempt.audio?.voicemailPlayed && attempt.audio.mode === 'voicemail-complete' ? 'voicemail_played' : 'needs_review') : status === 'failed' ? 'failed' : 'no_answer';
      this.store().db.prepare("UPDATE twilio_attempts SET state='ended' WHERE session=?").run(attempt.session);
    }
  }
  async end(attempt, outcome) {
    if (attempt.terminalConfirmed || attempt.ending) return;
    attempt.outcome = outcome;
    if (outcome === 'opt_out') this.store().suppress(attempt.contact.phone);
    if (!attempt.dispatched) { attempt.ended = true; attempt.audio?.prepareFailed?.(new Error(attempt.diagnostic || 'AI preparation stopped.')); return; }
    if (!attempt.sid) { attempt.ended = true; this.store().db.prepare("UPDATE twilio_attempts SET state='uncertain' WHERE session=?").run(attempt.session); return; }
    attempt.ending = true;
    try {
      const current = await this.provider.status(attempt.sid);
      this.callStatus(attempt, current.status);
      if (!attempt.terminalConfirmed) this.callStatus(attempt, (await this.provider.hangup(attempt.sid, current.status)).status);
      if (!attempt.terminalConfirmed) this.callStatus(attempt, (await this.provider.status(attempt.sid)).status);
      if (!attempt.terminalConfirmed) throw new Error();
    } catch { attempt.ended = true; attempt.outcome = 'unknown'; attempt.run.pause = true; attempt.diagnostic ||= 'Twilio hangup was not confirmed. Review the active call in Twilio; the list has stopped.'; this.store().db.prepare("UPDATE twilio_attempts SET state='uncertain' WHERE session=?").run(attempt.session); }
    finally { attempt.ending = false; }
  }
  callback(session, type, body) {
    if (body.AccountSid !== this.env.TWILIO_ACCOUNT_SID) throw new Error('Wrong account.');
    const row = this.store().db.prepare('SELECT * FROM twilio_attempts WHERE session=?').get(session);
    if (!row) throw new Error('Unknown attempt.');
    this.provider.assertSid(body.CallSid);
    if (row.call_sid && row.call_sid !== body.CallSid) throw new Error('Wrong call.');
    const attempt = this.attempts.get(session);
    if (attempt) {
      if ((body.To && body.To !== attempt.contact.phone) || (body.From && body.From !== this.env.TWILIO_FROM_NUMBER)) throw new Error('Wrong call target.');
      this.bind(attempt, body.CallSid);
    } else if (!row.call_sid) this.store().db.prepare('UPDATE twilio_attempts SET call_sid=? WHERE session=?').run(body.CallSid, session);
    const key = type + ':' + (type === 'status' ? body.SequenceNumber ?? body.CallStatus : type === 'amd' ? body.AnsweredBy : type === 'recording' ? body.RecordingSid + ':' + body.RecordingStatus : body.StreamEvent);
    if (!this.store().db.prepare('INSERT OR IGNORE INTO twilio_callbacks VALUES(?,?)').run(session, key).changes) return;
    if (!attempt) {
      if (type === 'status' && terminalCalls.has(body.CallStatus)) this.store().db.prepare("UPDATE twilio_attempts SET state='ended' WHERE session=?").run(session);
      return;
    }
    if (type === 'status') this.callStatus(attempt, body.CallStatus);
    if (type === 'amd' && !attempt.ended) { attempt.event('twilio.answer_' + body.AnsweredBy); attempt.audio?.decision(body.AnsweredBy); }
    if (type === 'recording' && body.RecordingStatus === 'completed' && /^RE[a-f0-9]{32}$/i.test(body.RecordingSid)) attempt.recordingSid = body.RecordingSid;
    if (type === 'recording' && body.RecordingStatus === 'absent') attempt.recordingAbsent = true;
    if (type === 'stream-status' && body.StreamEvent === 'stream-error' && !attempt.ended) { attempt.diagnostic = 'Twilio could not connect its audio stream. Check the public WSS tunnel.'; void this.end(attempt, 'needs_review'); }
  }
  async listen({ port = 28432 } = {}) {
    const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
    const server = createServer(async (request, response) => {
      response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
      if (request.method === 'GET' && request.url === '/twilio/health') { response.writeHead(200, { 'Content-Type': 'application/json' }); return response.end(JSON.stringify({ instance: this.healthToken })); }
      const match = /^\/twilio\/(status|amd|recording|stream-status)\/([a-f0-9-]{36})$/.exec(request.url || '');
      if (request.method !== 'POST' || !match || request.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') { response.writeHead(404); return response.end(); }
      try {
        let size = 0; const chunks = [];
        for await (const chunk of request) { size += chunk.length; if (size > 32768) throw new Error(); chunks.push(chunk); }
        const params = new URLSearchParams(Buffer.concat(chunks).toString()); const body = Object.fromEntries(params);
        if ([...params.keys()].length !== Object.keys(body).length || !this.provider.signed(request.url, request.headers['x-twilio-signature'], body)) { response.writeHead(403); return response.end(); }
        this.callback(match[2], match[1], body); response.writeHead(204); response.end();
      } catch { response.writeHead(400); response.end(); }
    });
    server.requestTimeout = 10000; server.headersTimeout = 10000;
    server.on('upgrade', (request, socket, head) => {
      const match = /^\/twilio\/media\/([a-f0-9-]{36})$/.exec(request.url || ''); const attempt = match && this.attempts.get(match[1]);
      if (!attempt || attempt.ended || attempt.mediaOpening || attempt.audio?.phone || !this.provider.signedMedia(request.url, request.headers['x-twilio-signature'])) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
      attempt.mediaOpening = true;
      wss.handleUpgrade(request, socket, head, phone => {
        let started = false;
        const startupTimer = setTimeout(() => phone.close(), 5000);
        phone.on('message', raw => {
          try {
            const message = JSON.parse(raw.toString());
            if (message.event === 'connected') return;
            if (message.event === 'start') {
              if (started || message.start?.accountSid !== this.env.TWILIO_ACCOUNT_SID || message.start?.mediaFormat?.encoding !== 'audio/x-mulaw' || message.start?.mediaFormat?.sampleRate !== 8000 || message.start?.mediaFormat?.channels !== 1) throw new Error();
              this.bind(attempt, message.start.callSid); this.callStatus(attempt, 'in-progress'); attempt.audio.attach(phone, message.start.streamSid); started = true; clearTimeout(startupTimer); return;
            }
            if (!started || message.streamSid !== attempt.audio.streamSid) throw new Error();
            if (message.event === 'stop') { phone.close(); return; }
            attempt.audio.media(message);
          } catch { phone.close(1008); }
        });
        phone.on('error', () => { attempt.diagnostic ||= 'Twilio media socket failed.'; void this.end(attempt, 'needs_review'); });
        phone.on('close', () => {
          clearTimeout(startupTimer);
          if (!attempt.ended) void this.sleep(500).then(async () => {
            if (attempt.ended) return;
            try { this.callStatus(attempt, (await this.provider.status(attempt.sid)).status); } catch {}
            if (!attempt.ended) { attempt.diagnostic ||= 'Twilio audio disconnected before the call ended.'; await this.end(attempt, 'needs_review'); }
          });
        });
      });
    });
    this.ingress = server; this.wss = wss;
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  }
  async close() {
    if (this.run) { this.run.stop = this.run.pause = true; if (this.run.attempt) await this.end(this.run.attempt, 'cancelled'); await this.run?.task; }
    for (const client of this.wss?.clients || []) client.terminate(); this.wss?.close();
    if (this.ingress?.listening) await new Promise(resolve => this.ingress.close(resolve));
  }
}

export function twilioRoutes(app, service) {
  const id = { type: 'string', pattern: '^[a-f0-9-]{36}$' };
  app.get('/twilio/status', () => service.status());
  app.post('/twilio/check', async (_r, reply) => { try { return await service.check(); } catch (e) { return reply.code(409).send({ error: diagnosticDetail(e.message) }); } });
  for (const action of ['start', 'pause', 'stop']) app.post('/campaigns-api/:id/twilio/' + action, { schema: { params: { type: 'object', properties: { id }, required: ['id'], additionalProperties: false }, body: { type: 'object', properties: action === 'start' ? { authorized: { const: true } } : {}, additionalProperties: false, required: action === 'start' ? ['authorized'] : [] } } }, async (r, reply) => {
    try { return action === 'start' ? await service.start(r.params.id) : service.control(r.params.id, action === 'stop'); }
    catch (e) { return reply.code(409).send({ error: diagnosticDetail(e.message) }); }
  });
}
