(() => {
  'use strict';
  if (document.getElementById('salesgod-local-audio-panel')) return;
  const SOURCE = 'salesgod-local-audio-v1';
  const host = document.createElement('aside'); host.id = 'salesgod-local-audio-panel';
  host.style.cssText = 'position:fixed;bottom:18px;left:18px;width:350px;max-width:calc(100vw - 36px);z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
:host{--jml-purple:#4C0099;--jml-lime:#B1EB1E;font:14px/1.5 "DM Sans",Inter,"Segoe UI",Arial,sans-serif;color:#242126}
*{box-sizing:border-box}[hidden]{display:none!important}
section{background:#fff;border:1px solid #dedbe2;border-top:5px solid var(--jml-purple);border-radius:4px;box-shadow:0 8px 28px #0002;padding:20px;max-height:calc(100dvh - 36px);overflow:auto}
h2{font-size:20px;line-height:1.2;letter-spacing:-.5px;margin:0 0 8px;color:var(--jml-purple)}
p{margin:10px 0}small{display:block;font-size:12px;line-height:1.5;color:#625d68}
button{font:600 12px/1.4 "DM Sans",Inter,"Segoe UI",Arial,sans-serif;border:1px solid var(--jml-purple);border-radius:3px;background:var(--jml-purple);color:#fff;padding:9px 10px;cursor:pointer;margin:7px 5px 0 0;max-width:100%}
button:hover:not(:disabled){box-shadow:inset 0 0 0 1px currentColor}
button:disabled{background:#efedf1;border-color:#dedbe2;color:#79727f;cursor:not-allowed}
button.stop{background:#fff;border-color:#625d68;color:#423c48}
#callingList{display:block;width:100%;background:var(--jml-lime);color:var(--jml-purple);border-color:var(--jml-purple);padding:11px}
#state{padding:10px 12px;background:#f2eef7;border-left:3px solid var(--jml-purple);font-size:12px}
pre{user-select:text;cursor:text;font:11px/1.5 "JetBrains Mono",Consolas,monospace;white-space:pre-wrap;max-height:100px;overflow:auto;background:#f4f2f6;padding:10px}
details{margin-top:14px;border-top:1px solid #dedbe2;padding-top:10px}summary{cursor:pointer;color:var(--jml-purple);font-size:12px}
.min{float:right;background:#fff;color:var(--jml-purple);border:1px solid #dedbe2;padding:2px 9px;margin:0;font-size:20px}
.error{color:#8b2525;overflow-wrap:anywhere}
button:focus-visible,summary:focus-visible{outline:3px solid var(--jml-purple);outline-offset:3px}
    </style><section><button class="min" id="min" aria-label="Minimize audio diagnostics">−</button><h2>SalesGod audio bridge</h2><small>Local diagnostic build · No OpenAI · No dialing</small><div id="body"><p id="state">Checking extension…</p><button id="arm">Enable local routing</button><button id="test" disabled>Test local audio</button><button id="rtc" disabled>Test WebRTC</button><button id="stop" class="stop">Disable</button><p id="result">No audio test run yet.</p><p id="rtcResult">WebRTC not tested.</p><small>In the dialer, refresh devices and select “SalesGod AI Bridge (local audio)” as the microphone. Keep the speaker on your headset.</small><p id="error" class="error"></p><details><summary>Connection evidence</summary><pre id="evidence"></pre><button id="download">Save report</button></details></div></section>`;
  if (location.origin === 'http://127.0.0.1:28431') {
    root.querySelector('style')?.remove();
    const styles = document.createElement('link'); styles.rel = 'stylesheet'; styles.href = '/panel.css'; root.prepend(styles);
  }
  document.documentElement.append(host);
  const $ = id => root.getElementById(id);
  const move = root.querySelector('section'); move.tabIndex = 0;
  move.title = 'Drag the panel to move it. Focus the panel and use arrow keys to move it; Home resets its position.';
  move.style.cssText = 'cursor:grab;touch-action:none;user-select:none';
  const positionKey = 'salesgod-panel-position-v1'; let position, drag;
  function place(x, y, save = true) {
    const rect = host.getBoundingClientRect(), margin = 8;
    position = { x: Math.max(margin, Math.min(x, Math.max(margin, window.innerWidth - rect.width - margin))), y: Math.max(margin, Math.min(y, Math.max(margin, window.innerHeight - rect.height - margin))) };
    host.style.left = position.x + 'px'; host.style.top = position.y + 'px'; host.style.bottom = 'auto';
    if (save) try { localStorage.setItem(positionKey, JSON.stringify(position)); } catch { /* Storage can be disabled. Dragging still works. */ }
  }
  try { const saved = JSON.parse(localStorage.getItem(positionKey)); if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) place(saved.x, saved.y); } catch { /* Use the default corner. */ }
  move.onpointerdown = e => {
    if (e.button !== 0 || e.target.closest('button,a,input,select,textarea,summary,pre,[contenteditable="true"]')) return;
    const rect = host.getBoundingClientRect(); drag = { id: e.pointerId, x: e.clientX - rect.left, y: e.clientY - rect.top };
    move.setPointerCapture(e.pointerId); e.preventDefault();
  };
  move.onpointermove = e => { if (drag?.id === e.pointerId) place(e.clientX - drag.x, e.clientY - drag.y, false); };
  move.onpointerup = move.onpointercancel = e => { if (drag?.id !== e.pointerId) return; drag = null; if (position) place(position.x, position.y); if (move.hasPointerCapture(e.pointerId)) move.releasePointerCapture(e.pointerId); };
  move.onkeydown = e => {
    if (e.target !== move) return;
    const delta = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[e.key];
    if (!delta && e.key !== 'Home') return;
    e.preventDefault(); const rect = host.getBoundingClientRect();
    if (e.key === 'Home') place(18, window.innerHeight - rect.height - 18); else place(rect.left + delta[0], rect.top + delta[1]);
  };
  const keepVisible = () => { if (position) place(position.x, position.y); };
  window.addEventListener('resize', keepVisible);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(keepVisible).observe(host);
  root.querySelector('small').textContent = 'Audio setup · Calling lists require Start';
  const voiceButton = document.createElement('button'); voiceButton.id = 'voice'; voiceButton.disabled = true;
  voiceButton.textContent = 'Open AI voice setup'; $('stop').before(voiceButton);
  const callButton = document.createElement('button'); callButton.id = 'callVoice'; callButton.disabled = true;
  callButton.textContent = 'AI Agents Test Call'; voiceButton.after(callButton);
  const listButton = document.createElement('button'); listButton.id = 'callingList'; listButton.textContent = 'Open calling list'; callButton.after(listButton);
  const historyButton = document.createElement('button'); historyButton.id = 'previousConversations'; historyButton.textContent = 'Previous Conversations'; listButton.after(historyButton);
  historyButton.onclick = () => { window.open('http://127.0.0.1:28431/history', '_blank', 'noopener'); };
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
    if (!report || !['0.1.0', '0.1.1', '0.2.0', '0.3.0', '0.3.2', '0.4.0', '0.4.1', '0.4.2', '0.4.3', '0.4.4'].includes(report.version)) return;
    $('state').textContent = report.testing ? 'Testing synthetic audio locally…' : report.armed ? 'Local routing enabled · OpenAI disconnected' : 'Local routing disabled · OpenAI disconnected';
    $('arm').disabled = report.armed || report.testing;
    voiceButton.disabled = !report.armed || report.testing || !['0.2.0', '0.3.0', '0.3.2', '0.4.0', '0.4.1', '0.4.2', '0.4.3', '0.4.4'].includes(report.version) || report.voiceState !== 'disconnected';
    callButton.disabled = voiceButton.disabled || !['0.3.0', '0.3.2', '0.4.0', '0.4.1', '0.4.2', '0.4.3', '0.4.4'].includes(report.version);
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
