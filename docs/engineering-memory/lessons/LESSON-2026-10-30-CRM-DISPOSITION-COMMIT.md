# Treat a CRM disposition as a verified post-call commit

A local call outcome is not the same as a durable CRM note. Preserve the provider's existing note text, append a bounded structured line, save through the observed visible form, reopen the same contact by normalized phone, and verify the exact line before advancing. Keep call ownership until verification completes. Reject note writes while the call is active or when attempt identity is uncertain.

Business dispositions must be narrower than technical completion. “Meeting set” requires explicit agreement on an exact date, time, and timezone; a vague callback becomes “Needs follow-up.” Voicemail, no-answer, failure and review states come from the deterministic call state machine. Record the chosen business disposition in the event journal as well as the CRM note.

If the provider does not confirm the note, preserve the call evidence, mark Needs review, pause the list, and expose the cause. Do not silently continue, overwrite prior notes, retry the phone call, or infer a successful CRM write from a button click.
