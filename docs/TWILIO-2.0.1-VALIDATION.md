# Twilio 2.0.1 — corrected authentication and trial detection

Date: 2026-11-08.

The owner revealed the existing account Auth Token in Twilio. It was read without printing the UI state or token, saved directly into the ignored local .env, and tested through read-only Twilio APIs. No telephone calls, account upgrades, number purchases or new credentials were created.

Twilio accepted authentication and returned an active Trial account. Both IncomingPhoneNumbers and OutgoingCallerIds returned empty lists. The earlier trial-panel calling number is a shared Twilio-owned trial number, not a dedicated number owned by this account.

Twilio’s current Voice trial documentation explicitly blocks Stream, required by this integration’s bidirectional AI audio. The provider preflight now reports successful authentication followed by this specific account restriction before any number lookup or dial attempt. The account owner must upgrade and obtain a voice-enabled number; the software does not perform billing actions.

The existing OpenAI key still returns expired_secret_key. The temporary public tunnel still has a network timeout and must be replaced with a working HTTPS/WSS connection or fixed by IT. All three readiness conditions remain required before explicit Start can dial.

Version 2.0.1 adds a deterministic trial-preflight test, updates the setup guide and keeps templates/package contents free of credentials. The full suite comprises 221 tests (24 Vitest and 197 Node tests), including 15 direct Twilio checks. Live telephone acceptance remains pending the account upgrade, valid OpenAI key, working public ingress and an explicitly authorized test call.

References:

- https://www.twilio.com/docs/usage/trials/try-out-voice#blocked-verbs
- https://www.twilio.com/docs/usage/trials#twilio-trial-numbers
