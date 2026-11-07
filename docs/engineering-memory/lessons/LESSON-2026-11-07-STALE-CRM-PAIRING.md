---
id: LESSON-2026-11-07-STALE-CRM-PAIRING
date: 2026-11-07
title: A retained MessagePort is not evidence of a live CRM connection
---

The panel previously refused any hello while listPort existed. Reloading the child page silently stranded that port, while the child could present a stale paired state until a 15-second command timeout. Use a page-specific connection ID plus the existing opener/token/origin checks to replace idle ports, retain the driver's dispatch history, and never rebind while it owns a call. Confirm readiness with a side-effect-free ping before campaign start/claim. Connection failures belong at the connection layer, not as failed contacts before dispatch. Reconnection never authorizes automatic calling. Preserve old recorded results for audit rather than silently resetting them.
