import { describe, expect, it, vi } from "vitest";
import { SalesGodWebhookClient } from "../src/integrations/salesgod/webhook-client.js";

describe("SalesGodWebhookClient", () => {
  it("sends JSON with bearer authentication", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const client = new SalesGodWebhookClient(
      { webhookUrl: "https://example.test/webhook", token: "secret" },
      { fetchImpl },
    );

    await client.send({ event: "test" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/webhook",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer secret",
        },
        body: JSON.stringify({ event: "test" }),
      }),
    );
  });

  it("fails closed on a non-success response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const client = new SalesGodWebhookClient(
      { webhookUrl: "https://example.test/webhook", token: "secret" },
      { fetchImpl },
    );

    await expect(client.send({ event: "test" })).rejects.toThrow("HTTP 401");
  });
});
