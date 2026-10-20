# ADR-0003: Durable local calling lists

Date: 2026-10-20

Status: Implemented; synthetic checks and one explicitly authorized real automatic voicemail call passed. Automatic human-answer handling remains unverified on a real call.

The owner requests sequential first-name/last-name/phone lists, transcripts and event logs without recordings, and completion notification. Initial development prohibited calls; the owner later authorized one controlled real test. It reached voicemail, played the approved message after greeting and beep, hung up automatically, saved events and completed the list. CRM confirmed no ongoing calls. Carrier recording is unconfirmed; human-answer behavior and multi-contact live processing were not exercised.

Use the existing loopback Fastify server and SQLite. A separate campaign store owns draft settings, explicit Start authorization, normalized contacts, suppression/windows, single active attempts, transcripts and material transitions. This local deployment trusts its operating-system user and exact loopback origin; it does not provide hosted multi-user authentication. The standard key remains server-side. No per-contact consent field is introduced.

A foreground list worker pairs with the CRM through exact opener/origin/nonce checks and private message ports. A narrow adapter uses observed DOM controls independently of the audio hook. One-time dispatch is reserved durably before a browser click. Unknown acknowledgement is never retried. Hangup is restricted to a matching owned destination. Resume skips terminal unknown rows. Expiry/restart recovers active paused attempts as well as running attempts, and another list cannot overlap an active attempt.

The audio controller preserves supervised mode. Automatic mode classifies transcribed opening speech out of band without audible output, then uses existing media/gate/VAD checks. A scoped finish_call tool requests natural end after closing audio drains; opt-outs persist suppression. Voicemail retains greeting/beep gating and approved TTS. Completed playback is not proof of carrier recording.

Simulation defaults on and invokes neither provider nor OpenAI. Live operation needs a live draft, paired CRM window and explicit Start. Import/reload/restart never auto-start. Notification is local banner/title and optional desktop notification. Export joins transcripts and available session metadata. Inactive contact/transcript data is pruned after seven days at service activity, while suppression persists.

Browser/computer suspension can interrupt a foreground worker; a thirty-second lease prioritizes preventing overlap over continuity. Classification and DOM observation can be uncertain and must pause for review. A documented provider API would improve reconciliation if available. The TypeScript fake-provider service remains separate from this audio-bridge implementation. Synthetic success and previous supervised calls do not establish unattended production readiness. See tools/audio-extension/CALLING-LISTS.md.
