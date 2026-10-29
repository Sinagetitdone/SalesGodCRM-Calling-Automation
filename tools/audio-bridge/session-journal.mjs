import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { diagnosticDetail } from './diagnostics.mjs';

// Preserve the existing import path for journal consumers.
export { diagnosticDetail } from './diagnostics.mjs';

export const journalEvents = ['session.started', 'openai.ready', 'dialer.media_ready', 'owner.answer_confirmed', 'answer.human_detected', 'owner.instruction_sent', 'owner.instruction_accepted', 'owner.instruction_unconfirmed',
  'transcript.audio_completed', 'transcript.audio_failed', 'call_screening.prompt_detected', 'call_screening.hold_detected', 'call_screening.missing_introduction', 'call_screening.repeat_ignored', 'call_screening.gate_requested', 'call_screening.playback_started', 'call_screening.playback_completed',
  'answer.transcript_received', 'answer.explicit_human_detected', 'answer.short_greeting_detected', 'answer.classification_requested', 'answer.classification_timeout', 'answer.classified_human', 'answer.classified_voicemail', 'answer.classified_unavailable', 'answer.classified_unknown',
  'conversation.started', 'recording.started', 'recording.saved', 'recording.failed', 'customer.speech_started', 'customer.speech_stopped', 'ai.response_started', 'ai.audio_started',
  'ai.response_completed', 'ai.response_cancelled', 'ai.response_failed', 'ai.interrupted', 'ai.paused', 'session.stopped', 'session.error', 'bridge.disconnected', 'dialer.media_ended',
  'voicemail.listening', 'voicemail.greeting_detected', 'voicemail.beep_detected', 'voicemail.silence_fallback', 'voicemail.transition_audio_ignored', 'voicemail.playback_started', 'voicemail.playback_completed', 'voicemail.incomplete', 'voicemail.timeout', 'voicemail.unavailable', 'voicemail.recognition_failed', 'voicemail.human_takeover', 'voicemail.takeover_unconfirmed'];
export const phases = ['preparing', 'waiting', 'ready', 'starting', 'talking', 'paused', 'stopping', 'stopped', 'failed', 'screening', 'call-screening-prompt', 'call-screening-speaking', 'call-screening-waiting', 'voicemail-waiting', 'voicemail-playing', 'voicemail-complete'];
export class SessionJournal {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS audio_events (
        session_id TEXT NOT NULL, sequence INTEGER NOT NULL, recorded_at TEXT NOT NULL,
        event TEXT NOT NULL, phase TEXT NOT NULL, PRIMARY KEY(session_id, sequence)
      );`);
    if (!this.db.prepare('PRAGMA table_info(audio_events)').all().some(column => column.name === 'detail')) this.db.exec("ALTER TABLE audio_events ADD COLUMN detail TEXT NOT NULL DEFAULT ''");
    // Diagnostic reasons are redacted; conversation text stays in the transcript store.
    this.prune();
  }
  prune() { this.db.prepare('DELETE FROM audio_events WHERE recorded_at < ?').run(new Date(Date.now() - 7 * 86400000).toISOString()); }
  append({ sessionId, sequence, event, phase, detail = '' }) {
    detail = diagnosticDetail(detail);
    if (sequence === 0) this.prune();
    const last = this.db.prepare('SELECT MAX(sequence) AS sequence FROM audio_events WHERE session_id=?').get(sessionId).sequence;
    if (last === null && (sequence !== 0 || event !== 'session.started')) throw new Error('Start the journal first.');
    if (last !== null && sequence > last + 1) throw new Error('Journal events must be sequential.');
    if (last !== null && sequence <= last) {
      const prior = this.db.prepare('SELECT event,phase,detail FROM audio_events WHERE session_id=? AND sequence=?').get(sessionId, sequence);
      if (prior?.event !== event || prior?.phase !== phase || prior?.detail !== detail) throw new Error('Journal sequence conflict.');
      return;
    }
    if (sequence > 2000) throw new Error('Session event limit reached.');
    this.db.prepare('INSERT INTO audio_events(session_id,sequence,recorded_at,event,phase,detail) VALUES (?,?,?,?,?,?)').run(sessionId, sequence, new Date().toISOString(), event, phase, detail);
  }
  read(sessionId) { this.prune(); return this.db.prepare('SELECT sequence, recorded_at AS time,event,phase,detail FROM audio_events WHERE session_id=? ORDER BY sequence').all(sessionId); }
  delete(sessionId) { this.db.prepare('DELETE FROM audio_events WHERE session_id=?').run(sessionId); }
  close() { this.db.close(); }
}
