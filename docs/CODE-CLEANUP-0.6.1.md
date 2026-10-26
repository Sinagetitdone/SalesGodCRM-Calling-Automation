# Code cleanup and verification — 0.6.1

Date: 2026-10-26. Maintenance release; extension remains 0.4.5.

## Review approach

Reviewed the application/domain layer, persistence, local bridge routes, browser call runner, audio lifecycle, extension adapter/signaling, history/export, and Windows/Mac distribution boundaries. Changes are deliberately limited to clear improvements that preserve the existing behavior. This is a maintenance review, not a claim that every possible defect has been eliminated.

## Code changes

1. **Separate contact parsing from storage.** Moved phone normalization and CSV parsing into `tools/audio-bridge/contact-import.mjs`. Named the existing CSV, contact-count and name-length limits, and reused the CSV limit in route validation. Expanded dense parser branches for readability. Original store exports remain available, with identical accepted input, errors, normalization and duplicate handling.
2. **Make final call results readable.** Replaced the nested outcome expression in `public/campaign-worker.js` with `stoppedCallOutcome`, using ordered guard clauses. Uncertain human takeover still takes priority over completed voicemail. Extracted repeated review/phone-ended checks without changing dispatch, hangup, recording or transcript sequencing.
3. **Name existing worker deadlines.** Pairing, preparation, heartbeat, dispatch observation, hangup, upload and polling durations now have descriptive names and explicit millisecond units. All values and timeout comparisons are unchanged.
4. **Define each voice preset once.** The supported preset list, API voice mapping and delivery style now derive from a single registry in `voice-settings.mjs`. Preset order, default Marin, the second Marin style, exact instructions and legacy fallback are unchanged.
5. **Share backend diagnostic sanitization.** Moved credential redaction and the 1,500-character bound to `diagnostics.mjs`; journal, campaign failures and route consumers use the same implementation. The old journal export remains compatible. Conversation text is not passed through this diagnostic sanitizer.
6. **Consolidate file-import constants.** Document formats, the 5 MB limit and the 20-second extraction deadline are named once in `text-import.mjs`. Child-process isolation, memory bounds and existing messages are unchanged.
7. **Protect distribution against missing modules.** Added the new helpers to the explicit package allowlist. Package tests now resolve relative module imports and reject missing packaged dependencies. Version metadata is 0.6.1 across the runtime and desktop launchers.
8. **Correct stale setup copy.** Removed a hard-coded old extension version and corrected obsolete statements that real calls were not recorded and conversation history expired after seven days. The standalone journal's retention and actual storage behavior were not changed.

## Intentionally retained

- The TypeScript domain already has a typed string union and transition table. Replacing this with numeric enums would make saved states and logs less readable without improving behavior.
- No database migration, API model change, prompt rewrite, timing adjustment, dependency update or new extension permission.
- Kept the live audio engine and extension injection scripts intact. A broad rewrite of these tightly coupled asynchronous paths needs a separate objective and additional integration evidence.
- The two ZIP writers remain separate: distribution uses compressed, reproducible archives, while history streams recordings to avoid a large combined buffer.

## Verification

- Baseline before changes: 188 passing automated tests.
- Final `npm run check`: TypeScript passed; all **192 tests passed** (24 application, 135 bridge/audio, 25 extension, 1 API, 7 distribution).
- Additional before/after comparison: **2,304 stopped-call status combinations**, zero changed outcomes.
- New regression cases cover outcome precedence, CSV boundary/quote behavior, voice mapping/legacy fallback, diagnostic redaction, and packaged module completeness.
- Restarted the local bridge only after confirming zero running lists and zero active contacts.
- Browser offline rehearsal: two fictional contacts finished sequentially, saved conversation/voicemail results and displayed the completion message.
- Browser live OpenAI rehearsal: one fictional contact, four replies, both audio streams verified; longest full reply was 6.0 seconds. The whole-conversation MP3 downloaded successfully (326,784 bytes) and matched the saved recording byte for byte.
- Previous Conversations displayed the four replies and event log. Downloaded the transcript/log JSON and selected-list ZIP; the ZIP contained the saved MP3.
- Browser extension-code lab: local audio graph and local WebRTC both passed in both directions. Test routing was disabled afterward.
- Browser recorder check: generated a 38,784-byte MP3 and recovered separate assistant/customer tone segments in order, with no microphone or API use. Real-calling page loaded saved-context controls and kept Start disabled without a selected list and CRM pairing.
- Automated tests exercised real-call orchestration with synthetic drivers, screening, voicemail takeover, failure handling, transcript/MP3 persistence, document imports and authorization. No telephone calls or physical microphone access were used.

## Limits and operation

No real carrier call was made; local tests do not prove end-to-end telephone delivery. Mac launchers are packaged and statically checked, but were not executed on macOS. Existing user records and settings remain in place. Synthetic verification lists are clearly labeled `Cleanup 0.6.1` in local history and are excluded from Git and the package.

The bridge runs at `http://127.0.0.1:28431/`. Reopen calling/rehearsal/history pages to load the new worker. The extension files are unchanged, so extension 0.4.5 does not require a reload for this release.
