(() => {
  'use strict';
  if (document.getElementById('salesgod-local-audio-panel')) return;
  const SOURCE = 'salesgod-local-audio-v1';
  const host = document.createElement('aside'); host.id = 'salesgod-local-audio-panel';
  host.style.cssText = 'position:fixed;bottom:18px;left:18px;width:330px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{font:14px/1.5 Segoe UI,sans-serif;color:#183c34}section{background:#f7fcf8;border:1px solid #7d9e8e;border-radius:14px;box-shadow:0 8px 30px #0003;padding:18px}h2{font-size:17px;margin:0 0 6px}p{margin:8px 0}small{display:block;color:#536a60}button{font:inherit;border:0;border-radius:6px;background:#175b48;color:#fff;padding:8px 11px;cursor:pointer;margin:7px 5px 0 0}button:disabled{opacity:.45;cursor:not-allowed}button.stop{background:#74433a}pre{font:11px/1.5 Consolas,monospace;white-space:pre-wrap;max-height:100px;overflow:auto;background:#eaf2eb;padding:8px}details{margin-top:10px}summary{cursor:pointer}.min{float:right;background:transparent;color:#183c34;padding:0 4px;margin:0}.error{color:#89362b}#body[hidden]{display:none}
    </style><section><button class="min" id="min" aria-label="Minimize audio diagnostics">−</button><h2>SalesGod audio bridge</h2><small>Local diagnostic build · No OpenAI · No dialing</small><div id="body"><p id="state">Checking extension…</p><button id="arm">Enable local routing</button><button id="test" disabled>Test local audio</button><button id="rtc" disabled>Test WebRTC</button><button id="stop" class="stop">Disable</button><p id="result">No audio test run yet.</p><p id="rtcResult">WebRTC not tested.</p><small>In the dialer, refresh devices and select “SalesGod AI Bridge (local audio)” as the microphone. Keep the speaker on your headset.</small><p id="error" class="error"></p><details><summary>Connection evidence</summary><pre id="evidence"></pre><button id="download">Save report</button></details></div></section>`;
  if (location.origin === 'http://127.0.0.1:4318') {
    root.querySelector('style')?.remove();
    const styles = document.createElement('link'); styles.rel = 'stylesheet'; styles.href = '/panel.css'; root.prepend(styles);
  }
  document.documentElement.append(host);
  const $ = id => root.getElementById(id);
  root.querySelector('small').textContent = 'Audio setup · No dialing controls';
  const voiceButton = document.createElement('button'); voiceButton.id = 'voice'; voiceButton.disabled = true;
  voiceButton.textContent = 'Open AI voice setup'; $('stop').before(voiceButton);
  const voiceResult = document.createElement('p'); voiceResult.id = 'voiceResult'; $('rtcResult').after(voiceResult);
  let report;
  const command = name => window.postMessage({ source: SOURCE, type: 'command', command: name, requestId: crypto.randomUUID() }, location.origin);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== SOURCE || event.data?.type !== 'result') return;
    report = event.data.status;
    if (!report || !['0.1.0', '0.1.1', '0.2.0'].includes(report.version)) return;
    $('state').textContent = report.testing ? 'Testing synthetic audio locally…' : report.armed ? 'Local routing enabled · OpenAI disconnected' : 'Local routing disabled · OpenAI disconnected';
    $('arm').disabled = report.armed || report.testing;
    voiceButton.disabled = !report.armed || report.testing || report.version !== '0.2.0' || report.voiceState !== 'disconnected';
    if (report.voiceState && report.voiceState !== 'disconnected') $('state').textContent = `Local routing enabled · Voice setup ${report.voiceState} · Check setup window for OpenAI status`;
    $('test').disabled = !report.armed || report.testing || (report.voiceState && report.voiceState !== 'disconnected');
    $('rtc').disabled = !report.armed || report.testing || (report.voiceState && report.voiceState !== 'disconnected');
    $('result').textContent = report.lastTest ? `Local test: ${report.lastTest.passed ? 'PASSED' : 'FAILED'} · Both directions checked` : 'No audio test run yet.';
    $('rtcResult').textContent = report.lastPeerTest ? `WebRTC: ${report.lastPeerTest.passed ? 'PASSED · audio received both ways' : 'FAILED · ' + report.lastPeerTest.error}` : 'WebRTC not tested.';
    voiceResult.textContent = report.lastVoiceTest ? `Paired setup: ${report.lastVoiceTest.passed ? 'PASSED' : 'FAILED'} · ${report.lastVoiceTest.mode === 'paired-routing-only' ? 'Local routing without OpenAI' : 'AI audio test'}` : '';
    $('error').textContent = event.data.error || '';
    $('evidence').textContent = `Dialer device lists: ${report.dialerEnumerations}\nDialer bridge-mic requests: ${report.dialerRequests}\nObserved dialer peers: ${report.observedPeers}\nActive dialer connections: ${report.activeDialerConnections}\nPhone calls initiated by extension: 0\nVoice setup: ${report.voiceState || 'not available'}\nOpenAI status: check local setup window\n` + (report.lastTest ? JSON.stringify(report.lastTest, null, 2) : '') + (report.lastPeerTest ? '\nWebRTC probe: ' + JSON.stringify(report.lastPeerTest, null, 2) : '');
    $('evidence').textContent += '\nRecent events:\n' + (report.events || []).slice(-8).map(item => `${item.time} ${item.event}`).join('\n');
    if (report.lastVoiceTest) $('evidence').textContent += '\nPaired setup:\n' + JSON.stringify(report.lastVoiceTest, null, 2);
  });
  $('arm').onclick = () => command('arm');
  $('test').onclick = () => command('test');
  $('rtc').onclick = () => command('peer-test');
  $('stop').onclick = () => command('disarm');
  voiceButton.onclick = () => {
    const token = crypto.randomUUID();
    window.postMessage({ source: SOURCE, type: 'command', command: 'prepare-voice', token, requestId: crypto.randomUUID() }, location.origin);
    const url = 'http://127.0.0.1:4318/voice-test#' + new URLSearchParams({ token, origin: location.origin });
    const popup = window.open(url, 'salesgod-voice-' + token);
    if (!popup) $('error').textContent = 'Allow the local voice setup window to open, then try again.';
  };
  $('min').onclick = () => { $('body').hidden = !$('body').hidden; $('min').textContent = $('body').hidden ? '+' : '−'; };
  $('download').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'salesgod-local-audio-report.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  command('status');
})();
