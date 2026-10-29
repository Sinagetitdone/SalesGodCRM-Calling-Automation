# CRM-native import and identity-bound calling — 1.0.3

Date: 2026-10-30

Package: 1.0.3

Extension: 0.4.8

## Behavior

- **Import contacts for calling** opens SalesGodCRM's native Import Contacts dialog.
- The extension captures only the CSV explicitly selected there and keeps it in the current page's memory.
- It waits for the CRM dialog to close after Import before offering the file to the paired local calling-list page.
- The local page creates a reviewable draft; neither import nor draft creation starts calls.
- Before every dispatch, the CRM driver searches the normalized phone, requires the exact imported first/last name, re-resolves the row after dialer settings, and clicks that row's Call control.
- A missing row, unfinished import, mismatched name, missing Call control or uncertain active identity stops before dialing.
- Verified post-call Notes and transcript/recording behavior are unchanged.

## Evidence and limits

Read-only inspection of the logged-in CRM confirmed the Contacts Import dialog, file chooser, header-row checkbox, Import button, displayed Name/Phone columns and the row Call control with `title="Call"`. The dialog was opened and closed without choosing or uploading a file. No contact was edited and no telephone call was placed.

Deterministic tests cover row-call dispatch, name-based active identity, missing and mismatched imports, import-wait deferral without consuming the contact, absence of provider APIs, one-session handoff guards, campaign sequencing, Notes and audio behavior. All 205 offline tests, type checking and the seven distributable archive checks pass on Windows.

A supervised synthetic import in a non-production CRM account would provide stronger provider-side evidence. Actual asynchronous import completion and provider display behavior are still external behavior; the pre-call identity gate is designed to fail closed if they differ.
