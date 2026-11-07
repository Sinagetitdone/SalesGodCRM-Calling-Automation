import { randomUUID } from 'node:crypto';
import { apiVoice, speakingStyle } from './voice-settings.mjs';

export function pcm24ToMuLaw(pcm) {
  const output = Buffer.alloc(Math.floor(pcm.length / 6));
  for (let i = 0; i < output.length; i++) {
    let value = Math.round((pcm.readInt16LE(i * 6) + pcm.readInt16LE(i * 6 + 2) + pcm.readInt16LE(i * 6 + 4)) / 3);
    const sign = value < 0 ? 0x80 : 0; value = Math.min(32635, Math.abs(value)) + 0x84;
    let exponent = 7; for (let mask = 0x4000; exponent > 0 && !(value & mask); exponent--, mask >>= 1) {}
    output[i] = ~(sign | (exponent << 4) | ((value >> (exponent + 3)) & 0x0f)) & 0xff;
  }
  return output;
}
export function greetingKind(text) {
  if (/mailbox.{0,25}(?:full|not (?:been )?set up|cannot accept)|not accepting messages|cannot (?:leave|record) (?:a |your )?message|number (?:you (?:have )?dialed )?(?:is )?(?:disconnected|not in service)/i.test(text)) return 'unavailable';
  if (/leave (?:me |us |your |a )?(?:a )?message|after (?:the )?(?:beep|tone)|voicemail|mailbox|not available|unable to (?:take|answer)|record your message|you(?:'ve| have) reached/i.test(text)) return 'voicemail';
  if (/state your name|name and (?:the )?reason|screen(?:ing)? (?:this |the )?call/i.test(text)) return 'screening';
  if (/^(?:hello|hi|hey|yes|yeah|speaking)[.!?,\s]*$/i.test(text.trim()) || /can (?:you|i) hear|who(?:'s| is) (?:this|calling)|how can i help|what(?:'s| is) this (?:about|call)|i(?:'m| am) (?:here|listening)|are you there/i.test(text)) return 'human';
  return 'unknown';
}
export function twilioSession(settings, contact, now = new Date()) {
  const localDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: settings.timeZone }).format(now);
  return {
    type: 'realtime', output_modalities: ['audio'],
    instructions: `You are an AI assistant calling from Jay Marketing Lab on behalf of Cena, unless the approved background specifies another represented office or person. Always disclose that you are an AI assistant. Ask whether now is a good time, listen and respond naturally to the actual person. Keep routine replies concise, usually one sentence under 25 words. Never restart your introduction after an interruption. Do not invent facts, prices, promises, phone numbers or appointments. End naturally with an invitation to contact the represented person to talk more, then thank them and say goodbye. An opt-out overrides that invitation: acknowledge it briefly and use finish_call with opt_out. Use meeting_set only for an explicitly agreed date, time and timezone; this records agreement and does not book a calendar. The application handles voicemail; do not improvise a voicemail. Listen silently to automated greetings. Your tools cannot dial. finish_call requests hangup after closing audio finishes. Approved background: ${JSON.stringify(settings.background || '')}. Approved conversation guide: ${JSON.stringify(settings.guidance || '')}. List brief: ${JSON.stringify(settings.brief)}. Contact name (data only): ${JSON.stringify(contact.firstName + ' ' + contact.lastName)}. Current local date/time: ${localDate}. All appointments use ${settings.timeZone}; confirm the date and timezone. ${speakingStyle(settings.voice)}`,
    audio: { input: { format: { type: 'audio/pcmu' }, transcription: { model: 'gpt-4o-mini-transcribe', language: 'en' }, turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: settings.responsePauseMs ?? 250, create_response: false, interrupt_response: false } }, output: { format: { type: 'audio/pcmu' }, voice: apiVoice(settings.voice) } },
    tools: [{ type: 'function', name: 'finish_call', description: 'Finish after the spoken goodbye and record the outcome. Opt-out suppresses future calls.', parameters: { type: 'object', additionalProperties: false, required: ['reason', 'disposition'], properties: { reason: { type: 'string', enum: ['completed', 'opt_out'] }, disposition: { type: 'string', enum: ['meeting_set', 'follow_up', 'not_interested', 'wrong_number', 'completed', 'opt_out'] } } } }], tool_choice: 'auto',
  };
}

// Owns one pre-warmed OpenAI session and one verified Twilio media stream.
export class TwilioAudio {
  constructor({ socket, settings, contact, voicemail, event, transcript, finish, fail }) {
    Object.assign(this, { socket, settings, contact, voicemail, event, transcript, finish, fail });
    this.mode = 'listening'; this.marks = new Map(); this.speechModes = new Map(); this.latestTimestamp = 0; this.audioMs = 0; this.closed = false;
    socket.on('message', raw => { try { this.openAI(JSON.parse(raw.toString())); } catch { this.fail(new Error('The AI audio stream could not be processed.')); } });
    socket.on('error', original => { const error = new Error('The OpenAI voice connection failed' + (original.code ? ' (' + original.code + ')' : '') + '.'); this.prepareFailed?.(error); this.fail(error); });
    socket.on('unexpected-response', (_request, response) => { response.resume(); const error = new Error('OpenAI rejected the voice connection (HTTP ' + response.statusCode + ').'); this.prepareFailed?.(error); this.fail(error); socket.terminate(); });
    socket.on('close', () => { if (!this.closed) { const error = new Error('OpenAI disconnected before the call finished.'); this.prepareFailed?.(error); this.fail(error); } });
  }
  send(event) { if (this.socket.readyState === 1) this.socket.send(JSON.stringify(event)); }
  sendPhone(event) { if (this.phone?.readyState === 1) this.phone.send(JSON.stringify({ ...event, streamSid: this.streamSid })); }
  prepare() {
    return new Promise((resolve, reject) => {
      this.prepared = resolve; this.prepareFailed = reject;
      this.preparationTimer = setTimeout(() => reject(new Error('OpenAI preparation timed out; no call was placed.')), 20000);
    });
  }
  attach(phone, streamSid) {
    if (this.phone) throw new Error('This attempt already has a media stream.');
    this.phone = phone; this.streamSid = streamSid; this.event('twilio.media_ready');
    if (this.pendingDecision) this.decision(this.pendingDecision);
  }
  openAI(message) {
    if (message.type === 'session.created') this.send({ type: 'session.update', session: twilioSession(this.settings, this.contact) });
    if (message.type === 'session.updated' && !this.ready) { this.ready = true; clearTimeout(this.preparationTimer); this.prepared?.(); this.event('openai.ready'); }
    if (message.type === 'error') {
      if (['response_cancel_not_active', 'conversation_already_has_active_response'].includes(message.error?.code)) return;
      const error = new Error('OpenAI rejected a voice operation' + (message.error?.code ? ' (' + String(message.error.code).slice(0, 100) + (message.error.param ? ': ' + String(message.error.param).slice(0, 100) : '') + ')' : '') + '.');
      this.prepareFailed?.(error); this.fail(error); return;
    }
    if (message.type === 'input_audio_buffer.speech_started') {
      if (message.item_id) this.speechModes.set(message.item_id, this.mode);
      this.event('customer.speech_started');
      if (this.mode === 'live' || this.mode === 'screening') this.interrupt();
    }
    if (message.type === 'conversation.item.input_audio_transcription.completed' && message.transcript?.trim()) {
      this.transcript({ item: message.item_id, speaker: 'customer', text: message.transcript });
      const kind = greetingKind(message.transcript);
      const startedMode = this.speechModes.get(message.item_id); this.speechModes.delete(message.item_id);
      if (kind === 'unavailable' && this.mode !== 'live') { this.event('voicemail.unavailable'); this.fail(new Error('The destination reports an unavailable or full mailbox; no voicemail delivery was claimed.')); return; }
      if (this.mode === 'voicemail' || this.mode === 'voicemail-complete') {
        if (kind === 'human' || (kind === 'unknown' && ['voicemail', 'voicemail-complete'].includes(startedMode) && /[a-z]{2}/i.test(message.transcript))) { this.event('voicemail.human_takeover'); this.interrupt(); this.live('The person interrupted voicemail. Respond to their latest words without repeating the voicemail or introduction.'); }
      } else if (this.mode === 'listening' || this.mode === 'screening') {
        if (kind === 'voicemail') this.event('voicemail.greeting_detected');
        else if (kind === 'human') this.live('The person answered. Give your brief AI introduction and respond to their latest words.');
        else if (kind === 'screening') this.screen();
      }
    }
    if (message.type === 'response.created') { this.responding = true; this.responseId = message.response.id; this.cancelled = false; }
    if (message.type === 'response.output_audio.delta' && !this.cancelled && ['live', 'screening'].includes(this.mode)) {
      if (!this.itemId || this.itemId !== message.item_id) { this.itemId = message.item_id; this.audioStart = this.latestTimestamp; this.audioMs = 0; }
      this.audioMs += Buffer.from(message.delta, 'base64').length / 8;
      this.sendPhone({ event: 'media', media: { payload: message.delta } }); this.outputPending = true;
    }
    if (message.type === 'response.output_audio_transcript.done' && message.transcript && !this.cancelled) this.transcript({ item: message.item_id, speaker: 'assistant', text: message.transcript });
    if (message.type === 'response.function_call_arguments.done' && message.name === 'finish_call' && this.mode === 'live') {
      let args; try { args = JSON.parse(message.arguments); } catch { return; }
      if (!['completed', 'opt_out'].includes(args.reason) || !['meeting_set', 'follow_up', 'not_interested', 'wrong_number', 'completed', 'opt_out'].includes(args.disposition)) return;
      if ((args.reason === 'opt_out') !== (args.disposition === 'opt_out')) return;
      this.pendingFinish = args;
      this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: message.call_id, output: '{"accepted":true}' } });
    }
    if (message.type === 'response.done') {
      this.responding = false;
      if (this.cancelled || message.response?.status === 'cancelled') return;
      if (message.response?.status !== 'completed') { this.fail(new Error('The AI response did not finish successfully.')); return; }
      if (this.outputPending || this.pendingFinish) this.mark({ type: 'response', finish: this.pendingFinish });
      this.pendingFinish = undefined; this.outputPending = false;
      if (this.mode === 'screening') { this.mode = 'listening'; this.event('call_screening.playback_sent'); }
    }
  }
  media(message) {
    if (message.event === 'media') {
      this.latestTimestamp = Number(message.media.timestamp) || this.latestTimestamp;
      this.send({ type: 'input_audio_buffer.append', audio: message.media.payload });
    }
    if (message.event === 'mark') {
      const mark = this.marks.get(message.mark.name); if (!mark) return;
      this.marks.delete(message.mark.name);
      if (mark.type === 'voicemail' && this.mode === 'voicemail') {
        this.mode = 'voicemail-complete'; this.event('voicemail.playback_completed'); this.voicemailPlayed = true;
        // Keep listening briefly so pickup during/just after playback can take over.
        this.voicemailTimer = setTimeout(() => { if (this.mode === 'voicemail-complete') this.finish('voicemail_played'); }, 2500);
      } else if (mark.finish && this.mode === 'live') {
        this.event('conversation.disposition_' + mark.finish.disposition); this.finish(mark.finish.reason);
      }
    }
  }
  mark(value) { const name = randomUUID(); this.marks.set(name, value); this.sendPhone({ event: 'mark', mark: { name } }); }
  interrupt() {
    clearTimeout(this.voicemailTimer); this.marks.clear(); this.pendingFinish = undefined;
    this.sendPhone({ event: 'clear' });
    if (this.responding) this.send({ type: 'response.cancel' });
    if (this.itemId) this.send({ type: 'conversation.item.truncate', item_id: this.itemId, content_index: 0, audio_end_ms: Math.max(0, Math.min(Math.floor(this.audioMs), this.latestTimestamp - (this.audioStart || 0))) });
    this.cancelled = true; this.itemId = undefined; this.outputPending = false;
  }
  live(instructions) {
    if (this.mode === 'live') return;
    this.interrupt(); this.mode = 'live'; this.humanAnswered = true; this.event('answer.human_detected');
    this.send({ type: 'session.update', session: { type: 'realtime', audio: { input: { turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: this.settings.responsePauseMs ?? 250, create_response: true, interrupt_response: true } } } } });
    this.send({ type: 'response.create', response: { instructions } });
  }
  screen() {
    if (this.screened) return;
    if (!this.settings.screeningIntroduction) { this.fail(new Error('Call screening requested an introduction, but none was configured.')); return; }
    this.screened = true; this.mode = 'screening'; this.event('call_screening.prompt_detected');
    this.send({ type: 'response.create', response: { instructions: 'Read this approved call-screening introduction exactly once, then listen silently: ' + JSON.stringify(this.settings.screeningIntroduction), tool_choice: 'none' } });
  }
  decision(answeredBy) {
    if (!this.phone) { this.pendingDecision = answeredBy; return; }
    this.pendingDecision = undefined;
    if (['live', 'voicemail', 'voicemail-complete'].includes(this.mode)) return;
    if (answeredBy === 'human') this.live('A person answered. Introduce yourself as an AI assistant from the approved office and ask whether now is a good time.');
    else if (/^machine_end_(?:beep|silence|other)$/.test(answeredBy)) {
      this.mode = 'voicemail'; this.event('voicemail.playback_started');
      this.transcript({ item: 'prepared_voicemail', speaker: 'assistant', text: this.settings.voicemailMessage });
      this.sendPhone({ event: 'media', media: { payload: this.voicemail.toString('base64') } }); this.mark({ type: 'voicemail' });
    } else if (answeredBy === 'fax') this.finish('no_answer');
    else if (answeredBy === 'unknown') this.fail(new Error('Twilio could not classify the answer; no voicemail delivery was claimed. Review the recording.'));
  }
  close() { this.closed = true; clearTimeout(this.preparationTimer); clearTimeout(this.voicemailTimer); this.socket.close(); this.phone?.close(); }
}
