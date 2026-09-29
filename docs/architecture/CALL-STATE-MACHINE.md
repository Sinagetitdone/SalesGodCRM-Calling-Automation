# Call State Machine

## Purpose

Keep calling behavior deterministic at the orchestration boundary while allowing the provider AI to conduct natural-language conversation.

## Proposed normalized states

- PENDING_ELIGIBILITY
- BLOCKED
- READY
- DISPATCHED
- RINGING
- HUMAN_CONNECTED
- VOICEMAIL
- NO_ANSWER
- IN_CONVERSATION
- CALLBACK_REQUESTED
- QUALIFIED
- NOT_INTERESTED
- APPOINTMENT_BOOKED
- HUMAN_FOLLOW_UP
- DO_NOT_CALL
- COMPLETED
- FAILED

## Transition principles

- Unknown eligibility -> BLOCKED.
- DO_NOT_CALL is terminal for campaign outreach unless a new valid consent event is recorded.
- Provider retries must be idempotent.
- A provider event must not move a call backward into an invalid state.
- Terminal states must not be overwritten by stale asynchronous events.
- Provider-specific statuses are translated into normalized states at the adapter boundary.

The exact transition matrix must be implemented and tested after the provider event contract is known.
