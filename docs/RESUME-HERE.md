# Resume here — 2026-10-23

## Latest appearance — package 0.5.2 / extension 0.4.2

JML branding is applied across localhost pages and the extension panel, using original kit SVGs and exact purple/lime tokens. See docs/brand/APPLICATION.md. Existing font fallbacks are explicitly approved by the owner. No calling or AI behavior changed. The running bridge serves new assets; Chrome must reload extension 0.4.2 and refresh idle CRM for its panel to update. All 143 checks and TypeScript passed. Local synthetic audio passed both directions and routing was disabled afterward. No phone or paid API call was made for branding.


## Latest layout — package 0.5.1 / extension 0.4.1

Open calling list (/campaigns) is now real calls only, with no simulation selector, rehearsal panel or manual AI controls. AI Agents Test Call (renamed from Prepare supervised call) opens /supervised-call with manual controls plus the complete rehearsal workflow. Saved lists are filtered by mode, old transcripts retained, and workers reject the wrong mode before start. Rehearsal/manual sessions are mutually exclusive in a test tab. All 143 tests and type checking passed; two-contact offline browser rehearsal completed. No real call was made. Extension files are updated but Chrome must reload extension 0.4.1 and refresh idle CRM to show the renamed button; never refresh an active call.

## Latest work — package 0.5.0

All 140 checks and TypeScript passed. The actual supervised-call code produced audio into a synthetic dialer using 250 ms VAD and 1.1× speed. Synthetic customer TTS failed twice, preventing round-trip latency measurement; no actual phone was dialed. The lab and AI sessions were stopped. Do not claim measured real-call latency yet.

Live AI rehearsal now exchanges dynamically generated dialogue between separate office/customer sessions, plays both voices, saves transcripts and exports genuine local MP3. New drafts use 600 output tokens, under-15-word guidance, parallel peer setup, 1.15× speech and a configurable 20-second complete-turn watchdog. Eight real API replies completed within 4.4–12.6 seconds each. Audio remains in the page until downloaded; transcript retention is seven days.

The owner's latest priority is real-call responsiveness. Live human VAD defaults to 250 ms (previously 350), per-list setting responsePauseMs accepts 200–1000 ms, and live replies use concise instructions with 1.1× speech. Voicemail timers and the five-minute AI session limit remain unchanged. Introduction no longer overrides session instructions. ai.audio_started events plus report.lastReplyAfterVadMs help measure actual latency. Reopen idle control pages after restarting the bridge to load changes; no extension reload needed. No real calls are authorized by this development task. Earlier dialing authorizations below were consumed.

## Stop state

The owner then authorized one v0.4.6 retest. That single-contact run recognized voicemail, detected the actual beep, played the full 8.15-second prepared message, logged playback_completed, waited eight seconds for late pickup, stopped AI, ended the owned phone call, and finished the list. The owner confirmed it went to voicemail; mailbox storage/full recipient-side audibility has not been independently confirmed. This was the acoustic-beep path, not the silence fallback. No further call is authorized by that completed test. The finished list remains available in the local controls.


Latest authorized call: one retry to the owner-specified test number ended before voicemail playback. Events show voicemail classification then unavailable classification; the owner heard “Please leave your message at the tone.” No playback-start event exists. Package 0.4.6 now requires explicit same-utterance mailbox failure evidence before accepting unavailable; normal recording invitations continue as voicemail. Audio checks pass 72 tests, including forced misclassification of the owner-reported greeting. The fix has not been redial-tested. The one-call authorization was consumed; do not redial without a new user request. Reopen idle controls from CRM to load updated browser scripts.


Latest fix: package 0.4.5 addresses the last real attempt's recognized-voicemail/no-beep timeout. Detector permits 120 seconds ringing and at least 45 seconds after a late greeting; confirmed voicemail plus 2.5 seconds fresh quiet can recover a missed beep. New speech resets fallback confirmation, and full mailboxes/pending human decisions block it. Logs distinguish voicemail.silence_fallback from voicemail.beep_detected. All 127 checks plus type checking passed; no new call or mailbox delivery has been verified. Close old idle calling-list controls and reopen from CRM after restarting the idle bridge to load the change; no extension reload is needed for this client/server-only patch.


Latest distribution: 0.4.4 contains the rewritten colleague guide (first-time setup, platform-specific command windows, daily startup, simulation, import-before-Start, notifications, logs, shutdown, errors and updates). SETUP.html is generated from SETUP.md by build-setup-guide.mjs during package:team. Runtime/extension behavior is unchanged from 0.4.3; no calls were placed for this guide update.


