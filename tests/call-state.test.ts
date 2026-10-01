import { describe, expect, it } from "vitest";
import { canTransition, transitionCall } from "../src/domain/call-state.js";

describe("call-state transitions", () => {
  it("allows eligibility to become ready", () => {
    expect(transitionCall("PENDING_ELIGIBILITY", "READY")).toBe("READY");
  });

  it("allows an eligible call to be dispatched", () => {
    expect(canTransition("READY", "DISPATCHED")).toBe(true);
  });

  it("rejects stale terminal-state rewrites", () => {
    expect(canTransition("DO_NOT_CALL", "READY")).toBe(false);
    expect(canTransition("COMPLETED", "READY")).toBe(false);
  });

  it("rejects invalid transitions", () => {
    expect(() => transitionCall("READY", "QUALIFIED")).toThrow(
      "Invalid call-state transition",
    );
  });
});
