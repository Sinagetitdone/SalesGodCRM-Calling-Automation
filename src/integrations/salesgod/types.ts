export interface SalesGodCallRequest {
  readonly idempotencyKey: string;
  readonly contactExternalId: string;
  readonly campaignExternalId: string;
}

export interface SalesGodCallResult {
  readonly providerCallId: string;
}

export interface SalesGodProvider {
  initiateCall(request: SalesGodCallRequest): Promise<SalesGodCallResult>;
}
