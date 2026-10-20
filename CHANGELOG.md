# Changelog

All notable project changes will be documented here.

## Unreleased

### 2026-10-20 — Local browser calling workflow

- Added extension 0.4.0 and loopback audio bridge on port 28431, without VB-CABLE or API keys in browser code.
- Added CSV drafts, sequential list execution, backend suppression/window/Start checks, durable dispatch/lease recovery, transcripts/events, export and completion UI.
- Added approved voicemail playback, guarded hangup and human-pickup interruption fixes, including post-message listening, correlated classification, repeated-speech handling and detection diagnostics.
- Added regression coverage; the latest complete check passed 103 tests plus type checking without phone calls or paid API requests.
- Recorded failed automatic human-answer tests and the later voicemail-only run accurately. Real automatic human answering and multi-contact calling are not yet validated. Playback does not prove carrier recording.
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
