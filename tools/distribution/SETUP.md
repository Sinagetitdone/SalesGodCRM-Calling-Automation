# SalesGod team setup

This package contains a Chrome extension and a local audio bridge. You need both. No VB-CABLE or Docker is needed. Windows launchers are tested on Windows; Mac launchers have not yet been tested on a Mac. The recent interruption-speed improvement still needs real-call verification. Start with simulation, not a customer list.

## First-time setup (about 10 minutes)

1. Install Google Chrome and **Node.js 24**, including npm, from https://nodejs.org/en/download. Use the installer for your computer. Restart Terminal or Command Prompt after installation. A managed computer may require your IT team to install these.
2. Extract the entire ZIP into a permanent folder you can write to, such as `Documents/SalesGod-Team`. Do not run inside the ZIP, move only the launchers, or use a shared/synced folder: your key and call records will be stored here.
3. Double-click **Configure OpenAI Windows.cmd** on Windows, or **Configure OpenAI Mac.command** on Mac. A text editor opens the local `.env` file. Paste your company-approved API key immediately after `OPENAI_API_KEY=` on the same line. Leave the model line as it is. Save and close the editor. Never send the filled file to someone else. This step does not check or send the key to OpenAI.
4. Double-click **Start Windows.cmd** or **Start Mac.command**. The first launch downloads the required libraries from npm; keep this window open. It starts only on this computer at http://127.0.0.1:28431/. Starting it does not dial or send speech to OpenAI. You may use simulation without a key.
5. In the same Chrome profile where you use SalesGodCRM, open `chrome://extensions`. Turn on **Developer mode**, choose **Load unpacked**, and select `tools/audio-extension` inside the extracted folder (the folder containing `manifest.json`). Follow your organization's extension policy.
6. Log into your own SalesGodCRM account. Confirm there is no active call, then refresh its dashboard. Look for the **SalesGod audio bridge** panel. Installation and refresh never start a call.

## Check the installation without calling

1. In the idle CRM panel, choose **Open calling list**. Keep this new window and CRM open. It should say **CRM controls paired**. Opening the local page directly does not pair CRM controls.
2. Leave **Simulation only — no calls and no OpenAI requests** checked. Choose **Use simulated contacts**, **Import and preview**, then **Start selected list**. Confirm simulated results appear. No phone call or OpenAI request is made in simulation.
3. For a separate audio check, use **Enable local routing** and **Test local audio** in the idle CRM panel; **Test WebRTC** checks the local connection too. These use synthetic audio, not a customer call. Choose **Disable** afterward. Do not change Chrome privacy flags or firewall settings to force a test to pass; ask your administrator if it fails.

## When authorized to call

Keep the bridge, CRM, and paired calling-list window open. Use the CRM number assigned to your account in Call settings; do not copy another colleague's caller number. The app currently identifies the live AI as **Jay Marketing Lab, on behalf of Cena**, and its default voicemail refers to **Sina**. Review these identities, the approved brief and voicemail before use. Other office identities require a code/configuration change first.

Import CSV columns `first_name,last_name,phone`, preview every contact, and choose the approved calling timezone and hours. Simulation stays on until you explicitly uncheck it. A live **Start selected list** can dial every eligible contact sequentially. Do not use Start on a real list merely to test installation. Suppression and calling-window checks remain active. Verify CRM uses **SalesGod AI Bridge (local audio)** as its microphone; keep its speaker on your headset.

Single-call audio and automatic human takeover have been observed on Windows. Multiple-contact live reliability and Mac telephone audio are not yet validated. Unknown call outcomes pause for review rather than automatic redial. The five-minute AI session limit applies.

## Everyday use, logs and updates

- Start your platform's launcher, then open CRM and **Open calling list**. Do not start a second copy of the bridge. Restart the bridge after editing the key, only when no call is active.
- View conversation text using **Saved lists → View transcript**. Expand **List event log** for events, or choose **Export transcripts and event log**. Each computer has separate records; there is no shared team dashboard. Inactive records expire after seven days of bridge activity; suppressions persist. No audio recordings are saved.
- During live calls, speech goes to OpenAI and API usage may be billed. Keys stay in the local `.env`; contact/transcript/event data stays in local `data` databases accessible to your OS user. Protect this folder using your computer's normal access controls.
- Wait until no phone call/list is active, then stop the bridge with **Ctrl+C** in its window. Closing it during a call can interrupt AI; check the actual CRM phone if that happens.
- For updates, finish all calls first and stop the bridge. Replace application files from a fresh package, preserving your local `.env` and `data` folder. Reload the extension in `chrome://extensions`, then refresh idle CRM and reopen calling-list controls. Do not redistribute your installed folder: share the original clean ZIP instead.

## Troubleshooting

- **Mac cannot execute a .command file:** open Terminal, type `chmod +x ` (including the space), drag one `.command` file into Terminal, press Return, and repeat for the other. The ZIP marks them executable, but some extractors may discard that attribute. If macOS or your organization blocks the download, ask IT to review it rather than disabling security protections. You can also open Terminal in the extracted folder and run `node tools/distribution/launcher.mjs configure` or `node tools/distribution/launcher.mjs start`.
- **Node missing or wrong version:** install Node.js 24 with npm, then reopen the launcher. The package deliberately checks the tested major version.
- **Port 28431 already in use/unavailable:** use the existing bridge window if it is already running. Otherwise ask IT. The launcher does not kill processes or change firewall rules.
- **Install fails:** confirm internet access to npm and that the folder is writable, then reopen Start. Required library versions are locked; installation scripts are disabled.
- **OpenAI rejects the key:** run Configure OpenAI, save the new key, and restart the idle bridge. An API key needs appropriate project/model access and billing. Never paste a key into chat or the extension.
- **Pairing/audio fails:** confirm the bridge is running and there is no ongoing CRM call, refresh idle CRM, and reopen controls through its extension panel. Use port **28431**, not the older 4318. Do not reload or refresh during a call.

Reference: Chrome's unpacked installation workflow is documented at https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked.
