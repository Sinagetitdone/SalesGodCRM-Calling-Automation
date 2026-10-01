export interface SalesGodConfig {
  readonly webhookUrl: string;
  readonly token: string;
  readonly tokenHeader: string;
  readonly tokenPrefix: string;
}

export function loadSalesGodConfig(
  env: Record<string, string | undefined> = process.env,
): SalesGodConfig {
  const webhookUrl = env.SALESGOD_WEBHOOK_URL;
  const token = env.SALESGOD_TOKEN;
  const tokenHeader = env.SALESGOD_TOKEN_HEADER;
  const tokenPrefix = env.SALESGOD_TOKEN_PREFIX ?? "";

  if (!webhookUrl) throw new Error("Missing SALESGOD_WEBHOOK_URL");
  if (!token) throw new Error("Missing SALESGOD_TOKEN");
  if (!tokenHeader) throw new Error("Missing SALESGOD_TOKEN_HEADER");

  return { webhookUrl, token, tokenHeader, tokenPrefix };
}
