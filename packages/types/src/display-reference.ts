const SHORT_ID_FALLBACK_LENGTH = 8;

function trimmed(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next && next.length > 0 ? next : null;
}

function shortIdFallback(id: string): string {
  return `#${id.slice(-SHORT_ID_FALLBACK_LENGTH).toUpperCase()}`;
}

export type CanonicalReferenceInput = {
  displayReference?: string | null;
  id?: string | null;
  businessNumber?: string | null;
};

export function formatApplicationReference(input: CanonicalReferenceInput): string {
  return trimmed(input.displayReference) ?? (input.id ? shortIdFallback(input.id) : "—");
}

export function formatContractReference(input: CanonicalReferenceInput): string {
  return (
    trimmed(input.displayReference) ??
    trimmed(input.businessNumber) ??
    (input.id ? shortIdFallback(input.id) : "—")
  );
}

export function formatInvoiceReference(input: CanonicalReferenceInput): string {
  return (
    trimmed(input.displayReference) ??
    trimmed(input.businessNumber) ??
    (input.id ? shortIdFallback(input.id) : "—")
  );
}

export function formatNoteReference(input: {
  noteReference?: string | null;
  id?: string | null;
}): string {
  return trimmed(input.noteReference) ?? (input.id ? shortIdFallback(input.id) : "—");
}

export function formatSettlementReference(input: CanonicalReferenceInput): string {
  return trimmed(input.displayReference) ?? (input.id ? shortIdFallback(input.id) : "—");
}

export function formatWithdrawalReference(input: CanonicalReferenceInput): string {
  return trimmed(input.displayReference) ?? (input.id ? shortIdFallback(input.id) : "—");
}

export function formatOrganizationReference(input: CanonicalReferenceInput): string {
  return trimmed(input.displayReference) ?? (input.id ? shortIdFallback(input.id) : "—");
}

/**
 * Named-entity label: `Toyota (ISS-202608-DK3)`.
 * Uses the canonical reference only — never a hashed short-id fallback in brackets.
 */
export function formatNamedEntityDisplay(
  name: string | null | undefined,
  canonicalReference: string | null | undefined
): string {
  const n = trimmed(name);
  const r = trimmed(canonicalReference);
  if (n && r) return `${n} (${r})`;
  if (n) return n;
  if (r) return r;
  return "—";
}

/** Notification copy: canonical ref without hash; legacy short-id keeps hash prefix. */
export function formatApplicationNotificationRef(input: CanonicalReferenceInput): string {
  const canonical = trimmed(input.displayReference);
  if (canonical) return canonical;
  if (input.id) return `#${input.id.slice(-SHORT_ID_FALLBACK_LENGTH).toUpperCase()}`;
  return "application";
}
