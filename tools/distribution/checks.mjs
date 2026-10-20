import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { packageEntries, zip } from './build-package.mjs';
import { ensureEnvironment, supportedNode, portAvailable } from './launcher.mjs';

test('release contains only runtime files, blank credentials and executable Mac launchers', async () => {
  const entries = await packageEntries(), names = entries.map(e => e.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes('tools/audio-extension/manifest.json'));
  assert.ok(names.includes('tools/audio-bridge/public/campaign-worker.js'));
  for (const name of names) assert.doesNotMatch(name, /(?:^|\/)(?:\.env$|data|node_modules|\.git|vendor|releases)(?:\/|$)|\.(?:png|db|log|local\.json)$/);
  assert.equal(entries.find(e => e.name === '.env.example').data.toString(), 'OPENAI_API_KEY=\nOPENAI_REALTIME_MODEL=gpt-realtime-2.1\n');
  for (const file of entries.filter(e => e.name.endsWith('.command'))) {
    assert.equal(file.mode & 0o777, 0o755); assert.equal(file.data.includes(13), false);
  }
  for (const file of entries.filter(e => e.name.endsWith('.cmd'))) assert.equal(file.data.toString().replaceAll('\r\n', '').includes('\n'), false);
  const manifest = JSON.parse(entries.find(e => e.name === 'package.json').data);
  const lock = JSON.parse(entries.find(e => e.name === 'package-lock.json').data);
  assert.deepEqual(manifest.dependencies, lock.packages[''].dependencies);
  assert.equal(lock.packages['node_modules/fastify'].version, manifest.dependencies.fastify);
  assert.equal(Object.values(lock.packages).some(p => p.dev), false);
});

test('ZIP extracts every entry byte-for-byte, includes checksums, and records Unix executable attributes', async () => {
  const entries = await packageEntries(), archive = zip(entries);
  assert.deepEqual(archive, zip(entries));
  let offset = 0;
  for (const entry of entries) {
    assert.equal(archive.readUInt32LE(offset), 0x04034b50);
    const size = archive.readUInt32LE(offset + 18), length = archive.readUInt16LE(offset + 26);
    assert.equal(archive.subarray(offset + 30, offset + 30 + length).toString(), 'SalesGod-Team/' + entry.name);
    const data = inflateRawSync(archive.subarray(offset + 30 + length, offset + 30 + length + size));
    assert.deepEqual(data, entry.data); offset += 30 + length + size;
  }
  for (const entry of entries) {
    assert.equal(archive.readUInt32LE(offset), 0x02014b50);
    assert.equal(archive.readUInt32LE(offset + 38) >>> 16, entry.mode);
    offset += 46 + archive.readUInt16LE(offset + 28);
  }
  assert.equal(archive.readUInt32LE(offset), 0x06054b50);
  const sums = entries.find(e => e.name === 'CONTENTS.sha256').data.toString();
  for (const entry of entries.filter(e => e.name !== 'CONTENTS.sha256')) assert.ok(sums.includes(createHash('sha256').update(entry.data).digest('hex') + '  ' + entry.name));
});

test('local setup creates a private blank environment without overwriting an existing key', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'salesgod setup '));
  try {
    await writeFile(join(folder, '.env.example'), 'OPENAI_API_KEY=\n');
    await ensureEnvironment(folder); assert.equal(await readFile(join(folder, '.env'), 'utf8'), 'OPENAI_API_KEY=\n');
    await writeFile(join(folder, '.env'), 'SYNTHETIC_EXISTING_CONFIGURATION\n');
    await ensureEnvironment(folder); assert.equal(await readFile(join(folder, '.env'), 'utf8'), 'SYNTHETIC_EXISTING_CONFIGURATION\n');
  } finally {
    assert.equal(folder.startsWith(join(tmpdir(), 'salesgod setup ')), true);
    await rm(folder, { recursive: true, force: true });
  }
});

test('launcher checks the tested Node major and detects occupied ports without stopping another server', async () => {
  assert.equal(supportedNode('24.0.0'), true); assert.equal(supportedNode('24.10.0'), true);
  for (const value of ['22.0.0', '25.0.0', 'invalid']) assert.equal(supportedNode(value), false);
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { assert.equal(await portAvailable(server.address().port), false); assert.equal(server.listening, true); }
  finally { await new Promise(resolve => server.close(resolve)); }
});
