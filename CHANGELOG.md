# Changelog

All notable project changes will be documented here.

## Unreleased

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
