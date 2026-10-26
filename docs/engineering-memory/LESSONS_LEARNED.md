# Lessons Learned

## 2026-10-26: Recorded audio and transcript evidence

See [transcript evidence](lessons/LESSON-2026-10-26-TRANSCRIPT-EVIDENCE.md): generated words can outlive interrupted playback; final transcripts must follow captured audio, with explicit source labels and retained recordings. Screening and bounded document extraction lessons are included.

## LL-2026-001 — Do not infer provider contracts

Context: The supplied SalesGodCRM integration value is a webhook URL plus a credential.

Lesson: A webhook URL does not by itself establish whether the endpoint initiates calls, receives events, what authentication scheme is required, or what payload is accepted.

Rule: Do not invent provider-specific API behavior. Require provider documentation or an authorized contract test before enabling live dispatch.

## 2026-10-19: Browser audio proof levels

See [browser audio proof](lessons/LESSON-2026-10-19-browser-audio-proof.md): distinguish generated audio graphs, local WebRTC connectivity, CRM enumeration, CRM microphone acquisition, and actual telephone/OpenAI audio. Never promote a partial diagnostic to a full integration pass.

## 2026-10-19: SQLite request isolation

See [SQLite request isolation](lessons/LESSON-2026-10-19-sqlite-request-isolation.md): do not await inside a shared DatabaseSync transaction; reject call-ID reuse across different idempotency keys before writing.
