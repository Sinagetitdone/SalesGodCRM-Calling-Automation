import { describe, expect, it } from "vitest";
import { evaluateEligibility } from "../src/domain/eligibility.js";

describe("eligibility", () => {
  it("blocks do-not-call contacts", () => {
    expect(
      evaluateEligibility({
        consentConfirmed: true,
        doNotCall: true,
        withinCallingWindow: true,
      }),
    ).toEqual({ status: "BLOCKED", reason: "DO_NOT_CALL" });
  });

  it("blocks contacts without confirmed consent", () => {
    expect(
      evaluateEligibility({
        consentConfirmed: false,
        doNotCall: false,
        withinCallingWindow: true,
      }),
    ).toEqual({ status: "BLOCKED", reason: "CONSENT_NOT_CONFIRMED" });
  });

  it("blocks outside the configured calling window", () => {
    expect(
      evaluateEligibility({
        consentConfirmed: true,
        doNotCall: false,
        withinCallingWindow: false,
      }),
    ).toEqual({ status: "BLOCKED", reason: "OUTSIDE_CALLING_WINDOW" });
  });

  it("allows only contacts passing every gate", () => {
    expect(
      evaluateEligibility({
        consentConfirmed: true,
        doNotCall: false,
        withinCallingWindow: true,
      }),
    ).toEqual({ status: "ELIGIBLE", reason: "ALL_REQUIRED_GATES_PASSED" });
  });
});
