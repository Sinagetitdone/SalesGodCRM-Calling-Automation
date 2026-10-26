import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { buildSetupGuide } from './build-setup-guide.mjs';
import { desktopEntries } from './build-desktop.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bridgeFiles = ['server.mjs', 'start.mjs', 'text-import.mjs', 'text-import-worker.mjs', 'audio-transcript-routes.mjs', 'openai-errors.mjs', 'voice-settings.mjs', 'history-export.mjs', 'session-journal.mjs', 'campaign-store.mjs', 'campaign-routes.mjs', 'rehearsal-routes.mjs'];
const publicFiles = ['brand/JML-Logo-Full-Dark.svg', 'brand/JML-Logo-J-Dark.svg', 'setup.html', 'style.css', 'panel.css', 'voice.html', 'voice.js', 'call.html', 'call.js', 'call-recording.js', 'text-import.js', 'audio-transcript.js', 'voicemail.js', 'simulator.html', 'simulator.js', 'campaign.js', 'campaign-worker.js', 'campaign-form.html', 'campaign.html', 'history.html', 'history.js', 'rehearsal-form.html', 'rehearsal.js', 'rehearsal-mp3.js', 'vendor/lame.min.js', 'vendor/lame.all.js', 'vendor/NOTICE.txt', 'vendor/LAME-LICENSE.txt', 'vendor/LGPL-3.0.txt', 'vendor/GPL-3.0.txt'];
const extensionFiles = ['brand/JML-Logo-Full-Dark.svg', 'manifest.json', 'local-rtc.js', 'window-rtc.js', 'audio-hook.js', 'campaign-driver.js', 'panel.js', 'tests/lab.html', 'tests/lab.js'];
const launchers = ['Start Windows.cmd', 'Configure OpenAI Windows.cmd', 'Start Mac.command', 'Configure OpenAI Mac.command'];
export async function packageEntries(sourceRoot = root) {
  // Explicit allowlist. Never copy an installed workspace, .env, data, logs,
  // screenshots, node_modules, .git, test exports or other unlisted files.
  const mapping = [
    ...bridgeFiles.map(name => ['tools/audio-bridge/' + name, 'tools/audio-bridge/' + name]),
    ...publicFiles.map(name => ['tools/audio-bridge/public/' + name, 'tools/audio-bridge/public/' + name]),
    ...extensionFiles.map(name => ['tools/audio-extension/' + name, 'tools/audio-extension/' + name]),
    ...launchers.map(name => [name, 'tools/distribution/' + name]),
    ['tools/distribution/launcher.mjs', 'tools/distribution/launcher.mjs'],
    ...['ensure-node-windows.cmd', 'ensure-node-mac.sh', 'NODE-VERSION.txt', 'NODE-SHASUMS256.txt'].map(name => ['tools/distribution/' + name, 'tools/distribution/' + name]),
    ['package.json', 'tools/distribution/runtime-package.json'],
    ['package-lock.json', 'tools/distribution/runtime-package-lock.json'],
    ['SETUP.html', 'tools/distribution/SETUP.html'],
    ['SETUP.md', 'tools/distribution/SETUP.md'],
  ];
  const entries = await Promise.all(mapping.map(async ([name, source]) => {
    let data = await readFile(resolve(sourceRoot, source));
    // Windows Git checkouts can use CRLF. A Mac shebang must have LF endings.
    if (name.endsWith('.command') || name.endsWith('.sh')) data = Buffer.from(data.toString().replace(/\r\n/g, '\n'));
    if (name.endsWith('.cmd')) data = Buffer.from(data.toString().replace(/\r?\n/g, '\r\n'));
    return { name, data, mode: name.endsWith('.command') ? 0o100755 : 0o100644 };
  }));
  // Generate the blank template; never derive it from the owner's environment.
  entries.push(...await desktopEntries());
  entries.push({ name: '.env.example', data: Buffer.from('OPENAI_API_KEY=\nOPENAI_REALTIME_MODEL=gpt-realtime-2.1\n'), mode: 0o100600 });
  const checksums = entries.map(entry => createHash('sha256').update(entry.data).digest('hex') + '  ' + entry.name).join('\n') + '\n';
  entries.push({ name: 'CONTENTS.sha256', data: Buffer.from(checksums), mode: 0o100644 });
  return entries;
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const value of data) { crc ^= value; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function zip(entries) {
  const local = [], central = []; let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from('SalesGod-Team/' + entry.name), compressed = deflateRawSync(entry.data), crc = crc32(entry.data);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0x5d54, 12); // Fixed release date: 2026-10-20, reproducible archive.
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(entry.data.length, 22); header.writeUInt16LE(name.length, 26);
    const record = Buffer.alloc(46); record.writeUInt32LE(0x02014b50); record.writeUInt16LE((3 << 8) | 20, 4); header.copy(record, 6, 4, 28);
    record.writeUInt32LE((entry.mode << 16) >>> 0, 38); record.writeUInt32LE(offset, 42);
    local.push(header, name, compressed); central.push(record, name); offset += header.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
export async function buildPackage(output = resolve(root, 'releases')) {
  await buildSetupGuide();
  const entries = await packageEntries(), archive = zip(entries);
  const metadata = JSON.parse(await readFile(resolve(root, 'tools/distribution/runtime-package.json'), 'utf8'));
  const filename = 'SalesGod-Team-' + metadata.version + '.zip';
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, filename), archive);
  await writeFile(resolve(output, filename + '.sha256'), createHash('sha256').update(archive).digest('hex') + '  ' + filename + '\n');
  console.log('Created ' + resolve(output, filename) + ' (' + entries.length + ' files, no credentials or runtime records).');
  return resolve(output, filename);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await buildPackage();
