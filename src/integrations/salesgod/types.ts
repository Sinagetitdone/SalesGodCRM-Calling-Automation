import type { CallOutcome } from "../../domain/call-outcome.js";

export interface SalesGodCallRequest {
  readonly idempotencyKey: string;
  readonly contactExternalId: string;
  readonly campaignExternalId: string;
}

export interface SalesGodCallResult {
  readonly providerCallId: string;
  // Only set by providers that report the result synchronously (the demo
  // simulator). A real provider reports outcomes through webhooks.
  readonly outcome?: CallOutcome;
}

export interface SalesGodProvider {
  initiateCall(request: SalesGodCallRequest): Promise<SalesGodCallResult>;
}
