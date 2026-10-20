import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const journalEvents = ['session.started', 'openai.ready', 'dialer.media_ready', 'owner.answer_confirmed', 'owner.instruction_sent', 'owner.instruction_accepted', 'owner.instruction_unconfirmed',
  'conversation.started', 'customer.speech_started', 'customer.speech_stopped', 'ai.response_started',
  'ai.response_completed', 'ai.response_cancelled', 'ai.response_failed', 'ai.interrupted', 'ai.paused', 'session.stopped', 'session.error', 'bridge.disconnected', 'dialer.media_ended',
  'voicemail.listening', 'voicemail.greeting_detected', 'voicemail.beep_detected', 'voicemail.playback_started', 'voicemail.playback_completed', 'voicemail.incomplete', 'voicemail.timeout', 'voicemail.unavailable', 'voicemail.recognition_failed'];
export const phases = ['preparing', 'waiting', 'ready', 'starting', 'talking', 'paused', 'stopping', 'stopped', 'failed', 'screening', 'voicemail-waiting', 'voicemail-playing', 'voicemail-complete'];
export class SessionJournal {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS audio_events (
        session_id TEXT NOT NULL, sequence INTEGER NOT NULL, recorded_at TEXT NOT NULL,
        event TEXT NOT NULL, phase TEXT NOT NULL, PRIMARY KEY(session_id, sequence)
      );`);
    // Only diagnostic metadata is retained. No contact data, recordings, or transcripts are accepted.
    this.prune();
  }
  prune() { this.db.prepare('DELETE FROM audio_events WHERE recorded_at < ?').run(new Date(Date.now() - 7 * 86400000).toISOString()); }
  append({ sessionId, sequence, event, phase }) {
    if (sequence === 0) this.prune();
    const last = this.db.prepare('SELECT MAX(sequence) AS sequence FROM audio_events WHERE session_id=?').get(sessionId).sequence;
    if (last === null && (sequence !== 0 || event !== 'session.started')) throw new Error('Start the journal first.');
    if (last !== null && sequence > last + 1) throw new Error('Journal events must be sequential.');
    if (last !== null && sequence <= last) {
      const prior = this.db.prepare('SELECT event,phase FROM audio_events WHERE session_id=? AND sequence=?').get(sessionId, sequence);
      if (prior?.event !== event || prior?.phase !== phase) throw new Error('Journal sequence conflict.');
      return;
    }
    if (sequence > 2000) throw new Error('Session event limit reached.');
    this.db.prepare('INSERT INTO audio_events VALUES (?,?,?,?,?)').run(sessionId, sequence, new Date().toISOString(), event, phase);
  }
  read(sessionId) { this.prune(); return this.db.prepare('SELECT sequence, recorded_at AS time,event,phase FROM audio_events WHERE session_id=? ORDER BY sequence').all(sessionId); }
  close() { this.db.close(); }
}
