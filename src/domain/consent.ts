export interface ConsentRecord {
  readonly contactExternalId: string;
  readonly phoneNumber: string; // E.164, e.g. +12125550100
  readonly consentedAt: string; // ISO 8601
  readonly source: string; // where consent was collected
  readonly method: "WRITTEN" | "ELECTRONIC_SIGNATURE";
  readonly coversAutomatedCalls: boolean;
  readonly revokedAt?: string;
}

export function findActiveConsent(
  records: readonly ConsentRecord[],
  contactExternalId: string,
  phoneNumber: string,
  now: Date = new Date(),
): ConsentRecord | undefined {
  return records.find(
    (record) =>
      record.contactExternalId === contactExternalId &&
      record.phoneNumber === phoneNumber &&
      record.coversAutomatedCalls &&
      record.revokedAt === undefined &&
      Date.parse(record.consentedAt) <= now.getTime(),
  );
}
