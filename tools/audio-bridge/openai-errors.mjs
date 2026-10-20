// Return only fixed public explanations and known error categories. Upstream
// messages can contain private request details and must never be forwarded.
export async function openAIFailure(response) {
  let code;
  try { code = (await response.json())?.error?.code; } catch {}
  let errorCode = 'upstream_error';
  let error = `OpenAI connection failed (${response.status}). Check API access and model availability.`;
  if (response.status === 403 && ['unsupported_country_region_territory', 'unsupported_country'].includes(code)) {
    errorCode = 'unsupported_country_region_territory';
    error = 'OpenAI API access is blocked for this connection\'s detected country or region (403). ChatGPT and this extension use separate product connections. If you are in a supported location, ask OpenAI Support or your IT team to review the region detection. Reinstalling the extension or replacing the key does not resolve a regional access block.';
  } else if (response.status === 401 && code === 'ip_not_authorized') {
    errorCode = 'ip_not_authorized'; error = 'OpenAI rejected this connection under the project IP allowlist. Ask your API administrator to review the approved network settings.';
  } else if (response.status === 401) {
    errorCode = 'invalid_api_key'; error = 'OpenAI rejected the API key. Update OPENAI_API_KEY in the local .env file and restart the bridge.';
  } else if (response.status === 429 && ['insufficient_quota', 'credit_balance_exhausted'].includes(code)) {
    errorCode = 'insufficient_quota'; error = 'OpenAI API quota or credit balance is exhausted. Ask your API project owner to review API billing; a ChatGPT subscription does not supply API credits.';
  } else if (response.status === 429) {
    errorCode = 'rate_limit_exceeded'; error = 'OpenAI rate limit or billing quota reached. Check API limits and billing before retrying.';
  } else if ([403, 404].includes(response.status) && code === 'model_not_found') {
    errorCode = 'model_not_found'; error = 'The configured OpenAI API model is unavailable to this project. Ask your API administrator to check model access and the local OPENAI_REALTIME_MODEL setting.';
  } else if (response.status === 403) {
    errorCode = 'access_denied'; error = 'OpenAI denied API access (403). Ask your API administrator or OpenAI Support to check project permissions and connection eligibility. ChatGPT access does not establish API access.';
  }
  return { error, errorCode, upstreamStatus: response.status };
}
