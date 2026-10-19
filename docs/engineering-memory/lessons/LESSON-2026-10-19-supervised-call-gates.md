---
type: lesson
status: active
title: Separate media readiness, human answer and permission to speak
tags: [integration, testing, calling, security]
---

# Context

An idle diagnostic bridge deliberately stopped when the dialer created a peer. Removing that stop alone would let AI speak during ringing, accept a physical microphone fallback, mistake its own private peer for customer audio, and lose records when a browser tab closed. A connected peer is not proof that a person answered.

# Prevention

Make supervised mode explicit. Start silent and verify a single dialer peer with a live generated microphone sender and incoming track. Require an operator-confirmed human answer, a local output-gate acknowledgement and the actual VAD configuration acknowledgement before unmuting or generating the introduction. Recheck readiness after asynchronous logging; late acknowledgements must not resume a paused or disconnected session. Use the original constructor for private bridge peers. Keep phone dispatch/hangup distinct from AI pause/stop and explain which one happened.

Treat response cancellation as cancellation rather than completion. Persist bounded metadata in an ordered, idempotent journal; reject arbitrary text fields and stop AI on journal failure. Retain no transcripts or recordings by default. Never count synthetic success as telephone-network validation.

# Evidence

call-checks.mjs exercises gating order, delayed acknowledgements after pause/media loss, interruption, journaling failure, strict schemas, disk persistence and retention. Extension tests verify live peers are permitted only in live mode, physical fallback is blocked, and generated sender plus incoming track are required. The no-phone browser rehearsal confirmed a spoken synthetic request reached OpenAI and its answer returned to the simulated customer, with pause and hangup cleanup.
