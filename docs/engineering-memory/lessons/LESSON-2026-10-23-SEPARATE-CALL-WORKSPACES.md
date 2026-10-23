# Separate test and real-call navigation without changing audio behavior

Moving controls is not just hiding headings. The old /campaigns route injected its form into the full supervised-call page, coupling manual controls and rehearsal to real lists. Use explicit page templates, a fixed page mode, filtered saved lists and a worker mode assertion before starting. Keep old records unchanged, and retain rehearsal transcript/MP3 UI under the test page.

The list worker still needs the same audio engine but not its manual buttons. Detached view controls preserve that engine's API without exposing manual actions in the list page; test that headless preparation remains silent and cleanup works. Do not duplicate visible voicemail IDs. Block rehearsal/manual audio overlap within the shared test page and never attach a campaign driver to the rehearsal UI.
