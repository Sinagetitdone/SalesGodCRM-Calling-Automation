import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { startQuickTunnel } from './twilio-tunnel.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Read only the current user's configured proxy. Never print addresses or credentials.
export function windowsProxy() {
  try {
    return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "$p = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'; @{enabled=[bool]$p.ProxyEnable;server=[string]$p.ProxyServer} | ConvertTo-Json -Compress"],
    { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { return null; }
}

export function proxyEnvironment(env, settings) {
  const result = { ...env };
  const explicit = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy;
  if (!explicit && settings?.enabled && settings.server) {
    const server = settings.server.trim();
    const selected = server.includes('=')
      ? server.split(';').find(part => part.trim().toLowerCase().startsWith('https='))?.trim().slice(6)
      : server;
    if (!selected) throw new Error('Windows proxy has no HTTPS entry. Ask your network administrator to configure HTTPS_PROXY in the local .env file.');
    let url;
    try { url = new URL(selected.includes('://') ? selected : 'http://' + selected); } catch {}
    if (!url || !['http:', 'https:'].includes(url.protocol)) throw new Error('The bridge needs an HTTP/HTTPS proxy. Review the local proxy configuration with your network administrator.');
    result.HTTPS_PROXY = url.href;
  }
  if (result.HTTPS_PROXY || result.https_proxy || result.HTTP_PROXY || result.http_proxy) {
    // Local extension signaling must stay on this computer.
    const bypass = [env.no_proxy || env.NO_PROXY || '', 'localhost', '127.0.0.1', '::1'].filter(Boolean).join(',');
    result.NO_PROXY = bypass;
    result.no_proxy = bypass;
  }
  return result;
}

export async function startBridge() {
  const env = proxyEnvironment(process.env, process.platform === 'win32' ? windowsProxy() : null);
  const proxied = Boolean(env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy);
  console.log(proxied ? 'Bridge API requests use the configured HTTP/HTTPS proxy; localhost stays local.' : 'Bridge API requests use the direct connection.');
  // A helper process starts with --use-env-proxy before doing any network I/O.
  const result = spawnSync(process.execPath, ['--use-env-proxy', fileURLToPath(new URL('start.mjs', import.meta.url)), '--configured'], { env, stdio: 'inherit' });
  if (result.error) throw new Error('The local bridge could not start. Check Node.js 24 and the setup guide.');
  process.exitCode = result.status ?? 1;
}
async function configuredStart() {
  const env = { ...process.env }; let tunnel;
  if (!env.TWILIO_PUBLIC_URL && env.TWILIO_TUNNEL !== 'manual' && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.OPENAI_API_KEY) {
    try { tunnel = await startQuickTunnel({ env }); env.TWILIO_PUBLIC_URL = tunnel.url; console.log('Temporary Twilio audio connection prepared. No calls placed.'); }
    catch (e) { console.log(e.message); console.log('The local desk will open, but Start remains blocked until its public connection is configured.'); }
  }
  const child = spawn(process.execPath, ['--use-env-proxy', fileURLToPath(new URL('server.mjs', import.meta.url))], { env, stdio: ['inherit', 'inherit', 'inherit', 'ipc'], windowsHide: true });
  const stop = () => { if (child.connected) child.send({ type: 'shutdown' }); else child.kill('SIGTERM'); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  tunnel?.child.once('exit', () => { if (child.exitCode === null) { console.log('Twilio public connection ended (' + tunnel.failureCategory() + '). Calling is blocked; the local desk stays open. Review Setup.'); if (child.connected) child.send({ type: 'twilio-tunnel-lost' }); } });
  await new Promise(resolveExit => { child.once('exit', code => { tunnel?.child.kill(); process.exitCode = code ?? 1; resolveExit(); }); child.once('error', () => { tunnel?.child.kill(); process.exitCode = 1; resolveExit(); }); });
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  (process.argv.includes('--configured') ? configuredStart() : startBridge()).catch(error => { console.error(error.message); process.exitCode = 1; });
}
