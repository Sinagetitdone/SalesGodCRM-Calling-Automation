---
id: LESSON-2026-11-07-INPUT-FEEDBACK
date: 2026-11-07
title: Show feedback for uploaded and restored content as well as typing
---

Input feedback must reflect programmatic values too: saved settings, copy/reset and file uploads often do not dispatch input events. Shared counters listen for edits and periodically compare the small set of text values, updating only changed values. Character counts include whitespace; word counts use whitespace separators. Keep validation rules intact. Uploaded CSV previews use textContent, never HTML, and are cleared before reading a replacement so failed reads cannot leave misleading old content. Counters exclude file, numeric, selection and hidden inputs.
