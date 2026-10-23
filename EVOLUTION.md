# Evolution

## 2026-10-24 — Double-click audio bridge applications (0.5.6)

Added SalesGod Bridge.exe and SalesGod Bridge.app to the clean team ZIP. They invoke the existing start scripts, including automatic checked Node bootstrap and locked dependency installation; neither invokes audio:check or starts a call. Windows uses a compiled AnyCPU .NET launcher with a fixed command and installation directory supplied separately, no elevation or interpolated shell paths. Mac opens the existing .command in Terminal through a quoted bundle-relative path. Progress stays visible and the existing stop procedure remains. Keep the extracted folder together and use a shortcut/alias for desktop access.

Windows compilation and synthetic process dispatch passed, including a different working directory, spaces/ampersands in the installation path, child exit-code forwarding and missing-package diagnostics. Package checks cover PE signature, Mac bundle executable permissions, plist mapping and archive integrity. Mac application execution and OS signing approval remain unverified; the apps are unsigned internal launchers. No phone or AI session was started.

## 2026-10-24 — Logo-free draggable tile (0.5.5 / extension 0.4.4)

Removed the logo from the extension panel and expanded dragging from the heading to the panel's background and text. Buttons, links, inputs, disclosure summaries and selectable log output are excluded so they remain usable. Keyboard movement applies only when the panel itself is focused. Saved position and viewport clamping remain. The 25 extension checks passed, including body drag and control exclusion. Browser preview was unavailable because the browser-control runtime could not initialize; no call or paid AI session was made.

## 2026-10-23 — Conversation history, live listening and movable panel (0.5.4 / extension 0.4.3)

The owner requested failure/pending logs in place of transcripts, audible live rehearsal, complete MP3 downloads, a draggable extension and review/delete/download history. Both list workspaces now show timestamped list/contact/audio events for failed or pending attempts, including persisted bounded application errors for new failures. Partial transcripts remain exportable. Historical errors that were never recorded are not reconstructed.

Rehearsal uses a shared audible media renderer with explicit unlock/retry, speaker test and volume controls. Both voices feed a separate recording mix, so listening volume does not change the recording. One MP3 covers all turns for a contact. New MP3s persist locally before the worker finishes the contact; upload failure retains the in-page download and marks the attempt failed. No phone audio recording was added.

Previous Conversations exposes all saved lists, per-contact JSON/MP3 exports, selected-list/all-history streaming ZIPs and explicit two-step deletion. Active lists/attempts cannot be deleted. Campaign history now remains until owner deletion; this supersedes automatic seven-day campaign pruning. Terminal audio metadata is archived with the contact; standalone diagnostic journal data still expires after seven days. Conversation deletion cascades through transcripts, recordings and archived events and removes the associated raw journal; opt-out suppression remains. The distribution contains no runtime history or credentials.

Drag the extension title to reposition the panel, with viewport clamping and per-site local position persistence. No dedicated drag button. Keyboard arrows/Home on the title provide an alternative. Chrome must reload extension 0.4.3; refresh CRM only when idle.

All 156 automated checks and TypeScript passed. Validation uses mocked AI exchanges, synthetic recordings, API authorization/deletion guards, whole-dialogue export checks, browser speaker-test acceptance, and local panel drag/reload checks. A ZIP downloaded from the running bridge also passed an independent Python ZIP/CRC check. No real call or paid OpenAI session is part of this release's verification; audibility on the user's chosen physical output still needs their confirmation.

## 2026-10-23 — Persistent calling context and five voice choices (0.5.3)

The owner explicitly required 6,000–20,000 characters for the manual live-conversation guide, including a true lower bound. Both the UI and sending code enforce it. Real calling lists now have a separate Background field (optional, up to 20,000 characters) and a conversation guide (6,000–20,000), with local saved defaults, character counts, reload and explicit application to an idle list. A singleton SQLite profile survives restart and seven-day campaign pruning. Lists retain independent context snapshots; updating defaults never changes existing attempts. Full context is included in authorized real-call session instructions, including represented identity instead of a hardcoded office opening. Voicemail wording remains separately approved.

Added Cedar, Ash, Echo, Ballad and Marin selectors for real calls/voicemail, manual supervised calls and both rehearsal roles. Real-call voice saves in the reusable profile and list; rehearsal voices save per imported test list. Cedar requests confident young-adult masculine delivery, without claiming a real age or promising a perceived age. Voice is chosen at session creation; no mid-session voice mutation. Existing rehearsal drafts without voice fields retain Marin/Cedar. All 150 checks and TypeScript passed with mocked OpenAI requests, boundary checks, restart persistence, inactive-list update guards and all five voice payloads for real, manual, voicemail and both rehearsal roles. Browser verification uses idle pages and rejects a 5,999-character guide. No paid AI session or real call was made. Extension version remains 0.4.2; restart the bridge and reopen idle pages for new controls.


