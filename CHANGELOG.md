# Changelog

All notable project changes will be documented here.

## Unreleased

### 2026-10-20 — Preserve normal voicemail invitations (team package 0.4.6)

- One authorized real test reached a voicemail greeting, then an unavailable classifier result ended the call before playback. The owner heard “Please leave your message at the tone.” No message playback was logged. This attempt did not verify the missed-beep recovery.
- Unavailable classifier results now require explicit mailbox failure evidence from the same utterance before pausing/hanging up. A recognized recording invitation without failure evidence continues as voicemail; other unsupported unavailable labels become unknown. The classifier prompt distinguishes a person being unavailable from a mailbox unable to record. No raw greeting text is added to persistent logs.
- A deterministic regression uses the owner-reported greeting and a forced incorrect unavailable label, confirming playback proceeds. Audio checks pass 72 tests. No second call was placed.


### 2026-10-20 — Recover missed voicemail beeps (team package 0.4.5)

- The latest real attempt recognized voicemail but hit the fixed 60-second screening timeout without a beep event or playback. Detection now allows 120 seconds for ringing and a bounded extension of at least 45 seconds after a late recognized greeting. Short 60–100 ms mailbox tones are accepted while clicks/long tones remain rejected.
- A model-confirmed recorded greeting followed by 2.5 seconds of fresh continuous silence can trigger the prepared message if the beep was missed. This path is logged as voicemail.silence_fallback, not a detected beep. New speech resets approval; pending/unknown human decisions cannot use old voicemail approval. Full mailbox, unavailable media, and existing human takeover gates remain active.
- Added seven deterministic regressions for late greetings, short/missing beeps, silence gating, full mailbox, playback completion and human/ambiguous pickup. Full checks pass 127 tests plus type checking. No new phone call was placed; actual mailbox receipt remains unverified.


### 2026-10-20 — Step-by-step colleague guide (team package 0.4.4)

- Rewrote the guide as ordered first-time setup, daily startup, practice, live import, results, shutdown and update steps. Separate Windows/Mac commands explain downloads, ready output, error-close prompts and Ctrl+C / Windows batch termination.
- Added a clickable contents menu and print-friendly HTML generated automatically from the Markdown source during packaging. Runtime behavior and extension version are unchanged.


### 2026-10-20 — Use the configured proxy (team package 0.4.3)

- Bridge startup now reads the enabled Windows user HTTP/HTTPS proxy, respects explicit environment proxy settings, and enables Node environment-proxy support. Local signaling always bypasses that proxy. Addresses and credentials are never logged; no Windows network settings are changed. Both npm startup and team launchers use the same entry point.
- Direct traffic returned a regional 403. Through the existing Hiddify proxy, the models-list endpoint instead rejected a restricted key's missing model-read scope; that result does not establish Realtime access. A deliberately invalid Realtime offer reached request validation with HTTP 400 invalid_offer through the proxy, with no phone call or voice session.
- Verified a complete no-call browser voice test through the updated bridge: completed AI audio response, 238 received packets and automatic disconnect. No physical microphone or dialer was used. All 120 checks plus type checking passed.
- Added deterministic coverage for proxy precedence, per-protocol HTTPS settings, localhost bypass and unsupported proxy formats. Mac system-proxy discovery remains unimplemented; explicit environment proxies are supported.

### 2026-10-20 — Actionable API errors (team package 0.4.2)

- Distinguish confirmed regional denial, generic permission denial, invalid keys, IP allowlist errors, quota/rate limits and model-access failures using fixed safe messages. Session and voicemail preparation failures remain no-call failures; unknown 403s are not labelled regional restrictions.
- Voice-test exports now retain failure stage/category, HTTP/upstream status, stop reason and end time without copying provider messages, unknown codes, credentials or connection descriptions. Added ChatGPT-versus-API guidance to the test page and setup guide.
- All 117 tests plus type checking passed with synthetic provider responses. This improves diagnostics; it does not remove an OpenAI service-side access restriction.

