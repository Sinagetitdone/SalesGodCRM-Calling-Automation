---
type: lesson
status: active
title: Separate audio routing evidence from API authentication and telephone evidence
tags: [integration, testing, security, calling]
---

# Context

A local inter-window WebRTC connection can succeed while OpenAI rejects session creation. A configured key is not proof of authentication, and a generated microphone is not proof of telephone media. The installed extension may also be older than the source files loaded by a local page.

# Prevention

Keep the standard API key server-side. Check authentication without logging credentials or upstream error bodies. Report a 401 separately from connectivity timeouts. Make synthetic two-way routing runnable without an API key; require measured peaks and RTP packets in each direction. Use the original peer constructor for private bridge peers to avoid feeding their audio back into the dialer-capture graph. Stop setup when a new dialer peer appears, and require a separate approved conversation mode for a phone call.

Use a lab URL outside the installed content-script match when validating new source files before extension reload. Mark source-level and installed-CRM evidence separately. Retain sanitized reports only at the owner's request; never include SDP, ICE addresses, keys, or conversation data in diagnostic logs.

# Evidence

The local paired-routing test passed with synthetic audio in both directions and no OpenAI request. The model-access and Realtime endpoint rejected the supplied key with HTTP 401. Automated tests cover early ICE, signaling cancellation and timeout, malformed descriptions, failed authentication cleanup, and waiting for actual received audio before declaring the AI test passed.
