# SalesGod Team: step-by-step setup and calling guide

Use this guide in order. Steps 1–5 are for your first installation. For everyday use, go to Step 6. Keep this guide open while you work.

You will use two parts: the Chrome extension adds controls to SalesGodCRM, and the local bridge runs in a command window on your computer. Both must be running. You do not need Docker, VB-CABLE, or a separate Node.js installation.

## Step 1 — Prepare your computer and extract the ZIP

1. Have Google Chrome installed, your own SalesGodCRM login ready, and a company-approved OpenAI API key available. A ChatGPT login alone does not supply API access.
2. If your organization uses a VPN or proxy, connect it now. Hiddify is not required. Use your organization's approved connection.
3. Download the original SalesGod Team ZIP supplied by your colleague.
4. On Windows, right-click the ZIP, choose **Extract All**, choose a permanent local folder such as Documents, and click **Extract**. On Mac, double-click the ZIP and move the extracted folder to Documents.
5. Open the extracted **SalesGod-Team** folder. You should see **SETUP.html**, **Start Windows.cmd**, **Start Mac.command**, and a **tools** folder. Run the files here, outside the ZIP.
6. Double-click **SETUP.html** to open this guide in your browser. Keep all extracted files together. Use a private local folder rather than a shared or synced team folder: your key and conversation logs will be stored here.

## Step 2A — Save your API key on Windows

1. In the extracted folder, double-click **Configure OpenAI Windows.cmd**.
2. A command window may appear. If it says **Preparing a private Node.js 24 runtime from nodejs.org**, wait. The launcher downloads and checks the required software automatically. You do not need to type any commands into this window.
3. Wait for Notepad to open the local `.env` file. A message may say **Opening your LOCAL .env file**. This is expected.
4. Find the line `OPENAI_API_KEY=`. Paste your API key immediately after the equals sign, on the same line. Do not add quotation marks or spaces. Do not change the model line.
5. Press **Ctrl+S** to save, then close Notepad. The configuration command window may close automatically; that is normal. Configuring the key does not start the bridge or validate API access.
6. Continue to Step 3A.

Never paste the API key into a command prompt, Chrome extension, chat, GitHub, or a screenshot. Use only your local `.env` file.

## Step 2B — Save your API key on Mac

1. In the extracted folder, double-click **Configure OpenAI Mac.command**.
2. Terminal may open and display **Preparing a private Node.js 24 runtime from nodejs.org**. Wait for automatic setup; no separate Node.js installation is needed.
3. TextEdit opens the local `.env` file. Find `OPENAI_API_KEY=` and paste the key immediately after the equals sign on the same line, without quotation marks or spaces. Leave the model line unchanged.
4. Press **Command+S** and close the TextEdit document. The Terminal command can then finish. Configuring the key does not start the bridge.
5. If double-clicking the file does not work, use the Mac manual commands in Step 8. If macOS or your organization blocks the software, ask IT to review it. Do not disable security protections.
6. Continue to Step 3B.

## Step 3A — Start the bridge on Windows

1. Double-click **Start Windows.cmd** in the extracted folder.
2. Leave the command window open. You may see automatic Node setup, **Installing required libraries from npm**, download progress, or a list of installed packages. First launch needs internet access and can take longer. Wait; no commands or API key need to be typed here.
3. Look for **Bridge API requests use the configured HTTP/HTTPS proxy; localhost stays local.** or **Bridge API requests use the direct connection.** Either can be correct for your network.
4. Wait for the ready message shown below. The extra words after the address are normal.

```text
Local audio bridge: http://127.0.0.1:28431 — calling lists require explicit Start.
```

5. Keep this window open for the entire calling session. A window waiting at this message is working; it is not frozen. You can minimize it.
6. Continue to Step 4. Starting the bridge never places a call.

## Step 3B — Start the bridge on Mac

1. Double-click **Start Mac.command** in the extracted folder. If needed, use the manual Terminal commands in Step 8.
2. Leave Terminal open while software downloads or libraries install. You may see **Preparing a private Node.js 24 runtime from nodejs.org** or **Installing required libraries from npm**. Wait for setup to finish.
3. Wait until Terminal shows **Local audio bridge: http://127.0.0.1:28431**. It may also show the direct/proxy connection message described in Step 3A.
4. Keep Terminal open for the entire calling session. You can minimize it. Starting the bridge never places a call.
5. Continue to Step 4.

