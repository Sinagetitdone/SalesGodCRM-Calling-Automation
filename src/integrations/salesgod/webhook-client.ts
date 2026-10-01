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

  async send(payload: Record<string, unknown>): Promise<void> {
    const response = await this.fetchImpl(this.config.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [this.config.tokenHeader]: `${this.config.tokenPrefix}${this.config.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`SalesGod webhook request failed with HTTP ${response.status}`);
    }
  }
}
