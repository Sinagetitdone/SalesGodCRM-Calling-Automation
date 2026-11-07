---
id: LESSON-2026-11-07-IMMEDIATE-START
date: 2026-11-07
title: Apply removed scheduling policy to both old and new lists
---

The owner removed calling-hour restrictions from local calling lists. A fix must remove both the claim gate and dispatch recheck; changing only defaults or the UI leaves old saved lists blocked. Preserve legacy fields for compatibility but make them optional and ignore them. Test the reported pre-opening timestamp, after-closing dispatch and omitted hour fields while preserving suppression, explicit authorization and once-only dispatch. No data migration or automatic Start is needed: the operator still presses Start after updating.
