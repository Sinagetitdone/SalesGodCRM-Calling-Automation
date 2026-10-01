# Capability Boundaries

## Campaign Management

Owns campaign definition, activation state, instructions version, and scheduling policy.

## Contact Eligibility

Owns the decision that a contact is eligible for a campaign. Unknown eligibility is not eligible.

## Calling Orchestration

Owns normalized call state and transitions between campaign and provider states.

## Conversation Policy

Owns approved scripts, knowledge references, qualification rules, escalation rules, and allowed actions. The provider executes the conversation.

## SalesGodCRM Integration

Owns translation between the normalized provider interface and the SalesGodCRM-supported integration contract.

No SalesGod-specific identifiers or payload structures should leak into unrelated domain modules.

## Outcomes

Owns normalized outcomes such as voicemail, no-answer, interested, not-interested, callback-requested, qualified, appointment-booked, human-follow-up, and do-not-call.

## Audit

Owns append-only evidence of material campaign, eligibility, call, and suppression transitions as required by the final data-retention design.
