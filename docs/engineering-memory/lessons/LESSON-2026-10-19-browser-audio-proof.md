---
type: lesson
status: active
title: Browser audio proof has multiple levels
tags: [integration, testing, calling]
---

# Browser audio proof has multiple levels

Distinguish a generated Web Audio graph test, a local WebRTC handshake, CRM microphone enumeration, CRM getUserMedia acceptance, real telephone audio, and OpenAI audio. Passing one does not establish the next.

A local WebRTC loopback can fail when the browser exposes no usable local ICE candidates. Keep that failure visible; do not claim phone media works based on a standalone synthetic graph test. Never trigger a real call merely to complete an explicitly no-call diagnostic.

The browser-only microphone requires the page to use the hooked media APIs; it is not a Windows audio device. Install before the CRM initializes and preserve normal physical microphone behavior unless the synthetic device is explicitly selected.

## WebRTC diagnostic follow-up

The localhost probe exchanged masked mDNS host candidates successfully but could not establish a candidate pair. The same synthetic probe connected on the SalesGodCRM origin, which already had microphone permission and exposed usable host candidates. Do not disable browser IP privacy settings to force a local test; compare the intended origin and record environmental limits.

A connected peer is not evidence of audible media. Explicitly keep remote streams and the Web Audio measurement graph processing, with zero-volume renderers and a zero-gain output for a silent test. Record both RTP packet flow and received sample levels. Queue trickled candidates until the remote description is ready and give cancellation a bounded cleanup path.
