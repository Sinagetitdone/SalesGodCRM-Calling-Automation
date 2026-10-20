# SalesGod team setup

This package contains a Chrome extension and a local audio bridge. You need both. No VB-CABLE or Docker is needed. Windows launchers are tested on Windows; Mac launchers have not yet been tested on a Mac. The recent interruption-speed improvement still needs real-call verification. Start with simulation, not a customer list.

## First-time setup (about 10 minutes)

1. Install **Google Chrome** if you do not already have it. **You do not need to install Node.js separately.** The Windows/Mac launchers reuse an available Node.js 24 with npm, or automatically download the pinned **Node.js v24.21.0** runtime from the official `nodejs.org` release site. They check its SHA-256 checksum before extraction. Windows x64/ARM64 and Intel/Apple Silicon Mac downloads are supported.
2. Extract the entire ZIP into a permanent folder you can write to, such as `Documents/SalesGod-Team`. Do not run inside the ZIP, move only the launchers, or use a shared/synced folder: your key and call records will be stored here.
3. Double-click **Configure OpenAI Windows.cmd** on Windows, or **Configure OpenAI Mac.command** on Mac. If Node is needed, wait for its automatic download (roughly 30–55 MB) and verification. It stays inside this folder's private `.runtime` directory; the launcher does not install a system service, change your permanent PATH or require administrator rights. Then a text editor opens the local `.env` file. Paste your company-approved API key immediately after `OPENAI_API_KEY=` on the same line. Leave the model line as it is. Save and close the editor. Never send the filled file to someone else. This step does not check or send the key to OpenAI.
4. Double-click **Start Windows.cmd** or **Start Mac.command**. The first launch downloads the required libraries from npm; keep this window open. It starts only on this computer at http://127.0.0.1:28431/. Starting it does not dial or send speech to OpenAI. You may use simulation without a key.
5. In the same Chrome profile where you use SalesGodCRM, open `chrome://extensions`. Turn on **Developer mode**, choose **Load unpacked**, and select `tools/audio-extension` inside the extracted folder (the folder containing `manifest.json`). Follow your organization's extension policy.
6. Log into your own SalesGodCRM account. Confirm there is no active call, then refresh its dashboard. Look for the **SalesGod audio bridge** panel. Installation and refresh never start a call.

## Check the installation without calling

1. In the idle CRM panel, choose **Open calling list**. Keep this new window and CRM open. It should say **CRM controls paired**. Opening the local page directly does not pair CRM controls.
2. Leave **Simulation only — no calls and no OpenAI requests** checked. Choose **Use simulated contacts**, **Import and preview**, then **Start selected list**. Confirm simulated results appear. No phone call or OpenAI request is made in simulation.
3. For a separate audio check, use **Enable local routing** and **Test local audio** in the idle CRM panel; **Test WebRTC** checks the local connection too. These use synthetic audio, not a customer call. Choose **Disable** afterward. Do not change Chrome privacy flags or firewall settings to force a test to pass; ask your administrator if it fails.

## Start the bridge each day — Windows

1. Open the extracted **SalesGod-Team** folder in File Explorer.
2. Double-click **Start Windows.cmd**. If the bridge is already running, keep using the existing window rather than starting another copy.
3. Wait until the window shows **Local audio bridge: http://127.0.0.1:28431**. First launch may take longer while libraries download. Keep this window open throughout your calling session.
4. If you prefer starting it manually, click File Explorer's address bar while inside **SalesGod-Team**, type `cmd`, and press Enter. In the command window, run `call "Start Windows.cmd"`. This runs the same automatic Node check/download and first-time library installation.
5. Starting the bridge does not place calls. Continue with **Import a list and begin calling** below.

## Start the bridge each day — Mac