The launchers do not require an administrator password. Mac launcher syntax has been checked, but actual Mac startup and telephone audio still need testing on a Mac.

## Step 4 — Install the Chrome extension

1. Open the Chrome profile you use for SalesGodCRM. A different Chrome profile has separate extensions and logins.
2. Type `chrome://extensions` in Chrome's address bar and press Enter.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Browse into your extracted **SalesGod-Team** folder, then **tools**, then **audio-extension**. Select this folder, which contains `manifest.json`. Do not select the ZIP or the whole SalesGod-Team folder.
6. Confirm Chrome shows **SalesGod Local Audio Bridge** and that it is enabled. Follow your company's Chrome policy; ask IT if installation is blocked.
7. Open SalesGodCRM and log into your own account. Confirm no call is active, then refresh the dashboard.
8. Look for the **SalesGod audio bridge** panel. Continue to Step 5.

## Step 5 — Check setup without calling anyone

1. Confirm the bridge command window is still open and shows the ready message.
2. Open `http://127.0.0.1:28431/voice-test` in Chrome.
3. Click **Test AI voice without a microphone**. This uses a short OpenAI session and may incur API usage. It does not open your physical microphone or place a phone call.
4. Wait for **AI audio test passed · disconnected**. If the test fails, go to Step 10. Do not start a live list until the voice check works.
5. Return to the idle CRM. In its extension panel, click **Open calling list**. Keep both pages open. Wait for **CRM controls paired**. Opening the local calling-list address directly does not pair the CRM.
6. Keep **Simulation only — no calls and no OpenAI requests** checked.
7. Click **Use simulated contacts**, then **Import and preview**. Confirm the saved list says **SIMULATION — no calls**.
8. Click **Start selected list**. This practice run makes no phone calls or OpenAI requests. Wait for **Finished processing every contact** and review the simulated results.
9. For an additional local audio check, use **Enable local routing** and **Test local audio** in the idle CRM extension panel. **Test WebRTC** checks the local connection too. These tests use synthetic audio. Choose **Disable** afterward if you are finished testing.

## Step 6 — Start your normal workday

1. Connect your approved VPN or proxy if your network requires one.
2. Open the extracted SalesGod-Team folder and double-click **Start Windows.cmd** or **Start Mac.command**. If its bridge window is already running, use that window instead of opening a second copy.
3. Wait for **Local audio bridge: http://127.0.0.1:28431**. Leave the command window open.
4. Open your SalesGodCRM Chrome profile and log in. Check that no call is active. Refresh the idle dashboard if the extension panel is missing.
5. In the extension panel, click **Open calling list**. Wait for **CRM controls paired** and keep both pages open.
6. Continue to Step 7. If you changed the key, VPN, or proxy settings, restart the bridge while no call or list is active and repeat the no-call voice test first.

## Step 7 — Import your list and start calling

1. Prepare a CSV file with these exact column names in the first row:

```csv
first_name,last_name,phone
```

2. Put one person's first name, last name, and phone number on each following row. Include the country code, such as `+1` for US numbers. Ask your team lead if unsure about a number. If using Excel, save as CSV first; an `.xlsx` workbook cannot be imported directly. Check that the country codes survived the export.
3. In the calling-list page, enter a descriptive **List name**. Use **Choose CSV file**, or paste the CSV text into **Or paste CSV**.
4. Expand **Call settings**. Enter **Your CRM caller number**, including country code. This is the outgoing number assigned to your CRM account, not a customer's number.
5. Set **Calling timezone**, **Start hour**, and **End hour**. For San Diego, use `America/Los_Angeles`. Hours use a 24-hour clock: 9 is 9 AM and 17 is 5 PM. One timezone applies to the whole list.
6. Review the **Approved conversation brief**. State the approved purpose, what the AI may say, and what information it should collect. The current live AI identifies itself as calling from **Jay Marketing Lab on behalf of Cena**. Other office identities need a configuration/code change before use.
7. Review the **Voicemail message** and voicemail controls. The default voicemail refers to **Sina**. Confirm that this wording is appropriate for your list.
8. Choose the mode before importing. For practice, leave **Simulation only — no calls and no OpenAI requests** checked and use simulated contacts. For an authorized real calling list, uncheck it.
9. Click **Import and preview**. Review names, numbers, settings, and the mode shown for the selected list: **SIMULATION — no calls** or **LIVE CALLING**.
10. If you need to change the mode, caller, brief, voicemail, or calling hours after import, change the form and import a new draft. Changing the form does not update the previously saved list. Select the correct new draft before continuing.
11. Before live calling, confirm the CRM microphone is **SalesGod AI Bridge (local audio)**. Keep the CRM speaker on your headset. If the microphone is missing, review the idle CRM's Settings/Refresh devices and repeat the local audio checks. Do not dial to work around a failed setup test.
12. If you want a desktop completion notification, click **Enable completion notification** and allow Chrome notifications if your company permits them. The page itself shows completion even without notifications.
13. Click **Start selected list** only when you are ready. On a **LIVE CALLING** list, this starts real calls, one eligible contact at a time. The system prepares AI audio, handles a person or recognized voicemail, saves results, and proceeds through the list.
14. Leave the bridge window, CRM page, and calling-list page open. Do not refresh them while a call is active. Calling-window and suppression checks remain active. If the page says it is waiting for the calling window, keep it open and review the approved hours.
15. Wait for **Finished processing every contact. Review the results below.** This means processing is finished; it does not mean every person answered. If the list pauses with an uncertain result, review the CRM before taking another action. Uncertain attempts are not automatically redialed.

