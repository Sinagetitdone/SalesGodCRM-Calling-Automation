# ADR-0009: Trial capabilities come from provider evidence

Date: 2026-11-08. Supersedes the automatic Trial-type denial introduced in 2.0.1.

The owner explicitly requested removal of the automatic trial-account block and one supervised test to the supplied destination. Official Twilio guidance conflicts: a September 2026 AI-calling tutorial discusses trial accounts with verified destinations, while the current new-trial guide lists Stream among blocked verbs. Account.type alone must not be presented as an observed call rejection.

The adapter no longer denies Trial accounts by type. Owned voice-number validation remains for normal lists. A trial shared caller can be submitted to Twilio for validation only when the explicitly started list contains exactly one contact. The configured calling number must still match the list; account authentication, suppression, prepared AI/voicemail, signed ingress, durable dispatch and no automatic retry after uncertain results remain.

A definite rejected Calls request with no bound Call SID is logged as failed/no call created, not unknown. Safe provider error text is retained with known credentials redacted for future diagnostics.

For this authorized probe, Cloudflare's direct edge connection timed out on the existing network. A temporary Pinggy SSH callback tunnel through the existing approved HTTP proxy passed the exact-instance HTTPS health check. Its public WebSocket upgrade reached the ingress and correctly rejected unsigned traffic. Only port 28432 was forwarded; private list/history controls on 28431 remained local. OpenAI authenticated and accepted the Realtime voice configuration; the exact voicemail was prepared before dispatch.

One Calls API request was submitted. Twilio returned HTTP 400, code 0, with no Call SID. The local attempt is retained as failed with dispatch_rejected_no_call_created. The phone was not dialed. The old adapter discarded the provider's message, so this result does not establish whether the rejection was caused by parameters, caller validation or trial streaming restrictions. No second request was submitted. Read-only call history confirmed no new test call was created.

Optional start-test-tunnel.mjs uses built-in OpenSSH, an isolated ephemeral key and known-hosts file under ignored .runtime, and the existing HTTP/HTTPS proxy. It exposes callback ingress only and expires with the free tunnel. It is a test fallback, not a managed production endpoint. Do not disable TLS or SSH host verification, change VPN settings or expose the admin port to make a test work.

References:

- https://www.twilio.com/en-us/blog/developers/tutorials/integrations/outbound-calls-openai-gpt-live-1-node
- https://www.twilio.com/docs/usage/trials/try-out-voice#blocked-verbs
- https://pinggy.io/docs/client_behind_proxy/
