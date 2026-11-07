---
id: LESSON-2026-11-07-DIRECT-KEYPAD
date: 2026-11-07
title: Global keypad dialing must not depend on CRM contacts
---

The owner removed provider contact and Contacts-page dependencies. The previous form-close wait required DOM removal, but the actual closed CRM modal remained mounted and hidden. Remove contact lookup/form/note code from the call path. Use observed global keypad controls with exact input-number confirmation, approved caller/generated microphone and one-use dispatch ownership. Do not accept a displayed name as proof of a phone target without verified provider identity. Preserve local imported names, outcome/event/transcript/MP3 history and never reset uncertain historical attempts automatically. CRM note synchronization is no longer part of this workflow.
