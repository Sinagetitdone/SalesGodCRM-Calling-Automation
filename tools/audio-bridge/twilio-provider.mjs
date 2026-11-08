import twilio from 'twilio';
import { HttpsProxyAgent } from 'https-proxy-agent';
import WebSocket from 'ws';
import { diagnosticDetail } from './diagnostics.mjs';

export const terminalCalls = new Set(['completed', 'busy', 'failed', 'no-answer', 'canceled']);
export function twilioConfiguration(env) {
  const missing = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'TWILIO_PUBLIC_URL', 'OPENAI_API_KEY'].filter(key => !env[key]?.trim());
  if (missing.length) return { ready: false, error: 'Add ' + missing.join(', ') + ' to the local .env file, then restart.' };
  if (!/^AC[a-f0-9]{32}$/i.test(env.TWILIO_ACCOUNT_SID) || !/^\+[1-9]\d{7,14}$/.test(env.TWILIO_FROM_NUMBER)) return { ready: false, error: 'Check the Twilio Account SID and calling number in .env.' };
  try {
    const url = new URL(env.TWILIO_PUBLIC_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    return { ready: true, publicUrl: url.origin, fromNumber: env.TWILIO_FROM_NUMBER };
  } catch { return { ready: false, error: 'TWILIO_PUBLIC_URL must be the public HTTPS origin of the callback-only service (port 28432).' }; }
}
export function openAIWebSocket(env) {
  const proxy = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy;
  return new WebSocket('wss://api.openai.com/v1/realtime?model=' + encodeURIComponent(env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1'), {
    headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY },
    ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}), handshakeTimeout: 15000, maxPayload: 2 * 1024 * 1024,
  });
}
export class TwilioProvider {
  constructor({ env, fetchImpl = fetch }) { this.env = env; this.fetch = fetchImpl; }
  configuration() { return twilioConfiguration(this.env); }
  async request(resource, fields, { binary = false } = {}) {
    const account = this.env.TWILIO_ACCOUNT_SID;
    const form = fields && new URLSearchParams();
    if (fields) for (const [key, value] of Object.entries(fields)) for (const item of Array.isArray(value) ? value : [value]) form.append(key, String(item));
    let response;
    try {
      response = await this.fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}${resource}`, {
        method: fields ? 'POST' : 'GET', headers: { Authorization: 'Basic ' + Buffer.from(account + ':' + this.env.TWILIO_AUTH_TOKEN).toString('base64'), ...(fields ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        ...(form ? { body: form } : {}), signal: AbortSignal.timeout(20000), redirect: 'error',
      });
    } catch { throw new Error('Twilio request did not return a confirmed result. Check the connection; a dial request must never be retried automatically.'); }
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      let providerMessage = typeof detail.message === 'string' ? detail.message : '';
      const secretValues = [this.env.OPENAI_API_KEY, this.env.TWILIO_AUTH_TOKEN, this.env.TWILIO_API_KEY_SECRET, Buffer.from(account + ':' + this.env.TWILIO_AUTH_TOKEN).toString('base64')].filter(Boolean);
      for (const value of secretValues) providerMessage = providerMessage.split(value).join('[redacted]');
      providerMessage = diagnosticDetail(providerMessage);
      const error = new Error(diagnosticDetail(`Twilio rejected the request (HTTP ${response.status}${Number.isInteger(detail.code) ? ', code ' + detail.code : ''}). ${providerMessage ? 'Provider detail: ' + providerMessage + ' ' : 'Check account permissions, trial restrictions, caller number and destination. '}No automatic retry.`));
      error.definiteRejection = response.status >= 400 && response.status < 500; throw error;
    }
    return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
  }
  async check({ allowTrialSharedCaller = false } = {}) {
    // Account checks are read-only and can explain authentication/trial problems
    // before a public tunnel has been configured. Dial still requires the real URL.
    const config = twilioConfiguration({ ...this.env, TWILIO_PUBLIC_URL: this.env.TWILIO_PUBLIC_URL || 'https://not-configured.invalid' });
    if (!config.ready) throw new Error(config.error);
    const account = await this.request('.json');
    if (account.status !== 'active') throw new Error('The Twilio account is not active.');
    const numbers = await this.request('/IncomingPhoneNumbers.json?PhoneNumber=' + encodeURIComponent(config.fromNumber));
    const callerOwned = numbers.incoming_phone_numbers?.some(n => n.phone_number === config.fromNumber && n.capabilities?.voice);
    const trialSharedCaller = !callerOwned && account.type === 'Trial' && allowTrialSharedCaller;
    if (!callerOwned && !trialSharedCaller) throw new Error('The configured caller is not an owned voice-enabled number. A trial shared number can be submitted for Twilio validation only in an explicitly started one-contact test list.');
    return { ready: true, fromNumber: config.fromNumber, trial: account.type === 'Trial', trialSharedCaller, callerOwned: Boolean(callerOwned) };
  }
  dial(attempt) {
    const config = this.configuration(); if (!config.ready) throw new Error(config.error);
    const endpoint = suffix => config.publicUrl + '/twilio/' + suffix + '/' + attempt.session;
    const stream = config.publicUrl.replace('https:', 'wss:') + '/twilio/media/' + attempt.session;
    const xml = new twilio.twiml.VoiceResponse();
    xml.connect().stream({ url: stream, statusCallback: endpoint('stream-status'), statusCallbackMethod: 'POST' });
    xml.hangup();
    return this.request('/Calls.json', {
      To: attempt.contact.phone, From: config.fromNumber, Twiml: xml.toString(), Timeout: 35, TimeLimit: 330,
      StatusCallback: endpoint('status'), StatusCallbackMethod: 'POST', StatusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      MachineDetection: 'DetectMessageEnd', AsyncAmd: true, AsyncAmdStatusCallback: endpoint('amd'), AsyncAmdStatusCallbackMethod: 'POST', MachineDetectionTimeout: 45,
      Record: true, RecordingChannels: 'dual', RecordingStatusCallback: endpoint('recording'), RecordingStatusCallbackMethod: 'POST', RecordingStatusCallbackEvent: ['completed', 'absent'],
    });
  }
  status(sid) { this.assertSid(sid); return this.request('/Calls/' + sid + '.json'); }
  hangup(sid, status = 'in-progress') { this.assertSid(sid); return this.request('/Calls/' + sid + '.json', { Status: ['queued', 'ringing'].includes(status) ? 'canceled' : 'completed' }); }
  assertSid(sid) { if (!/^CA[a-f0-9]{32}$/i.test(sid)) throw new Error('Unverified Twilio call identity.'); }
  recording(sid) { if (!/^RE[a-f0-9]{32}$/i.test(sid)) throw new Error('Invalid Twilio recording identity.'); return this.request('/Recordings/' + sid + '.mp3', undefined, { binary: true }); }
  signed(path, signature, parameters = {}) {
    const config = this.configuration();
    return config.ready && typeof signature === 'string' && twilio.validateRequest(this.env.TWILIO_AUTH_TOKEN, signature, config.publicUrl + path, parameters);
  }
  signedMedia(path, signature) {
    const config = this.configuration(); if (!config.ready || typeof signature !== 'string') return false;
    // Twilio's WSS handshake normalization can append a trailing slash.
    // Check only this configured origin and exact attempt path, never a forwarded Host.
    return [config.publicUrl, config.publicUrl.replace('https:', 'wss:')].some(base => ['', '/'].some(suffix => twilio.validateRequest(this.env.TWILIO_AUTH_TOKEN, signature, base + path + suffix, {})));
  }
}
