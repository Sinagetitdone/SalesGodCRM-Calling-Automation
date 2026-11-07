(() => {
  const status = document.getElementById('twilioStatus'), result = document.getElementById('twilioCheck'), button = document.getElementById('checkTwilio');
  const refresh = () => fetch('/twilio/status').then(r => r.json()).then(s => { status.textContent = s.ready && s.ingressListening ? 'Settings present · Calling number: ' + s.fromNumber + '. Use the connection check below to verify them.' : s.error || 'Twilio is not configured.'; }).catch(() => { status.textContent = 'Local bridge unavailable.'; });
  void refresh(); setInterval(() => { void refresh(); }, 5000);
  button.onclick = async () => {
    button.disabled = true; result.textContent = 'Checking account, number and public callback connection…';
    try { const r = await fetch('/twilio/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const data = await r.json(); if (!r.ok) throw new Error(data.error); result.textContent = 'Connected · ' + data.fromNumber + (data.trial ? ' · Trial account: verified destinations only.' : '') + ' · No calls placed.'; }
    catch (e) { result.textContent = e.message; }
    finally { button.disabled = false; }
  };
})();
