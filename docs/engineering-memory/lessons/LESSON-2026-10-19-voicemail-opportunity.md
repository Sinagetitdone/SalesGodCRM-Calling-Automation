---
type: lesson
status: active
title: A voicemail recording opportunity needs greeting and beep evidence
tags: [integration, testing, calling, audio]
---

# Context

The first phone test reached an automatically answered mailbox. Starting the normal AI introduction during the greeting did not leave the intended voicemail. The historical test mode also prohibited voicemail, despite it being an original product requirement. Transport connection and generated audio did not establish delivery.

# Prevention

Model voicemail as a separate silent screening and one-shot playback path. Prepare owner text before dispatch; never invent callback numbers or business claims. Combine bounded greeting recognition with a finished beep, allow bounded ASR latency, and retain neither the transcript nor raw call audio. Keep automatic conversation responses disabled until a person is explicitly confirmed. Pause, media loss, mailbox-full announcements and absent signals must prevent playback or record interruption. Do not equate audio-source completion with a saved carrier recording. Expose manual hangup while provider call control remains unsupported.

# Evidence

Pure signal tests cover mailbox frequencies, silence, ring tones, broadband input, clicks and long tones. Controller tests cover both-cue ordering, delayed transcripts, one-shot behavior, cancellation, failed preparation, gate acknowledgement, completion drain and hangup interruption. The actual OpenAI/browser rehearsal received the prepared message at the synthetic mailbox with peak 0.62636, persisted the event sequence and stopped all AI resources. Real mailbox recording remains unverified.