1. Open the extracted **SalesGod-Team** folder in Finder.
2. Double-click **Start Mac.command**. If the bridge is already running, use the existing Terminal window. If the file cannot execute, follow the Mac troubleshooting instructions below.
3. Wait until Terminal shows **Local audio bridge: http://127.0.0.1:28431**. First launch downloads libraries. Keep Terminal open throughout your calling session.
4. To start manually, open Terminal, type `cd ` (including the space), drag the **SalesGod-Team folder** from Finder into Terminal, then press Return. Run `bash "Start Mac.command"`. This includes the automatic Node check/download, so it works even when Node is not installed on your Mac.
5. Starting the bridge does not place calls. Continue with the common instructions below. Mac launchers have syntax-check coverage only; actual Mac startup and phone audio still need verification.

## Import a list and begin calling — Windows and Mac

1. With the bridge running, open Chrome and log into your own **SalesGodCRM** account in the profile where the extension is installed. Confirm no phone call is active. If the extension panel is missing, refresh the idle dashboard.
2. In the **SalesGod audio bridge** panel, click **Open calling list**. Wait for **CRM controls paired**. Keep this new page and the CRM page open. Do not open the local address manually as a replacement for pairing.
3. Enter a descriptive **List name**. Upload your CSV using **Choose CSV file**, or paste its contents into **Or paste CSV**. The first line must be `first_name,last_name,phone`. Include first name, last name and phone on each following row, using country codes such as `+1` for US numbers. Save spreadsheet files as CSV first; do not upload an Excel workbook.
4. Open **Call settings**. Enter the CRM caller number assigned to your account, including country code. Set the approved **Calling timezone**, **Start hour** and **End hour**; hours use the 24-hour clock in that timezone. Enter the **Approved conversation brief** describing why the AI is calling, what it may say, and the information it should collect. Do not copy another colleague's caller number or invent business details.
5. Review the **Voicemail message** and whether voicemail is enabled. The app currently identifies the live AI as **Jay Marketing Lab, on behalf of Cena**, and the default voicemail refers to **Sina**. Confirm these identities are appropriate. Other office identities require a code/configuration change first.
6. Choose the mode **before importing**. For practice, keep **Simulation only — no calls and no OpenAI requests** checked and use **Use simulated contacts**. For an authorized real list, uncheck **Simulation only**. Do not use a live list merely to test installation.
7. Click **Import and preview**. Check every name and number. Confirm the selected list says **SIMULATION — no calls** for practice or **LIVE CALLING** for real calls. The draft saves its mode, brief, voicemail, caller and time settings at import. Changing the form afterward does not change that saved draft: import a fresh draft if you need different settings. Do not start the old draft by mistake.
8. Before a real call, verify CRM uses **SalesGod AI Bridge (local audio)** as its microphone and keep the speaker on your headset. If the device is missing, check the idle CRM's Settings/Refresh devices and local audio diagnostics. Do not place a call to force a failed setup check to pass.
9. When ready, click **Start selected list**. On a **LIVE CALLING** draft, this begins dialing eligible contacts sequentially. The system prepares the voice connection, handles a person or recognized voicemail, saves results, and moves to the next eligible contact. Suppression and calling-window checks remain active. Outside the approved hours, the list cannot proceed; review the status instead of repeatedly pressing Start.
10. Keep the bridge window, Chrome CRM page and paired calling-list page open until finished. The system shows **Finished processing every contact** when the list is done; review individual outcomes, because finished processing does not mean every person answered. Uncertain attempts pause for review and are not automatically redialed.

## Pause, stop, and read the results

1. Choose **Pause after current contact** to let the current call finish before pausing the list.
2. Choose **Stop current call and pause** to request that the system end its current owned call and pause. Verify the CRM phone has ended; if call identity is uncertain, check it manually. Do not close the bridge as a substitute for this control.
3. To read a conversation, choose the relevant list under **Saved lists**, then click **View transcript** beside a contact. Expand **List event log** for the sequence of events. Choose **Export transcripts and event log** to download the records.
4. When processing is finished and CRM shows no ongoing call, press **Ctrl+C** in the bridge's command/Terminal window to stop the bridge. This works on Windows and Mac. Next time, start the platform launcher again before using **Open calling list**.

Single-call audio and automatic human takeover have been observed on Windows. Multiple-contact live reliability and Mac telephone audio are not yet validated. Unknown call outcomes pause for review rather than automatic redial. The five-minute AI session limit applies.

## Everyday use, logs and updates

