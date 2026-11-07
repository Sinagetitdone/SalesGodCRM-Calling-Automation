---
id: LESSON-2026-11-07-IMPORT-ACKNOWLEDGEMENT
date: 2026-11-07
title: Confirm native dialog actions and report at the initiating page
---

The original import opener searched only plain buttons and returned after click without checking that a visible file dialog opened. Errors shown only on the CRM extension could be missed while the user worked on the calling page.

The calling page now requests import over the paired port. The adapter looks for visible labeled controls and waits for a visible import dialog with a file chooser. Progress and errors return to the calling page; acknowledgement contains only serializable state. Never treat click dispatch alone as proof that the UI opened. Synthetic port and UI tests cover opening, file handoff and errors; real provider validation remains separate.
