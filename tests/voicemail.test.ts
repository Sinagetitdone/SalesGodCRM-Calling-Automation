import { describe, expect, it } from "vitest";
import { createVoicemailMessage } from "../src/domain/voicemail.js";

describe("voicemail messages", () => {
  it("creates a versioned message", () => {
    expect(createVoicemailMessage("v1", "Please call me back.")).toEqual({
      version: "v1",
      text: "Please call me back.",
    });
  });

  it("rejects an empty message", () => {
    expect(() => createVoicemailMessage("v1", "   ")).toThrow(
      "Voicemail text is required",
    );
  });
});
