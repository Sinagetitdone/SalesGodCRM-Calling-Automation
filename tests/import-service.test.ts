import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CallOrchestrator } from "../src/application/call-orchestrator.js";
import { InMemoryCallRepository } from "../src/application/call-repository.js";
import { dispatchImportedContacts } from "../src/application/import-service.js";
import { importContacts } from "../src/application/contact-import.js";
import type { ConsentRecord } from "../src/domain/consent.js";

const csv = readFileSync("fixtures/synthetic-contacts.csv", "utf8");
const consents = JSON.parse(
  readFileSync("fixtures/synthetic-consent.json", "utf8"),
) as ConsentRecord[];
const now = new Date("2026-10-10T00:00:00Z");

function setup() {
  const provider = {
    initiateCall: vi.fn().mockResolvedValue({ providerCallId: "sg-1" }),
  };
  const orchestrator = new CallOrchestrator(new InMemoryCallRepository(), provider);
  return { provider, orchestrator };
}

describe("dispatchImportedContacts", () => {
  it("dispatches only accepted contacts", async () => {
    const { provider, orchestrator } = setup();
    const imported = importContacts(csv, consents, new Set(), now);

    const calls = await dispatchImportedContacts(
      imported,
      { campaignExternalId: "camp-A", withinCallingWindow: true },
      orchestrator,
    );

    expect(calls.map((c) => c.contactExternalId)).toEqual(["T-001", "T-008"]);
    expect(calls.every((c) => c.state === "DISPATCHED")).toBe(true);
    expect(provider.initiateCall).toHaveBeenCalledTimes(2);
  });

  it("does not dial the same contact twice when the import runs again", async () => {
    const { provider, orchestrator } = setup();
    const imported = importContacts(csv, consents, new Set(), now);
    const input = { campaignExternalId: "camp-A", withinCallingWindow: true };

    await dispatchImportedContacts(imported, input, orchestrator);
    const second = await dispatchImportedContacts(imported, input, orchestrator);

    expect(second).toHaveLength(2);
    expect(provider.initiateCall).toHaveBeenCalledTimes(2);
  });

  it("marks calls BLOCKED when the calling window is closed, without dialing", async () => {
    const { provider, orchestrator } = setup();
    const imported = importContacts(csv, consents, new Set(), now);

    const calls = await dispatchImportedContacts(
      imported,
      { campaignExternalId: "camp-B", withinCallingWindow: false },
      orchestrator,
    );

    expect(calls.every((c) => c.state === "BLOCKED")).toBe(true);
    expect(provider.initiateCall).not.toHaveBeenCalled();
  });
});
