# LL-2026-011: Check the actual API route and endpoint permissions

Chrome can honor a Windows user proxy while Node fetch silently connects directly. Record only whether a proxy is configured, not its address or credentials. Enable Node's environment-proxy support explicitly, preserve explicit environment overrides, read existing Windows HTTP/HTTPS settings when available, and bypass localhost. Restart the idle bridge after changing proxy configuration. Never weaken TLS verification or change system network settings as a side effect.

Do not treat every 403 as a regional denial. A restricted key can deny models-list read access while allowing Realtime requests. Check the actual voice endpoint: an intentionally invalid SDP offer may verify request validation without starting media, but only a successful no-call voice test establishes audio connectivity. Keep these evidence levels separate. Fixed public diagnostics must not copy arbitrary upstream error strings.
