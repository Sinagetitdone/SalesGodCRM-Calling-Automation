# Team installation package

Build a clean shareable ZIP from the repository root:

```text
npm run package:check
npm run package:team
```

Output: `releases/SalesGod-Team-0.4.0.zip` plus its `.sha256` file. The archive contains a `SalesGod-Team` folder, `SETUP.html`/`SETUP.md`, root-level Windows/Mac launchers, the runtime bridge, extension and blank `.env.example`. It does not include a Node installer or compiled desktop app. Colleagues install Node.js 24 and Chrome themselves. First launch downloads locked production libraries from npm with dependency install scripts disabled. No Docker, VB-CABLE, registry changes, background service, firewall edits or admin actions are performed by the launchers. The `.command` files are marked executable in ZIP metadata and normalized to LF independently of the builder's OS.

Only distribute the fresh ZIP produced by the allowlist builder. Never ZIP an installed folder: it can contain `.env`, contacts/transcripts, suppression databases and exports. `releases/` is ignored, so local smoke-test installs are not committed or recursively packaged. Per-file SHA-256 checksums are included in the archive and an archive checksum is written alongside it; these detect accidental changes and do not constitute a publisher signature.

The source launcher files here are templates copied to the archive root. Run the extracted root launchers, not these templates directly. The common launcher lives at `tools/distribution/launcher.mjs` in the installed package; it creates `.env` exclusively without replacing an existing file, checks the tested Node major and loopback port, installs libraries when the lock fingerprint changes, and runs the bridge in the terminal. Configure opens the local file in Notepad/TextEdit for the human to enter the key. The launcher never reads or prints the key. No startup action starts a calling list.

`runtime-package.json` and `runtime-package-lock.json` are a separate production-only manifest/lock snapshot of the tested Fastify dependency tree. Keep them aligned when updating runtime dependencies; npm ci from a clean extracted archive must pass. The main development lockfile is not shipped. Change the runtime package version for a new distribution release, and keep extension/setup version descriptions accurate.

Current validation on Windows: independent tar ZIP extraction, clean production npm ci, 15 package runtime routes through Fastify inject, simulation enabled by default, zero upstream API requests, and Windows launcher's occupied-port error path leaving the current bridge untouched. Both Mac scripts pass Bash syntax checking; executable ZIP metadata and line endings are covered by tests. No macOS runtime, Gatekeeper, Finder extraction, installation or telephone-audio validation has been performed. Do not describe this as a signed/notarized installer or promise Mac call compatibility.

`npm run check` includes four offline distribution regressions in addition to the application checks (109 total tests plus type checking as of this package). A real Mac smoke test and separately authorized telephone test remain necessary. The package keeps the current Jay Marketing Lab/Cena live identity and Sina voicemail; the colleague guide explicitly requires review. It provides local per-computer records, not a shared multi-user service.
