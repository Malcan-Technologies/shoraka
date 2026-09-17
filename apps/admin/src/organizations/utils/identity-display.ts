import { PROFILE_REQUIRED_EMPTY_LABEL } from "@cashsouk/types";

export function formatAdminIdentityDisplay(params: {
  documentType: string | null;
  documentNumber: string | null;
  identityNumberRequiredMissing: boolean;
}): {
  identityPrefixValue: string | null;
  identityNumberValue: string | null;
} {
  const identityPrefixValue = params.documentType;

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

