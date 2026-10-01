import { describe, expect, it, vi } from "vitest";
import { CallOrchestrator } from "../src/application/call-orchestrator.js";
import { InMemoryCallRepository } from "../src/application/call-repository.js";
import type { SalesGodProvider } from "../src/integrations/salesgod/types.js";

function provider(): SalesGodProvider {
  return {
    initiateCall: vi.fn().mockResolvedValue({ providerCallId: "sg-call-1" }),
  };
}

describe("CallOrchestrator", () => {
  it("blocks calls that fail eligibility before invoking SalesGod", async () => {
    const repo = new InMemoryCallRepository();
    const salesGod = provider();
    const orchestrator = new CallOrchestrator(repo, salesGod);

    const result = await orchestrator.start({
      id: "call-1",
      contactExternalId: "contact-1",
      campaignExternalId: "campaign-1",
      consentConfirmed: false,
      doNotCall: false,
      withinCallingWindow: true,
      idempotencyKey: "idem-1",
    });

    expect(result.state).toBe("BLOCKED");
    expect(salesGod.initiateCall).not.toHaveBeenCalled();
  });

  it("dispatches an eligible call and persists the provider call id", async () => {
    const repo = new InMemoryCallRepository();
    const salesGod = provider();
    const orchestrator = new CallOrchestrator(repo, salesGod);

    const result = await orchestrator.start({
      id: "call-2",
      contactExternalId: "contact-2",
      campaignExternalId: "campaign-2",
      consentConfirmed: true,
      doNotCall: false,
      withinCallingWindow: true,
      idempotencyKey: "idem-2",
    });

    expect(result.state).toBe("DISPATCHED");
    expect(result.providerCallId).toBe("sg-call-1");
    expect(salesGod.initiateCall).toHaveBeenCalledOnce();
  });

  it("does not dispatch the same idempotency key twice", async () => {
    const repo = new InMemoryCallRepository();
    const salesGod = provider();
    const orchestrator = new CallOrchestrator(repo, salesGod);

    const input = {
      id: "call-3",
      contactExternalId: "contact-3",
      campaignExternalId: "campaign-3",
      consentConfirmed: true,
      doNotCall: false,
      withinCallingWindow: true,
      idempotencyKey: "idem-3",
    };

    await orchestrator.start(input);
    await orchestrator.start(input);

    expect(salesGod.initiateCall).toHaveBeenCalledOnce();
  });
});
