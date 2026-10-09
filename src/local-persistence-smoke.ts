import { rmSync } from "node:fs";

import { CallOrchestrator } from "./application/call-orchestrator.js";
import { SQLiteCallRepository } from "./application/sqlite-call-repository.js";
import type {
  SalesGodCallRequest,
  SalesGodCallResult,
  SalesGodProvider,
} from "./integrations/salesgod/types.js";

const databasePath = "data/local-smoke.db";

class FakeProvider implements SalesGodProvider {
  public dispatchCount = 0;

  async initiateCall(
    _request: SalesGodCallRequest,
  ): Promise<SalesGodCallResult> {
    this.dispatchCount += 1;

    return {
      providerCallId: `persistent-call-${this.dispatchCount}`,
    };
  }
}

async function main(): Promise<void> {
  rmSync(databasePath, {
    force: true,
  });

  const provider = new FakeProvider();

  console.log("=== FIRST PROCESS-LIKE SESSION ===");

  const firstRepository =
    new SQLiteCallRepository(databasePath);

  const firstOrchestrator = new CallOrchestrator(
    firstRepository,
    provider,
  );

  const firstResult = await firstOrchestrator.start({
    id: "persistent-call-1",
    contactExternalId: "persistent-contact-1",
    campaignExternalId: "persistent-campaign-1",
    consentConfirmed: true,
    doNotCall: false,
    withinCallingWindow: true,
    idempotencyKey: "persistent-idem-1",
  });

  console.log(firstResult);

  firstRepository.close();

  console.log("\n=== SECOND PROCESS-LIKE SESSION ===");

  const secondRepository =
    new SQLiteCallRepository(databasePath);

  const secondOrchestrator = new CallOrchestrator(
    secondRepository,
    provider,
  );

  const secondResult = await secondOrchestrator.start({
    id: "this-id-should-not-be-used",
    contactExternalId: "different-contact",
    campaignExternalId: "different-campaign",
    consentConfirmed: true,
    doNotCall: false,
    withinCallingWindow: true,
    idempotencyKey: "persistent-idem-1",
  });

  console.log(secondResult);

  console.log(
    `\nProvider dispatch count: ${provider.dispatchCount}`,
  );

  if (provider.dispatchCount !== 1) {
    throw new Error(
      `Expected one provider dispatch across restart, got ${provider.dispatchCount}`,
    );
  }

  if (secondResult.id !== firstResult.id) {
    throw new Error(
      "Expected persisted idempotency key to return the original call",
    );
  }

  secondRepository.close();

  console.log(
    "\nPERSISTENCE SMOKE TEST PASSED",
  );
}

main().catch((error: unknown) => {
  console.error(
    "\nPERSISTENCE SMOKE TEST FAILED",
  );

  console.error(error);

  process.exitCode = 1;
});