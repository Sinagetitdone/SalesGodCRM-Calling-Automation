# Resume here — 2026-10-30

## Latest reliability update — package 1.0.1 / extension 0.4.6

The supplied team ZIP had an external 1.0.0 name but internal package 0.6.1/extension 0.4.5 metadata. Release 1.0.1 aligns those versions, repairs short-human-greeting and voicemail-start races, and saves first/last names through the visible SalesGodCRM Contacts workflow before dialing. Start from CRM **Contacts**; a missing save confirmation stops before the call. Both supplied 163-row CSVs fail precisely at row 140 because its first name is blank. No live contact was edited and no telephone call was placed for this repair.

Full evidence, fixes, 198 passing tests plus type checking, and remaining limits: [CALL-RELIABILITY-1.0.1.md](CALL-RELIABILITY-1.0.1.md). Reload extension 0.4.6, refresh the idle Contacts page, restart the bridge, and reopen the calling-list window.

## Previous maintenance update — package 0.6.1 / extension 0.4.5

Conservative code cleanup: separate contact import and diagnostics helpers, readable stopped-call outcome decisions, named unchanged deadlines, a single voice preset registry, consolidated document limits, and packaged-import validation. No database, audio timing, voice behavior or extension changes. Corrected stale setup text about recording/retention.

Full change list, validation and limitations: [CODE-CLEANUP-0.6.1.md](CODE-CLEANUP-0.6.1.md). All 192 automated tests passed. No-call browser offline/live rehearsals, saved MP3/JSON/ZIP downloads, local audio and WebRTC checks passed. No telephone calls placed. Reopen local pages to load the changed worker; no extension reload required.

## Previous feature update — package 0.6.0 / extension 0.4.5

Guidance verification: the actual Realtime model was tested via the production `/session` construction with two 6,500-character synthetic guides, in-memory contacts and text-only replies. Guide A produced Alex / Tuesday 2 PM / “lilac window”; Guide B produced Jordan / Thursday 11 AM / “amber field”. Both passed; no microphone, CRM or telephone action. Real guidance already reached the session; existing lists still require Apply after editing defaults. A new status explains selected-list versus editor differences. Added separate optional 6,000–20,000-character rehearsal office guidance with idle-list Apply, full prompt injection into the office role, and precedence over conflicting short-brief details. The previous manual next-reply box does not control the rehearsal. Diagnostic script `guidance-browser-check.mjs` is excluded from distribution and uses live API credits only on explicit Run.

Voice request: user explicitly selected five feminine-sounding options using four built-in voices plus a second Marin style. Menu: Marin Calm, Coral Warm, Sage Measured, Shimmer Bright, Marin Confident (`marin_confident` maps to API `marin` plus separate instructions). Same presets apply to real/supervised calls, voicemail/screening and both rehearsal roles. No claimed guarantee of perceived gender. Saved legacy male settings normalize to Marin at preparation without rewriting historical records. Rehearsal defaults use Marin and Coral. Tests verify the actual base voice and style sent to each API.

Browser recorder smoke check passed with actual Chrome MediaRecorders and MP3 encoding: separate synthetic assistant/customer tone tracks, correct order/timing, mixed MP3 38,784 bytes, no microphone/API/phone activity. The local page shows the new settings. File-picker automation was blocked by the browser-control extension's file-URL permission; no permission was changed. Upload extraction and text replacement are covered by the backend and UI tests.

Adds saved short call-screening introductions, local text-file imports, explicit failure reasons and final transcripts from recorded real-call audio. Screening uses existing English ASR plus narrow prompt/hold rules, a separately prepared 10–300-character introduction, verified audio gate and bounded waits; it transitions to human conversation or a fresh voicemail detector. An empty introduction pauses a detected screening request. User may upload TXT/MD/DOCX/PDF beside text areas (5 MB, 100 PDF pages, field limits preserved, review before normal Save/Send). Extraction is isolated in a 128 MB, 20-second child process with no inherited API environment; worker threads were rejected after a reproducible native PDF teardown crash on Windows.

Failure details now persist in the session journal and contact archive, including reported API code/status, stage and specific timeouts; exposed credential patterns are redacted. Main and history views display them, and JSON/ZIP exports preserve them.

Confirmed transcript bug: response.output_audio_transcript.done was treated as spoken text although generation can precede playback or be interrupted. New real-list calls capture separate customer/AI recordings alongside the mixed MP3. After hangup/save, browser energy-based segmentation preserves elapsed time and speaker identity; server sends only recorded MP3 clips to gpt-transcribe, without the planned script/live draft as a prompt. Final audio transcript replaces the displayed draft atomically; draft stays separately exportable. Transcription failures retain MP3/draft, expose the cause and pause the list. No guarantee of verbatim punctuation/spelling or remote carrier delivery. No automatic rewrite of old calls. Additional post-call API usage and up to 180 seconds processing; next dispatch waits. No actual calls made. A short Windows-generated synthetic WAV passed the real gpt-transcribe API with HTTP 200 and matching spoken words (normalizing “four P M” to “4 p.m.”). See ADR-0007.

Restart the idle bridge and reopen local pages. Extension code/permissions remain 0.4.5. Existing list settings stay unchanged until Apply. Live transcription still uses the existing mini model; official docs now mark it deprecated for February 2027, so a separate session-model migration needs testing before then.

