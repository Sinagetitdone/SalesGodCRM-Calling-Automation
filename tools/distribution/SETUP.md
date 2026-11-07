# Team calling desk 2.0.1 — Twilio setup

This version replaces SalesGodCRM dialing with Twilio. No SalesGodCRM login, extension, virtual microphone, VB-CABLE or Docker is required. Your list, context, call results, transcripts and downloaded recordings remain on your computer.

The launcher names **SalesGod Bridge.exe** and **SalesGod Bridge.app** are retained so existing shortcuts keep working. They now open the Twilio calling desk.

## Step 1 — Extract the whole package

1. Windows: right-click the ZIP, choose **Extract All**, and extract it to a permanent private folder such as Documents.
2. Mac: double-click the ZIP, then move the extracted **SalesGod-Team** folder to Documents.
3. Keep the entire folder together. Do not run files inside the ZIP or move the launcher by itself.
4. Open **SETUP.html** for the formatted guide.
5. Updating an existing installation: finish/stop any current list and close the old bridge first. Back up your private **.env** and **data** folder. Replace program files with the new package while retaining those private files. Do not share them with colleagues.

## Step 2 — Prepare Twilio and OpenAI

1. Have an upgraded Twilio account and an owned voice-enabled Twilio telephone number.
2. In Twilio account home, find **Account SID** (starts with **AC**) and **Auth Token**. An API key SID starting with **SK** is a different field; do not use it as Account SID.
3. Have a valid OpenAI API key with API billing and voice-model access. A ChatGPT subscription alone does not provide API credits.
4. Twilio’s current trial blocks Media Streams, which this live AI workflow requires, and uses shared trial numbers rather than an owned calling number. The account owner must upgrade and obtain a voice-enabled number before using this workflow. The app does not upgrade accounts, buy numbers or change billing. Source: https://www.twilio.com/docs/usage/trials/try-out-voice#blocked-verbs

## Step 3A — Save settings on Windows

1. Double-click **Configure OpenAI Windows.cmd**. Despite its older name, it opens the settings for both services.
2. If the launcher says it is preparing Node.js 24, wait. It downloads a private verified runtime automatically; no separate Node installation or CMD commands are required.
3. In Notepad, enter your real values after the equals signs in the **.env** file. Do not edit **.env.example**.
4. Save with **Ctrl+S**, then close Notepad. Keep the filename exactly **.env**, not **.env.txt**.

```text
OPENAI_API_KEY=your real OpenAI key
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
TWILIO_ACCOUNT_SID=your AC Account SID
TWILIO_AUTH_TOKEN=your account Auth Token
TWILIO_FROM_NUMBER=your voice-enabled Twilio number with country code
TWILIO_PUBLIC_URL=
TWILIO_TUNNEL=quick
```

## Step 3B — Save settings on Mac

1. Double-click **Configure OpenAI Mac.command**.
2. Wait for the private Node.js runtime setup if this is the first launch.
3. The local **.env** opens in a plain-text editor. Enter the same settings shown above.
4. Save with **Command+S**, then close the editor. Keep the exact filename **.env**.

Never put keys in GitHub, AGENTS.md, this guide, a browser extension or a chat message. Give each colleague their own approved local credentials. The shared ZIP contains blank settings only.

## Step 4 — Start the calling desk

1. Windows: double-click **SalesGod Bridge.exe**. Fallback: **Start Windows.cmd**.
2. Mac: double-click **SalesGod Bridge.app**. Fallback: **Start Mac.command**.
3. On first launch, wait while Node.js, required libraries and the private Cloudflare connection tool are prepared. Internet access is needed. Downloads are from official sources and checked where applicable.
4. With **TWILIO_TUNNEL=quick** and no public URL, startup attempts a temporary HTTPS connection to the callback-only service. No Cloudflare account or router changes are required.
5. Open **http://127.0.0.1:28431/** in your browser.
6. Keep the progress/terminal window running. Closing it stops the backend. Do not stop or update it during a call.
7. If your organization blocks an unsigned internal launcher, ask IT to review it. Do not disable security protections.

If you prefer manual startup in an existing repository, open PowerShell on Windows or Terminal on Mac in the project folder and run:

```text
npm run audio:bridge
```

For the extracted team package, the equivalent command is:

```text
npm start
```

These commands require Node.js 24 and installed libraries. Double-click startup handles those prerequisites automatically.

## Step 5 — Check the connection without calling anyone

1. On Setup, click **Check Twilio connection — no calls**.
2. Wait for the result. This checks the account, owned calling number and public callback connection.
3. It must report a successful connection before starting a real list.
4. For a silent OpenAI voice authentication/configuration check in a terminal opened in this folder, run **npm run twilio:check**. This never dials a number or opens your physical microphone.
5. On **AI rehearsal**, you can run a simulated conversation. This tests AI dialogue, not telephone delivery, answer detection or voicemail timing.

A passing setup or synthetic test does not prove that a real recipient can hear the AI. Complete one explicitly authorized test call before using a customer list.

## Step 6 — Set the background, guide and voicemail

1. Open **Calling lists**.
2. Enter the approved office/person, background and conversation guide. The AI identifies itself as an AI assistant.
3. Choose the voice, response pause and optional short introduction for automatic call screening.
4. Click **Save for future calls** to use that context for new imports.
5. To change an existing idle list, select it and use **Apply to selected list**. Typing alone does not change the saved list.
6. Review the **Voicemail message**. The system prepares these exact words before dialing and waits for the voicemail greeting to end.
7. Choose the timezone for dates and appointments. Los Angeles and San Diego use **America/Los_Angeles**.
8. Review the calling number: it must exactly match **TWILIO_FROM_NUMBER** in .env.

