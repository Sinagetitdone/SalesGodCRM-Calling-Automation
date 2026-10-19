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
      doNotCall: true,
      withinCallingWindow: true,
      idempotencyKey: "idem-1",
    });

    expect(result.state).toBe("BLOCKED");
    expect(salesGod.initiateCall).not.toHaveBeenCalled();
  });

  it("dispatches a pre-authorized call without a consent field and persists the provider call id", async () => {
    const repo = new InMemoryCallRepository();
    const salesGod = provider();
    const orchestrator = new CallOrchestrator(repo, salesGod);

    const result = await orchestrator.start({
      id: "call-2",
      contactExternalId: "contact-2",
      campaignExternalId: "campaign-2",
      doNotCall: false,
      withinCallingWindow: true,
      idempotencyKey: "idem-2",
    });

    expect(result.state).toBe("DISPATCHED");
    expect(result.providerCallId).toBe("sg-call-1");
    expect(result.consentConfirmed).toBe(false);
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

  it("marks a call as failed when the provider dispatch fails", async () => {
    const repo = new InMemoryCallRepository();

    const salesGod: SalesGodProvider = {
      initiateCall: vi.fn().mockRejectedValue(
        new Error("provider unavailable"),
      ),
    };

    const orchestrator = new CallOrchestrator(repo, salesGod);

    await expect(
      orchestrator.start({
        id: "call-failure",
        contactExternalId: "contact-failure",
        campaignExternalId: "campaign-1",
        consentConfirmed: true,
        doNotCall: false,
        withinCallingWindow: true,
        idempotencyKey: "idem-failure",
      }),
    ).rejects.toThrow("provider unavailable");

    const stored = await repo.get("call-failure");

    expect(stored?.state).toBe("FAILED");
  });

  it("does not concurrently dispatch the same idempotency key twice", async () => {
    const repo = new InMemoryCallRepository();

    let dispatchCount = 0;

    const salesGod: SalesGodProvider = {
      initiateCall: vi.fn().mockImplementation(async () => {
        dispatchCount += 1;

        await new Promise((resolve) => setTimeout(resolve, 50));

        return {
          providerCallId: "sg-concurrent-call",
        };
      }),
    };

    const orchestrator = new CallOrchestrator(repo, salesGod);

    const input = {
      id: "call-concurrent",
      contactExternalId: "contact-concurrent",
      campaignExternalId: "campaign-1",
      consentConfirmed: true,
      doNotCall: false,
      withinCallingWindow: true,
      idempotencyKey: "idem-concurrent",
    };

    await Promise.all([
      orchestrator.start(input),
      orchestrator.start(input),
    ]);

    expect(dispatchCount).toBe(1);
    expect(salesGod.initiateCall).toHaveBeenCalledOnce();
  });
});