Proxy diagnosis supersedes the direct-route-only conclusion below: the owner's Windows user proxy (Hiddify) was enabled, but bridge startup ignored it. Package 0.4.3 now uses a common proxy-aware startup wrapper (Windows user HTTP/HTTPS discovery, explicit env precedence, Node proxy support, localhost bypass). Direct API requests still returned regional 403; proxied models-list 403 was missing model-read permissions for the restricted key, not a region denial. A proxied invalid Realtime offer reached HTTP 400 invalid_offer without creating media or dialing. This validation probe alone did not establish a successful voice session. After the idle bridge restarted using this wrapper, the standalone silent-input browser test passed: SDP accepted, channel opened, response completed, audio peak 0.36579, 238 received audio packets, and automatic disconnect. No physical microphone or phone call was used. All 120 automated checks plus type checking passed. Telephone media and Mac runtime were not retested. Restart only idle bridge sessions; no calls are authorized by this troubleshooting request.

Latest diagnostic update: local code now maps safe API error categories and exports failure stage/status in voice reports (package 0.4.2; 117 checks plus type checking passed). This chat working does not prove API eligibility. The last independently verified API result was 403 unsupported_country_region_territory; do not describe an error-message/report fix as restoring OpenAI connectivity. No telephone call is authorized by a request to fix connection diagnostics.

A shareable local installation package is now available via `npm run package:team`; see `tools/distribution/README.md` and its `SETUP.md`. Version 0.4.1 contains Windows/Mac launchers, no keys/private records, and automatically downloads a pinned/checksum-verified private Node.js 24 runtime when needed. The package has clean Windows smoke coverage and Mac shell syntax coverage; actual Mac startup/audio is untested. Builds are ignored under `releases/`; rebuild from source for future sharing rather than zipping an installed folder (including its new `.runtime` cache).

The owner subsequently authorized one more call. It automatically switched from voicemail to a human conversation, saved replies and audibility confirmation, and ended with no ongoing CRM call. The owner then requested faster interruption recovery. The latency patch removes extra takeover polling, preserves pending classifier results across repeated speech, and changes VAD silence from 600 to 350 ms. Synthetic checks pass; this patch has not been phone-tested. No additional call is authorized by the fix request. Earlier test descriptions below remain historical evidence. List import, page reload and bridge restart never start calls.

Repository: https://github.com/Sinagetitdone/SalesGodCRM-Calling-Automation

Active branch: `feat/supervised-first-call`. Current changes are pushed to this branch; they are not claimed merged into `main` or `dev`.

## What exists

- Node.js 24 loopback bridge at `http://127.0.0.1:28431`, started with `npm run audio:bridge` from the repository root. Windows reserved the former port; do not switch back to 4318 casually.
- Unpacked Chrome extension `tools/audio-extension`, version **0.4.0**, installed/reloaded on the owner's Chrome profile. It provides generated microphone routing without VB-CABLE, exact-origin/nonce audio pairing, and a separate CRM DOM adapter. Existing dialer peers cannot be retroactively hooked; refresh the CRM only while idle.
- `/campaigns`: CSV `first_name,last_name,phone`, draft preview, simulation by default, sequential worker, caller/timezone/window/brief settings, explicit Start, pause/stop, transcripts, event log, JSON export and completion banner/title. Desktop notification is optional and permission-based.
- Backend campaign authorization, suppression and window rechecks, single active attempt/list, durable one-time dispatch, ten-second heartbeat/thirty-second lease, and recovery to unknown without redial. No per-contact consent field is required for the owner's pre-authorized lists.
- Automatic voicemail detection, exact approved prepared message, one playback, interruption handling, quiet-window listening and guarded owned-call hangup. Manual supervised conversation and setup diagnostics remain separate modes.
- Local ignored `data/campaigns.db` holds contact details, transcripts and list events; `data/live-audio.db` holds metadata. Inactive campaign data is pruned after seven days of service activity, while suppressions persist. No audio recordings are saved. The data is local OS-user accessible, not application-encrypted.

The checked-in Docker configuration runs the original TypeScript fake-provider service, **not** this local browser/audio workflow. Chrome, the unpacked extension and the local Node bridge currently perform the real integration. No macOS-specific installer or distribution package has been completed.

## Approved behavior

The live AI identifies itself as an AI assistant from **Jay Marketing Lab**, on behalf of **Cena**, asks whether now is a good time, and follows only the approved brief. It listens/responds naturally, avoids invented business facts or bookings, and at a natural ending says the person can contact Cena if they want to talk more. Opt-outs are acknowledged without promotion and suppressed. Do not insert an old one-off scheduling question into a new call; no appointment was booked during these tests.

Approved default voicemail:

> Hi, this is Sina's AI assistant calling for a brief audio test. If you have received this voicemail, please notify me. Thanks.

The difference between Cena in the live brief and Sina in the voicemail is owner-approved wording. Preserve it unless instructed otherwise. Do not invent a recipient name; earlier test labels were internal placeholders.

## Evidence and unresolved issue

