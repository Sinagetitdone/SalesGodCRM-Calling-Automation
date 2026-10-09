import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CallOrchestrator } from "../src/application/call-orchestrator.js";
import { InMemoryCallRepository } from "../src/application/call-repository.js";
import { importContacts } from "../src/application/contact-import.js";
import { SQLiteCallRepository } from "../src/application/sqlite-call-repository.js";
import { followUpFor } from "../src/domain/call-outcome.js";
import type { ConsentRecord } from "../src/domain/consent.js";
import { nextTurn, openingTurn } from "../src/domain/conversation.js";
import { VOICEMAIL_SCRIPT } from "../src/domain/voicemail-script.js";
import { simulateOutcome } from "../src/integrations/salesgod/fake-provider.js";

describe("followUpFor", () => {
  it("starts an AI conversation when the call is answered", () => {
    expect(followUpFor({ state: "DISPATCHED", outcome: "ANSWERED" })).toEqual({
      action: "AI_CONVERSATION",
    });
  });

  it("leaves the voicemail script when the call goes to voicemail", () => {
    const followUp = followUpFor({ state: "DISPATCHED", outcome: "VOICEMAIL" });

    expect(followUp).toEqual({
      action: "LEAVE_VOICEMAIL",
      voicemailVersion: "v1",
      text: VOICEMAIL_SCRIPT.text,
    });
    expect(VOICEMAIL_SCRIPT.text.startsWith("Hi, this is Ava.")).toBe(true);
    expect(VOICEMAIL_SCRIPT.text).toContain("760-205-8290");
  });

  it("has no follow-up for calls that were blocked", () => {
    expect(followUpFor({ state: "BLOCKED" })).toEqual({ action: "NONE" });
  });
});

describe("simulateOutcome", () => {
  it("is deterministic for the same contact and produces both outcomes", () => {
    const ids = ["T-001", "T-002", "T-003", "T-004", "T-005", "T-006"];
    const first = ids.map(simulateOutcome);

    expect(ids.map(simulateOutcome)).toEqual(first);
    expect(new Set(first)).toEqual(new Set(["ANSWERED", "VOICEMAIL"]));
  });
});

describe("nextTurn", () => {
  it("opens the conversation by saying it is automated", () => {
    expect(openingTurn().reply).toContain("automated assistant");
  });

  it("offers an introduction call when the person is interested", () => {
    const turn = nextTurn("GREETING", "Yes, tell me more");

    expect(turn.stage).toBe("SCHEDULING");
    expect(turn.optedOut).toBe(false);
  });

  it("opts out on stop, whatever the stage", () => {
    for (const stage of ["GREETING", "SCHEDULING", "DONE"] as const) {
      const turn = nextTurn(stage, "Please stop calling me");

      expect(turn.optedOut).toBe(true);
      expect(turn.stage).toBe("OPTED_OUT");
    }
  });

  it("does not treat 'not interested' as interest", () => {
    const turn = nextTurn("GREETING", "Not interested, yes");

    expect(turn.optedOut).toBe(true);
  });

  it("keeps asking when the reply is unclear", () => {
    const turn = nextTurn("GREETING", "hmm maybe later?");

    expect(turn.stage).toBe("GREETING");
    expect(turn.reply).toContain("say stop to opt out");
  });

  it("sends nothing further after an opt-out", () => {
    expect(nextTurn("OPTED_OUT", "yes").optedOut).toBe(true);
  });
});

describe("importContacts row checks added for arbitrary data", () => {
  const consent: ConsentRecord[] = [
    {
      contactExternalId: "A",
      phoneNumber: "+12125550100",
      consentedAt: "2026-01-01T00:00:00Z",
      source: "test",
      method: "WRITTEN",
      coversAutomatedCalls: true,
    },
  ];
  const now = new Date("2026-10-10T00:00:00Z");

  it("rejects a row with no contact id", () => {
    const csv = "contact_id,first_name,last_name,phone\n,No,Id,(212) 555-0100";
    const result = importContacts(csv, consent, new Set(), now);

    expect(result.rejected[0]?.reason).toBe("MISSING_CONTACT_ID");
  });

  it("rejects a repeated contact id so it is not silently merged", () => {
    const csv = [
      "contact_id,first_name,last_name,phone",
      "A,One,Test,(212) 555-0100",
      "A,Two,Test,(212) 555-0101",
    ].join("\n");
    const result = importContacts(csv, consent, new Set(), now);

    expect(result.accepted.map((c) => c.contactExternalId)).toEqual(["A"]);
    expect(result.rejected[0]?.reason).toBe("DUPLICATE_CONTACT_ID");
  });
});

describe("outcome storage", () => {
  it("passes the provider outcome through to the saved call", async () => {
    const provider = {
      initiateCall: vi.fn().mockResolvedValue({
        providerCallId: "p-1",
        outcome: "VOICEMAIL",
      }),
    };
    const orchestrator = new CallOrchestrator(new InMemoryCallRepository(), provider);

    const call = await orchestrator.start({
      id: "c-1",
      contactExternalId: "T-001",
      campaignExternalId: "camp",
      consentConfirmed: true,
      doNotCall: false,
      withinCallingWindow: true,
      idempotencyKey: "k-1",
    });

    expect(call.outcome).toBe("VOICEMAIL");
  });

  it("stores outcomes and do-not-call numbers in SQLite", async () => {
    const repo = new SQLiteCallRepository(":memory:");

    await repo.save({
      id: "c-1",
      contactExternalId: "T-001",
      campaignExternalId: "camp",
      consentConfirmed: true,
      doNotCall: false,
      withinCallingWindow: true,
      state: "DISPATCHED",
      providerCallId: "p-1",
      outcome: "ANSWERED",
    });
    await repo.addDoNotCall("+12125550100");
    await repo.addDoNotCall("+12125550100");

    expect((await repo.get("c-1"))?.outcome).toBe("ANSWERED");
    expect(await repo.listDoNotCall()).toEqual(["+12125550100"]);
    repo.close();
  });
});

// Keeps the fixture import test honest: the synthetic consent file must still parse.
describe("fixtures", () => {
  it("synthetic consent file is valid JSON", () => {
    const records = JSON.parse(readFileSync("fixtures/synthetic-consent.json", "utf8"));
    expect(Array.isArray(records)).toBe(true);
  });
});
