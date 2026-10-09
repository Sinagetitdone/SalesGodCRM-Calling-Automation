import type { CallOrchestrator } from "./call-orchestrator.js";
import type { CallRecord } from "./call-repository.js";
import type { ImportResult } from "./contact-import.js";

export interface DispatchImportInput {
  readonly campaignExternalId: string;
  readonly withinCallingWindow: boolean;
}

// Only contacts that passed import checks reach the orchestrator. The import
// has already verified consent and the do-not-call list, so consent is passed
// through as confirmed. The call key is per campaign and contact, so importing
// the same contact again returns the existing call instead of dialing twice.
export async function dispatchImportedContacts(
  imported: ImportResult,
  input: DispatchImportInput,
  orchestrator: CallOrchestrator,
): Promise<CallRecord[]> {
  const calls: CallRecord[] = [];

  for (const contact of imported.accepted) {
    const key = `${input.campaignExternalId}:${contact.contactExternalId}`;

    const call = await orchestrator.start({
      id: key,
      contactExternalId: contact.contactExternalId,
      campaignExternalId: input.campaignExternalId,
      consentConfirmed: true,
      doNotCall: false,
      withinCallingWindow: input.withinCallingWindow,
      idempotencyKey: key,
    });

    calls.push(call);
  }

  return calls;
}
