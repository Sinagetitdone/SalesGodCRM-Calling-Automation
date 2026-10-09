import type { CallOutcome } from "../../domain/call-outcome.js";
import type {
  SalesGodCallRequest,
  SalesGodCallResult,
  SalesGodProvider,
} from "./types.js";

// Demo provider: places no calls. Outcomes are simulated and deterministic per
// contact id, so the same contact always gets the same simulated result.
export class FakeSalesGodProvider implements SalesGodProvider {
  async initiateCall(
    request: SalesGodCallRequest,
  ): Promise<SalesGodCallResult> {
    console.log("[FAKE SALESGOD] initiateCall", request);

    return {
      providerCallId: `fake-${request.idempotencyKey}`,
      outcome: simulateOutcome(request.contactExternalId),
    };
  }
}

export function simulateOutcome(contactExternalId: string): CallOutcome {
  const sum = [...contactExternalId].reduce((total, char) => total + char.charCodeAt(0), 0);
  return sum % 3 === 0 ? "VOICEMAIL" : "ANSWERED";
}