## Step 7 — Upload your list and preview it

1. Click **Import contacts for calling** and choose a CSV on this computer.
2. Use the columns **first_name,last_name,phone**. Include the country code for international numbers.
3. Review the small file-content preview under the upload button.
4. Enter the list name and review its settings, additional instructions and voicemail.
5. Click **Create draft from uploaded file**. Review the resulting names and numbers.
6. Duplicate normalized numbers are skipped. Invalid rows show an error. Creating a draft never starts calls.
7. Existing CRM-era lists keep their original caller number. Use **Copy selected list to editor**, change the caller to your Twilio number and create a new draft before calling. Earlier completed/uncertain contacts are never automatically retried.

```csv
first_name,last_name,phone
Alex,Example,+12025550101
Sam,Example,+12025550102
```

The example numbers above are fictional. Do not use them for real calls.

## Step 8 — Start, pause and stop

1. Select the saved list you reviewed.
2. Click **Start selected list** once. This authorizes real calls to pending contacts. There is no calling-hours restriction.
3. The backend checks the Twilio account and public connection, then prepares OpenAI audio and the exact voicemail before each dial attempt.
4. It dials contacts one at a time and saves the result before advancing. You do not need to press Start between contacts.
5. **Pause after current contact** finishes the current attempt and stops before the next.
6. **Stop current call and pause** requests hangup of the verified owned Twilio call and pauses the list.
7. You can close/reopen the browser page without ending the backend worker. Reopen Calling lists to recover its current controls. Keep the bridge and public tunnel running.
8. Completion appears in the list window. Optionally enable the completion notification. Review every result before considering the list finished.

Human answers use a live conversation. Speech interrupts buffered AI audio. Voicemail uses Twilio answer detection; playback is logged complete only after Twilio acknowledges it. A person speaking during or just after voicemail can switch to a live conversation. Answer detection is not perfect; ambiguous cases are marked for review rather than claimed successful.

## Step 9 — Read or export the results

1. Open **Previous Conversations** at **http://127.0.0.1:28431/history**.
2. Choose the list and contact to view names, status, conversation transcript, disposition events and logs.
3. For an answered call, the app requests a Twilio recording and saves a local MP3. Recording availability can be delayed; failures are shown for review. Live transcript text is a draft and may differ from the recording.
4. Download the contact report/MP3, the selected-list ZIP, or the whole-history ZIP using the controls provided.
5. **meeting_set** means a date/time was verbally agreed; this app does not create a calendar event. Other dispositions include follow_up, not_interested, wrong_number, completed and opt_out.
6. Local records remain until you delete them. Twilio separately retains its call logs and recordings under its own account settings. Deleting locally does not delete the Twilio copy.
7. Back up the private **data** folder and **.env** securely. Do not include them in installation ZIPs.

## Step 10 — A stable public connection for team use

Quick tunnels are temporary development/test connections. Their URL changes each launch and availability is not guaranteed. For dependable daily calling, have IT configure a stable managed HTTPS/WSS tunnel.

1. Set **TWILIO_TUNNEL=manual**.
2. Point the trusted tunnel to **http://127.0.0.1:28432**.
3. Set **TWILIO_PUBLIC_URL=https://your-public-host** and restart the bridge.
4. Do not expose port **28431**. That is your private list/history/control desk.
5. The public service on **28432** accepts signed Twilio callbacks and media for known attempts; it does not expose your lists, keys or Start controls.

For an existing Cloudflare installation, the same temporary callback connection can be started manually on Windows PowerShell or Mac Terminal:

```text
cloudflared tunnel --url http://127.0.0.1:28432
```

Copy the printed HTTPS origin into **TWILIO_PUBLIC_URL**, set **TWILIO_TUNNEL=manual**, restart the bridge, and keep both processes open.

## Troubleshooting

**Twilio trial blocks Media Streams:** authentication is working, but the account cannot use this live audio workflow yet. Ask the account owner to upgrade and obtain a voice-enabled Twilio number. Update TWILIO_FROM_NUMBER locally and restart. Do not use the shared trial-panel number as an owned number.

**Twilio rejects authentication:** recheck the AC Account SID and the account Auth Token on Twilio account home. An SK API key and its secret are not interchangeable with these settings.

**OpenAI expired_secret_key / authentication error:** replace OPENAI_API_KEY with a valid key locally and restart. Never paste it into chat or GitHub.

**Public callback unreachable:** keep the tunnel running and target port 28432. Confirm the public hostname reaches this installation. Use a stable managed tunnel if the quick service is unavailable.

**No sound / no voicemail:** inspect that contact’s full details and recording. A complete voicemail log requires an acknowledged playback mark. Failed AI preparation blocks dialing; missing media stops the attempt. Do not assume a completed telephone connection means the person heard the AI.

**Uncertain dial result:** check Twilio Call Logs before proceeding. The app never automatically redials an uncertain attempt. An unresolved attempt blocks another list until its telephone state can be verified.

**Port already in use:** use the already-running bridge, or stop it while idle before opening another. The launcher does not terminate unrelated programs.

**Network/proxy:** Hiddify is not required. Use your organization’s approved network. Windows system HTTP/HTTPS proxy settings are detected; Mac or other setups can use HTTPS_PROXY and NO_PROXY in the local .env. HTTP requests and the OpenAI WebSocket use this configuration. Localhost stays local. Regional access restrictions must be resolved with the provider or your IT team, not by changing keys or reinstalling.

**Costs and call length:** Twilio telephone/answer-detection/recording and OpenAI usage may be billed. Calls are bounded to 330 seconds. Reaching a limit is a review condition, not proof of a completed business conversation.
