# ADR-0006: Real calling-list MP3 recordings

Date: 2026-10-24. Package 0.5.7; extension remains 0.4.4.

The owner requests the complete real-call conversation as a playable, downloadable MP3 in Previous Conversations. All new real calling-list attempts automatically record after durable dispatch reservation and before the dialer action. Preparing audio alone does not record. Existing manual diagnostic controls remain diagnostic-only; use a one-contact real list for a saved phone conversation.

Capture the dialer's incoming media before the transcription track's enabled gate. Capture the actual local outbound destination after the AI output gain, including direct prepared voicemail. Mix with 0.5 gain for overlap headroom. Do not request the physical microphone or connect the recording mix to computer speakers. This is local bridge audio, not proof of what the carrier delivered or saved in a mailbox. Record ringing/greetings and silence as part of the attempt, not only transcribed speech.

MediaRecorder captures one continuous Opus/WebM timeline; the existing pinned LAME encoder converts it locally into one mono 128-kbps MP3. Stop media promptly, then encode cooperatively while worker heartbeats continue. The worker may hang up the owned phone call while encoding, but cannot finish the contact or advance to the next contact until persistence completes. Concurrent stop requests share one promise. The five-minute session limit is unchanged.

The existing campaign_recordings table stores the MP3 under its contact. The exact local origin, active authorized worker lease, campaign/contact membership, reserved session, active contact state, MP3 signature and 12 MB limit govern upload. History playback, MP3 download, contact deletion and list/all-history ZIP export reuse the existing routes. Data remains local until downloaded and is never copied into a distribution ZIP. Owner deletion cascades audio; exports already downloaded remain outside application control.

Recording start or capability failure prevents dialing. Capture/encoding/upload failures stop progression and are logged for review. A successfully encoded MP3 with a failed upload is offered as a temporary in-page download. Audio saved after normal interruption may be partial. Closing/crashing the browser or losing the local bridge before finalization can lose the recording; keep both open until the contact finishes. There is no claim of crash-safe incremental recording. Older audio that was never saved cannot be recovered.

Validation uses synthetic audio graphs and mocked call/media controls plus real local database/HTTP/ZIP and MPEG encoding checks. No phone or paid API calls are part of development verification. Carrier recording and Mac browser audio require a separately authorized real-device check.
