# Data Flow

## Target flow

1. Contact enters the system from an approved source.
2. Eligibility is evaluated.
3. Eligible contact is enrolled into a campaign.
4. Campaign orchestration requests a provider call through the SalesGod adapter.
5. SalesGod performs the AI call.
6. Provider events and results are normalized.
7. The normalized outcome updates campaign state.
8. Appointment, callback, DNC, or human-follow-up actions are persisted.
9. Reporting reads normalized state rather than provider-specific payloads.

## Data minimization

Only data required for calling, qualification, appointment handling, auditability, and reporting should be retained.

Retention periods for recordings, transcripts, and consent evidence are unresolved production architecture decisions.