- Start your platform's launcher, then open CRM and **Open calling list**. Do not start a second copy of the bridge. Restart the bridge after editing the key, only when no call is active.
- View conversation text using **Saved lists → View transcript**. Expand **List event log** for events, or choose **Export transcripts and event log**. Each computer has separate records; there is no shared team dashboard. Inactive records expire after seven days of bridge activity; suppressions persist. No audio recordings are saved.
- During live calls, speech goes to OpenAI and API usage may be billed. Keys stay in the local `.env`; contact/transcript/event data stays in local `data` databases accessible to your OS user. Protect this folder using your computer's normal access controls.
- Wait until no phone call/list is active, then stop the bridge with **Ctrl+C** in its window. Closing it during a call can interrupt AI; check the actual CRM phone if that happens.
- For updates, finish all calls first and stop the bridge. Replace application files from a fresh package, preserving your local `.env` and `data` folder. Reload the extension in `chrome://extensions`, then refresh idle CRM and reopen calling-list controls. Do not redistribute your installed folder: share the original clean ZIP instead.

## Troubleshooting

- **Mac cannot execute a .command file:** open Terminal, type `chmod +x ` (including the space), drag one `.command` file into Terminal, press Return, and repeat for the other. The ZIP marks them executable, but some extractors may discard that attribute. If macOS or your organization blocks the download, ask IT to review it rather than disabling security protections. For ordinary manual startup from Terminal in the extracted folder, use `bash "Configure OpenAI Mac.command"` or `bash "Start Mac.command"`; these include Node setup.
- **Node download/setup fails:** confirm internet access to `https://nodejs.org`, that the extracted folder is writable, and that no other setup window is running. Retry the launcher after the other setup finishes. A checksum failure stops setup before the archive is extracted or run; ask IT to review the download/cache. The launchers do not weaken certificate checks, change execution policy, modify your permanent PATH or install into system folders. A managed computer may block downloaded software; ask IT rather than bypassing its protections. If automatic downloads are prohibited, IT can install Node.js 24 with npm from https://nodejs.org/en/download; the launchers will reuse it.
- **Port 28431 already in use/unavailable:** use the existing bridge window if it is already running. Otherwise ask IT. The launcher does not kill processes or change firewall rules.
- **Install fails:** confirm internet access to npm and that the folder is writable, then reopen Start. Required library versions are locked; installation scripts are disabled.
- **OpenAI rejects the key:** run Configure OpenAI, save the new key, and restart the idle bridge. An API key needs appropriate project/model access and billing. Never paste a key into chat or the extension.
- **ChatGPT works, but the extension cannot connect:** ChatGPT and the OpenAI API are separate product connections. This extension uses the API key in your local bridge, not your chat session or ChatGPT subscription. Check the voice test's specific error before changing settings. A confirmed `unsupported_country_region_territory` / 403 error means API access is denied for the detected region. Reinstalling Node/Chrome or replacing the key does not resolve that denial. If you are in a location on https://developers.openai.com/api/docs/supported-countries, ask OpenAI Support or your IT team to review incorrect region detection. API use is unavailable in unsupported locations. The app does not automatically route around these restrictions.
- **Sharing a failed voice-test report:** click **Save test report** in the voice-test page. Version 0.4.2 records a known error category, failure stage, HTTP/upstream status when available, stop reason and end time. Unknown provider codes/messages, keys and connection descriptions are not copied into the report. Older reports may show zero packets without explaining the cause; read the visible error too. A setup failure prevents live preparation and does not start a phone call.
- **Pairing/audio fails:** confirm the bridge is running and there is no ongoing CRM call, refresh idle CRM, and reopen controls through its extension panel. Use port **28431**, not the older 4318. Do not reload or refresh during a call.
- **Open calling list shows "site cannot be reached" / "connection refused":** the local bridge may have stopped. Start your Windows/Mac launcher and wait for the local bridge address. Close the failed calling-list window, then click **Open calling list** again in CRM to establish a fresh pairing. Starting the bridge or reopening controls does not start a call.

Reference: Chrome's unpacked installation workflow is documented at https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked.