## 2026-10-23 — JML branding (0.5.2 / extension 0.4.2)

Applied the supplied JML kit to the local setup, real calling lists, AI test/rehearsal, voice test, simulator and extension panel. Official SVG logos retain their original artwork and proportions. Shared color tokens use purple #4C0099 and lime #B1EB1E, with neutral surfaces, visible keyboard focus and responsive controls. The owner approved retaining the existing fonts when JML fonts are unavailable; no fonts are downloaded or distributed. Calling behavior, prompts, timing, contact data and API-key handling are unchanged.

The extension exposes only its packaged logo to the two existing SalesGodCRM hostnames. Local pages serve their logos from explicit same-origin routes under the existing CSP. Package allowlists and checks include both logo copies. All 143 checks and TypeScript passed; the branded local panel passed the synthetic two-direction audio check and its minimize/restore controls were inspected. No telephone call or paid OpenAI session was started. Reload extension 0.4.2 and refresh idle CRM to apply the panel appearance.


## 2026-10-23 — Separate real calling lists from AI test controls (0.5.1)

The owner requested Open calling list exclusively for real campaigns, with Live AI rehearsal and manual supervised controls moved to the extension's renamed AI Agents Test Call button. Package 0.5.1 includes extension 0.4.1. /campaigns has its own real-list template, real-only imports and saved-list filter; /supervised-call contains manual controls plus practice-only import, saved rehearsals, live dialogue and MP3 export. Prior records remain intact. A mode check rejects cross-workspace list execution before claiming a worker; rehearsal never pairs to CRM campaign controls. Manual AI preparation and rehearsal cannot run simultaneously in the same test tab.

The real list retains the shared audio engine without rendering manual controls, and keeps voicemail editing inside Call settings. All 143 checks and TypeScript passed, including headless audio preparation, mode separation, saved-list filters, unique DOM IDs and the renamed extension button. Browser inspection confirmed both layouts and previous rehearsal transcript access; a two-contact offline rehearsal completed in the relocated page. No real calls or additional paid AI tests were made for this reorganization. Reload the unpacked extension and refresh idle CRM to apply its new button label.

## 2026-10-23 — Live rehearsal, MP3 export and faster live-call turns (0.5.0)

Added two independent speaking AI agents for fictional contacts, streamed and saved transcripts, local MP3 replay/download, and a configurable rehearsal reply watchdog (20 seconds by default, 10–120 allowed). Connect both rehearsal peers concurrently; use brief replies and 1.15× rehearsal speech. An eight-reply browser test completed with both voices verified; measured complete turns ranged from 4.4 to 12.6 seconds. These timings include generation and speech, not telephone latency.

The owner clarified that responsiveness must improve on real calls too. Human conversation VAD now defaults to 250 ms instead of 350 ms, configurable per imported list (200–1000 ms). Live sessions request concise routine answers and 1.1× speech; introductory guidance is additive so it retains the approved brief. Voicemail screening, ringing, beep, late-pickup and session-limit timers are unchanged. Audio-start events and the most recent delay after VAD are reported for measurement. No real phone call was placed for this change; carrier performance still requires an authorized test.

See ADR-0004 and the 2026-10-23 rehearsal/audio Engineering Memory lesson. Windows/Mac distribution includes the encoder and setup guide; source extension version remains 0.4.0.

Validation: all 140 automated checks plus TypeScript checking passed. A no-phone WebRTC test using the actual supervised-call code accepted 250 ms VAD and 1.1× speech, generated the introduction and delivered measurable audio to the synthetic dialer. Synthetic customer TTS generation failed twice, so customer-to-AI response latency was not measured in that browser test; do not infer carrier latency from the successful introduction. Both synthetic peers were stopped. A new real-call test remains necessary before claiming measured telephone responsiveness.

## 2026-10-20 — Successful v0.4.6 supervised voicemail playback

One newly authorized single-contact phone test recognized the recorded greeting, detected an acoustic beep, played all 8.15 seconds of the prepared voicemail, waited for late pickup and ended the owned call. The list reported voicemail playback completed and finished; CRM returned to idle. The owner confirmed voicemail pickup but has not verified stored mailbox contents. The silent fallback was not exercised in this call. No implementation change or further dialing was needed for this verification.


