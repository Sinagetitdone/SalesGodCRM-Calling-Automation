export interface SalesGodConfig {
  readonly webhookUrl: string;
  readonly token: string;
}

export function loadSalesGodConfig(
  env: Record<string, string | undefined> = process.env,
): SalesGodConfig {
  const webhookUrl = env.SALESGOD_WEBHOOK_URL;
  const token = env.SALESGOD_TOKEN;

  if (!webhookUrl) {
    throw new Error("Missing SALESGOD_WEBHOOK_URL");
  }
  if (!token) {
    throw new Error("Missing SALESGOD_TOKEN");
  }

  return { webhookUrl, token };
}
