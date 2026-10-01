import { evaluateEligibility } from "../domain/eligibility.js";
import { transitionCall, type CallState } from "../domain/call-state.js";
import type { SalesGodProvider } from "../integrations/salesgod/types.js";
import type { CallRecord, CallRepository } from "./call-repository.js";

export interface StartCallInput {
  readonly id: string;
  readonly contactExternalId: string;
  readonly campaignExternalId: string;
  readonly consentConfirmed: boolean;
  readonly doNotCall: boolean;
  readonly withinCallingWindow: boolean;
  readonly idempotencyKey: string;
}

export class CallOrchestrator {
  constructor(
    private readonly repository: CallRepository,
    private readonly provider: SalesGodProvider,
  ) {}

  async start(input: StartCallInput): Promise<CallRecord> {
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    const decision = evaluateEligibility({
      consentConfirmed: input.consentConfirmed,
      doNotCall: input.doNotCall,
      withinCallingWindow: input.withinCallingWindow,
    });

    let state: CallState = "PENDING_ELIGIBILITY";
    state = transitionCall(state, decision.status === "ELIGIBLE" ? "READY" : "BLOCKED");

    const initial: CallRecord = {
      id: input.id,
      contactExternalId: input.contactExternalId,
      campaignExternalId: input.campaignExternalId,
      consentConfirmed: input.consentConfirmed,
      doNotCall: input.doNotCall,
      withinCallingWindow: input.withinCallingWindow,
      state,
    };

    await this.repository.save(initial);

    if (state !== "READY") return initial;

    const result = await this.provider.initiateCall({
      idempotencyKey: input.idempotencyKey,
      contactExternalId: input.contactExternalId,
      campaignExternalId: input.campaignExternalId,
    });

    const dispatched: CallRecord = {
      ...initial,
      state: transitionCall(initial.state, "DISPATCHED"),
      providerCallId: result.providerCallId,
    };

    await this.repository.save(dispatched);
    if ("rememberIdempotencyKey" in this.repository) {
      (this.repository as CallRepository & {
        rememberIdempotencyKey(key: string, id: string): void;
      }).rememberIdempotencyKey(input.idempotencyKey, input.id);
    }

    return dispatched;
  }
}
