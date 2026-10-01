import type { CallState } from "../domain/call-state.js";

export interface CallRecord {
  readonly id: string;
  readonly contactExternalId: string;
  readonly campaignExternalId: string;
  readonly consentConfirmed: boolean;
  readonly doNotCall: boolean;
  readonly withinCallingWindow: boolean;
  readonly state: CallState;
  readonly providerCallId?: string;
}

export interface CallRepository {
  get(id: string): Promise<CallRecord | undefined>;
  save(call: CallRecord): Promise<void>;
  findByIdempotencyKey(idempotencyKey: string): Promise<CallRecord | undefined>;
}

export class InMemoryCallRepository implements CallRepository {
  private readonly calls = new Map<string, CallRecord>();
  private readonly idempotency = new Map<string, string>();

  async get(id: string): Promise<CallRecord | undefined> {
    return this.calls.get(id);
  }

  async save(call: CallRecord): Promise<void> {
    this.calls.set(call.id, call);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<CallRecord | undefined> {
    const id = this.idempotency.get(idempotencyKey);
    return id ? this.calls.get(id) : undefined;
  }

  rememberIdempotencyKey(idempotencyKey: string, callId: string): void {
    this.idempotency.set(idempotencyKey, callId);
  }
}