## Step 8 — Manual commands if double-click does not work

Run only the commands for your operating system. Do not type the `C:\...>` or `%` prompt shown by your computer. Do not put your API key in a command.

### Windows: Command Prompt

1. Open the extracted **SalesGod-Team** folder in File Explorer.
2. Click the address bar at the top, type `cmd`, and press Enter. Command Prompt opens in the correct folder. You do not need to type a `cd` command or your username.
3. To configure the key, type the following command and press Enter. Complete Step 2A when Notepad opens.

```bat
call "Configure OpenAI Windows.cmd"
```

4. To start the bridge, type this command and press Enter:

```bat
call "Start Windows.cmd"
```

5. Wait for the bridge ready message. These commands include automatic Node setup. Leave Command Prompt open while working.

### Mac: Terminal

1. Open **Terminal** using Spotlight: press **Command+Space**, type `Terminal`, and press Return.
2. Type `cd `, including the space after `cd`. Drag the extracted **SalesGod-Team folder** from Finder into Terminal. Press Return. Terminal is now inside the correct folder; this also handles spaces in its path.
3. To configure the key, type this command and press Return. Complete Step 2B when TextEdit opens.

```sh
bash "Configure OpenAI Mac.command"
```

4. To start the bridge, type this command and press Return:

```sh
bash "Start Mac.command"
```

5. Wait for the bridge ready message. These commands include automatic Node setup. Leave Terminal open while working.

## Step 9 — Pause, read logs, and finish safely

1. To finish the current call and then pause, click **Pause after current contact**.
2. To stop the system's current call and pause, click **Stop current call and pause**. Check that the CRM phone actually ended. If the system cannot identify its owned call, inspect the CRM manually.
3. To read a conversation, select its list under **Saved lists**, then click **View transcript** beside the contact. Expand **List event log** to see what happened.
4. Click **Export transcripts and event log** to save a copy. Keep the export private. Records are stored separately on each computer; there is no shared team dashboard and no audio recording.
5. Inactive contact details, transcripts, and events expire after seven days of bridge activity. Export records you need before then. Suppression records persist.
6. When no list or phone call is active, click the bridge's command/Terminal window and press **Ctrl+C**. On Mac, use **Control+C**, not Command+C. If Windows asks **Terminate batch job (Y/N)?**, type `Y` and press Enter.
7. Once the command returns to a prompt or the launcher exits, close its window. Next time, repeat Step 6. Closing the bridge during a call interrupts the AI and may leave the CRM phone connected; inspect the phone if that happens.

## Step 10 — Understand prompts and fix common problems

### The command window is open but nothing else happens

If you see the bridge address, it is ready. The launcher does not automatically open Chrome. Leave the window open and continue to Step 4 or Step 6. No typing is needed at the ready message.

### “Preparing a private Node.js 24 runtime” or “Installing required libraries from npm”

This is normal on first use. Keep internet connected and wait for the ready message. Node is downloaded from the official nodejs.org site and checked before use. Do not open multiple setup windows while it is working.

### “Node setup failed”, checksum failure, or library installation failure

