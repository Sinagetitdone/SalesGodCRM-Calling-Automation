(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let campaign, contact, report, serial = 0;
  const active = ['preparing', 'dispatching', 'connected'];
  async function api(path, body) {
    const r = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json(); if (!r.ok) throw new Error(data.error || 'History is unavailable.'); return data;
  }
  const fail = e => { $('historyError').textContent = e.message; };
  function reset() { serial++; contact = report = null; $('historyDetail').hidden = true; $('deleteConfirmation').hidden = true; $('historyAudio').replaceChildren(); }
  async function load() {
    reset(); campaign = null; $('exportHistoryList').hidden = true; $('historyContacts').replaceChildren(); $('historyError').textContent = '';
    const data = await api('/conversation-history');
    $('historyList').replaceChildren(new Option('Choose a list', ''));
    for (const c of data.campaigns) $('historyList').append(new Option(`${c.name} · ${c.state} · ${c.created.slice(0, 10)}`, c.id));
    $('historyStatus').textContent = `${data.campaigns.length} saved lists. Choose one to review its conversations.`;
  }
  async function choose() {
    reset(); const request = serial, id = $('historyList').value;
    campaign = null; $('exportHistoryList').hidden = true; $('historyContacts').replaceChildren(); if (!id) return;
    const result = await api('/campaigns-api/' + id); if (request !== serial) return; campaign = result;
    $('exportHistoryList').href = '/conversation-history.zip?campaign=' + id; $('exportHistoryList').hidden = false;
    $('historyStatus').textContent = `${campaign.settings.simulation ? 'Rehearsal' : 'Real calls'} · ${campaign.contacts.length} contacts · ${campaign.state}`;
    for (const c of campaign.contacts) {
      const button = document.createElement('button');
      button.textContent = `${c.firstName} ${c.lastName} · ${c.phone} · ${c.state}`;
      button.onclick = () => void review(c).catch(fail); $('historyContacts').append(button);
    }
  }
  async function review(c) {
    reset(); const request = serial, list = campaign; contact = c;
    const base = `/campaigns-api/${list.id}/${c.id}`;
    $('historyDetail').hidden = false; $('historyTitle').textContent = `${c.firstName} ${c.lastName} · ${c.state}`;
    $('historyText').textContent = 'Loading…'; $('exportConversation').disabled = $('deleteConversation').disabled = true;
    const [turns, audio] = await Promise.all([api(base + '/transcript'), api(base + '/events')]);
    if (request !== serial) return;
    const events = [...list.events.filter(e => !e.contact || e.contact === c.id).map(e => ({ ...e, source: e.contact ? 'Contact' : 'List' })), ...audio.events.map(e => ({ ...e, source: 'Audio' }))].sort((a, b) => a.time.localeCompare(b.time));
    report = { list: list.name, contact: c, transcript: turns.turns, events };
    const log = events.map(e => `${e.time} [${e.source}] ${e.event}${e.phase ? ' · phase=' + e.phase : ''}`).join('\n');
    const diagnostic = ['pending', 'failed', 'unknown', 'needs_review', ...active].includes(c.state);
    $('historyText').textContent = (diagnostic ? '' : 'Transcript\n' + (turns.turns.map(t => `${t.speaker}: ${t.text}`).join('\n\n') || 'No transcript saved.') + '\n\n') + 'Recorded event log\n' + log + (c.state === 'pending' ? '\nPending: this contact has not been attempted.' : '') + (c.state === 'failed' && !events.some(e => e.event.startsWith('failure_detail:')) ? '\nNo detailed error message was saved for this older attempt.' : '');
    if (c.hasRecording) {
      const player = document.createElement('audio'), link = document.createElement('a');
      player.controls = true; player.src = base + '/recording';
      link.href = player.src; link.download = `conversation-${c.id}.mp3`; link.textContent = 'Download conversation MP3 (both voices; partial if interrupted)';
      $('historyAudio').append(player, link);
    } else {
      const note = document.createElement('p');
      note.textContent = active.includes(c.state) ? 'Recording is available after this call finishes saving.' : 'No audio recording was saved for this attempt. Older calls cannot be reconstructed from their transcript.';
      $('historyAudio').append(note);
    }
    $('exportConversation').disabled = false;
    $('deleteConversation').disabled = list.state === 'running' || list.contacts.some(item => active.includes(item.state));
  }
  $('historyList').onchange = () => void choose().catch(fail);
  $('refreshHistory').onclick = () => void load().catch(fail);
  $('deleteConversation').onclick = () => { $('deleteConfirmation').hidden = false; };
  $('cancelDelete').onclick = () => { $('deleteConfirmation').hidden = true; };
  $('confirmDelete').onclick = async () => {
    if (!campaign || !contact) return;
    $('confirmDelete').disabled = true;
    try { await api(`/campaigns-api/${campaign.id}/${contact.id}/delete`, { confirmed: true }); await load(); $('historyStatus').textContent = 'Conversation deleted. Choose another saved list to continue.'; }
    catch (e) { fail(e); } finally { $('confirmDelete').disabled = false; }
  };
  $('exportConversation').onclick = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `conversation-${contact.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  void load().catch(fail);
})();
