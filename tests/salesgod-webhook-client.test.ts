import { describe, expect, it, vi } from "vitest";
import { SalesGodWebhookClient } from "../src/integrations/salesgod/webhook-client.js";

describe("SalesGodWebhookClient", () => {
  const config = {
    webhookUrl: "https://example.test/webhook",
    token: "secret",
    tokenHeader: "x-api-key",
    tokenPrefix: "",
  };

  it("sends JSON using the configured authentication header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const client = new SalesGodWebhookClient(config, { fetchImpl });

    await client.send({ event: "test" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/webhook",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": "secret",
        },
        body: JSON.stringify({ event: "test" }),
      }),
    );
  });

  it("fails closed on a non-success response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const client = new SalesGodWebhookClient(config, { fetchImpl });

    await expect(client.send({ event: "test" })).rejects.toThrow("HTTP 401");
  });
});
