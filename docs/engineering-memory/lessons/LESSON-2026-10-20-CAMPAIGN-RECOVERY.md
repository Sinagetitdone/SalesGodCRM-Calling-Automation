# LL-2026-007: Reserve dispatch before side effects; recover paused workers too

A command acknowledgement can disappear after the browser already clicked Call. Retrying risks a duplicate telephone call. Persist a single-use attempt before issuing the command, remember its ID in the adapter, and preserve unknown on ambiguity. Resume must skip terminal unknown rows.

Pause is also crashable: future contacts may be paused while the current call remains active. Recover/expire paused active attempts as well as running ones. Prevent another list while any attempt remains active. Otherwise an orphan can block resumption forever or permit overlap.

Keep transcripts session-bound and idempotent, and await writes before completing an attempt. Storage/audio failure must produce failure/review rather than success. Synthetic worker and DOM tests establish sequencing and identity guards, but cannot prove the CRM phone lifecycle. Label simulated results and separately verify real integration with authorization.

Implemented in campaign-store.mjs, public/campaign-worker.js and campaign-driver.js; covered by campaign-checks.mjs and campaign-driver-checks.mjs.
