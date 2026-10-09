import { CallOrchestrator } from "./application/call-orchestrator.js";
import { InMemoryCallRepository } from "./application/call-repository.js";
import type {
  SalesGodCallRequest,
  SalesGodCallResult,
  SalesGodProvider,
} from "./integrations/salesgod/types.js";

class FailingProvider implements SalesGodProvider {
  async initiateCall(
    _request: SalesGodCallRequest,
  ): Promise<SalesGodCallResult> {
    throw new Error("Simulated provider outage");
  }
}

class SlowProvider implements SalesGodProvider {
  public dispatchCount = 0;

  async initiateCall(
    _request: SalesGodCallRequest,
  ): Promise<SalesGodCallResult> {
    this.dispatchCount += 1;

    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      providerCallId: `slow-provider-${this.dispatchCount}`,
    };
  }
}

async function testProviderFailure(): Promise<void> {
  console.log("\n=== TEST 1: PROVIDER FAILURE ===");

  const repository = new InMemoryCallRepository();
  const orchestrator = new CallOrchestrator(
    repository,
    new FailingProvider(),
  );

  try {
    await orchestrator.start({
      id: "failure-call-1",
      contactExternalId: "contact-failure",
      campaignExternalId: "campaign-1",
      consentConfirmed: true,
      doNotCall: false,
      withinCallingWindow: true,
      idempotencyKey: "failure-idem-1",
    });
  } catch (error) {
    console.log(
      "Provider error:",
      error instanceof Error ? error.message : error,
    );
  }

  const stored = await repository.get("failure-call-1");

  console.log("Stored record after failure:");
  console.log(stored);

  if (!stored) {
    throw new Error("Expected call to exist in repository");
  }

  console.log(
    `OBSERVATION: call remains in state ${stored.state} after provider failure`,
  );
}

async function testConcurrentIdempotency(): Promise<void> {
  console.log("\n=== TEST 2: CONCURRENT IDEMPOTENCY ===");

  const repository = new InMemoryCallRepository();
  const provider = new SlowProvider();

  const orchestrator = new CallOrchestrator(
    repository,
    provider,
  );

  const input = {
    id: "concurrent-call-1",
    contactExternalId: "contact-concurrent",
    campaignExternalId: "campaign-1",
    consentConfirmed: true,
    doNotCall: false,
    withinCallingWindow: true,
    idempotencyKey: "concurrent-idem-1",
  };

  const results = await Promise.all([
    orchestrator.start(input),
    orchestrator.start(input),
  ]);

  console.log("Results:");
  console.log(results);

  console.log(
    `Provider dispatch count: ${provider.dispatchCount}`,
  );

  if (provider.dispatchCount > 1) {
    console.log(
      "BUG CONFIRMED: same idempotency key dispatched more than once concurrently",
    );
  } else {
    console.log(
      "Concurrent idempotency behaved correctly",
    );
  }
}

async function main(): Promise<void> {
  await testProviderFailure();
  await testConcurrentIdempotency();
}

main().catch((error: unknown) => {
  console.error("\nFAILURE SMOKE TEST ERROR");

  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});