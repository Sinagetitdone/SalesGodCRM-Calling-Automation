export type EligibilityDecision =
  | { status: "ELIGIBLE"; reason: string }
  | { status: "BLOCKED"; reason: string };

export interface EligibilityInput {
  consentConfirmed: boolean;
  doNotCall: boolean;
  withinCallingWindow: boolean;
}

export function evaluateEligibility(input: EligibilityInput): EligibilityDecision {
  if (input.doNotCall) {
    return { status: "BLOCKED", reason: "DO_NOT_CALL" };
  }

  if (!input.consentConfirmed) {
    return { status: "BLOCKED", reason: "CONSENT_NOT_CONFIRMED" };
  }

  if (!input.withinCallingWindow) {
    return { status: "BLOCKED", reason: "OUTSIDE_CALLING_WINDOW" };
  }

  return { status: "ELIGIBLE", reason: "ALL_REQUIRED_GATES_PASSED" };
}
