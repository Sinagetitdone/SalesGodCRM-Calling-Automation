# Resume here — 2026-10-20

## Stop state

A shareable local installation package is now available via `npm run package:team`; see `tools/distribution/README.md` and its `SETUP.md`. It contains Windows/Mac launchers, no keys/private records, and requires Node.js 24 installed separately. The package has clean Windows smoke coverage and Mac shell syntax coverage; actual Mac startup/audio is untested. Current checks passed 109 tests plus type checking. The first distribution build is ignored under `releases/`; rebuild it from source for future sharing rather than zipping an installed folder.

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
