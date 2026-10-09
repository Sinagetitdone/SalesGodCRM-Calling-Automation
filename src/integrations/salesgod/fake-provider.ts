import type {
  SalesGodCallRequest,
  SalesGodCallResult,
  SalesGodProvider,
} from "./types.js";

export class FakeSalesGodProvider implements SalesGodProvider {
  async initiateCall(
    request: SalesGodCallRequest,
  ): Promise<SalesGodCallResult> {
    console.log("[FAKE SALESGOD] initiateCall", request);

    return {
      providerCallId: `fake-${request.idempotencyKey}`,
    };
  }
}