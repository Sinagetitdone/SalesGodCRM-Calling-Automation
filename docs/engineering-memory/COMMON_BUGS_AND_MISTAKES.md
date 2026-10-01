# Common Bugs and Mistakes

## BUG-PATTERN-001 — Treating a webhook URL as an API contract

Failure mode: Implementing a guessed request schema or authentication scheme from an endpoint URL alone.

Prevention: Keep provider-specific behavior behind an adapter and record the exact verified contract before production use.

Regression control: Contract tests must assert the documented provider request/response/event shapes once available.