### 2026-10-20 — Automatic private Node setup (team package 0.4.1)

- Start/Configure launchers now reuse Node.js 24 with npm or automatically download pinned, checksum-verified official runtime archives for Windows x64/ARM64 and Intel/Apple Silicon Mac. Runtime files stay in the installation's `.runtime` folder; no administrator rights, permanent PATH edits, execution-policy changes or system installer are used.
- Added corrupted-download rejection and runtime-pin coverage, and verified a real Windows no-Node download/extract/Node/npm path in a long folder with spaces. Mac and Windows ARM64 runtime execution remain untested; no phone call or OpenAI request is part of this setup.
- Passed 111 automated tests plus type checking, Mac shell syntax checks and the full extracted Windows launcher with system Node hidden. The existing owner bridge was left running; no calls were placed.

### 2026-10-20 — Shareable team package

- Expanded the included HTML/Markdown guide with daily Windows/Mac launcher and manual startup, numbered CSV/settings/import/live Start steps, pause/stop, logs/export, shutdown and connection-refused recovery. Clarified that draft settings, including simulation mode, are saved at import and require a fresh draft to change.
- Added a reproducible allowlisted ZIP with Windows/Mac start and key-configuration launchers, blank environment template, production dependency lock, checksums, and HTML/Markdown setup guide.
- Launchers check Node.js 24 and loopback port, install required libraries on first launch, preserve existing local keys, and keep calling explicitly started. No owner's keys, logs, databases, screenshots or installed libraries are included.
- Passed 109 automated tests plus type checking, clean Windows package extraction/dependency installation, no-key route smoke checks, occupied-port handling and Mac shell syntax checks. Actual macOS startup/audio remain unverified. No calls or OpenAI requests were made for packaging.

### 2026-10-20 — Faster interruption recovery

- Removed the extra one-second human-takeover polling delay and preserved pending human classification across repeated speech. Newer transcripts still supersede older decisions.
- Reduced screening/live turn-end silence from 600 to 350 ms, retaining interruption and media authorization gates. Shorter pauses may increase early turn-taking; real latency improvement is not yet phone-tested.
- Recorded one real automatic voicemail-to-human conversation with saved transcript and audibility confirmation. This was before the latency patch; no additional call was made to test the patch.

### 2026-10-20 — Local browser calling workflow

- Added extension 0.4.0 and loopback audio bridge on port 28431, without VB-CABLE or API keys in browser code.
- Added CSV drafts, sequential list execution, backend suppression/window/Start checks, durable dispatch/lease recovery, transcripts/events, export and completion UI.
- Added approved voicemail playback, guarded hangup and human-pickup interruption fixes, including post-message listening, correlated classification, repeated-speech handling and detection diagnostics.
- Added regression coverage; 105 tests plus type checking passed without phone calls or paid API requests (the fake-provider HTTP check needed a rerun after a transient bad-port failure).
- Recorded failed automatic human-answer tests and the later voicemail-only run accurately, followed by the successful single takeover described above. Multi-contact live calling remains unvalidated. Playback does not prove carrier recording.
- Added [resume notes](docs/RESUME-HERE.md) and refreshed onboarding/current-state documentation. Work is paused; no retry or new call is scheduled.

### Historical prototype changes

- Added deterministic call orchestration with eligibility gating and idempotency.
- Added an in-memory call repository for domain/application tests.
- Added SalesGod webhook configuration, bearer authentication, and generic JSON client.
- Added secret-safe environment configuration and integration tests.
- Kept live call dispatch disabled until the provider's actual call-initiation contract is verified.
- Bootstrapped JML repository operating structure.
- Added initial architecture and integration discovery documents.
- Added deterministic call-state domain core and tests.

- Completed a strict JML repository audit and documented release-blocking gaps.
- Added CONTRIBUTING, agent/skill operating contracts, and Engineering Memory summaries/index/bug record.
- Corrected START-HERE to reflect the actual implementation state.
