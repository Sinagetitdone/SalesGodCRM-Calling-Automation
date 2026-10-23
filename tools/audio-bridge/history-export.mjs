import { Readable } from 'node:stream';

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
// Stream one stored ZIP entry at a time: large recording libraries must not be
// copied into one giant Buffer. Filenames are server-generated UUIDs only.
export function historyZip(store, journal, campaignId) {
  const campaigns = campaignId ? [store.read(campaignId)] : store.history();
  const total = store.db.prepare('SELECT COUNT(*) AS n FROM campaign_contacts').get().n;
  const bytes = store.db.prepare('SELECT COALESCE(SUM(length(audio)),0) AS n FROM campaign_recordings').get().n;
  if (!campaignId && (total > 20000 || bytes > 3000000000)) throw new Error('History is too large for one ZIP. Download each list separately.');
  function* files() {
    yield { name: 'README.txt', data: Buffer.from('SalesGod conversation history\nJSON files contain list settings, contact details, transcripts and recorded events. MP3 files contain both voices from saved rehearsals and new real calling-list calls, including voicemail and partial recordings. Older real calls may have no audio. Old unsaved or deleted data cannot be recovered. Exported files are outside the app and remain after deletion in the app.\n') };
    for (const summary of campaigns) {
      let list;
      try { list = store.read(summary.id); } catch { continue; }
      yield { name: `${list.id}/list.json`, data: Buffer.from(JSON.stringify(list, null, 2)) };
      for (const contact of list.contacts) {
        const saved = store.archivedAudio(contact.id);
        const report = { contact, transcript: store.transcripts(list.id, contact.id), events: list.events.filter(e => !e.contact || e.contact === contact.id), audioEvents: saved.length ? saved : contact.session ? journal().read(contact.session) : [] };
        yield { name: `${list.id}/${contact.id}.json`, data: Buffer.from(JSON.stringify(report, null, 2)) };
        const audio = store.recording(list.id, contact.id);
        if (audio) yield { name: `${list.id}/${contact.id}.mp3`, data: Buffer.from(audio) };
      }
    }
  }
  async function* zip() {
    let offset = 0; const directory = [];
    for (const { name, data } of files()) {
      const filename = Buffer.from(name), crc = crc32(data), local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(0x5d57, 12);
      local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
      const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); local.copy(entry, 6, 4, 28); entry.writeUInt32LE(offset, 42);
      directory.push(Buffer.concat([entry, filename]));
      offset += local.length + filename.length + data.length;
      if (offset > 0xffffffff || directory.length > 65535) throw new Error('ZIP size limit exceeded. Export fewer lists.');
      yield local; yield filename; yield data;
    }
    const central = Buffer.concat(directory), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(directory.length, 8); end.writeUInt16LE(directory.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
    yield central; yield end;
  }
  return Readable.from(zip());
}
