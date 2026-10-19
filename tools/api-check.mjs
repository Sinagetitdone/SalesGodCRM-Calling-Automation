import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('fake-provider HTTP API validates input, blocks suppression, persists calls and rejects ID collisions', { timeout: 20000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), 'salesgod-api-check-'));
  const database = join(folder, 'synthetic.db');
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', CALL_DATABASE_PATH: database },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let timer;
  try {
    const url = await new Promise((resolve, reject) => {
      let output = '';
      timer = setTimeout(() => reject(new Error('Test API did not start in time')), 10000);
      child.once('error', reject);
      child.once('exit', () => reject(new Error('Test API exited before it was ready')));
      child.stdout.on('data', data => {
        output += data.toString();
        const address = output.match(/Server listening at (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
        if (address) { clearTimeout(timer); resolve(address); }
      });
      child.stderr.resume();
    });
    const post = body => fetch(`${url}/calls`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000) });
    assert.equal((await fetch(`${url}/health`)).status, 200);
    assert.equal((await fetch(`${url}/calls/missing`)).status, 404);
    assert.equal((await post({})).status, 400);
    const input = { id: 'synthetic-call', contactExternalId: 'synthetic-contact', campaignExternalId: 'synthetic-campaign', doNotCall: false, withinCallingWindow: true, idempotencyKey: 'synthetic-key' };
    const first = await post(input); assert.equal(first.status, 200);
    const call = await first.json(); assert.equal(call.state, 'DISPATCHED'); assert.match(call.providerCallId, /^fake-/);
    assert.equal((await (await fetch(`${url}/calls/${input.id}`)).json()).contactExternalId, input.contactExternalId);
    assert.equal((await (await post(input)).json()).providerCallId, call.providerCallId);
    const conflict = await post({ ...input, idempotencyKey: 'different-key', contactExternalId: 'other-contact' });
    assert.equal(conflict.status, 409); assert.equal((await conflict.json()).error, 'CALL_ID_CONFLICT');
    const blocked = await post({ ...input, id: 'suppressed-call', idempotencyKey: 'suppressed-key', doNotCall: true });
    assert.equal((await blocked.json()).state, 'BLOCKED');
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    // Remove only the explicitly created synthetic file and its now-empty temporary directory.
    await rm(database, { force: true }); await rmdir(folder);
  }
});
