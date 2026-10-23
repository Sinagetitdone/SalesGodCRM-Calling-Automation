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
  if (location.origin === 'http://127.0.0.1:28431') {
    root.querySelector('style')?.remove();
    const styles = document.createElement('link'); styles.rel = 'stylesheet'; styles.href = '/panel.css'; root.prepend(styles);
  }
  document.documentElement.append(host);
  const $ = id => root.getElementById(id);
  root.querySelector('small').textContent = 'Audio setup · Calling lists require Start';
  const voiceButton = document.createElement('button'); voiceButton.id = 'voice'; voiceButton.disabled = true;
  voiceButton.textContent = 'Open AI voice setup'; $('stop').before(voiceButton);
  const callButton = document.createElement('button'); callButton.id = 'callVoice'; callButton.disabled = true;
  callButton.textContent = 'AI Agents Test Call'; voiceButton.after(callButton);
  const listButton = document.createElement('button'); listButton.id = 'callingList'; listButton.textContent = 'Open calling list'; callButton.after(listButton);
  const voiceResult = document.createElement('p'); voiceResult.id = 'voiceResult'; $('rtcResult').after(voiceResult);
  let report, listPopup, listToken, listPort, dialer, listWatch;
  const pending = new Map();
  const request = (name, data = {}) => new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID(); const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Audio hook did not acknowledge.')); }, 6000);
    pending.set(requestId, { resolve, reject, timer }); window.postMessage({ source: SOURCE, type: 'command', command: name, requestId, ...data }, location.origin);
  });
  const command = name => window.postMessage({ source: SOURCE, type: 'command', command: name, requestId: crypto.randomUUID() }, location.origin);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== SOURCE || event.data?.type !== 'result') return;
    const waiter = pending.get(event.data.requestId);
    if (waiter) { clearTimeout(waiter.timer); pending.delete(event.data.requestId); event.data.error ? waiter.reject(new Error(event.data.error)) : waiter.resolve(event.data.status); }
    report = event.data.status;
    if (!report || !['0.1.0', '0.1.1', '0.2.0', '0.3.0', '0.3.2', '0.4.0', '0.4.1'].includes(report.version)) return;
    $('state').textContent = report.testing ? 'Testing synthetic audio locally…' : report.armed ? 'Local routing enabled · OpenAI disconnected' : 'Local routing disabled · OpenAI disconnected';
    $('arm').disabled = report.armed || report.testing;
    voiceButton.disabled = !report.armed || report.testing || !['0.2.0', '0.3.0', '0.3.2', '0.4.0', '0.4.1'].includes(report.version) || report.voiceState !== 'disconnected';
    callButton.disabled = voiceButton.disabled || !['0.3.0', '0.3.2', '0.4.0', '0.4.1'].includes(report.version);
    if (report.voiceState && report.voiceState !== 'disconnected') $('state').textContent = `Local routing enabled · Voice setup ${report.voiceState} · Check setup window for OpenAI status`;
    $('test').disabled = !report.armed || report.testing || (report.voiceState && report.voiceState !== 'disconnected');
    $('rtc').disabled = !report.armed || report.testing || (report.voiceState && report.voiceState !== 'disconnected');
    $('result').textContent = report.lastTest ? `Local test: ${report.lastTest.passed ? 'PASSED' : 'FAILED'} · Both directions checked` : 'No audio test run yet.';
    $('rtcResult').textContent = report.lastPeerTest ? `WebRTC: ${report.lastPeerTest.passed ? 'PASSED · audio received both ways' : 'FAILED · ' + report.lastPeerTest.error}` : 'WebRTC not tested.';
    voiceResult.textContent = report.lastVoiceTest ? `Paired setup: ${report.lastVoiceTest.passed ? 'PASSED' : 'FAILED'} · ${report.lastVoiceTest.mode === 'paired-routing-only' ? 'Local routing without OpenAI' : 'AI audio test'}` : '';
    $('error').textContent = event.data.error || '';
    $('evidence').textContent = `Dialer device lists: ${report.dialerEnumerations}\nDialer bridge-mic requests: ${report.dialerRequests}\nObserved dialer peers: ${report.observedPeers}\nActive dialer connections: ${report.activeDialerConnections}\nList dispatch attempts in this page: ${dialer?.attempts.size || 0}\nVoice setup: ${report.voiceState || 'not available'}\nOpenAI status: check local setup window\n` + (report.lastTest ? JSON.stringify(report.lastTest, null, 2) : '') + (report.lastPeerTest ? '\nWebRTC probe: ' + JSON.stringify(report.lastPeerTest, null, 2) : '');
    $('evidence').textContent += '\nRecent events:\n' + (report.events || []).slice(-8).map(item => `${item.time} ${item.event}`).join('\n');
    if (report.lastVoiceTest) $('evidence').textContent += '\nPaired setup:\n' + JSON.stringify(report.lastVoiceTest, null, 2);
  });
  $('arm').onclick = () => command('arm');
  $('test').onclick = () => command('test');
  $('rtc').onclick = () => command('peer-test');
  $('stop').onclick = () => command('disarm');
  listButton.onclick = () => {
    if (listPopup && !listPopup.closed) { $('error').textContent = 'Use the existing calling-list window.'; return; }
    listToken = crypto.randomUUID();
    listPopup = window.open('http://127.0.0.1:28431/campaigns#' + new URLSearchParams({ token: listToken, origin: location.origin }), 'salesgod-list-' + listToken);
    if (!listPopup) $('error').textContent = 'Allow the local calling-list window to open.';
  };
  window.addEventListener('message', event => {
    if (event.origin !== 'http://127.0.0.1:28431' || event.source !== listPopup || event.data?.source !== 'salesgod-campaign-v1' || event.data.token !== listToken || event.data.type !== 'hello' || listPort) return;
    const channel = new MessageChannel(); listPort = channel.port1; dialer = new window.SalesGodCampaignDialer();
    let busy = false;
    listPort.onmessage = async ({ data }) => {
      if (!data || typeof data.id !== 'string' || busy) return;
      busy = true;
      try {
        let result;
        if (data.command === 'inspect') result = await dialer.inspect();
        else if (data.command === 'prepare') { await dialer.inspect(); await request('arm'); await request('prepare-voice', { mode: 'live', token: data.token }); result = { prepared: true }; }
        else if (data.command === 'dial') {
          if (!report?.armed || report.voiceState !== 'audio-connected') throw new Error('Prepare silent AI audio first.');
          result = await dialer.dial(data);
        } else if (data.command === 'status') result = await dialer.status();
        else if (data.command === 'hangup') result = await dialer.hangup(data.attempt);
        else if (data.command === 'release') { await dialer.release(data.attempt); await request('disarm'); result = { released: true }; }
        else throw new Error('Unknown list command.');
        listPort.postMessage({ id: data.id, result });
      } catch (error) { listPort.postMessage({ id: data.id, error: error.message }); }
      finally { busy = false; }
    };
    listPort.start(); listPopup.postMessage({ source: 'salesgod-campaign-v1', type: 'paired', token: listToken }, event.origin, [channel.port2]);
    listWatch = setInterval(() => {
      if (!listPopup.closed) return;
      if (dialer.owned) void dialer.hangup(dialer.owned.attempt).catch(() => { $('error').textContent = 'Calling-list window closed; check the CRM call and hang up manually if needed.'; });
      command('disarm'); listPort.close(); listPort = undefined; clearInterval(listWatch);
    }, 1000);
  });
  voiceButton.onclick = () => {
    const token = crypto.randomUUID();
    window.postMessage({ source: SOURCE, type: 'command', command: 'prepare-voice', token, requestId: crypto.randomUUID() }, location.origin);
    const url = 'http://127.0.0.1:28431/voice-test#' + new URLSearchParams({ token, origin: location.origin });
    const popup = window.open(url, 'salesgod-voice-' + token);
    if (!popup) $('error').textContent = 'Allow the local voice setup window to open, then try again.';
  };
  callButton.onclick = () => {
    const token = crypto.randomUUID();
    window.postMessage({ source: SOURCE, type: 'command', command: 'prepare-voice', mode: 'live', token, requestId: crypto.randomUUID() }, location.origin);
    const url = 'http://127.0.0.1:28431/supervised-call#' + new URLSearchParams({ token, origin: location.origin });
    if (!window.open(url, 'salesgod-call-' + token)) $('error').textContent = 'Allow the local call-control tab to open, then try again.';
  };
  $('min').onclick = () => { $('body').hidden = !$('body').hidden; $('min').textContent = $('body').hidden ? '+' : '−'; };
  $('download').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'salesgod-local-audio-report.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  command('status');
})();
