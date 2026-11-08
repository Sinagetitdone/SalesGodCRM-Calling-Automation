// OpenSSH ProxyCommand transport for the explicitly chosen test-tunnel endpoint.
// Credentials stay in the existing environment; stdout is raw SSH traffic only.
import http from 'node:http';
import https from 'node:https';
const [host, port] = process.argv.slice(2);
if (host !== 'free.pinggy.io' || port !== '443') throw new Error('Unexpected tunnel destination.');
const configured = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (!configured) throw new Error('No approved HTTP/HTTPS proxy configured.');
const proxy = new URL(configured);
if (!['http:', 'https:'].includes(proxy.protocol)) throw new Error('Unsupported proxy protocol.');
const auth = proxy.username || proxy.password ? 'Basic ' + Buffer.from(decodeURIComponent(proxy.username) + ':' + decodeURIComponent(proxy.password)).toString('base64') : undefined;
const request = (proxy.protocol === 'https:' ? https : http).request({ hostname: proxy.hostname, port: proxy.port || (proxy.protocol === 'https:' ? 443 : 80), method: 'CONNECT', path: host + ':' + port, headers: { Host: host + ':' + port, ...(auth ? { 'Proxy-Authorization': auth } : {}) } });
request.setTimeout(15000, () => request.destroy(new Error('Proxy connection timed out.')));
request.on('error', () => { process.stderr.write('The approved proxy could not connect to the test tunnel.\n'); process.exitCode = 1; });
request.on('connect', (response, socket, head) => {
  if (response.statusCode !== 200) { socket.destroy(); process.stderr.write('The approved proxy rejected the test tunnel.\n'); process.exitCode = 1; return; }
  request.setTimeout(0); if (head.length) process.stdout.write(head);
  process.stdin.pipe(socket); socket.pipe(process.stdout);
  socket.on('error', () => { process.exitCode = 1; });
  process.stdin.on('end', () => socket.end());
});
request.end();
