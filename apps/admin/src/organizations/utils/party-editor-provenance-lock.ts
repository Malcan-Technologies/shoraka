import type { ProfileFieldSources } from "@cashsouk/types";

export type PartyEditorProvenanceLockFlags = {
  salutationLocked: boolean;
  genderLocked: boolean;
  dateOfBirthLocked: boolean;
  nationalityLocked: boolean;
  identityPrefixLocked: boolean;
  identityNumberLocked: boolean;
  dateOfIncorporationLocked: boolean;
  countryOfIncorporationLocked: boolean;
};

function nonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * UI provenance lock flags for the admin People & Access editor.
 *
 * Business rule:
 * - REGTANK provenance + non-empty value => locked/read-only
 * - REGTANK provenance + empty/null value => editable
 * - USER/ADMIN provenance => editable
 * - missing provenance => editable
 */
export function computePartyEditorProvenanceLockFlags(params: {
  fieldSources?: ProfileFieldSources;
  values: {
    salutation: string;
    gender: string;
    dateOfBirth: string;
    nationality: string;
    identityPrefix: string;
    identityNumber: string;
    dateOfIncorporation: string;
    countryOfIncorporation: string;
  };
}): PartyEditorProvenanceLockFlags {
  const fs = params.fieldSources ?? ({} as ProfileFieldSources);
  const isRegTank = (field: keyof typeof fs): boolean => fs[field]?.source === "REGTANK";

  const hasDob = nonEmptyString(params.values.dateOfBirth);
  const hasGender = nonEmptyString(params.values.gender);
  const hasNationality = nonEmptyString(params.values.nationality);
  const hasSalutation = nonEmptyString(params.values.salutation);
  const hasIdentityPrefix = nonEmptyString(params.values.identityPrefix);
  const hasIdentityNumber = nonEmptyString(params.values.identityNumber);
  const hasIncorpDate = nonEmptyString(params.values.dateOfIncorporation);
  const hasIncorpCountry = nonEmptyString(params.values.countryOfIncorporation);

  return {
    salutationLocked: isRegTank("salutation") && hasSalutation,
    genderLocked: isRegTank("gender") && hasGender,
    dateOfBirthLocked: isRegTank("dateOfBirth") && hasDob,
    nationalityLocked: isRegTank("nationality") && hasNationality,
    identityPrefixLocked: isRegTank("identityPrefix") && hasIdentityPrefix,
    identityNumberLocked: isRegTank("identityNumber") && hasIdentityNumber,
    dateOfIncorporationLocked: isRegTank("dateOfIncorporation") && hasIncorpDate,
    countryOfIncorporationLocked: isRegTank("countryOfIncorporation") && hasIncorpCountry,
  };
}

