// Optional live-model check: synthetic in-memory contacts, text-only replies, no CRM/dialing.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createBridge } from './server.mjs';
import { CampaignStore } from './campaign-store.mjs';
import { SessionJournal } from './session-journal.mjs';
const store = new CampaignStore(':memory:'), journal = new SessionJournal(':memory:');
const cases = [
  { name: 'Guide A', fact: 'The representative is Alex. The approved preferred meeting time is Tuesday at 2 PM Pacific. The exact customer reference phrase is lilac window.', expected: ['Alex', 'Tuesday', '2', 'lilac window'] },
  { name: 'Guide B', fact: 'The representative is Jordan. The approved preferred meeting time is Thursday at 11 AM Pacific. The exact customer reference phrase is amber field.', expected: ['Jordan', 'Thursday', '11', 'amber field'] }
];
const app = createBridge({ campaignStore: store, journal });
const js = `const cases = ${JSON.stringify(cases.map(({ name, expected }) => ({ name, expected })))};
document.querySelector('button').onclick = async () => {
  const output = document.querySelector('pre'); output.textContent = 'Testing the actual voice model with two different saved guides…';
  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const pc = new RTCPeerConnection(), dc = pc.createDataChannel('oai-events'); pc.addTransceiver('audio', {direction:'recvonly'});
    let timer;
    try {
      const done = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Model reply timed out')), 40000);
        dc.onopen = () => {
          dc.send(JSON.stringify({type:'conversation.item.create', item:{type:'message',role:'user',content:[{type:'input_text',text:'Who are you representing, what preferred meeting time may you offer, and what is the exact customer reference phrase?'}]}}));
          dc.send(JSON.stringify({type:'response.create',response:{output_modalities:['text']}}));
        };
        let text = '';
        dc.onmessage = event => {
          const message = JSON.parse(event.data);
          if (message.type === 'response.output_text.done') text = message.text;
          if (message.type === 'error') reject(new Error(message.error?.code || 'OpenAI error'));
          if (message.type === 'response.done') {
            if (message.response?.status !== 'completed') reject(new Error('Response did not complete'));
            else resolve(text || (message.response.output || []).flatMap(x=>x.content || []).map(x=>x.text || '').join(''));
          }
        };
      });
      done.catch(()=>{});
      await pc.setLocalDescription(await pc.createOffer());
      const response = await fetch('/session/' + i,{method:'POST',headers:{'Content-Type':'application/sdp'},body:pc.localDescription.sdp});
      if (!response.ok) throw new Error('Session rejected: HTTP ' + response.status);
      await pc.setRemoteDescription({type:'answer',sdp:await response.text()});
      const answer = await done;
      results.push({guide:cases[i].name,answer,passed:cases[i].expected.every(word=>answer.toLowerCase().includes(word.toLowerCase()))});
    } catch(error) { results.push({guide:cases[i].name,error:error.message,passed:false}); }
    finally { clearTimeout(timer); dc.close(); pc.close(); }
  }
  output.textContent = JSON.stringify({results,phoneCalls:0,microphoneUsed:false,liveModel:true},null,2);
};`;
let busy = false;
createServer(async (req, res) => {
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end('<!doctype html><title>No-phone guidance check</title><h1>Guidance influence check</h1><p>Two synthetic saved guides, actual Realtime model, text-only answers. Uses API credits. No CRM or microphone.</p><button>Run guidance comparison</button><pre>Ready</pre><script src="/check.js"></script>'); }
  if (req.url === '/check.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(js); }
  const index = /^\/session\/([01])$/.exec(req.url)?.[1];
  if (req.method !== 'POST' || index === undefined || busy || req.headers.origin !== 'http://127.0.0.1:28433') { res.statusCode = 403; return res.end(); }
  busy = true; let campaign, worker;
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const rule = ' Use only approved facts. Do not invent information. Respect the requested conversation context and acknowledge uncertainty. ';
    const guidance = (cases[index].fact + rule.repeat(65)).slice(0, 6500);
    campaign = store.create({ name: cases[index].name, csv: 'first_name,last_name,phone\nAlex,Example,+12025550101', settings: { simulation: false, timeZone: 'UTC', startHour: 0, endHour: 24, callerNumber: '+12025550100', brief: 'Answer the customer using the approved guidance. Collect preferences without booking.', voicemailMessage: 'Synthetic message only.', background: 'Example Office. Use the representative named in the guide.', guidance, voice: 'marin' } });
    worker = randomUUID(); store.start(campaign.id, worker); const row = store.claim(campaign.id, worker).contact;
    const response = await app.inject({ method: 'POST', url: '/session', headers: { host: '127.0.0.1:28431', origin: 'http://127.0.0.1:28431', 'content-type': 'application/sdp', 'x-audio-mode': 'campaign-call', 'x-campaign-id': campaign.id, 'x-contact-id': row.id, 'x-worker-id': worker }, payload: Buffer.concat(chunks).toString() });
    store.finish(campaign.id, row.id, worker, 'cancelled'); store.pause(campaign.id, worker);
    res.statusCode = response.statusCode; res.setHeader('Content-Type', response.statusCode === 200 ? 'application/sdp' : 'application/json'); res.end(response.body);
  } catch { res.statusCode = 500; res.end('Synthetic guidance setup failed.'); }
  finally { busy = false; }
}).listen(28433, '127.0.0.1', () => console.log('No-phone guidance check: http://127.0.0.1:28433'));
