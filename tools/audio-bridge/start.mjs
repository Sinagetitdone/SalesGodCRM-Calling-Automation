import { execFileSync, spawnSync } from 'node:child_process';
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

export function startBridge() {
  const env = proxyEnvironment(process.env, process.platform === 'win32' ? windowsProxy() : null);
  const proxied = Boolean(env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy);
  console.log(proxied ? 'Bridge API requests use the configured HTTP/HTTPS proxy; localhost stays local.' : 'Bridge API requests use the direct connection.');
  const result = spawnSync(process.execPath, ['--use-env-proxy', fileURLToPath(new URL('server.mjs', import.meta.url))], { env, stdio: 'inherit' });
  if (result.error) throw new Error('The local bridge could not start. Check Node.js 24 and the setup guide.');
  process.exitCode = result.status ?? 1;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) startBridge();
