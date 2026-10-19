---
type: lesson
status: active
title: Keep synchronous SQLite reservations atomic across asynchronous callers
tags: [architecture, testing, calling]
---

# Context

The SQLite reservation opened a transaction and then awaited repository methods on the same shared DatabaseSync connection. Concurrent callers could enter a second transaction before the first committed. Its upsert also let a new idempotency key reuse and overwrite an existing call ID.

# Prevention

Keep all operations inside a DatabaseSync transaction synchronous, even when the repository's public interface returns promises. Reject a new reservation if its call ID is already owned by another key. Apply the same collision rule in the in-memory implementation and return an HTTP conflict rather than mislabeling it as a provider error.

# Evidence

tests/sqlite-call-repository.test.ts covers concurrent independent reservations, concurrent duplicate keys, ID collision preservation, rollback recovery, and in-memory parity. tools/api-check.mjs verifies the real local fake-provider API returns HTTP 409 for collisions.
