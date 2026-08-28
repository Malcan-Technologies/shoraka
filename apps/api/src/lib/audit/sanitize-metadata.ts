/**
 * Strip secrets, raw provider payloads and unnecessary PII from activity/onboarding metadata.
 * Structured evidence (ids, status, reason codes, entity refs) is kept.
 */

const DROP_KEYS =
  /^(payload|raw_?payload|raw_?body|request_?body|body|jwt|id_token|access_?token|refresh_?token|authorization|secret|password|private_?key|api_?key|credential|session_token|webhook_payloads)$/i;

const PII_KEYS =
  /^(nric|ic_?number|government_?id(_?number)?|document_?num|mykad|full_?ic|id_?number|passport_?number)$/i;

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function sanitizeAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditMetadata);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (DROP_KEYS.test(key) || PII_KEYS.test(key)) continue;
      out[key] = sanitizeAuditMetadata(nested);
    }
    return out;
  }
  if (typeof value === "string" && JWT_SHAPE.test(value) && value.length > 40) {
    return "[REDACTED]";
  }
  return value;
}

export function sanitizeAuditMetadataRecord(
  metadata: object | null | undefined
): object | null | undefined {
  if (metadata == null) return metadata;
  return sanitizeAuditMetadata(metadata) as object;
}
