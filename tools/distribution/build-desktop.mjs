import { access, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const source = resolve(dirname(fileURLToPath(import.meta.url)), 'desktop');
const output = resolve(source, '../../../releases/desktop');
let compilation;
export async function desktopEntries() {
  // Keep compiler-generated binaries out of source control; build from reviewed
  // C# source using the Windows .NET Framework compiler (no downloaded tools).
  compilation ??= compileWindows();
  const executable = await compilation;
  return [
    { name: 'SalesGod Bridge.exe', data: await readFile(executable), mode: 0o100755 },
    { name: 'SalesGod Bridge.app/Contents/Info.plist', data: await readFile(join(source, 'Info.plist')), mode: 0o100644 },
    { name: 'SalesGod Bridge.app/Contents/MacOS/SalesGodBridge', data: Buffer.from((await readFile(join(source, 'SalesGodBridge'), 'utf8')).replace(/\r\n/g, '\n')), mode: 0o100755 },
  ];
}
async function compileWindows() {
  if (process.platform !== 'win32') throw new Error('Build the team ZIP on Windows to compile its .exe from source. The Mac .app is included in the same ZIP.');
  const windows = process.env.SystemRoot || 'C:\\Windows';
  let compiler;
  for (const framework of ['Framework64', 'Framework']) {
    const path = join(windows, 'Microsoft.NET', framework, 'v4.0.30319', 'csc.exe');
    try { await access(path); compiler = path; break; } catch {}
  }
  if (!compiler) throw new Error('Windows .NET Framework C# compiler not found. Install the Windows .NET Framework developer tools before building a release.');
  await mkdir(output, { recursive: true });
  const executable = join(output, 'SalesGod Bridge.exe');
  const result = spawnSync(compiler, ['/nologo', '/target:exe', '/platform:anycpu', '/optimize+', '/debug-', '/out:' + executable, '/win32manifest:' + join(source, 'windows.manifest'), join(source, 'WindowsLauncher.cs')], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('Could not compile the Windows launcher: ' + (result.stderr || result.stdout || result.error?.message));
  return executable;
}
