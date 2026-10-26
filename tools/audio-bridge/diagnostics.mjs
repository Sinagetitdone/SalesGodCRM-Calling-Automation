// Diagnostic errors may contain credentials; conversation text is stored separately.
export const diagnosticMaxLength = 1500;

export function diagnosticDetail(value) {
  return String(value || '')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, diagnosticMaxLength);
}
