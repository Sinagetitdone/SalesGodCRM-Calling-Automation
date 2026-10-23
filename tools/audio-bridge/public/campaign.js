(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const practice = document.body.dataset.workspace === 'rehearsal';
  const readAgentSettings = () => ({ turnSeconds: Number($('turnSeconds').value) });
  document.title = practice ? 'AI Agents Test Call · SalesGod' : 'Real calling lists · SalesGod';
  let selected, control, pairTimer, worker, starting = false;
  const recordings = [], visibleTurns = new Map(); let rehearsalContact;
  const rehearsal = practice ? new window.SalesGodRehearsal({ onUpdate: update => {
    if (update.type === 'starting') {
      rehearsalContact = update.contact; visibleTurns.clear(); $('rehearsalTranscript').replaceChildren();
      $('downloadRehearsalTranscript').disabled = true;
      $('rehearsalStatus').textContent = `Connecting two AI agents for ${rehearsalContact.firstName} ${rehearsalContact.lastName}…`;
      $('rehearsalPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (['speaking', 'delta', 'turn'].includes(update.type)) {
      let row = visibleTurns.get(update.index);
      if (!row) { const element = document.createElement('li'); element.dataset.role = update.role; $('rehearsalTranscript').append(element); row = { element, role: update.role }; visibleTurns.set(update.index, row); }
      row.text = update.text; row.saved = Boolean(update.saved);
      row.element.textContent = `${update.role === 'assistant' ? 'Office AI · Marin' : 'Fictional customer · Cedar'}${row.saved ? ' · saved · ' + update.seconds.toFixed(1) + 's including speech' : ''}\n${update.text || 'Thinking…'}`;
      $('rehearsalStatus').textContent = `${update.role === 'assistant' ? 'Office AI' : 'Customer AI'} ${update.type === 'turn' ? 'finished speaking' : 'is speaking'} · reply ${update.index + 1}`;
      $('downloadRehearsalTranscript').disabled = false;
      $('rehearsalTranscript').scrollTop = $('rehearsalTranscript').scrollHeight;
    } else if (update.type === 'recording') {
      $('rehearsalStatus').textContent = 'Preparing your MP3 recording on this computer…';
    } else if (update.type === 'finished') {
      $('rehearsalStatus').textContent = update.error || (update.outcome === 'completed' ? `Rehearsal completed · ${update.turns} replies saved · both agents’ audio verified · longest reply ${update.longestTurn.toFixed(1)}s including speech.` : 'Rehearsal stopped · partial results retained.');
      if (update.error) $('listError').textContent = update.error;
    }
  }, onRecording: ({ contact, outcome, blob }) => {
    const url = URL.createObjectURL(blob), article = document.createElement('article'), title = document.createElement('strong'), audio = document.createElement('audio'), link = document.createElement('a');
    title.textContent = `${contact.firstName} ${contact.lastName} · ${outcome === 'completed' ? 'Completed rehearsal' : 'Partial rehearsal'}`;
    audio.controls = true; audio.src = url;
    link.href = url; link.download = `salesgod-rehearsal-${contact.id}.mp3`; link.textContent = 'Download rehearsal MP3';
    article.append(title, audio, link); $('rehearsalRecordings').prepend(article); recordings.push({ url, article });
    if (recordings.length > 10) { const old = recordings.shift(); old.article.remove(); URL.revokeObjectURL(old.url); }
  } }) : null;
  const pending = new Map(); let serial = Promise.resolve();
  const args = new URLSearchParams(location.hash.slice(1)), token = args.get('token'), origin = args.get('origin');
  const labels = { completed: 'Conversation completed', voicemail_played: 'Voicemail playback completed', no_answer: 'No answer', blocked: 'Suppressed', unknown: 'Unknown — review', needs_review: 'Needs review', failed: 'Failed — review', opt_out: 'Opted out', cancelled: 'Cancelled', pending: 'Pending', preparing: 'Preparing', dispatching: 'Call attempted', connected: 'Connected' };
  async function api(path, body) {
    const response = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Local service unavailable.'); return data;
  }
  function error(e) { $('listError').textContent = e.message; }
  function download(data, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function driver(command, data = {}) {
    if (practice) return Promise.reject(new Error('Rehearsal cannot control the CRM dialer.'));
    const run = () => new Promise((resolve, reject) => {
      if (!control) return reject(new Error('Open this list using extension version 0.4.0 in the CRM.'));
      const id = crypto.randomUUID(), timer = setTimeout(() => { pending.delete(id); reject(new Error('CRM did not acknowledge. Check the dialer before resuming.')); }, 15000);
      pending.set(id, { resolve, reject, timer }); control.postMessage({ id, command, ...data });
    });
    const result = serial.then(run); serial = result.catch(() => {}); return result;
  }
  if (!practice && window.opener && token && ['https://www.salesgodcrm.net', 'https://salesgodcrm.net'].includes(origin)) {
    window.addEventListener('message', event => {
      if (control || event.source !== window.opener || event.origin !== origin || event.data?.source !== 'salesgod-campaign-v1' || event.data.type !== 'paired' || event.data.token !== token || !event.ports[0]) return;
      control = event.ports[0]; clearInterval(pairTimer);
      control.onmessage = ({ data }) => { const p = pending.get(data?.id); if (!p) return; clearTimeout(p.timer); pending.delete(data.id); data.error ? p.reject(new Error(data.error)) : p.resolve(data.result); };
      control.start(); $('driverState').textContent = 'CRM controls paired. No calls start until you choose Start.'; render();
    });
    const hello = () => window.opener.postMessage({ source: 'salesgod-campaign-v1', type: 'hello', token }, origin);
    pairTimer = setInterval(hello, 1000); hello(); setTimeout(() => clearInterval(pairTimer), 30000);
  }
  async function transcript(contact) {
    const data = await api(`/campaigns-api/${selected.id}/${contact.id}/transcript`);
    $('selectedTranscript').hidden = false;
    $('selectedTranscript').textContent = `${contact.firstName} ${contact.lastName}\n${labels[contact.state] || contact.state}\n\n` + (data.turns.map(t => `${t.speaker}: ${t.text}`).join('\n\n') || 'No conversation transcript saved.');
  }
  function render() {
    const running = starting || Boolean(worker?.running);
    $('startList').disabled = !selected || selected.settings.simulation !== practice || running || (practice && window.SalesGodCall.status().active) || !['draft', 'paused'].includes(selected.state) || (!practice && !control);
    $('pauseList').disabled = $('stopList').disabled = !running;
    $('importList').disabled = $('savedLists').disabled = running;
    $('exportList').disabled = !selected;
    $('copyList').disabled = !selected || running;
    if (!selected) return;
    $('listMode').textContent = `${selected.name} · ${selected.settings.simulation ? selected.settings.simulationMode === 'agents' ? 'LIVE AI REHEARSAL — no calls · uses OpenAI credits' : 'OFFLINE SIMULATION — no calls or API usage' : 'LIVE CALLING'} · ${selected.state} · ${selected.contacts.length} contacts`;
    $('contactRows').replaceChildren();
    for (const c of selected.contacts) {
      const tr = document.createElement('tr');
      for (const value of [`${c.firstName} ${c.lastName}`, c.phone, (selected.settings.simulation ? 'Simulated: ' : '') + (labels[c.state] || c.state)]) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
      const td = document.createElement('td'), b = document.createElement('button'); b.textContent = 'View transcript'; b.onclick = () => void transcript(c).catch(error); td.append(b); tr.append(td); $('contactRows').append(tr);
    }
    $('listEvents').textContent = selected.events.map(e => `${e.time} ${e.contact ? selected.contacts.find(c => c.id === e.contact)?.firstName + ': ' : ''}${e.event}`).join('\n');
  }
  async function refresh() {
    const lists = (await api('/campaigns-api?mode=' + (practice ? 'rehearsal' : 'live'))).campaigns;
    $('savedLists').replaceChildren(new Option('Choose a list', ''));
    lists.forEach(c => $('savedLists').append(new Option(`${c.name} (${c.state})`, c.id)));
    if (selected) { selected = await api('/campaigns-api/' + selected.id); $('savedLists').value = selected.id; }
    render();
  }
  worker = new window.SalesGodCampaignWorker({ api, driver, audio: window.SalesGodCall, rehearsal, expectedSimulation: practice, onState: state => {
    const name = state.contact ? `${state.contact.firstName} ${state.contact.lastName}` : '';
    $('listState').textContent = state.state === 'finished' ? 'Finished processing every contact. Review the results below.' : state.state === 'waiting' ? 'Waiting for the calling window. Keep this window open.' : `${state.state.replaceAll('_', ' ')} ${name}`;
    if (['paused', 'needs_review'].includes(state.state)) document.title = practice ? 'Rehearsal paused · SalesGod' : 'Calling list paused · SalesGod';
    if (state.state === 'finished') {
      document.title = practice ? 'Rehearsal finished · SalesGod' : 'Calling list finished · SalesGod';
      if (!practice) { $('state').textContent = 'List finished · no active list call remains'; $('media').textContent = 'List audio disconnected'; }
      if (window.Notification?.permission === 'granted') new Notification('Calling list finished', { body: 'All contacts processed. Review conversations and voicemail results in the list window.' });
    }
    void refresh().catch(error);
  } });
  $('contactFile').onchange = async () => { try { const f = $('contactFile').files[0]; if (f) { if (f.size > 400000) throw new Error('CSV file exceeds 400 KB.'); $('contactCsv').value = await f.text(); } } catch (e) { error(e); } };
  if (practice) $('demoContacts').onclick = () => { $('contactCsv').value = 'first_name,last_name,phone\nAlex,Example,+12025550101\nSam,Example,+12025550102'; $('listName').value = 'My rehearsal'; };
  $('copyList').onclick = () => {
    if (!selected || worker.running) return;
    const s = selected.settings;
    $('listName').value = (selected.name + ' — revised').slice(0, 120);
    const csvCell = value => '"' + String(value).replaceAll('"', '""') + '"';
    $('contactCsv').value = 'first_name,last_name,phone\n' + selected.contacts.map(c => [c.firstName, c.lastName, c.phone].map(csvCell).join(',')).join('\n');
    for (const [id, value] of Object.entries({ simulationMode: s.simulationMode || 'offline', rehearsalPersona: s.rehearsalPersona || 'interested', rehearsalTurns: s.rehearsalTurns || 8, callerNumber: s.callerNumber, listTimeZone: s.timeZone, startHour: s.startHour, endHour: s.endHour, callBrief: s.brief, ...(!practice ? { voicemailMessage: s.voicemailMessage } : {}) })) if ($(id)) $(id).value = value;
    if (practice) $('turnSeconds').value = s.rehearsalConfig?.turnSeconds ?? 20;
    else $('responsePauseMs').value = s.responsePauseMs ?? 250;
    $('listName').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('listState').textContent = 'Copied to editor. Change settings and click Import and preview to save a new list.';
  };
  $('importList').onclick = async () => {
    try {
      $('listError').textContent = '';
      const simulation = practice;
      if (!practice && !$('responsePauseMs').reportValidity()) return;
      if (simulation && $('simulationMode').value === 'agents') {
        if (!$('turnSeconds').reportValidity()) return;
      }
      selected = await api('/campaigns-api/import', { name: $('listName').value.trim(), csv: $('contactCsv').value,
        settings: { simulation, ...(practice ? { simulationMode: $('simulationMode').value, rehearsalPersona: $('rehearsalPersona').value, rehearsalTurns: Number($('rehearsalTurns').value), rehearsalConfig: readAgentSettings() } : { responsePauseMs: Number($('responsePauseMs').value) }), callerNumber: simulation ? '+12025550100' : $('callerNumber').value.trim(), timeZone: practice ? 'UTC' : $('listTimeZone').value.trim(), startHour: practice ? 0 : Number($('startHour').value), endHour: practice ? 24 : Number($('endHour').value), brief: $('callBrief').value.trim(), voicemailMessage: practice ? 'Fictional rehearsal; no voicemail is sent.' : $('voicemailMessage').value.trim() } });
      $('listState').textContent = `Imported ${selected.contacts.length} contacts. ${selected.duplicates} duplicate numbers skipped. Nothing has started.`; $('selectedTranscript').hidden = true; await refresh();
    } catch (e) { error(e); }
  };
  $('savedLists').onchange = async () => { try { selected = $('savedLists').value ? await api('/campaigns-api/' + $('savedLists').value) : undefined; $('selectedTranscript').hidden = true; $('listState').textContent = selected?.state === 'finished' ? 'Finished processing every contact. Review the results below.' : 'Nothing is running in this window.'; render(); } catch (e) { error(e); } };
  $('refreshLists').onclick = () => void refresh().catch(error);
  $('startList').onclick = async () => {
    if (!selected || worker.running || starting || selected.settings.simulation !== practice || (practice && window.SalesGodCall.status().active)) return;
    if (practice) { window.SalesGodRehearsalBusy = true; window.dispatchEvent(new CustomEvent('salesgod-rehearsal-state')); }
    starting = true; render();
    $('listError').textContent = ''; document.title = 'Calling list running · SalesGod';
    try { if (selected.settings.simulation && selected.settings.simulationMode === 'agents') await rehearsal.unlock(); const task = worker.run(selected.id); render(); await task; } catch (e) { error(e); }
    finally { starting = false; if (practice) { await rehearsal.close().catch(() => {}); window.SalesGodRehearsalBusy = false; window.dispatchEvent(new CustomEvent('salesgod-rehearsal-state')); } await refresh().catch(error); render(); }
  };
  $('pauseList').onclick = () => void worker.pause().catch(error);
  $('stopList').onclick = () => void worker.stop().catch(error);
  $('allowNotification').onclick = async () => { if (!window.Notification) return error(new Error('Desktop notifications are unavailable. Completion is always shown here.')); $('allowNotification').textContent = (await Notification.requestPermission()) === 'granted' ? 'Completion notifications enabled' : 'Completion will appear in this window'; };
  $('exportList').onclick = async () => { try { const report = await api('/campaigns-api/' + selected.id); for (const c of report.contacts) { c.transcript = (await api(`/campaigns-api/${report.id}/${c.id}/transcript`)).turns; c.audioEvents = c.session ? (await api('/live-log/' + c.session)).events : []; } download(report, 'salesgod-calling-list.json'); } catch (e) { error(e); } };
  if (practice) $('downloadRehearsalTranscript').onclick = () => download({ mode: 'ai-rehearsal', contact: rehearsalContact, turns: [...visibleTurns.values()].map(({ role, text, saved }) => ({ role, text, saved })) }, 'salesgod-rehearsal-transcript.json');
  window.addEventListener('pagehide', () => { rehearsal?.stop(); void rehearsal?.close(); recordings.forEach(r => URL.revokeObjectURL(r.url)); });
  window.addEventListener('salesgod-call-state', render);
  window.addEventListener('beforeunload', event => { if (worker.running) { event.preventDefault(); event.returnValue = ''; } });
  void refresh().catch(error);
  setInterval(() => { if (worker.running) void refresh().catch(error); }, 5000);
})();
