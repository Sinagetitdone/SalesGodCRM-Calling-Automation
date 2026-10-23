# Record the delivered local audio graph, not transcript or generated speech

For real-call recording, customer audio must branch before the ASR track is disabled, while AI audio must branch after output gating. Prepared voicemail bypasses the AI gain and must enter the same outbound recording source. Recording raw OpenAI output includes speech the customer was never allowed to hear; recording only the ASR destination omits muted greetings.

Keep MediaRecorder stop and final data delivery ahead of Web Audio context closure. Concurrent session termination paths need one shared completion promise, so a list cannot mark a contact finished while its upload is pending. End the owned phone connection without waiting for MP3 encoding, but retain the worker lease until the recording is saved. Persist capture/save failures and pause; never silently report an unrecorded call as fully saved. Retain an in-page MP3 download on upload failure.

Synthetic graph tests prove routing and state transitions, not actual carrier delivery. Browser termination can prevent asynchronous finalization; document that limit instead of promising every crash produces a recording. Keep real recordings out of test artifacts and shareable packages.
