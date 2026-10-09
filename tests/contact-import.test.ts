import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importContacts, normalizePhone } from "../src/application/contact-import.js";
import type { ConsentRecord } from "../src/domain/consent.js";

const csv = readFileSync("fixtures/synthetic-contacts.csv", "utf8");
const consents = JSON.parse(
  readFileSync("fixtures/synthetic-consent.json", "utf8"),
) as ConsentRecord[];
const now = new Date("2026-10-10T00:00:00Z");

describe("normalizePhone", () => {
  it("converts US numbers to E.164 and rejects malformed ones", () => {
    expect(normalizePhone("(212) 555-0100")).toBe("+12125550100");
    expect(normalizePhone("1-212-555-0100")).toBe("+12125550100");
    expect(normalizePhone("12345")).toBeUndefined();
  });
});

describe("importContacts", () => {
  it("accepts only contacts with active, automated-call consent", () => {
    const result = importContacts(csv, consents, new Set(), now);

    expect(result.accepted.map((c) => c.contactExternalId)).toEqual(["T-001", "T-008", "T-009"]);
  });

  it("gives a reason for every rejected row", () => {
    const result = importContacts(csv, consents, new Set(), now);
    const reasons = Object.fromEntries(
      result.rejected.map((r) => [r.contactExternalId, r.reason]),
    );

    expect(reasons).toEqual({
      "T-002": "NO_ACTIVE_CONSENT",
      "T-003": "NO_ACTIVE_CONSENT",
      "T-004": "NO_ACTIVE_CONSENT",
      "T-005": "NO_ACTIVE_CONSENT",
      "T-006": "DUPLICATE_PHONE",
      "T-007": "INVALID_PHONE",
    });
  });

  it("blocks numbers on the do-not-call list even with consent", () => {
    const dnc = new Set(["+12125550100", "+12125550105"]);
    const result = importContacts(csv, consents, dnc, now);

    expect(result.accepted.map((c) => c.contactExternalId)).toEqual(["T-009"]);
    expect(result.rejected.find((r) => r.contactExternalId === "T-001")?.reason).toBe(
      "DO_NOT_CALL_LIST",
    );
    expect(result.rejected.find((r) => r.contactExternalId === "T-008")?.reason).toBe(
      "DO_NOT_CALL_LIST",
    );
  });

  it("refuses a file without the required columns", () => {
    expect(() => importContacts("name,phone\nx,1", consents, new Set(), now)).toThrow(
      /Missing required CSV column/,
    );
  });
});
