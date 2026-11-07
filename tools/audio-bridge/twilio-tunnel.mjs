import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';

// Official Cloudflare release, verified against its published asset digests.
export const tunnelRelease = '2026.10.7';
export const tunnelAssets = {
  'win32-x64': ['cloudflared-windows-amd64.exe', '2493dbc168923bb3e59e5e7716f71deced92992eea9acd6e9d74f84ac7751343'],
  'darwin-x64': ['cloudflared-darwin-amd64.tgz', '02f3edfd87684dd5b705607688e4eb4b323f6e777b81e7b3a85af556aa356848'],
  'darwin-arm64': ['cloudflared-darwin-arm64.tgz', '3586ccf397e98e5f437e60e7c307ca6ac463e110580503af8bb8e6f9ebf831bd'],
};
export function verifiedTunnelAsset(bytes, digest) { return createHash('sha256').update(bytes).digest('hex') === digest; }
export async function ensureTunnel({ platform = process.platform, arch = process.arch, folder = resolve('.runtime', 'cloudflared', tunnelRelease), fetchImpl = fetch } = {}) {
  const asset = tunnelAssets[platform + '-' + arch];
  if (!asset) throw new Error('Automatic Twilio tunnel supports Windows x64 and Mac Intel/Apple Silicon. Set TWILIO_PUBLIC_URL for another trusted tunnel.');
  const [name, digest] = asset; await mkdir(folder, { recursive: true, mode: 0o700 });
  const archive = resolve(folder, name); let bytes;
  try { bytes = await readFile(archive); } catch {}
  if (!bytes || !verifiedTunnelAsset(bytes, digest)) {
    console.log('Preparing a private Cloudflare connection tool from its official release…');
    const response = await fetchImpl(`https://github.com/cloudflare/cloudflared/releases/download/${tunnelRelease}/${name}`, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error('Cloudflare download failed (HTTP ' + response.status + '). Set TWILIO_PUBLIC_URL for your own HTTPS tunnel.');
    bytes = Buffer.from(await response.arrayBuffer());
    if (!verifiedTunnelAsset(bytes, digest)) throw new Error('Cloudflare download checksum did not match. The downloaded software will not run.');
    await writeFile(archive, bytes, { mode: 0o700 });
  }
  if (platform === 'win32') return archive;
  execFileSync('tar', ['-xzf', archive, '-C', folder, 'cloudflared'], { stdio: 'ignore', timeout: 15000 });
  const binary = resolve(folder, 'cloudflared'); await chmod(binary, 0o700); return binary;
}
export async function startQuickTunnel({ env, fetchImpl = fetch } = {}) {
  const binary = await ensureTunnel({ fetchImpl });
  const child = spawn(binary, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', 'http://127.0.0.1:28432'], { env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  return new Promise((resolveResult, reject) => {
    let log = '', ready = false;
    const timer = setTimeout(() => { child.kill(); reject(new Error('The public Twilio audio connection timed out. Use your organization’s stable HTTPS tunnel via TWILIO_PUBLIC_URL.')); }, 45000);
    child.stderr.on('data', chunk => {
      log = (log + chunk.toString()).slice(-10000);
      const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/.exec(log);
      if (match && !ready) { ready = true; clearTimeout(timer); resolveResult({ url: match[0], child, failureCategory: () => /x509|certificate.*(?:fail|unknown)/i.test(log) ? 'TLS certificate error' : /timeout|timed out|deadline exceeded/i.test(log) ? 'network timeout' : /failed to (?:resolve|lookup)|DNS/i.test(log) ? 'DNS connection error' : 'connection process exited' }); }
    });
    child.once('error', () => { clearTimeout(timer); reject(new Error('The Cloudflare connection tool could not start.')); });
    child.once('exit', () => { clearTimeout(timer); if (!ready) reject(new Error('The public Twilio connection could not start. Set TWILIO_PUBLIC_URL for a working HTTPS tunnel.')); });
  });
}
