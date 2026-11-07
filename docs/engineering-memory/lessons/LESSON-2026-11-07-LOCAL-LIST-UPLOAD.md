---
id: LESSON-2026-11-07-LOCAL-LIST-UPLOAD
date: 2026-11-07
title: Keep local list preparation independent of provider control
---

The owner expects Upload in the calling workspace to choose a file on the local computer. Requiring provider pairing or opening the provider import dialog made this action confusing. Upload/read/validate/draft now operate locally; dispatch alone needs the CRM connection. Explain that local queue creation does not create CRM contacts, because the current row-call adapter still verifies provider identity before dialing. Tests must run without an opener or paired port and prove the uploaded names/numbers persist as unattempted draft rows. A failed replacement upload must invalidate the previous CSV rather than silently using it.
