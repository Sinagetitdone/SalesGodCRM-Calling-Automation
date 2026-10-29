# Provider-native import handoff

When the provider already owns contact import and identity, do not duplicate that write one contact at a time immediately before calling. Let the user select the file once in the provider's visible import dialog, retain the selection only in page memory, and hand the same bytes to local campaign state through an authenticated same-session channel.

Dialog submission is not proof that an asynchronous bulk import has completed. Before every irreversible call action, search by normalized phone, require the exact expected name, re-resolve the row after other UI changes, and click that provider contact row's Call control. Missing rows, mismatched identity or changed controls must stop before dialing. This both prevents calling the wrong contact and keeps provider-side call logs associated with the visible name.
