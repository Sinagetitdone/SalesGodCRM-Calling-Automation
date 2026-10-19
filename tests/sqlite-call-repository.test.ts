import { afterEach, describe, expect, it, vi } from "vitest";
import { CallOrchestrator } from "../src/application/call-orchestrator.js";
import { CallIdConflictError, InMemoryCallRepository } from "../src/application/call-repository.js";
import { SQLiteCallRepository } from "../src/application/sqlite-call-repository.js";

const databases: SQLiteCallRepository[] = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });
function setup() {
  const repository = new SQLiteCallRepository(":memory:"); databases.push(repository);
  const provider = { initiateCall: vi.fn(async () => ({ providerCallId: "synthetic-provider-id" })) };
  return { repository, provider, orchestrator: new CallOrchestrator(repository, provider) };
}
const input = {
  id: "synthetic-call", contactExternalId: "synthetic-contact", campaignExternalId: "synthetic-campaign",
  doNotCall: false, withinCallingWindow: true, idempotencyKey: "synthetic-key",
};
describe("SQLite request isolation", () => {
  it("allows concurrent independent requests on one database connection", async () => {
    const { repository, provider, orchestrator } = setup();
    const calls = await Promise.all(Array.from({ length: 12 }, (_, i) => orchestrator.start({ ...input, id: `call-${i}`, idempotencyKey: `key-${i}` })));
    expect(calls.every(call => call.state === "DISPATCHED")).toBe(true);
    expect(provider.initiateCall).toHaveBeenCalledTimes(12);
    expect((await repository.get("call-11"))?.providerCallId).toBe("synthetic-provider-id");
  });
  it("reserves a duplicate key once under concurrent requests", async () => {
    const { provider, orchestrator } = setup();
    const calls = await Promise.all(Array.from({ length: 8 }, () => orchestrator.start(input)));
    expect(calls.every(call => call.id === input.id)).toBe(true);
    expect(provider.initiateCall).toHaveBeenCalledOnce();
  });
  it("rejects a reused call ID and preserves both original data and key ownership", async () => {
    const { repository, provider, orchestrator } = setup();
    await orchestrator.start(input);
    await expect(orchestrator.start({ ...input, contactExternalId: "other-contact", idempotencyKey: "other-key" })).rejects.toBeInstanceOf(CallIdConflictError);
    expect((await repository.findByIdempotencyKey(input.idempotencyKey))?.contactExternalId).toBe(input.contactExternalId);
    expect(await repository.findByIdempotencyKey("other-key")).toBeUndefined();
    expect(provider.initiateCall).toHaveBeenCalledOnce();
    // The failed reservation rolled back cleanly; a subsequent request still works.
    expect((await orchestrator.start({ ...input, id: "new-call", idempotencyKey: "new-key" })).state).toBe("DISPATCHED");
  });
  it("applies the same call-ID collision rule in the in-memory repository", async () => {
    const repository = new InMemoryCallRepository();
    const provider = { initiateCall: vi.fn(async () => ({ providerCallId: "synthetic-provider-id" })) };
    const orchestrator = new CallOrchestrator(repository, provider);
    await orchestrator.start(input);
    await expect(orchestrator.start({ ...input, idempotencyKey: "other-key" })).rejects.toBeInstanceOf(CallIdConflictError);
    expect(provider.initiateCall).toHaveBeenCalledOnce();
  });
});
