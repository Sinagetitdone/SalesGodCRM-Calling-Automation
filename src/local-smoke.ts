import { CallOrchestrator } from "./application/call-orchestrator.js";
import { InMemoryCallRepository } from "./application/call-repository.js";
import type {
  SalesGodCallRequest,
  SalesGodCallResult,
  SalesGodProvider,
} from "./integrations/salesgod/types.js";

class LocalFakeSalesGodProvider implements SalesGodProvider {
  public dispatchCount = 0;

  async initiateCall(
    request: SalesGodCallRequest,
  ): Promise<SalesGodCallResult> {
    this.dispatchCount += 1;

    console.log("\n[FAKE SALESGOD] initiateCall()");
    console.log(request);

    return {
      providerCallId: `local-provider-call-${this.dispatchCount}`,
    };
  }
}

async function main(): Promise<void> {
  const repository = new InMemoryCallRepository();
  const provider = new LocalFakeSalesGodProvider();

  const orchestrator = new CallOrchestrator(
    repository,
    provider,
  );

  console.log("=== SCENARIO 1: ELIGIBLE CALL ===");

  const eligible = await orchestrator.start({
    id: "local-call-1",
    contactExternalId: "synthetic-contact-1",
    campaignExternalId: "synthetic-campaign-1",
    consentConfirmed: true,
    doNotCall: false,
    withinCallingWindow: true,
    idempotencyKey: "local-idem-1",
  });

  console.log("Result:");
  console.log(eligible);

  console.log("\n=== SCENARIO 2: BLOCKED - DO NOT CALL ===");

  const blocked = await orchestrator.start({
    id: "local-call-2",
    contactExternalId: "synthetic-contact-2",
    campaignExternalId: "synthetic-campaign-1",
    consentConfirmed: false,
    doNotCall: true,
    withinCallingWindow: true,
    idempotencyKey: "local-idem-2",
  });

  console.log("Result:");
  console.log(blocked);

  console.log("\n=== SCENARIO 3: DUPLICATE IDEMPOTENCY KEY ===");

  const duplicate = await orchestrator.start({
    id: "different-id-that-should-not-dispatch",
    contactExternalId: "synthetic-contact-999",
    campaignExternalId: "synthetic-campaign-999",
    consentConfirmed: true,
    doNotCall: false,
    withinCallingWindow: true,
    idempotencyKey: "local-idem-1",
  });

  console.log("Result:");
  console.log(duplicate);

  console.log("\n=== SUMMARY ===");
  console.log(`Provider dispatch count: ${provider.dispatchCount}`);

  if (provider.dispatchCount !== 1) {
    throw new Error(
      `Expected exactly 1 provider dispatch, got ${provider.dispatchCount}`,
    );
  }

  if (eligible.state !== "DISPATCHED") {
    throw new Error(
      `Eligible call should be DISPATCHED, got ${eligible.state}`,
    );
  }

  if (blocked.state !== "BLOCKED") {
    throw new Error(
      `Suppressed call should be BLOCKED, got ${blocked.state}`,
    );
  }

  if (duplicate.id !== eligible.id) {
    throw new Error(
      "Duplicate idempotency request should return the original call",
    );
  }

  console.log("\nLOCAL SMOKE TEST PASSED");
}

main().catch((error: unknown) => {
  console.error("\nLOCAL SMOKE TEST FAILED");

  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
