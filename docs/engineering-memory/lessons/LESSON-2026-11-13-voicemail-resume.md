# Preserve voicemail through recorded prompt tails

The owner identified SalesGod-Team-1.0.12.zip as the affected release. Its legacy CRM call engine is byte-identical to the af7634f baseline. Do not diagnose this package using the later Twilio runtime. The repair lives on fix/crm-voicemail-1.0.13, based on that CRM release; it does not revert the Twilio migration.

Two deterministic reproductions failed before this repair:

- A recognized mailbox invitation followed by “When you have finished recording, you may hang up” lost its silence-fallback confirmation because the later segment lacked a second recording invitation. A missed acoustic beep then left the message unplayed.
- A delayed beep transcript after the audio gate opened triggered the generic human-interruption path. This permanently stopped the prepared source, with no recovery when the transcript proved to be a mailbox artifact.

Retain recording approval only for narrowly recognized mailbox continuations. Unknown speech still invalidates fallback approval. On interruption, silence playback immediately, retaining its AudioContext playhead. Resume only for a recognized mailbox prompt and after all pending speech is transcribed and quiet. A confirmed human discards the resume point and starts live conversation; unknown speech requires review. Manual pause, shutdown and failed media cannot resume playback. Track resumed playback in the durable journal; only the final resumed source's completion and drain can mark playback complete.

Expanded deterministic invitation recognition covers brief/detailed messages and name-and-number requests, while excluding call-screening name-and-reason prompts. No secrets or contact information were needed. Synthetic tests establish application behavior, not carrier storage or a diagnosis of the owner's exact call; no failed-call event export was supplied.
