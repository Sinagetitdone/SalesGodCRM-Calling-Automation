# Lessons Learned

## LL-2026-001 — Do not infer provider contracts

Context: The supplied SalesGodCRM integration value is a webhook URL plus a credential.

Lesson: A webhook URL does not by itself establish whether the endpoint initiates calls, receives events, what authentication scheme is required, or what payload is accepted.

Rule: Do not invent provider-specific API behavior. Require provider documentation or an authorized contract test before enabling live dispatch.
