import type { SalesGodConfig } from "../../config.js";

export interface SalesGodWebhookClientOptions {
  readonly fetchImpl?: typeof fetch;
}

export class SalesGodWebhookClient {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: SalesGodConfig,
    options: SalesGodWebhookClientOptions = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Sends a caller-defined payload to the configured SalesGod webhook.
   *
   * The payload schema is intentionally not hard-coded because the supplied
   * endpoint is a webhook URL and no official payload contract was provided.
   */
  async send(payload: Record<string, unknown>): Promise<void> {
    const response = await this.fetchImpl(this.config.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`SalesGod webhook request failed with HTTP ${response.status}`);
    }
  }
}
