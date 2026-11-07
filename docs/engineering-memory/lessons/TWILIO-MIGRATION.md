# Direct telephony migration lessons — 2026-11-08

- Change the actual shipped runtime, not only the earlier provider prototype under src.
- Account SIDs begin AC; API-key SIDs begin SK. REST API-key secrets and webhook-signing Auth Tokens are different credentials. Never reveal them while diagnosing which field was populated.
- A prepared Realtime connection must fail before dialing when authentication or configuration is rejected. WebSocket close/error must reject the preparation promise; an unreferenced timeout can let Node exit without reporting the failure.
- A Twilio clear message returns marks for discarded audio. Delete invalidated marks before clear so canceled voicemail never becomes playback_completed.
- Twilio callbacks can beat the Calls REST response and terminal events can arrive out of order. Persist the attempt before dispatch and bind the provider identity exactly once.
- Confirm playback before hanging up after voicemail or a spoken closing. Keep listening briefly for human takeover after voicemail playback. Transcription of a greeting that began before playback must not become a false takeover.
- Public callback routes and private Start/import/history routes need separate listeners. A tunnel to the full local admin app would expose contact information and calling controls.
- Voice recording MP3s can include ID3 tags. Accept supported MP3 headers instead of assuming every file starts at its first audio frame.
- Pin and verify tool downloads. Generate the distribution dependency lock from tested production dependencies; never globally replace version-like strings in lockfiles.

- Current Twilio trials use shared Twilio-owned trial numbers and block the Stream verb. A trial-panel calling number is not evidence of an owned programmable voice number. Detect this account restriction explicitly before looking up numbers or attempting calls; never bypass it by removing provider eligibility checks. Source: https://www.twilio.com/docs/usage/trials/try-out-voice#blocked-verbs
