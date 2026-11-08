// Explicit temporary callback-only tunnel for supervised testing on this machine.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { proxyEnvironment, windowsProxy } from './start.mjs';
const env = proxyEnvironment(process.env, process.platform === 'win32' ? windowsProxy() : null);
mkdirSync('.runtime', { recursive: true });
if (!existsSync('.runtime/pinggy-test-key')) {
  const generated = spawnSync(process.platform === 'win32' ? 'ssh-keygen.exe' : 'ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', '.runtime/pinggy-test-key'], { windowsHide: true, stdio: 'ignore' });
  if (generated.status !== 0) throw new Error('OpenSSH could not prepare the private test-tunnel identity.');
}
const state = { started: new Date().toISOString(), status: 'starting', publicUrl: null };
const save = () => writeFileSync('.runtime/test-tunnel.json', JSON.stringify(state), { mode: 0o600 }); save();
const proxied = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy;
const args = ['-T', '-p', '443', '-i', '.runtime/pinggy-test-key', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'UserKnownHostsFile=.runtime/pinggy-known-hosts', '-o', 'IdentityAgent=none', '-o', 'IdentitiesOnly=yes', '-o', 'PreferredAuthentications=publickey', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', ...(proxied ? ['-o', 'ProxyCommand=node tools/audio-bridge/ssh-proxy.mjs %h %p'] : []), '-R', '0:127.0.0.1:28432', 'free.pinggy.io'];
const ssh = spawn(process.platform === 'win32' ? 'ssh.exe' : 'ssh', args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
const consume = chunk => {
  log = (log + chunk.toString()).slice(-20000);
  writeFileSync('.runtime/test-tunnel-private.log', log, { mode: 0o600 });
  const match = /https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pinggy-free\.link\b/.exec(log);
  if (match && state.status !== 'ready') { state.status = 'ready'; state.publicUrl = match[0]; save(); console.log('Temporary callback tunnel ready; public address saved locally. No call placed.'); }
};
ssh.stdout.on('data', consume); ssh.stderr.on('data', consume);
const timeout = setTimeout(() => { if (state.status !== 'ready') { ssh.kill(); console.log('The temporary test tunnel did not connect.'); } }, 30000);
ssh.once('error', () => { clearTimeout(timeout); state.status = 'failed'; save(); console.log('The SSH tunnel could not start.'); });
ssh.once('exit', code => { clearTimeout(timeout); state.status = 'ended'; save(); console.log('Temporary test tunnel ended (exit ' + code + ').'); });
process.once('SIGINT', () => ssh.kill()); process.once('SIGTERM', () => ssh.kill());
