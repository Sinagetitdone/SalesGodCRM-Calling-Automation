export type EligibilityDecision =
  | { status: "ELIGIBLE"; reason: string }
  | { status: "BLOCKED"; reason: string };

export interface EligibilityInput {
  /** Legacy metadata only; imported lists are authorized at campaign level. */
  consentConfirmed?: boolean;
  doNotCall: boolean;
  withinCallingWindow: boolean;
}

export function evaluateEligibility(input: EligibilityInput): EligibilityDecision {
  if (input.doNotCall) {
    return { status: "BLOCKED", reason: "DO_NOT_CALL" };
  }

  if (!input.withinCallingWindow) {
    return { status: "BLOCKED", reason: "OUTSIDE_CALLING_WINDOW" };
  }

  return { status: "ELIGIBLE", reason: "ALL_REQUIRED_GATES_PASSED" };
}