Read the error above the final prompt. Check internet access and that the extracted folder is writable. If asked **Press any key to continue . . .** on Windows or **Press Return to close.** on Mac, that means setup stopped; pressing a key only closes the window. It does not fix the error. Retry the launcher after resolving the cause. Ask IT about checksum errors, blocked downloads, or an interrupted setup lock. Do not delete caches or disable security controls blindly. If your organization prohibits automatic downloads, IT can install Node.js 24 with npm instead.

### “Port 28431 is already in use or unavailable”

Look for an existing bridge window. If it is already running, use it and close only the duplicate failed launcher. If there is no working bridge, ask IT to identify what owns the port. Do not stop an unknown process.

### “Open calling list” opens a page that cannot load

Start the bridge and wait for its ready message. The current address is `http://127.0.0.1:28431/`, not the older port 4318. Close the failed calling-list window and click **Open calling list** again from CRM. Keep the bridge running.

### The page does not say “CRM controls paired”

Open the calling list using the CRM extension panel, not a bookmark or a manually typed local address. Confirm the extension is enabled in this Chrome profile. If no call is active, refresh CRM and reopen the controls. Never refresh an active call.

### The voice test fails, or ChatGPT works but the extension does not

Read the specific error on the voice-test page. ChatGPT and this bridge use separate connections. A missing/invalid key requires saving the local key and restarting the idle bridge. Quota, billing, model access, and project permissions must be reviewed by your API administrator. Do not paste a key into an error report. Use **Save test report** to export safe connection diagnostics; older reports may have less detail.

### You use a VPN or proxy

Hiddify is optional. A VPN that routes all computer traffic generally needs no extra bridge settings. On Windows, the bridge reads an enabled Windows user HTTP/HTTPS proxy at startup. Keep that proxy app running and look for the proxy message in the bridge window. A Chrome-only VPN may not route the bridge at all.

On Mac, or for an explicit proxy configuration, ask IT to set `HTTPS_PROXY` in the local `.env` file using your approved HTTP/HTTPS proxy address. Explicit environment proxy settings take precedence. Do not guess the address or copy another person's proxy credentials. Mac system-proxy discovery, PAC scripts, and SOCKS-only configuration are not supported by the launcher. Restart the idle bridge after any proxy change and repeat Step 5. Local signaling stays on your computer.

A confirmed `unsupported_country_region_territory` error means OpenAI denied API access for the detected region. Reinstalling the extension or replacing the key does not remove that restriction. If you are in a supported location, ask OpenAI Support or IT to review detection: https://developers.openai.com/api/docs/supported-countries. A VPN does not guarantee service availability.

### Mac will not open a .command file

Try the `bash` commands in Step 8. If macOS or company policy blocks the download, ask IT to review it. Do not disable Gatekeeper, certificate checks, or other security protections.

### Chrome shows no audio device, or a local audio/WebRTC test fails

Confirm the bridge is running and no CRM call is active. Check extension status, enable local routing, review CRM audio devices, and repeat the idle local audio checks. Ask your administrator if it still fails; do not change Chrome privacy flags or firewall rules to force it through. The standalone OpenAI test does not verify telephone media.

### You need help from your team lead

Send the exact error text, whether you are on Windows or Mac, your package version, and the step that failed. A screenshot of the error or the safe voice-test report can help. Exclude API keys, proxy credentials, contact details, and conversation transcripts from screenshots.

## Step 11 — Install a future update

1. Finish or safely stop all calls and lists, then stop the bridge with **Ctrl+C**.
2. Keep a private backup of your current local `.env` and `data` folder. Never send that backup to colleagues.
3. Replace application files with the new package while preserving your `.env` and `data` folder in the installed folder. Ask your team lead if unsure which files to replace.
4. In `chrome://extensions`, click **Reload** for SalesGod Local Audio Bridge. If the extension now lives in a different folder, load the new `tools/audio-extension` folder instead and remove the old duplicate.
5. Start the updated bridge, refresh only idle CRM, reopen the calling list from its panel, and repeat Step 5 before live calling.
6. Share only the original clean ZIP. Do not zip your installed folder: it contains your key, downloaded runtime, and call records.

## What this version has been checked for

Windows startup, proxy-based OpenAI audio, simulation, and individual telephone tests have been observed. Multiple-contact live reliability and actual Mac telephone audio still need validation. The AI session has a five-minute limit, including preparation. Use a supervised approved test before relying on a new installation for a live list.
