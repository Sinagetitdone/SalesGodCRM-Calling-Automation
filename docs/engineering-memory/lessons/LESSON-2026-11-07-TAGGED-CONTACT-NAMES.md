---
id: LESSON-2026-11-07-TAGGED-CONTACT-NAMES
date: 2026-11-07
title: Display cells can combine identity and metadata
---

The CRM Name cell's textContent concatenates the name and tags, sometimes without whitespace. Comparing that composite string with an imported full name falsely deferred every attempt even though the import was complete.

When the display cell differs, verify the existing first-name, last-name and phone fields through the known contact form. Close without Save and resolve the current row again. Never trim arbitrary known tag words or use a prefix match: those approaches can accept a different real name. Regressions must include concatenated badges as well as real identity mismatches. Verification here is synthetic, not a live CRM/call test.