## 2026-10-20 — Guard mailbox-unavailable classifications

The owner authorized one live retry after 0.4.5. It recognized voicemail, then classified a following utterance as unavailable and ended before any playback event. The owner reported a normal recording invitation. The exact ASR text is not retained, so do not claim a known transcript-level cause. Require explicit same-utterance mailbox failure evidence for unavailable; an unsupported label with invitation evidence continues as voicemail, otherwise remains unknown. Updated classifier instructions and deterministic regression cover the reported invitation. No further call is authorized by this repair. Package 0.4.6 contains the fix.


## 2026-10-20 — Voicemail recovery after a missed beep

The latest local attempt spent about 65 seconds from dispatch to review: media began, a recorded greeting was classified as voicemail, then the fixed screening timer fired with no beep/playback event. The exact acoustic reason the tone was missed is not available in metadata. Replace the one-minute detector deadline with bounded ringing/greeting windows and permit a model-confirmed voicemail plus fresh 2.5-second silence to recover a missed tone. Silence alone never authorizes playback; new speech invalidates the fallback approval and a separate event identifies this trigger. Keep playback/drain and human-takeover behavior unchanged. Seven new synthetic regressions and all existing checks pass (127 plus type checking). No phone call was placed; package 0.4.5 ships the fix.


## 2026-10-20 — Colleague setup walkthrough

Package 0.4.4 turns the setup guide into a numbered Windows/Mac walkthrough with exact launcher commands and expected prompt handling. A small local renderer generates the browser guide during packaging, so HTML and Markdown remain aligned. This is a documentation/distribution change; no call behavior changes and no calls were placed.


## 2026-10-20 — Preserve the owner's configured proxy for bridge traffic

Network diagnosis found Windows user proxy enabled through Hiddify while the bridge startup used direct Node fetch. The startup wrapper now reads Windows HTTP/HTTPS settings, preserves explicit environment overrides, enables Node's built-in environment proxy support, and bypasses localhost. This reads existing settings only; no system proxy, firewall, VPN or certificate settings are modified. The same wrapper ships in package 0.4.3 and is used by npm and team launchers. Mac uses explicit environment configuration; PAC/SOCKS discovery is not supported.

Direct API requests returned unsupported_country_region_territory. Proxied models-list requests returned missing model-read permissions for a restricted key; that endpoint is not a reliable voice-readiness probe. A proxied Realtime request with deliberately invalid SDP returned invalid_offer (400), establishing arrival at request validation without a call or active voice session. This probe alone did not prove media transport. After the idle bridge restarted using this wrapper, the standalone silent-input browser test passed: SDP accepted, channel opened, response completed, audio peak 0.36579, 238 received audio packets, and automatic disconnect. No physical microphone or phone call was used. All 120 automated checks plus type checking passed. Telephone media and Mac runtime were not retested. No phone calls are authorized by troubleshooting.

## 2026-10-20 — Preserve safe API failure causes

The owner reported that the extension could not connect even though this chat worked. A no-phone diagnostic and an independent read-only API check returned 403 with unsupported_country_region_territory. The old voice-test report recorded zero packets and session.stopped but omitted the error cause, while UI described 403 generically as model/access trouble. ChatGPT access and API connection eligibility are separate; no extension code change can establish service-side regional eligibility.

Added safe server mappings for known error codes without forwarding upstream messages or arbitrary codes. The same mapping covers Realtime setup and voicemail synthesis so voice preparation fails before dispatch with a useful explanation. Test/live reports retain an allowlisted category, stage and numeric HTTP/upstream status; voice exports also retain fixed stop reason and end timestamp. Unknown 403 errors keep a generic access-denied explanation rather than claiming unsupported region. Six new regressions cover regional errors in both endpoints, unknown-code secrecy, other known categories, report export and failure-before-media behavior. Full validation passed 117 tests plus type checking; no telephone call was placed. Updated installation package is 0.4.2. This is diagnostic improvement, not a claim of restored API access.

## 2026-10-20 — Automatic per-installation Node bootstrap

The owner requested that colleagues not have to download/install Node separately. Team package 0.4.1 now checks for suitable Node.js 24/npm and otherwise downloads official v24.21.0 Windows x64/ARM64 or Mac Intel/Apple Silicon archives. Version and SHA-256 pins are checked into the distribution sources after verification against nodejs.org. Checksums are verified before extraction; cached archives are rechecked. Downloads, extraction and runtime PATH stay local to the installation/launcher process. No execution-policy/certificate/security setting changes, global installs, admin actions or phone calls are introduced.

