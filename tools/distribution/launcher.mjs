import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import net from 'node:net';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export function supportedNode(version) { return Number(version.split('.')[0]) === 24; }
export async function ensureEnvironment(folder) {
  // Exclusive creation: a colleague's existing key must never be overwritten.
  try { await writeFile(resolve(folder, '.env'), await readFile(resolve(folder, '.env.example')), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}
export async function portAvailable(port = 28431) {
  return new Promise(resolveResult => {
    const probe = net.createServer();
    probe.once('error', () => resolveResult(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolveResult(true)));
  });
}
export async function launch(action = 'start') {
  if (!['start', 'configure'].includes(action)) throw new Error('Unknown launcher action.');
  if (!supportedNode(process.versions.node)) throw new Error('Install Node.js 24 from https://nodejs.org/en/download, then reopen this launcher.');
  process.chdir(root);
  await ensureEnvironment(root);
  if (action === 'configure') {
    console.log('Opening your LOCAL .env file. Paste the key after OPENAI_API_KEY=, save, and close the editor.');
    console.log('Keep this file on this computer. Restart the bridge after changing the key.');
    const editor = process.platform === 'win32' ? ['notepad.exe', [resolve(root, '.env')]] : ['open', ['-W', '-e', resolve(root, '.env')]];
    const result = spawnSync(editor[0], editor[1], { stdio: 'inherit' });
    if (result.error || result.status !== 0) throw new Error('Could not open the editor. Open the local .env file manually using a plain-text editor.');
    return;
  }
  if (!await portAvailable()) throw new Error('Port 28431 is already in use or unavailable. If this bridge is already running, use its existing window. Otherwise ask your administrator; this launcher will not stop another program or change network settings.');
  const lock = await readFile(resolve(root, 'package-lock.json'));
  const digest = createHash('sha256').update(lock).digest('hex');
  let installed = false;
  try {
    await access(resolve(root, 'node_modules/fastify/package.json'));
    installed = (await readFile(resolve(root, 'node_modules/.salesgod-lock'), 'utf8')) === digest;
  } catch {}
  if (!installed) {
    console.log('Installing required libraries from npm. Internet access is needed on first launch.');
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.error || result.status !== 0) throw new Error('Library installation failed. Check your internet connection and Node.js 24 installation, then run Start again.');
    await writeFile(resolve(root, 'node_modules/.salesgod-lock'), digest);
  }
  await mkdir(resolve(root, 'data'), { recursive: true, mode: 0o700 });
  console.log('\nSalesGod Local Audio Bridge');
  console.log('Keep this window open while using the extension. Stop only when no call is active (Ctrl+C).');
  console.log('Open in Chrome: http://127.0.0.1:28431/');
  console.log('To set your key, use Configure OpenAI. Starting the bridge does not place calls.\n');
  const server = spawnSync(process.execPath, ['--env-file-if-exists=.env', 'tools/audio-bridge/server.mjs'], { stdio: 'inherit' });
  if (server.error) throw new Error('The bridge could not start. Check the setup guide.');
  if (server.status && server.status !== 130) process.exitCode = server.status;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  launch(process.argv[2]).catch(error => { console.error('\n' + error.message); process.exitCode = 1; });
}
