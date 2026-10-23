# JML application notes

Source: the owner's JML-Brand-Application-Kit-01.zip, with its contract preserved alongside this document. The owner explicitly approved the existing interface font when the suggested JML fonts are unavailable.

- Exact colors: purple #4C0099; lime #B1EB1E. White, near-white and dark neutrals support readable forms. Red is retained only for semantic errors.
- Original Full Dark SVG is used on light page headers and the extension panel. The original J Dark SVG is the local favicon. Assets are copied without recoloring, cropping or changing proportions.
- Font stacks: DM Sans with Inter / Segoe UI / Arial fallback; DM Serif Display headings with the same approved existing UI fallback; JetBrains Mono with Consolas / monospace fallback. Fonts are neither downloaded nor embedded.
- Local pages share public/style.css. The extension embeds panel styles because it runs in the CRM shadow root; the local diagnostic page uses public/panel.css under the existing CSP. Keep these two style blocks synchronized.
- Extension branding uses chrome.runtime.getURL for one packaged SVG, exposed only to the existing two SalesGodCRM hosts. No new API, microphone, network or browser permissions are requested. The local lab loads the identical logo from its own origin.
- Distribution explicitly includes three SVG files (full logo in each runtime, compact mark in the bridge). Private keys, recordings and runtime databases remain excluded.
- Purple/white text contrast is 11.88:1 and purple/lime 8.36:1. Lime is not used for readable text on white. Keyboard focus outlines and hidden/disabled states remain visible and functional.
- Header links open a separate tab so navigation does not replace active call controls. Real CRM pairing still starts through the extension's Open calling list or AI Agents Test Call button, as explained on each standalone page.

The changes are visual. Real calling lists remain separate from AI rehearsal and supervised controls; no call prompts, voicemail wording, timers, transcripts, keys or state transitions are changed. Visual checks use idle local pages. Extension verification in CRM requires the user to reload it and refresh an idle CRM tab.
