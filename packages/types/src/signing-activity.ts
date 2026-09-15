/**
 * Display-safe copy for per-document signing completion activity.
 * Metadata must never include email or IC numbers.
 */

export function isAutomaticSigningDocumentSigned(
  metadata?: Record<string, unknown> | null
): boolean {
  return metadata?.execution_mode === "AUTOMATIC";
}

function metaString(metadata: Record<string, unknown> | null | undefined, key: string): string {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function signingDocumentSignedSignerName(
  metadata?: Record<string, unknown> | null
): string {
  return metaString(metadata, "signer_name") || metaString(metadata, "actorName");
}

export function formatSigningDocumentSignedTitle(
  metadata?: Record<string, unknown> | null
): string {
  if (isAutomaticSigningDocumentSigned(metadata)) {
    return "CashSouk Completed Signing";
  }
  const name = signingDocumentSignedSignerName(metadata);
  return name ? `${name} Completed Signing` : "Signer Completed Signing";
}

export function formatSigningDocumentSignedDescription(
  metadata?: Record<string, unknown> | null
): string {
  const documentName = metaString(metadata, "document_name");
  const roleLabel = metaString(metadata, "role_label");
  const signerName = signingDocumentSignedSignerName(metadata);

  if (isAutomaticSigningDocumentSigned(metadata)) {
    if (documentName && roleLabel) {
      return `${documentName} was signed automatically as ${roleLabel}.`;
    }
    if (documentName) return `${documentName} was signed automatically by CashSouk.`;
    return "CashSouk signed automatically.";
  }

  if (documentName && roleLabel && signerName) {
    return `${signerName} signed ${documentName} as ${roleLabel}.`;
  }
  if (documentName && signerName) {
    return `${signerName} signed ${documentName}.`;
  }
  if (signerName) return `${signerName} completed a signing step.`;
  return "A signer completed a signing step.";
}