A Windows child process with system Node hidden successfully downloaded and verified the x64 archive and ran the private Node/npm. Legacy .NET ZIP extraction hit Windows path limits in the nested smoke folder; the bootstrap now uses built-in Windows tar and a bounded cache staging/move instead. Offline coverage rejects a deliberately corrupt cache before extraction. Mac scripts pass syntax checks, but Mac and Windows ARM64 execution are not claimed verified. The setup guide now presents automatic runtime setup and manual launcher commands that also work without an existing Node command.

## 2026-10-20 — Local team distribution package

The owner requested a package colleagues can use on Windows and Mac. Added an explicit allowlist ZIP builder, production-only dependency manifest/lock, blank key template, per-file/archive checksums, platform launchers and a nontechnical setup guide. Each installation keeps its own key and transcript/event databases locally. The launchers require Node.js 24, install libraries on first launch, preserve local configuration, refuse an occupied loopback port without killing anything, and never dispatch calls. This does not create hosted multi-user authorization, shared records, a Chrome Web Store listing, signed installer or bundled Node runtime.

All 109 automated tests plus type checking passed. A clean extracted copy installed production libraries, served 15 runtime routes with fake/no upstream access and default simulation, and correctly reported the existing bridge's port on the Windows launcher path. An independent ZIP reader extracted the archive; Bash checked Mac script syntax and automated checks verify executable attributes/LF line endings. No Mac hardware/runtime or telephone test was performed. No call or paid OpenAI request was made during packaging. The current owner bridge was left running.

## 2026-10-20 — Automatic human takeover observed; reduce interruption delay

One newly authorized single call recognized greeting/beep and began prepared voicemail. New speech stopped playback; correlated classification and an interactive question then triggered human takeover without an owner-answer button. The saved conversation contains live AI replies and the recipient's audibility confirmation. The AI included the approved contact-Cena closing; the telephone ended and CRM showed no ongoing calls. This establishes one observed automatic takeover, not unattended or multi-contact reliability. Repeated interruptions and imperfect transcription remained visible.

The owner reported a long pause on interruption. Inspection found that a fresh speech onset erased an in-flight classifier decision, and confirmed human startup used a one-second polling timer in addition to VAD silence. Pending decisions now survive repeated speech until a newer transcript supersedes them. Confirmed human startup runs immediately when speech-stop and evidence are both available, retaining verified media/gate/VAD checks. Screening and live server VAD silence is reduced from 600 to 350 ms. Two new synthetic regressions exercise pending-result preservation and supersession, and existing regressions verify timer-free startup. No new call or paid API request was made to test this latency change; real end-to-end latency remains to be measured. The full check reached an unrelated transient fetch bad-port failure in the fake-provider HTTP check; that check passed on rerun.

## 2026-10-20 — Diagnostic voicemail-only test

One further explicitly authorized call loaded the new detection logs. Incoming speech was transcribed, a classification returned voicemail, the greeting and beep were recognized, the approved message played, and the call ended after the eight-second quiet window. There were zero live AI response turns and no speech starting during message playback or the final listening window. The owner confirmed nobody picked up, so this exercised voicemail only and does not validate human-answer behavior. No retry was made; logs remain local and no call was left active.

## 2026-10-20 — Human answer remained silent in the takeover test

A separately authorized single-call test loaded the takeover fix, but never entered voicemail playback or human conversation. The journal recorded four incoming speech segments and zero AI turns before the provider call ended. The owner reported the person said hello and asked whether they could be heard. The list correctly paused as needs_review; the requested voicemail-to-human transition was not validated. Existing metadata cannot establish whether ASR latency, classification, or result handling caused that silent screening period. No retry was made.

Added metadata-only events for transcript receipt, classifier requests/results/timeouts, direct recognition of a narrowly bounded interactive question such as "can you hear me", and reading correlated classifier output from response.done as well as the incremental text event. Confirmed human evidence now survives another speech segment while waiting for a quiet speaking opportunity, instead of being cleared on each VAD onset. Three new synthetic regressions cover that exact question, rejection of bare hello/mailbox cues, and final-only classifier responses followed by repeated speech. These improvements do not retrospectively prove the failed call's root cause or establish real takeover success.

## 2026-10-20 — Correct missed human pickup during voicemail

