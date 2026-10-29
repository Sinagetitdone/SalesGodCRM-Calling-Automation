import { CampaignStore, outcomes } from './campaign-store.mjs';
import { contactImportLimits } from './contact-import.mjs';
import { callVoices } from './voice-settings.mjs';
import { historyZip } from './history-export.mjs';
import { diagnosticDetail } from './diagnostics.mjs';
const uuid = { type: 'string', pattern: '^[a-f0-9-]{36}$' };
const worker = { workerId: uuid };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const profileFields = { background: { type: 'string', maxLength: 20000 }, guidance: { type: 'string', minLength: 6000, maxLength: 20000 }, voice: { type: 'string', enum: callVoices }, screeningIntroduction: { type: 'string', maxLength: 300, anyOf: [{ maxLength: 0 }, { minLength: 10 }] } };
const settingsSchema = object({ timeZone: { type: 'string', minLength: 1, maxLength: 80 }, startHour: { type: 'integer', minimum: 0, maximum: 23 }, endHour: { type: 'integer', minimum: 1, maximum: 24 }, callerNumber: { type: 'string', pattern: '^\\+[1-9][0-9]{7,14}$' }, voicemailMessage: { type: 'string', minLength: 10, maxLength: 1000 }, brief: { type: 'string', minLength: 1, maxLength: 2000 }, simulation: { type: 'boolean' },
  simulationMode: { type: 'string', enum: ['offline', 'agents'] }, rehearsalPersona: { type: 'string', enum: ['interested', 'busy', 'skeptical'] }, rehearsalTurns: { type: 'integer', minimum: 4, maximum: 12, multipleOf: 2 },
  rehearsalConfig: object({
    turnSeconds: { type: 'integer', minimum: 10, maximum: 120 },
  }, []),
  responsePauseMs: { type: 'integer', minimum: 200, maximum: 1000 },
  crmImportFile: { type: 'string', minLength: 1, maxLength: 255 },
  ...profileFields,
  customerVoice: { type: 'string', enum: callVoices },
}, ['timeZone', 'startHour', 'endHour', 'callerNumber', 'voicemailMessage', 'brief', 'simulation']);
export function campaignRoutes(app, { env, store: supplied, journal }) {
  let store = supplied;
  let existingHistoryArchived = false;
  const get = () => {
    store ??= new CampaignStore(env.CAMPAIGN_DATABASE_PATH || 'data/campaigns.db'); store.expire();
    if (!existingHistoryArchived && journal) {
      const rows = store.db.prepare("SELECT id,session FROM campaign_contacts WHERE session IS NOT NULL AND state NOT IN ('pending','preparing','dispatching','connected') AND NOT EXISTS(SELECT 1 FROM campaign_audio_archive a WHERE a.contact=campaign_contacts.id)").all();
      for (const row of rows) store.archiveAudio(row.id, journal().read(row.session));
      existingHistoryArchived = true;
    }
    return store;
  };
  app.addHook('onClose', async () => { if (!supplied) store?.close(); });
  const route = (method, url, body, handler) => app.route({ method, url, schema: { ...(body ? { body } : {}), ...(url.includes(':id') ? { params: object({ id: uuid, ...(url.includes(':contact') ? { contact: uuid } : {}) }) } : {}) }, handler: async (request, reply) => {
    try { return handler(get(), request); } catch (error) { return reply.code(409).send({ error: diagnosticDetail('Campaign action failed: ' + (error.message || 'No further cause reported') + (error.code ? ' [' + error.code + ']' : '')) }); }
  } });
  app.get('/campaigns-api', { schema: { querystring: object({ mode: { type: 'string', enum: ['live', 'rehearsal'] } }, []) } }, r => ({ campaigns: get().list(r.query.mode) }));
  app.get('/conversation-history', () => ({ campaigns: get().history() }));
  app.get('/conversation-history.zip', { schema: { querystring: object({ campaign: uuid }, []) } }, (r, reply) => {
    try { return reply.type('application/zip').header('Content-Disposition', 'attachment; filename="salesgod-conversations.zip"').send(historyZip(get(), journal, r.query.campaign)); }
    catch (e) { return reply.removeHeader('Content-Disposition').type('application/json').code(409).send({ error: e.message }); }
  });
  route('GET', '/calling-profile', null, s => s.callingProfile());
  route('POST', '/calling-profile', object(profileFields, ['background', 'guidance']), (s, r) => s.saveCallingProfile(r.body));
  route('POST', '/campaigns-api/:id/guidance', object(profileFields, ['background', 'guidance']), (s, r) => s.applyCallingProfile(r.params.id, r.body));
  route('POST', '/campaigns-api/:id/rehearsal-guidance', object({ guidance: { type: 'string', maxLength: 20000, anyOf: [{ maxLength: 0 }, { minLength: 6000 }] } }), (s, r) => s.applyRehearsalGuidance(r.params.id, r.body.guidance));
  route('POST', '/campaigns-api/import', object({ name: { type: 'string', minLength: 1, maxLength: 120 }, csv: { type: 'string', minLength: 1, maxLength: contactImportLimits.csvCharacters }, settings: settingsSchema }), (s, r) => s.create(r.body));
  route('GET', '/campaigns-api/:id', null, (s, r) => s.read(r.params.id));
  route('POST', '/campaigns-api/:id/start', object({ ...worker, authorized: { const: true } }), (s, r) => s.start(r.params.id, r.body.workerId));
  route('POST', '/campaigns-api/:id/heartbeat', object(worker), (s, r) => s.heartbeat(r.params.id, r.body.workerId));
  route('POST', '/campaigns-api/:id/pause', object(worker), (s, r) => s.pause(r.params.id, r.body.workerId));
  route('POST', '/campaigns-api/:id/next', object(worker), (s, r) => s.claim(r.params.id, r.body.workerId));
  route('POST', '/campaigns-api/:id/:contact/dispatch', object({ ...worker, session: uuid }), (s, r) => s.dispatch(r.params.id, r.params.contact, r.body.workerId, r.body.session));
  route('POST', '/campaigns-api/:id/:contact/defer', object({ ...worker, message: { type: 'string', minLength: 1, maxLength: 1500 } }), (s, r) => s.defer(r.params.id, r.params.contact, r.body.workerId, r.body.message));
  route('POST', '/campaigns-api/:id/:contact/finish', object({ ...worker, outcome: { type: 'string', enum: outcomes }, diagnostic: object({ message: { type: 'string', maxLength: 1500 }, session: uuid }, []) }, ['workerId', 'outcome']), (s, r) => {
    const result = s.finish(r.params.id, r.params.contact, r.body.workerId, r.body.outcome, r.body.diagnostic);
    const contact = result.contacts.find(c => c.id === r.params.contact);
    if (contact.session && journal) s.archiveAudio(contact.id, journal().read(contact.session));
    return result;
  });
  route('GET', '/campaigns-api/:id/:contact/events', null, (s, r) => {
    const contact = s.read(r.params.id).contacts.find(c => c.id === r.params.contact);
    if (!contact) throw new Error('Contact not found.');
    const archived = s.archivedAudio(contact.id);
    return { events: archived.length ? archived : contact.session && journal ? journal().read(contact.session) : [] };
  });
  route('POST', '/campaigns-api/:id/:contact/delete', object({ confirmed: { const: true } }), (s, r) => {
    const session = s.deleteConversation(r.params.id, r.params.contact);
    if (session && journal) journal().delete(session);
    return { deleted: true };
  });
  app.addContentTypeParser('audio/mpeg', { parseAs: 'buffer', bodyLimit: 12000000 }, (_r, body, done) => done(null, body));
  app.post('/campaigns-api/:id/:contact/recording', { bodyLimit: 12000000, schema: { params: object({ id: uuid, contact: uuid }), headers: { type: 'object', properties: { 'x-worker-id': uuid }, required: ['x-worker-id'] } } }, async (r, reply) => {
    try { return get().saveRecording(r.params.id, r.params.contact, r.headers['x-worker-id'], r.body); }
    catch (error) { return reply.code(409).send({ error: diagnosticDetail('The conversation recording could not be saved: ' + (error.message || 'No further cause reported')) }); }
  });
  app.get('/campaigns-api/:id/:contact/recording', { schema: { params: object({ id: uuid, contact: uuid }) } }, async (r, reply) => {
    try {
      const audio = get().recording(r.params.id, r.params.contact);
      if (!audio) return reply.code(404).send({ error: 'No recording was saved for this conversation.' });
      return reply.type('audio/mpeg').header('Content-Disposition', `attachment; filename="conversation-${r.params.contact}.mp3"`).send(Buffer.from(audio));
    } catch { return reply.code(404).send({ error: 'Conversation not found.' }); }
  });
  route('POST', '/campaigns-api/:id/:contact/transcript', object({ ...worker, session: uuid, item: { type: 'string', minLength: 1, maxLength: 120 }, speaker: { type: 'string', enum: ['customer', 'assistant'] }, text: { type: 'string', minLength: 1, maxLength: 10000 } }), (s, r) => s.transcript(r.params.id, r.params.contact, r.body.workerId, r.body));
  route('GET', '/campaigns-api/:id/:contact/transcript', null, (s, r) => s.transcriptInfo(r.params.id, r.params.contact));
  route('POST', '/campaigns-api/suppress', object({ phone: { type: 'string', minLength: 8, maxLength: 30 } }), (s, r) => { s.suppress(r.body.phone); return { saved: true }; });
  return get;
}
