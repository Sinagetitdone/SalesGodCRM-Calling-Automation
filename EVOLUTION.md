# Evolution

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
