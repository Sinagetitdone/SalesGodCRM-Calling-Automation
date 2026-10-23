import { CampaignStore, outcomes } from './campaign-store.mjs';
const uuid = { type: 'string', pattern: '^[a-f0-9-]{36}$' };
const worker = { workerId: uuid };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const settingsSchema = object({ timeZone: { type: 'string', minLength: 1, maxLength: 80 }, startHour: { type: 'integer', minimum: 0, maximum: 23 }, endHour: { type: 'integer', minimum: 1, maximum: 24 }, callerNumber: { type: 'string', pattern: '^\\+[1-9][0-9]{7,14}$' }, voicemailMessage: { type: 'string', minLength: 10, maxLength: 1000 }, brief: { type: 'string', minLength: 1, maxLength: 2000 }, simulation: { type: 'boolean' },
  simulationMode: { type: 'string', enum: ['offline', 'agents'] }, rehearsalPersona: { type: 'string', enum: ['interested', 'busy', 'skeptical'] }, rehearsalTurns: { type: 'integer', minimum: 4, maximum: 12, multipleOf: 2 },
  rehearsalConfig: object({
    turnSeconds: { type: 'integer', minimum: 10, maximum: 120 },
  }, []),
  responsePauseMs: { type: 'integer', minimum: 200, maximum: 1000 },
}, ['timeZone', 'startHour', 'endHour', 'callerNumber', 'voicemailMessage', 'brief', 'simulation']);
export function campaignRoutes(app, { env, store: supplied }) {
  let store = supplied;
  const get = () => { store ??= new CampaignStore(env.CAMPAIGN_DATABASE_PATH || 'data/campaigns.db'); store.expire(); return store; };
  app.addHook('onClose', async () => { if (!supplied) store?.close(); });
  const route = (method, url, body, handler) => app.route({ method, url, schema: { ...(body ? { body } : {}), ...(url.includes(':id') ? { params: object({ id: uuid, ...(url.includes(':contact') ? { contact: uuid } : {}) }) } : {}) }, handler: async (request, reply) => {
    try { return handler(get(), request); } catch { return reply.code(409).send({ error: 'Campaign action could not be completed. Check its status, calling window, worker lease and contact state.' }); }
  } });
  app.get('/campaigns-api', { schema: { querystring: object({ mode: { type: 'string', enum: ['live', 'rehearsal'] } }, []) } }, r => ({ campaigns: get().list(r.query.mode) }));
  route('POST', '/campaigns-api/import', object({ name: { type: 'string', minLength: 1, maxLength: 120 }, csv: { type: 'string', minLength: 1, maxLength: 400000 }, settings: settingsSchema }), (s, r) => s.create(r.body));
  route('GET', '/campaigns-api/:id', null, (s, r) => s.read(r.params.id));
  route('POST', '/campaigns-api/:id/start', object({ ...worker, authorized: { const: true } }), (s, r) => s.start(r.params.id, r.body.workerId));
  route('POST', '/campaigns-api/:id/heartbeat', object(worker), (s, r) => s.heartbeat(r.params.id, r.body.workerId));
  route('POST', '/campaigns-api/:id/pause', object(worker), (s, r) => s.pause(r.params.id, r.body.workerId));
  route('POST', '/campaigns-api/:id/next', object(worker), (s, r) => s.claim(r.params.id, r.body.workerId));
  route('POST', '/campaigns-api/:id/:contact/dispatch', object({ ...worker, session: uuid }), (s, r) => s.dispatch(r.params.id, r.params.contact, r.body.workerId, r.body.session));
  route('POST', '/campaigns-api/:id/:contact/finish', object({ ...worker, outcome: { type: 'string', enum: outcomes } }), (s, r) => s.finish(r.params.id, r.params.contact, r.body.workerId, r.body.outcome));
  route('POST', '/campaigns-api/:id/:contact/transcript', object({ ...worker, session: uuid, item: { type: 'string', minLength: 1, maxLength: 120 }, speaker: { type: 'string', enum: ['customer', 'assistant'] }, text: { type: 'string', minLength: 1, maxLength: 10000 } }), (s, r) => s.transcript(r.params.id, r.params.contact, r.body.workerId, r.body));
  route('GET', '/campaigns-api/:id/:contact/transcript', null, (s, r) => ({ turns: s.transcripts(r.params.id, r.params.contact) }));
  route('POST', '/campaigns-api/suppress', object({ phone: { type: 'string', minLength: 8, maxLength: 30 } }), (s, r) => { s.suppress(r.body.phone); return { saved: true }; });
  return get;
}
