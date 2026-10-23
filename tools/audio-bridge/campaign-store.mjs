import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { callVoices, defaultCallVoice } from './voice-settings.mjs';

export const outcomes = ['completed', 'voicemail_played', 'no_answer', 'blocked', 'failed', 'unknown', 'needs_review', 'opt_out', 'cancelled'];
const activeStates = ['preparing', 'dispatching', 'connected'];
export function phone(value) {
  const raw = String(value).trim();
  if (!/^[+\d\s().-]+$/.test(raw)) throw new Error('Use a phone number without extensions.');
  let digits = raw.replace(/\D/g, '');
  if (!raw.startsWith('+') && digits.length === 10) digits = '1' + digits;
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error('Include a valid country code.');
  return '+' + digits;
}
export function parseContacts(csv) {
  if (typeof csv !== 'string' || csv.length > 400000) throw new Error('CSV exceeds the import limit.');
  const rows = []; let row = [], field = '', quoted = false;
  csv = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i <= csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n' || c === undefined)) {
      row.push(field.trim()); field = '';
      if (c !== ',') { if (row.some(Boolean)) rows.push(row); row = []; }
    } else if (c !== '\r') field += c ?? '';
  }
  if (quoted) throw new Error('CSV contains an unclosed quote.');
  const columns = rows.shift()?.map(x => x.toLowerCase().replace(/[ _-]/g, ''));
  if (!columns || ['firstname', 'lastname', 'phone'].some(x => !columns.includes(x))) throw new Error('CSV needs first_name,last_name,phone headers.');
  if (!rows.length || rows.length > 1000) throw new Error('Import between 1 and 1000 contacts.');
  const seen = new Set(), contacts = []; let duplicates = 0;
  for (const [index, values] of rows.entries()) {
    const get = key => values[columns.indexOf(key)]?.trim() || '';
    if (values.length !== columns.length) throw new Error(`Row ${index + 2}: wrong column count.`);
    const first = get('firstname'), last = get('lastname');
    if (!first || first.length > 80 || last.length > 80 || /[\x00-\x1f]/.test(first + last)) throw new Error(`Row ${index + 2}: invalid name.`);
    let number; try { number = phone(get('phone')); } catch { throw new Error(`Row ${index + 2}: invalid phone number.`); }
    if (seen.has(number)) { duplicates++; continue; } seen.add(number);
    contacts.push({ firstName: first, lastName: last, phone: number });
  }
  return { contacts, duplicates };
}
export function withinWindow(settings, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: settings.timeZone, hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const hour = Number(parts.find(x => x.type === 'hour').value);
  return hour >= settings.startHour && hour < settings.endHour;
}
export class CampaignStore {
  constructor(path, now = () => new Date()) {
    this.now = now; if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,name TEXT NOT NULL,state TEXT NOT NULL,settings TEXT NOT NULL,worker TEXT,heartbeat TEXT,authorized_at TEXT,created TEXT NOT NULL,finished TEXT);
      CREATE TABLE IF NOT EXISTS campaign_contacts(id TEXT PRIMARY KEY,campaign TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,position INTEGER NOT NULL,first_name TEXT NOT NULL,last_name TEXT NOT NULL,phone TEXT NOT NULL,state TEXT NOT NULL,session TEXT,dispatched TEXT,ended TEXT,UNIQUE(campaign,phone));
      CREATE TABLE IF NOT EXISTS campaign_events(id INTEGER PRIMARY KEY,campaign TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,contact TEXT,event TEXT NOT NULL,time TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS campaign_transcripts(contact TEXT NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,item TEXT NOT NULL,speaker TEXT NOT NULL,text TEXT NOT NULL,time TEXT NOT NULL,PRIMARY KEY(contact,item,speaker));
      CREATE TABLE IF NOT EXISTS campaign_suppressions(phone TEXT PRIMARY KEY,created TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS calling_profile(id INTEGER PRIMARY KEY CHECK(id=1),background TEXT NOT NULL,guidance TEXT NOT NULL,updated TEXT NOT NULL);`);
    if (!this.db.prepare('PRAGMA table_info(calling_profile)').all().some(column => column.name === 'voice')) this.db.exec("ALTER TABLE calling_profile ADD COLUMN voice TEXT NOT NULL DEFAULT 'cedar'");
    this.recover(); this.prune();
  }
  stamp() { return this.now().toISOString(); }
  callingProfile() {
    return this.db.prepare('SELECT background,guidance,voice,updated FROM calling_profile WHERE id=1').get() ?? { background: '', guidance: '', voice: defaultCallVoice, updated: null };
  }
  validateProfile({ background = '', guidance, voice = defaultCallVoice }) {
    if (!callVoices.includes(voice)) throw new Error('Unsupported calling voice.');
    if (typeof background !== 'string' || background.trim().length > 20000 || typeof guidance !== 'string' || guidance.trim().length < 6000 || guidance.trim().length > 20000) throw new Error('Calling guidance must contain 6,000–20,000 characters; background allows up to 20,000.');
    return { background: background.trim(), guidance: guidance.trim(), voice };
  }
  saveCallingProfile(profile) {
    const { background, guidance, voice } = this.validateProfile(profile);
    this.db.prepare('INSERT INTO calling_profile(id,background,guidance,updated,voice) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET background=excluded.background,guidance=excluded.guidance,updated=excluded.updated,voice=excluded.voice').run(background, guidance, this.stamp(), voice);
    return this.callingProfile();
  }
  applyCallingProfile(id, profile) {
    const approved = this.validateProfile(profile);
    return this.transaction(() => {
      const c = this.read(id);
      if (c.settings.simulation || !['draft', 'paused'].includes(c.state) || c.contacts.some(row => activeStates.includes(row.state))) throw new Error('Only an idle real calling list can be updated.');
      this.db.prepare('UPDATE campaigns SET settings=? WHERE id=?').run(JSON.stringify({ ...c.settings, ...approved }), id);
      this.event(id, null, 'calling_guidance_updated');
      return this.read(id);
    });
  }
  event(campaign, contact, event) { this.db.prepare('INSERT INTO campaign_events(campaign,contact,event,time) VALUES(?,?,?,?)').run(campaign, contact ?? null, event, this.stamp()); }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const value = fn(); this.db.exec('COMMIT'); return value; } catch (error) { this.db.exec('ROLLBACK'); throw error; } }
  prune() { this.db.prepare("DELETE FROM campaigns WHERE COALESCE(finished,created) < ? AND state != 'running'").run(new Date(this.now().getTime() - 7 * 86400000).toISOString()); }
  recover() {
    this.transaction(() => {
      for (const c of this.db.prepare("SELECT id FROM campaigns WHERE state IN ('running','paused') AND worker IS NOT NULL").all()) {
        this.db.prepare("UPDATE campaign_contacts SET state='unknown',ended=? WHERE campaign=? AND state IN ('preparing','dispatching','connected')").run(this.stamp(), c.id);
        this.db.prepare("UPDATE campaigns SET state='paused',worker=NULL WHERE id=?").run(c.id); this.event(c.id, null, 'recovered_without_redial');
      }
    });
  }
  create({ name, csv, settings }) {
    for (const value of [settings.voice, settings.customerVoice]) if (value !== undefined && !callVoices.includes(value)) throw new Error('Unsupported voice.');
    if (!settings.simulation) {
      const defaults = this.callingProfile();
      settings = { ...(defaults.guidance ? { background: defaults.background, guidance: defaults.guidance, voice: defaults.voice } : {}), ...settings };
      if (settings.guidance !== undefined) settings = { ...settings, ...this.validateProfile(settings) };
    }
    const parsed = parseContacts(csv);
    new Intl.DateTimeFormat('en-US', { timeZone: settings.timeZone }).format(this.now());
    if (!(Number.isInteger(settings.startHour) && Number.isInteger(settings.endHour) && settings.startHour >= 0 && settings.endHour <= 24 && settings.startHour < settings.endHour)) throw new Error('Invalid calling window.');
    const id = randomUUID(); this.prune();
    this.transaction(() => {
      this.db.prepare('INSERT INTO campaigns(id,name,state,settings,created) VALUES(?,?,?,?,?)').run(id, name, 'draft', JSON.stringify(settings), this.stamp());
      for (const [position, c] of parsed.contacts.entries()) this.db.prepare('INSERT INTO campaign_contacts(id,campaign,position,first_name,last_name,phone,state) VALUES(?,?,?,?,?,?,?)').run(randomUUID(), id, position, c.firstName, c.lastName, c.phone, 'pending');
      this.event(id, null, 'imported');
    });
    return { ...this.read(id), duplicates: parsed.duplicates };
  }
  read(id) {
    const c = this.db.prepare('SELECT * FROM campaigns WHERE id=?').get(id); if (!c) throw new Error('Campaign not found.');
    delete c.worker; c.settings = JSON.parse(c.settings);
    return { ...c, contacts: this.db.prepare('SELECT id,position,first_name AS firstName,last_name AS lastName,phone,state,session,dispatched,ended FROM campaign_contacts WHERE campaign=? ORDER BY position').all(id), events: this.db.prepare('SELECT contact,event,time FROM campaign_events WHERE campaign=? ORDER BY id').all(id) };
  }
  list(mode) {
    this.prune();
    if (mode) return this.db.prepare('SELECT id,name,state,created,finished FROM campaigns WHERE json_extract(settings,\'$.simulation\')=? ORDER BY created DESC LIMIT 50').all(mode === 'rehearsal' ? 1 : 0);
    return this.db.prepare('SELECT id,name,state,created,finished FROM campaigns ORDER BY created DESC LIMIT 50').all();
  }
  owner(id, worker) {
    const c = this.db.prepare('SELECT * FROM campaigns WHERE id=?').get(id);
    if (!c || c.worker !== worker || !c.authorized_at || !['running', 'paused'].includes(c.state)) throw new Error('Campaign worker is not authorized.');
    if (this.now().getTime() - Date.parse(c.heartbeat) > 30000) throw new Error('Worker lease expired; resume explicitly.');
    return c;
  }
  start(id, worker) {
    return this.transaction(() => {
      const c = this.db.prepare('SELECT * FROM campaigns WHERE id=?').get(id);
      if (!c || !['draft', 'paused'].includes(c.state)) throw new Error('Campaign cannot start in this state.');
      if (this.db.prepare("SELECT id FROM campaigns WHERE state='running' AND id<>?").get(id)) throw new Error('Another campaign is running.');
      if (this.db.prepare("SELECT id FROM campaign_contacts WHERE campaign<>? AND state IN ('preparing','dispatching','connected')").get(id)) throw new Error('Another attempt is still active.');
      if (this.db.prepare("SELECT id FROM campaign_contacts WHERE campaign=? AND state IN ('preparing','dispatching','connected')").get(id)) throw new Error('Resolve the active attempt before resuming.');
      this.db.prepare("UPDATE campaigns SET state='running',worker=?,heartbeat=?,authorized_at=COALESCE(authorized_at,?) WHERE id=?").run(worker, this.stamp(), this.stamp(), id);
      this.event(id, null, 'owner_started'); return this.read(id);
    });
  }
  heartbeat(id, worker) { this.owner(id, worker); this.db.prepare('UPDATE campaigns SET heartbeat=? WHERE id=?').run(this.stamp(), id); return { ok: true }; }
  pause(id, worker) { this.owner(id, worker); this.db.prepare("UPDATE campaigns SET state='paused' WHERE id=?").run(id); this.event(id, null, 'paused'); return this.read(id); }
  claim(id, worker) {
    return this.transaction(() => {
      const c = this.owner(id, worker); if (c.state !== 'running') throw new Error('Campaign is paused.');
      if (this.db.prepare("SELECT id FROM campaign_contacts WHERE campaign=? AND state IN ('preparing','dispatching','connected')").get(id)) throw new Error('An attempt is already active.');
      if (!this.db.prepare("SELECT id FROM campaign_contacts WHERE campaign=? AND state='pending'").get(id)) {
        this.db.prepare("UPDATE campaigns SET state='finished',finished=? WHERE id=?").run(this.stamp(), id); this.event(id, null, 'finished'); return { finished: true };
      }
      if (!JSON.parse(c.settings).simulation && !withinWindow(JSON.parse(c.settings), this.now())) return { waiting: 'calling_window' };
      let next;
      while ((next = this.db.prepare("SELECT * FROM campaign_contacts WHERE campaign=? AND state='pending' ORDER BY position LIMIT 1").get(id))) {
        if (!this.db.prepare('SELECT phone FROM campaign_suppressions WHERE phone=?').get(next.phone)) break;
        this.db.prepare("UPDATE campaign_contacts SET state='blocked',ended=? WHERE id=?").run(this.stamp(), next.id); this.event(id, next.id, 'suppressed');
      }
      if (!next) { this.db.prepare("UPDATE campaigns SET state='finished',finished=? WHERE id=?").run(this.stamp(), id); this.event(id, null, 'finished'); return { finished: true }; }
      this.db.prepare("UPDATE campaign_contacts SET state='preparing' WHERE id=?").run(next.id); this.event(id, next.id, 'claimed');
      return { contact: this.read(id).contacts.find(x => x.id === next.id), settings: JSON.parse(c.settings) };
    });
  }
  contact(id, contactId, worker) {
    const c = this.owner(id, worker), row = this.db.prepare('SELECT * FROM campaign_contacts WHERE id=? AND campaign=?').get(contactId, id);
    if (!row) throw new Error('Contact not found.'); return { campaign: c, row };
  }
  dispatch(id, contactId, worker, session) {
    return this.transaction(() => {
      const { campaign, row } = this.contact(id, contactId, worker);
      if (campaign.state !== 'running' || row.state !== 'preparing') throw new Error('Dispatch is not permitted or has already been attempted.');
      if (!JSON.parse(campaign.settings).simulation && !withinWindow(JSON.parse(campaign.settings), this.now())) throw new Error('Outside calling window.');
      if (this.db.prepare('SELECT phone FROM campaign_suppressions WHERE phone=?').get(row.phone)) throw new Error('Contact is suppressed.');
      this.db.prepare("UPDATE campaign_contacts SET state='dispatching',session=?,dispatched=? WHERE id=?").run(session, this.stamp(), contactId); this.event(id, contactId, 'dispatch_authorized_once');
      return { phone: row.phone, attempt: contactId };
    });
  }
  finish(id, contactId, worker, outcome) {
    if (!outcomes.includes(outcome)) throw new Error('Invalid outcome.');
    const { row } = this.contact(id, contactId, worker);
    if (row.state === outcome) return this.read(id);
    if (!activeStates.includes(row.state)) throw new Error('Attempt is already terminal.');
    this.transaction(() => {
      this.db.prepare('UPDATE campaign_contacts SET state=?,ended=? WHERE id=?').run(outcome, this.stamp(), contactId); this.event(id, contactId, outcome);
      if (outcome === 'opt_out') this.suppress(row.phone);
      if (['unknown', 'needs_review', 'failed'].includes(outcome)) this.db.prepare("UPDATE campaigns SET state='paused' WHERE id=?").run(id);
    }); return this.read(id);
  }
  transcript(id, contactId, worker, { session, item, speaker, text }) {
    const { row } = this.contact(id, contactId, worker);
    if (row.session !== session || !['dispatching', 'connected', ...outcomes].includes(row.state)) throw new Error('Transcript is not associated with this attempt.');
    const old = this.db.prepare('SELECT text FROM campaign_transcripts WHERE contact=? AND item=? AND speaker=?').get(contactId, item, speaker);
    if (old) { if (old.text !== text) throw new Error('Transcript item conflict.'); return { saved: true }; }
    if (this.db.prepare('SELECT COUNT(*) AS count FROM campaign_transcripts WHERE contact=?').get(contactId).count >= 500) throw new Error('Transcript limit reached.');
    this.db.prepare('INSERT INTO campaign_transcripts VALUES(?,?,?,?,?)').run(contactId, item, speaker, text, this.stamp()); return { saved: true };
  }
  transcripts(id, contactId) { if (!this.db.prepare('SELECT id FROM campaign_contacts WHERE campaign=? AND id=?').get(id, contactId)) throw new Error('Contact not found.'); return this.db.prepare('SELECT item,speaker,text,time FROM campaign_transcripts WHERE contact=? ORDER BY rowid').all(contactId); }
  suppress(number) { this.db.prepare('INSERT OR IGNORE INTO campaign_suppressions VALUES(?,?)').run(phone(number), this.stamp()); }
  expire() {
    for (const c of this.db.prepare("SELECT id FROM campaigns WHERE state IN ('running','paused') AND worker IS NOT NULL AND heartbeat < ?").all(new Date(this.now().getTime() - 30000).toISOString())) {
      this.db.prepare("UPDATE campaign_contacts SET state='unknown',ended=? WHERE campaign=? AND state IN ('preparing','dispatching','connected')").run(this.stamp(), c.id);
      this.db.prepare("UPDATE campaigns SET state='paused',worker=NULL WHERE id=?").run(c.id); this.event(c.id, null, 'lease_expired_no_redial');
    }
  }
  close() { this.db.close(); }
}
