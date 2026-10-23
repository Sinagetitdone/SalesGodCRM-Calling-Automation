# ADR 0004 — Live two-agent rehearsal with local MP3 export

Date: 2026-10-23. Package: 0.5.0. Extension remains 0.4.0.

## Decision

Add a Live AI rehearsal subtype to simulated calling lists. The office and fictional customer use independent Realtime sessions, different voices (marin/cedar), and separate histories. Completed spoken transcripts become the other agent's next text input. No sentence script or speech recognition is used. Stream transcript deltas while each voice plays; wait for both response.done and output_audio_buffer.stopped before relaying the turn. Keep final-turn guidance additive so it cannot replace the office's original role/approved-brief constraints.

Use recvonly WebRTC audio, without a physical microphone or CRM port. The local /rehearsal-session endpoint checks the same-origin guard, owning worker, current simulation mode, active contact and session ID. Each attempt can open at most one peer per role. No credentials or phone numbers enter prompts/browser session configuration. This is dialogue rehearsal, not validation of telephone routing, VAD, voicemail classification or interruption latency.

The existing sequential campaign worker invokes this adapter only for simulationMode=agents. Offline mode and old drafts without that setting retain the free canned simulation. New UI drafts default to Live AI rehearsal with explicit API-cost labeling; import/reload never starts requests. Failure and Stop do not invoke even release/hangup operations on the CRM. Existing suppression/window/live-call authorization behavior is unchanged.

## Bounds and storage

Choose 4, 8 or 12 total replies and interested/busy/skeptical customer behavior before import. Each role is instructed to stay under 15 words, with 600 maximum output tokens, 1.15× speech, a configurable 20-second per-turn watchdog (10–120 seconds) and a five-minute session deadline. Both peers connect concurrently. Token caps are not latency targets; wait for actual playback completion. API usage is billed normally. Automatic retries are disabled. Copy a selected list to the editor to revise settings and import a fresh list, retaining the original audit record.

Real calls have separate timing: human-conversation server VAD uses 250 ms silence by default (200–1000 ms per list); screening remains 350 ms. Live speech uses 1.1× speed and concise routine answers. Do not apply the rehearsal complete-turn timeout or token cap to a real call. Do not shorten voicemail or end-call deadlines to hide response latency. Additive opening instructions preserve role and brief. Record audio-start events and measure delay from speech_stopped to audio start; this excludes the silence-detection interval and carrier delivery.

Save completed turns and interrupted partial text in the existing seven-day local campaign store. Text export labels partial audio. Mix received audio into a browser MediaRecorder; decode and encode to 128 kbps mono MP3 locally using the separate unmodified lamejs 1.2.1 library. Yield during encoding to keep the worker heartbeat responsive. No conversion API or backend recording store is introduced. Keep only the last ten recordings in page memory; refresh/close loses audio unless downloaded. Telephone calls remain unrecorded. Package the encoder, readable source and attribution with the Windows/Mac ZIP.

## Validation

### Workspace organization, updated in 0.5.1

The owner separated real calling from testing. /campaigns is real-only with an independent page template and a shared headless call engine. /supervised-call contains manual controls and rehearsal setup/output, reached by extension 0.4.1's AI Agents Test Call button. Mode-filtered lists retain original records. A worker mode assertion rejects mismatches before /start; rehearsal UI never opens a campaign control port. An active manual session blocks rehearsal Start, and an active rehearsal blocks manual preparation. Import/reload still cannot dial. Voicemail editing remains with real list settings.

Regression coverage includes API authorization and privacy, bounded settings, separate roles/voices, one connection per role, output drain in either event order, prompt preservation, immediate Stop, sequential persistence, failure without CRM actions and genuine MP3 frame encoding. Browser checks use fictional contacts and real OpenAI sessions; results are documented in Evolution. Actual Mac playback is not established by Windows checks.

Sources: [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations), [lamejs upstream](https://github.com/zhuker/lamejs).
