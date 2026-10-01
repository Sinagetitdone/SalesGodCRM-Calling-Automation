import { describe, expect, it } from "vitest";
import { verifyBearerToken } from "../src/integrations/salesgod/webhook-auth.js";

describe("verifyBearerToken", () => {
  it("accepts the exact configured bearer token", () => {
    expect(verifyBearerToken("Bearer secret", "secret")).toBe(true);
  });

  it("rejects missing, malformed, or incorrect credentials", () => {
    expect(verifyBearerToken(undefined, "secret")).toBe(false);
    expect(verifyBearerToken("Basic secret", "secret")).toBe(false);
    expect(verifyBearerToken("Bearer wrong", "secret")).toBe(false);
  });
});