The owner corrected the first automatic test result: a person picked up and spoke during voicemail, but the system hung up. The earlier success assessment covered playback/dispatch mechanics and was too broad. Inspection found input/VAD disabled during playback, human classification limited to initial screening, and a one-second post-playback shutdown. Automatic mode now preserves listening, accepts human classification after voicemail cues, interrupts prepared audio on new speech, and blocks hangup for pending pickup. Uninterrupted completion waits through eight quiet seconds; unresolved speech requires review after thirty seconds and never replays the message. Correlated classifier revisions reject stale results; confirmed human turns are persisted and late pending pickup cannot be reported as a successful voicemail. Regression tests cover before-beep, mid-message, post-message, delayed transcription, stale events, disconnect and uncertain speech without calls. The known historical local test row was flagged needs_review with an owner_reported_missed_human_pickup event; its original playback/hangup evidence remains intact. Real verification of the fix remains pending.

## 2026-10-20 — First automatic voicemail call

After explicit renewed authorization for one call to the owner's latest test number, extension 0.4.0 was reloaded and the idle CRM phone reconnected. A one-contact live list automatically prepared OpenAI audio, dispatched once, detected voicemail greeting and beep, played the approved message once, ended its owned phone call, saved the event log, and displayed list completion. CRM confirmed no ongoing calls and routing disabled. No retry or second call was made. Carrier recording remains unconfirmed and automatic human-answer handling remains untested on real media. A small list UI correction now replaces the manual audio engine's stale hangup instruction with the verified list-finished state.

## 2026-10-20 — Local calling lists, transcripts and completion

The owner requested sequential CSV contacts, conversation transcripts plus event logs, voicemail outcomes and completion notification, then explicitly instructed **do not call anyone**. Extension 0.4.0 and the loopback bridge now implement an opt-in list worker with default simulation, draft preview, backend Start authorization, suppression/windows, single-use durable dispatch, transcript persistence and export. Interrupted/uncertain attempts pause without redial; paused active attempts are recovered too. The automatic audio controller adds silent answer classification and a scoped natural-end/opt-out tool, retaining existing media and voicemail gates. A two-contact no-call browser simulation verified import, sequential results, saved transcript and completion notice. The new real automatic dispatch/answer/hangup lifecycle remains unverified, and the installed extension has not been reloaded for this change. See ADR-0003 and CALLING-LISTS.md. No calls were placed.

## 2026-10-20 — Owner guidance during human conversations

The owner requested a scheduling question during an already-running conversation, which had no instruction input. Newly opened local controls can now submit a bounded system-context note for the AI's next reply, restricted to live human conversation and correlated with API acknowledgement. The context update does not create another response or claim customer delivery; text is not persisted in the metadata journal. Existing sessions require reopening and cannot receive newly deployed UI code without reconnecting. The original scheduling request was not delivered and no meeting was booked.

## 2026-10-20 — Loopback port migration

Windows reserved the former audio port inside a TCP exclusion range and denied binding despite no active listener. The local server, extension trusted origin and setup instructions now use loopback port 28431. Extension 0.3.2 must be reloaded for this coordinated origin change. Existing host/origin restrictions remain exact; no OS network protections are changed. All 74 automated checks passed and the server bound successfully on the new port.

## 2026-10-19 — Supervised first-call conversation mode

Added explicit live-audio pairing separately from setup diagnostics. The bridge permits and monitors one new dialer audio peer, requires the generated microphone sender and incoming track, and stays muted until an owner-confirmed answer plus gate/VAD acknowledgements. OpenAI server VAD handles customer interruption. Pause clears output and disables input; peer loss, tab closure, journal failure and a five-minute limit stop AI without redial or automatic phone hangup. Physical microphone fallback is blocked while the supervised pair exists.

Added a local SQLite event journal with ordered idempotent writes and seven-day metadata retention, and a synthetic customer/dialer rehearsal. Live OpenAI heard the synthetic customer's request and generated the requested word through the return audio route; interruption, pause and hangup cleanup passed. Actual SalesGodCRM telephone media remains the next supervised-call verification. No real call was placed by the assistant.

## 2026-10-19 — Supervised Realtime setup and local audio pairing

Version 0.2.0 pairs the extension's generated-microphone and incoming-audio graphs to a loopback voice window using a short-lived token and MessagePort. The private WebRTC peer uses the original constructor to avoid capturing its own output. Synthetic routing can be tested without OpenAI; both audio signal peaks and RTP directions are required. Realtime setup keeps the standard API key server-side, requests one explicit AI introduction, waits for audio playback to drain, and disconnects automatically. Turn detection is disabled and a new dialer peer cancels setup. No phone calls or live conversation mode are enabled.

