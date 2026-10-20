# SalesGodCRM Calling Automation

For colleagues: build the clean installation ZIP using `npm run package:team`. It includes Windows/Mac launchers and a [simple setup guide](tools/distribution/SETUP.md). See [package maintenance and validation](tools/distribution/README.md). Launchers automatically download a checksum-verified private Node.js 24 runtime when needed; Mac runtime compatibility has not yet been tested.

Local calling-list prototype using the owner's logged-in SalesGodCRM dialer, a custom Chrome audio bridge, and OpenAI voice. See [resume notes](docs/RESUME-HERE.md) for the exact stopping point and next verification.

## Current behavior

- Extension **0.4.0** exposes a generated microphone, routes dialer audio, and provides a separate guarded browser adapter for explicitly started calling lists. It starts disabled and contains no API key. VB-CABLE is not required.
- `/campaigns` imports `first_name,last_name,phone` CSV into draft lists, previews contacts, processes them sequentially, saves conversation transcripts and event logs, and displays completion. Simulation is the default and invokes neither OpenAI nor the dialer. Import/reload/restart never starts calls.
- Live lists enforce backend suppression, calling windows, campaign-level Start authorization, one active attempt, single-use dispatch, and recovery without blind redial. The owner pre-authorizes imported contacts; no per-contact consent field is required.
- Voicemail uses the approved message after greeting/beep detection. Automatic mode keeps listening during playback and an eight-second quiet window afterward. New speech interrupts playback and blocks hangup while checking for a person. Unconfirmed interruptions require review.
- Prior supervised telephone audio was confirmed by the owner. A later single call automatically switched from voicemail to a human conversation and saved the recipient's audibility confirmation. The owner reported slow interruption recovery; the subsequent latency patch has synthetic coverage but has not been phone-tested. Earlier failed calls and remaining limits are documented.
- Local transcript/event export is available; no audio recordings are saved. Sensitive runtime databases are ignored by Git and inactive campaign data is pruned after seven days of service activity. Opt-out suppression persists separately.

This is a local development prototype, not a hosted multi-user service. The audio bridge binds to loopback and checks exact Host/Origin; it trusts the operating-system user. Keep it private and limit live use to explicitly authorized controlled tests until the remaining integration checks pass. The original TypeScript service and Docker configuration remain a separate fake-provider runtime; they do not run the browser/audio bridge.

## Development

Use Node.js 24 and npm:

    npm ci
    npm run check

`check` runs type checking, domain/storage tests, the audio-server and extension checks, and a real local HTTP check using only the fake provider and a temporary database. No phone calls or paid API requests are needed.

Optional synthetic demonstrations:

    npm run smoke
    npm run smoke:failure
    npm run smoke:persistence

## Audio setup

    npm run audio:bridge

Open http://127.0.0.1:28431 for setup instructions. The [calling-list workflow](tools/audio-extension/CALLING-LISTS.md) uses extension **0.4.0**; reload and refresh the CRM only while idle. Opening/importing never starts calls. `/campaigns` defaults to simulation without calls or OpenAI requests. The [supervised procedure](tools/audio-extension/SUPERVISED-FIRST-CALL.md) and [voicemail procedure](tools/audio-extension/VOICEMAIL.md) describe manual controls. `/voice-test` and `/call-simulator` can incur API usage. VB-CABLE is not required.

- [Extension setup and limits](tools/audio-extension/README.md)
- [Observed no-call test results](tools/audio-extension/TEST-RESULTS.md)
- [Local setup server](tools/audio-bridge/README.md)
- [Architecture direction](docs/architecture/ADR-0002-BROWSER-DIALER-VOICE.md)
- [Local calling-list architecture](docs/architecture/ADR-0003-LOCAL-CALLING-LISTS.md)
- [Resume here: current evidence and next steps](docs/RESUME-HERE.md)

## Credentials

Copy `.env.example` to `.env` if needed and enter `OPENAI_API_KEY` locally. Never put a key in AGENTS.md, source code, tests, chat, or GitHub. `.env` is ignored by Git. Only the loopback server reads the key; browser pages receive SDP, never the standard API key. Restart the server after changing `.env`.

A generic webhook client is retained as an alternative integration primitive. Do not infer a SalesGod call-initiation API or payload from a webhook URL.

## Remaining work before real campaigns

- The first authorized automatic call exposed a missed human pickup during voicemail. A later call demonstrated automatic takeover; the latest latency patch and multiple-contact live processing still need separately authorized verification. See [calling-list limits](tools/audio-extension/CALLING-LISTS.md).
- CSV lists, local suppression/window checks, explicit Start authorization, crash recovery, transcripts and completion UI are now implemented in the audio bridge and tested synthetically. Hosted multi-user authentication and provider reconciliation remain future work.
- Supply an approved business brief before real lists. Playback cannot prove carrier recording. Review unknown attempts in the CRM before explicit resume; they are never redialed automatically.

The TypeScript fake-provider runtime remains separate from audio-bridge lists. See [ADR-0003](docs/architecture/ADR-0003-LOCAL-CALLING-LISTS.md), [START-HERE.md](START-HERE.md) and [AGENTS.md](AGENTS.md).
