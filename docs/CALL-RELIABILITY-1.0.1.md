# Call reliability and CRM name saving — 1.0.1

Date: 2026-10-30. Package 1.0.1; Chrome extension 0.4.6.

## Evidence reviewed

- The supplied `SalesGod-Team-1.0.0.zip` was externally named 1.0.0, but its internal runtime metadata was 0.6.1 and its extension was 0.4.5. Package 1.0.1 aligns the archive name, runtime metadata, desktop launchers and setup guide.
- Both supplied contact CSVs contain 163 data rows with `First Name,Last Name,Phone` headers. Both stop at row 140 because that row has a phone number but no first or last name. The importer now reports `Row 140: first name is required.` instead of the vague `invalid name` error.
- The supplied SalesGodCRM screenshots show imported contacts and one phone-number-as-name row. They do not contain call audio, playback events or answer classification, so they cannot prove the exact cause of a specific unanswered or missing-voicemail call.
- The local databases do not contain the colleagues' reported calls. Their exact event history therefore remains unavailable unless they export **Previous Conversations** from the affected computer.
- The logged-in CRM was inspected without placing a call or saving a contact. The supported Contacts page exposes phone search, Add Contact, Edit, separate First Name/Last Name fields, and explicit Add/Save controls. The extension uses those visible controls; no private provider API was invented.

## Defects found and repaired

1. **A clear mailbox invitation could still wait on a second classifier.** If that classifier was delayed or returned unknown after the beep had been missed, the saved voicemail never started. Standard recorded invitations now deterministically confirm voicemail, and fresh silence can recover a missed beep without waiting for that second result.
2. **The beep tail could cancel its own voicemail.** During the short interval in which the generated microphone gate opened, the tail of the mailbox tone could arrive as a speech event and be treated as a human interruption. Transition audio is now isolated during gate opening; a recognized beep/tone artifact cannot cancel prepared playback.
3. **A short human greeting could wait indefinitely.** A bare “Hello” depended on transcription plus a separate answer classifier. The system now gives short human greetings a bounded 750 ms safety window. Continued recorded mailbox speech cancels the fallback, preventing a segmented greeting from being mistaken for a person.
4. **The calling worker discarded contact names at dispatch.** It sent only the phone number to the global dialer, so SalesGodCRM could create a number-only record. The worker now passes first and last name, searches Contacts by normalized phone, creates or updates the contact through the visible CRM form, confirms the saved name, and only then dials. Failure to confirm pauses before any call.
5. **Malformed list feedback was too vague.** A blank first name now has a precise row-specific error. This prevents the blank row seen in both supplied CSVs from entering a new campaign.

## Operator change

Open **Contacts** from the SalesGodCRM left menu before choosing **Open calling list**. Extension 0.4.6 enforces this because the Contacts table and supported Add/Edit forms are required to verify names. A colleague who starts from Dashboard receives an instruction and no calling-list window is opened.

## Verification

- Synthetic coverage exercises standard voicemail invitations, missed-beep recovery, beep-tail isolation, delayed short greetings, segmented recorded greetings, contact creation, contact rename, wrong-page refusal and first/last-name propagation from the worker.
- Targeted reliability suite: 93 tests passed.
- The complete repository and distribution suites passed: 198 tests plus TypeScript type checking.
- Browser inspection was read-only. No contact was created or edited, and no telephone call was placed.

## Remaining limits

Automated tests prove the state machine and observed DOM workflow, not carrier delivery. `voicemail_played` means the prepared audio drained through the generated microphone; it does not independently prove that a carrier stored the recording. The first real call with 1.0.1 should be one supervised, authorized number, followed by checking the recipient's mailbox and exporting **Previous Conversations**. Mac launch and telephone audio still require a Mac hardware test.