Local browser pairing and synthetic two-way routing passed. The supplied key was configured in the ignored local .env file at the owner's request, but OpenAI rejected it with HTTP 401 invalid_api_key; successful live AI audio remains unverified. A mistakenly committed value was removed from the current .env.example on main, without rewriting history. No key value is retained in documentation, test fixtures, or reports.

## 2026-10-19 — Pre-push verification and storage fixes

Added real SQLite concurrency/collision coverage and an isolated HTTP API check using the fake provider. Reservations no longer yield inside DatabaseSync transactions; a call ID owned by another request is rejected without overwriting records and is mapped to HTTP 409. CI now runs all core, HTTP, audio-server, and extension tests with npm ci. Setup instructions reflect the driver-free diagnostic direction, obsolete cable UI code is removed, and local credentials, databases, vendor binaries, screenshots, and manual trace files stay out of Git.

## 2026-10-19 — WebRTC diagnostics corrected and verified on the CRM origin

Version 0.1.1 adds explicit queued ICE candidate exchange, bounded signaling waits, cancellation, transport summaries, silent remote audio renderers, and active zero-gain measurement output. The synthetic WebRTC test passed twice on the idle SalesGodCRM page with audio packets and received signal levels in both directions. The localhost mDNS-only path remains unavailable and is documented separately. No phone calls, OpenAI requests, physical microphone capture, or browser/network security changes were made.

## 2026-10-19 — Driver-free browser audio diagnostic extension

The owner selected a custom Chrome extension instead of VB-CABLE. Added a diagnostic-only, narrowly scoped extension providing a generated page-level microphone, local incoming-audio routing, and synthetic graph and optional WebRTC tests. The build contains no OpenAI requests or call controls. Installing and verifying it on the live idle CRM page is separate from the standalone lab. The local setup page now explains this direction; the earlier cable bridge remains legacy code.

## 2026-10-19 — Local audio bridge setup panel

Added a loopback-only, disconnected-by-default OpenAI Realtime setup panel under tools/audio-bridge. The proposed routing uses Chrome tab audio capture for customer audio and VB-CABLE for AI playback into the dialer's microphone. The signed official VB-CABLE package is downloaded locally, but installation requires administrator access and a restart. No API key was configured during preparation. No live session, audio-route validation, or phone call has occurred. Campaign dialing remains outside this setup panel.

## 2026-10-19 — Owner-requested browser dialer and voice bridge

The owner selected automation of their logged-in manual SalesGodCRM dialer with a separate OpenAI voice bridge, list import, voicemail handling, and event logs. ADR-0002 supersedes the prior restriction requiring SalesGodCRM authorization for browser automation. Per-contact consent verification is removed for the owner's pre-authorized lists; suppression and calling-window controls remain. Live browser calling and audio routing are not yet implemented.

## 2026-09-29 — Repository bootstrap

The repository was created as a dedicated project for automating a permission-based calling workflow around SalesGodCRM's native AI caller.

The initial direction is deliberately provider-adapter based. No undocumented SalesGodCRM API or UI automation is assumed.

The first architecture spike is to establish the provider-approved integration contract. Implementation is blocked from live calling until that contract and the required compliance and authorization gates are resolved.

## Relationship to other artifacts

- Git history records implementation changes.
- ADRs record discrete architecture decisions.
- RFCs record proposals requiring broader discussion.
- Changelog records user-visible changes.
- Engineering Memory records reusable lessons and bugs.
- Evolution records system-direction history.

## 2026-10-01 — Strict JML audit

The repository was re-audited against the supplied JML standards. CI is green, but production release remains blocked by unresolved provider contract, authorization, persistence, runtime, audit, and security-validation gates. The repository now records those gaps explicitly and corrects stale onboarding/status documentation.

## 2026-10-19 — Supervised voicemail delivery path

The first phone test reached voicemail, exposing the missing greeting/beep handling. The local audio controls now prepare editable owner text through OpenAI TTS before dialing, screen incoming English transcription without generating responses, and require both a recognized greeting and completed beep before one playback through the generated dialer microphone. Outcomes distinguish playback completion, interruption, unavailable mailbox and review/timeouts. Synthetic end-to-end browser testing confirmed audio returned to the simulated mailbox without a phone call. Actual carrier recording and automatic phone hangup remain separate, unverified capabilities; operators still end the CRM call.
