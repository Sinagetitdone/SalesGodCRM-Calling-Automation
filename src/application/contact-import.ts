import { findActiveConsent, type ConsentRecord } from "../domain/consent.js";

export interface ContactRow {
  readonly contactExternalId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber: string;
}

export interface RejectedRow {
  readonly line: number;
  readonly contactExternalId: string;
  readonly reason: string;
}

export interface ImportResult {
  readonly accepted: ContactRow[];
  readonly rejected: RejectedRow[];
}

const REQUIRED_HEADERS = ["contact_id", "first_name", "last_name", "phone"];

export function normalizePhone(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  return undefined;
}

// Minimal CSV reader: comma-separated, optional double quotes, no embedded newlines.
export function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const fields: string[] = [];
      let current = "";
      let quoted = false;

      for (const char of line) {
        if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) {
          fields.push(current.trim());
          current = "";
        } else current += char;
      }

      fields.push(current.trim());
      return fields;
    });
}

export function importContacts(
  csvText: string,
  consents: readonly ConsentRecord[],
  doNotCallPhones: ReadonlySet<string> = new Set(),
  now: Date = new Date(),
): ImportResult {
  const [headerRow, ...dataRows] = parseCsv(csvText);
  const headers = headerRow ?? [];

  for (const header of REQUIRED_HEADERS) {
    if (!headers.includes(header)) {
      throw new Error(`Missing required CSV column: ${header}`);
    }
  }

  const column = (name: string, row: string[]) => row[headers.indexOf(name)] ?? "";

  const accepted: ContactRow[] = [];
  const rejected: RejectedRow[] = [];
  const seenPhones = new Set<string>();
  const seenContactIds = new Set<string>();

  dataRows.forEach((row, index) => {
    const line = index + 2; // header is line 1
    const contactExternalId = column("contact_id", row);

    if (!contactExternalId) {
      rejected.push({ line, contactExternalId, reason: "MISSING_CONTACT_ID" });
      return;
    }

    if (seenContactIds.has(contactExternalId)) {
      rejected.push({ line, contactExternalId, reason: "DUPLICATE_CONTACT_ID" });
      return;
    }
    seenContactIds.add(contactExternalId);

    const phoneNumber = normalizePhone(column("phone", row));
    if (!phoneNumber) {
      rejected.push({ line, contactExternalId, reason: "INVALID_PHONE" });
      return;
    }

    if (seenPhones.has(phoneNumber)) {
      rejected.push({ line, contactExternalId, reason: "DUPLICATE_PHONE" });
      return;
    }
    seenPhones.add(phoneNumber);

    if (doNotCallPhones.has(phoneNumber)) {
      rejected.push({ line, contactExternalId, reason: "DO_NOT_CALL_LIST" });
      return;
    }

    if (!findActiveConsent(consents, contactExternalId, phoneNumber, now)) {
      rejected.push({ line, contactExternalId, reason: "NO_ACTIVE_CONSENT" });
      return;
    }

    accepted.push({
      contactExternalId,
      firstName: column("first_name", row),
      lastName: column("last_name", row),
      phoneNumber,
    });
  });

  return { accepted, rejected };
}
