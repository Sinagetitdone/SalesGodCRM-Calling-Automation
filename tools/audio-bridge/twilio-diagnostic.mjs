// Read-only account checks and a silent OpenAI handshake. Never dials.
import { spawnSync } from 'node:child_process';
import { proxyEnvironment, windowsProxy } from './start.mjs';
if (!process.argv.includes('--child')) {
  const result = spawnSync(process.execPath, ['--use-env-proxy', '--env-file-if-exists=.env', import.meta.filename, '--child'], { env: proxyEnvironment(process.env, process.platform === 'win32' ? windowsProxy() : null), stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} else {
  const { TwilioProvider, openAIWebSocket } = await import('./twilio-provider.mjs');
  const { TwilioAudio } = await import('./twilio-audio.mjs');
  const provider = new TwilioProvider({ env: { ...process.env, TWILIO_PUBLIC_URL: process.env.TWILIO_PUBLIC_URL || 'https://not-configured.invalid' } });
  try { console.log('Twilio account:', await provider.check()); } catch (e) { console.log('Twilio account:', e.message); process.exitCode = 1; }
  try {
    const local = await (await fetch('http://127.0.0.1:28431/twilio/status', { signal: AbortSignal.timeout(3000) })).json();
    if (!local.ready || !local.publicUrl) throw new Error(local.error || 'Public audio connection not configured.');
    const localHealth = await (await fetch('http://127.0.0.1:28432/twilio/health', { signal: AbortSignal.timeout(3000) })).json();
    const publicResponse = await fetch(local.publicUrl + '/twilio/health', { signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!publicResponse.ok || (await publicResponse.json()).instance !== localHealth.instance) throw new Error('The public HTTPS callback address does not reach this bridge.');
    console.log('Public audio ingress: reachable; exact bridge instance verified. No call placed.');
  } catch (e) { console.log('Public audio ingress:', e.message.startsWith('The public') || e.message.startsWith('Add ') ? e.message : 'Not verified. Open Setup and check the public connection.'); }
  let audio;
  try {
    audio = new TwilioAudio({ socket: openAIWebSocket(process.env), settings: { timeZone: 'America/Los_Angeles', voice: 'marin', responsePauseMs: 250, brief: 'Silent connection check only.' }, contact: { firstName: 'Synthetic', lastName: 'Test' }, voicemail: Buffer.alloc(0), event: () => {}, transcript: () => {}, finish: () => {}, fail: () => {} });
    await audio.prepare(); console.log('OpenAI: authenticated; PCMU audio and voice configuration accepted. No audio generated or call placed.');
  } catch (e) { console.log('OpenAI:', e.message); process.exitCode = 1; }
  finally { audio?.close(); }
}
