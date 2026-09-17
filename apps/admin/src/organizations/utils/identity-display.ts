import { PROFILE_REQUIRED_EMPTY_LABEL } from "@cashsouk/types";

function formatAdminDocumentType(type: string | null | undefined): string | null {
  if (!type) return null;
  const trimmed = type.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  // Keep admin display human-friendly while preserving unknown values safely.
  switch (upper) {
    case "DRIVER_LICENSE":
      return "Driving License";
    case "NRIC":
      return "NRIC";
    case "PASSPORT":
      return "Passport";
    default:
      // Preserve original casing; only normalize the separator.
      return trimmed.replace(/_/g, " ");
  }
}

export function formatAdminIdentityDisplay(params: {
  documentType: string | null;
  documentNumber: string | null;
  identityNumberRequiredMissing: boolean;
}): {
  identityPrefixValue: string | null;
  identityNumberValue: string | null;
} {
  const identityPrefixValue = formatAdminDocumentType(params.documentType);

  const rawNumber = params.documentNumber;
  const identityNumberEmpty =
    rawNumber === null || rawNumber === undefined || String(rawNumber).trim().length === 0;

  // Admin read mode should show an explicit CTA prompt when the completeness rule
  // currently requires identityNumber but RegTank returned an empty/blank value.
  const identityNumberValue = identityNumberEmpty
    ? params.identityNumberRequiredMissing
      ? PROFILE_REQUIRED_EMPTY_LABEL
      : null
    : rawNumber;

  return { identityPrefixValue, identityNumberValue };
}

