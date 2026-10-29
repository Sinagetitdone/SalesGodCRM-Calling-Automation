# Lessons Learned

## 2026-10-30: Provider-native import handoff

See [provider-native import handoff](lessons/LESSON-2026-10-30-PROVIDER-NATIVE-IMPORT.md): capture one user-selected provider import in memory, bind the local draft to it, and use the verified provider contact row for the call side effect so identity is preserved.

## 2026-10-30: CRM disposition commit

See [CRM disposition commit](lessons/LESSON-2026-10-30-CRM-DISPOSITION-COMMIT.md): save a post-call status as a verified provider-side commit, preserve prior notes, retain call ownership until confirmation, and pause rather than silently advancing on failure.

## 2026-10-30: Call transitions and contact identity

See [call transitions and contact identity](lessons/LESSON-2026-10-30-CALL-TRANSITIONS-AND-CONTACT-IDENTITY.md): treat voicemail gate opening, short-greeting fallback and CRM contact saving as acknowledged state transitions; save and verify names before dialing.

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

- Conservative cleanup: preserve outcome precedence and public imports; validate newly extracted modules in the distributable ZIP. See [the maintenance lesson](lessons/LESSON-2026-10-26-CONSERVATIVE-CLEANUP.md).