1. Prior supervised calls established audible AI and, per the owner, a received voicemail. These do not establish automatic human-answer success.
2. The first automatic voicemail call played the message and hung up, but the owner reported a person spoke during playback and was missed. Its historical local row was flagged `needs_review` with an appended owner-report event, retaining original playback evidence.
3. The first fix retained response-disabled VAD/transcription during automatic playback, allowed takeover after voicemail cues, interrupted prepared audio on new speech, and added an eight-second quiet window. Unconfirmed interruptions require review after thirty seconds; interrupted messages are not replayed.
4. A subsequent answered call recorded four incoming speech segments and zero AI turns. The owner reported "hello, can you hear me". The list paused for review. Old metadata cannot establish whether ASR, classification or result handling caused the silence.
5. Further changes added transcript/classifier lifecycle events without unconfirmed speech text, a narrow interactive-question shortcut after ASR, final `response.done` classification handling, and preservation of confirmed human evidence across repeated speech. Synthetic regressions passed. A bare hello remains ambiguous; speech activity alone is not a confirmed person.
6. The latest real test recorded transcription and a voicemail classification, recognized greeting/beep, played the message, waited eight quiet seconds and ended the call. There were zero live AI replies and no speech starting during message playback or the final quiet window. The owner confirmed nobody answered. This verifies that voicemail run only; it does not prove the human fix or carrier recording.

The later single-call update above established an observed automatic human conversation. Multiple-contact live sequencing has only synthetic coverage. Do not repeatedly call the owner-provided number to discover whether somebody is ready.

## Next session

1. Inspect current Git state and these notes. The current checks passed **105 tests plus type checking** with fake external responses and synthetic contacts/audio; the fake-provider HTTP check needed a rerun after a transient bad-port failure. Checks place no calls or paid requests.
2. Check whether the bridge is already listening before starting another copy. Keep `OPENAI_API_KEY` only in the ignored root `.env`; never print it or paste it into GitHub/AGENTS.md. The existing local key was accepted. A colleague must configure their own local environment; secrets/runtime data are intentionally absent from GitHub.
3. Reopen the local calling-list window through **Open calling list** in the CRM extension to load current client scripts and establish a fresh private control port. Reloading an old list window does not re-establish its previous control port. The recent fixes only changed server/pages, so extension 0.4.0 does not need another reload just for them.
4. Prefer an OpenAI-backed **no-phone automatic-answer rehearsal** before another phone call. Existing unit tests inject classifier/transcription events; `/call-simulator` primarily exercises supervised mode and must not be presented as full automatic-answer validation. Diagnose ASR receipt, classifier requests/results/timeouts and actual output separately.
5. For a new explicitly authorized one-number test, verify CRM **No ongoing calls**, phone **Ready**, the generated bridge microphone and available approved caller number. Use a fresh draft; do not reset/retry an unknown attempt. Set the authorized window/timezone explicitly; keep normal backend policy checks intact.
6. During the test observe `answer.transcript_received`, `answer.classification_requested`, `answer.classified_*`, `answer.classification_timeout`, `answer.explicit_human_detected`, `answer.human_detected`, `conversation.started` and actual AI output/playback. Confirm customer audibility separately. Do not manually press the human-answer control and then describe that as automatic success.
7. Await a natural ending, verify owned-call hangup and durable transcript/event export, and only then evaluate the test. Keep the five-minute AI limit in mind. A quiet voicemail or a played message is not a human-answer pass.

## Source map

- `tools/audio-bridge/public/call.js`: audio controller, answer detection, output gates, voicemail takeover, transcript callbacks and natural-end tool handling.
- `tools/audio-bridge/public/campaign-worker.js`: sequential preparation/dispatch, observation, hangup/release and result classification.
- `tools/audio-bridge/campaign-store.mjs`, `campaign-routes.mjs`: authoritative SQLite state and local API.
- `tools/audio-extension/campaign-driver.js`: observed CRM selectors, caller/microphone selection, single dispatch and owned-call checks. Do not invent provider APIs or selectors.
- `tools/audio-bridge/session-journal.mjs`: accepted metadata events. Restart an idle bridge after changing this schema; otherwise new events may be rejected by the old process.
- `tools/audio-bridge/call-checks.mjs`, `campaign-checks.mjs` and `tools/audio-extension/tests/`: deterministic regression coverage.
- [Calling-list operation and limits](../tools/audio-extension/CALLING-LISTS.md), [architecture](architecture/ADR-0003-LOCAL-CALLING-LISTS.md), [evolution](../EVOLUTION.md), and [takeover lesson](engineering-memory/lessons/LESSON-2026-10-20-VOICEMAIL-TAKEOVER.md).

Screenshots, databases and detailed real-call records stay local and ignored because they may contain private contact information. Sanitized behavior, evidence limits, fixes and reproducible checks are documented in GitHub.
