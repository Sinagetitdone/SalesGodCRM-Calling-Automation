export const callStates = [
  "PENDING_ELIGIBILITY",
  "BLOCKED",
  "READY",
  "DISPATCHED",
  "RINGING",
  "HUMAN_CONNECTED",
  "VOICEMAIL",
  "NO_ANSWER",
  "IN_CONVERSATION",
  "CALLBACK_REQUESTED",
  "QUALIFIED",
  "NOT_INTERESTED",
  "APPOINTMENT_BOOKED",
  "HUMAN_FOLLOW_UP",
  "DO_NOT_CALL",
  "COMPLETED",
  "FAILED",
] as const;

export type CallState = (typeof callStates)[number];

const transitions: Record<CallState, readonly CallState[]> = {
  PENDING_ELIGIBILITY: ["BLOCKED", "READY"],
  BLOCKED: [],
  READY: ["DISPATCHED", "DO_NOT_CALL"],
  DISPATCHED: ["RINGING", "VOICEMAIL", "NO_ANSWER", "FAILED"],
  RINGING: ["HUMAN_CONNECTED", "VOICEMAIL", "NO_ANSWER", "FAILED"],
  HUMAN_CONNECTED: ["IN_CONVERSATION", "DO_NOT_CALL", "FAILED"],
  VOICEMAIL: ["COMPLETED"],
  NO_ANSWER: ["COMPLETED", "READY"],
  IN_CONVERSATION: [
    "CALLBACK_REQUESTED",
    "QUALIFIED",
    "NOT_INTERESTED",
    "APPOINTMENT_BOOKED",
    "HUMAN_FOLLOW_UP",
    "DO_NOT_CALL",
    "COMPLETED",
    "FAILED",
  ],
  CALLBACK_REQUESTED: ["COMPLETED", "READY"],
  QUALIFIED: ["APPOINTMENT_BOOKED", "HUMAN_FOLLOW_UP", "COMPLETED"],
  NOT_INTERESTED: ["COMPLETED"],
  APPOINTMENT_BOOKED: ["COMPLETED"],
  HUMAN_FOLLOW_UP: ["COMPLETED"],
  DO_NOT_CALL: [],
  COMPLETED: [],
  FAILED: [],
};

export function canTransition(from: CallState, to: CallState): boolean {
  return transitions[from].includes(to);
}

export function transitionCall(from: CallState, to: CallState): CallState {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid call-state transition: ${from} -> ${to}`);
  }
  return to;
}