## Previous update — package 0.5.9 / extension 0.4.5

Needs review, Failed and Unknown rows now offer View full details in real and rehearsal lists. Their panels and Previous Conversations show saved transcript (including partial replies), timestamps, call/session metadata, recording availability, persisted failure details and the full archived event log together. History preserves available sections and MP3 access when one detail request fails; exported JSON includes retrieval errors. List JSON export now reads archived contact audio events instead of the expiring standalone journal. Future review failures preserve their specific pause reason before generic cleanup. Old missing audio/text/error details cannot be reconstructed. Reopen idle calling/history pages; no extension reload is needed. No calls were made.

## Previous update — package 0.5.8 / extension 0.4.5

Panel setup button is now AI Voice Startup. All main buttons use an equal two-column grid; AI Agents Test Call and Open calling list span full rows, while Previous Conversations and Disable share equal width and height. Inline CRM styles and local preview styles match. Local Chrome preview was visually checked without arming audio or placing calls. Reload extension 0.4.5 and refresh CRM only while idle. Audio and recording behavior is unchanged.

## Previous update — package 0.5.7 / extension 0.4.4

Validation: TypeScript and all 166 automated tests passed (24 app, 109 audio, 25 extension, 1 API, 7 package). The no-call checks cover both audio directions, actual MPEG encoding, single finalization, deferred persistence, phone hangup before encoding finishes, wrong-worker/terminal upload rejection, history download/delete and ZIP exports.

Real calling-list calls now record one continuous MP3 with customer audio, gated AI replies and prepared voicemail. Capture starts before dialing; persistence completes before contact completion/next dispatch. The phone can hang up while local encoding finishes. Previous Conversations plays/downloads the MP3 and includes it in ZIPs. Saving failures pause and retain a temporary download when encoding succeeded. No recording for preparation alone; manual diagnostic calls remain outside list history. Keep browser/bridge open until saving completes; crash-safe chunk persistence is not implemented. Old unrecorded calls cannot be recovered. See ADR-0006. No real calls authorized or made for this change. Browser automation initialization remains unavailable, so no new browser/phone audibility claim. Restart the idle bridge and reopen calling-list/history pages; extension code is unchanged.

## Previous update — package 0.5.6 / extension 0.4.4

The team ZIP now includes SalesGod Bridge.exe (Windows) and SalesGod Bridge.app (Mac) for double-click audio bridge startup. No command typing; a progress console/Terminal opens automatically and must stay open. The whole extracted folder is required. Desktop shortcuts/aliases are supported. Existing scripts still bootstrap Node and configure the local key; startup never calls anyone. Windows launcher dispatch tested with a synthetic child, Mac bundle/syntax validated only (no Mac device available). Unsigned internal applications; company OS controls still apply. Release building now needs the Windows .NET Framework compiler; generated executable is excluded from Git and compiled into the allowlisted ZIP.

## Previous update — package 0.5.5 / extension 0.4.4

The extension logo is removed. Drag any panel background/text area to reposition it; interactive controls and log selection stay usable. Keyboard arrows/Home move the panel when it is focused. All 25 extension checks passed. Browser-control initialization failed during this small update, so the new layout was not visually rechecked. Reload extension 0.4.4 and refresh idle CRM. No calling behavior changed.

## Previous update — package 0.5.4 / extension 0.4.3

Previous Conversations (`/history`) reviews, exports and deletes saved list conversations. Per-contact JSON/MP3, selected-list ZIP and all-history ZIP are supported. Rehearsal MP3s now persist in the local campaign database and contain both speakers for a whole contact (partial if interrupted). Real phone audio is not recorded. Campaign history remains until explicitly deleted; previously pruned records and old browser-only audio cannot be recovered. Standalone manual diagnostic logs still use seven-day retention; terminal list audio events are archived.

Failed/pending rows display exact recorded logs in the transcript panel. New worker failure messages and preparation session IDs persist without granting dispatch authorization. Rehearsal has live sound resume, speaker test and volume controls, using one audible output and independent recording mix. Extension panel is draggable by its title, remembers position, and includes Previous Conversations. Reload extension 0.4.3 and refresh idle CRM after updating. No phone call or paid API session was made for this release.

## Prior settings — package 0.5.3 / extension 0.4.2

Manual next-reply guidance now requires 6,000–20,000 characters, explicitly confirmed by the owner. Real lists have saved local background and conversation guidance, with background capped at 20,000 and guidance requiring 6,000–20,000. Save for future calls persists defaults; new lists snapshot them. Apply to selected list updates only idle draft/paused lists, never active attempts. Old lists keep their original brief until explicitly updated. Background/guide control represented identity in new real sessions; automatic opening no longer overrides them with hardcoded names.

Five voices (Cedar, Ash, Echo, Ballad, Marin) are selectable for real calls and matching voicemail, manual supervised calls and each rehearsal agent. New real calls default to Cedar with confident young-adult masculine delivery guidance; exact perceived age is not guaranteed. Rehearsal choices are saved on import. All 150 checks and TypeScript passed. No actual phone or paid API call was used to verify these changes; payload tests mock OpenAI. Local pages were visually checked. Reopen idle pages to load changes; no additional extension reload is required beyond installed 0.4.2. Do not start calls without new user authorization.


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
