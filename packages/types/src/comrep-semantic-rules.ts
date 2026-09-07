/**
 * SC ComRep RMO-P2P special field rules that are not “plain text / date / amount”.
 * Definitions come from the reporting manual. Do not invent extra formats.
 */

import { normalizeScNric, normalizeScRegistrationNumber } from "./comrep-normalization";
import type { ScGender, ScIdentityPrefix } from "./comrep-profile";

export const SC_INDIVIDUAL_GENDERS = ["MALE", "FEMALE"] as const;
export type ScIndividualGender = (typeof SC_INDIVIDUAL_GENDERS)[number];

export const SC_GENDER_NOT_APPLICABLE_NOTE =
  "Not Applicable is only chosen if the person is a non-individual entity. For individuals, insert the gender as reflected per the verified official documents.";

export const SC_MALAYSIA_COUNTRY_NAME = "MALAYSIA";

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isMalaysiaCountryName(value: string | null | undefined): boolean {
  return emptyToNull(value)?.toUpperCase() === SC_MALAYSIA_COUNTRY_NAME;
}

export function scGendersForEntityType(entityType: "INDIVIDUAL" | "CORPORATE"): readonly string[] {
  return entityType === "CORPORATE" ? ["NOT_APPLICABLE"] : SC_INDIVIDUAL_GENDERS;
}

export function isScGenderAllowedForEntity(
  entityType: "INDIVIDUAL" | "CORPORATE",
  gender: string | null | undefined
): boolean {
  const value = emptyToNull(gender);
  if (!value) return true;
  return scGendersForEntityType(entityType).includes(value);
}

export function scIdentityPrefixesForRole(input: {
  entityType: "INDIVIDUAL" | "CORPORATE";
  officerOnly?: boolean;
}): readonly string[] {
  if (input.entityType === "CORPORATE") return ["ROC"];
  if (input.officerOnly) return ["NRIC", "PASSPORT"];
  return ["NRIC", "PASSPORT"];
}

export function isScIdentityPrefixAllowed(input: {
  entityType: "INDIVIDUAL" | "CORPORATE";
  officerOnly?: boolean;
  prefix: string | null | undefined;
}): boolean {
  const prefix = emptyToNull(input.prefix);
  if (!prefix) return true;
  return scIdentityPrefixesForRole(input).includes(prefix);
}

/**
 * NRIC: no dash/space/special characters (manual §2.4).
 * BRN/ROC: no dash/space/special characters (manual §2.3).
 * Passport: SC does not apply the NRIC format rule — trim only.
 */
export function normalizeScIdentityNumber(input: {
  value: string | null | undefined;
  entityType?: "INDIVIDUAL" | "CORPORATE" | null;
  prefix?: string | null;
  nationality?: string | null;
}): string | null {
  const value = emptyToNull(input.value);
  if (!value) return null;
  const prefix = emptyToNull(input.prefix);
  if (input.entityType === "CORPORATE" || prefix === "ROC") {
    return normalizeScRegistrationNumber(value);
  }
  if (prefix === "PASSPORT") return value;
  if (prefix === "NRIC") return normalizeScNric(value);
  if (input.entityType === "INDIVIDUAL" && isMalaysiaCountryName(input.nationality)) {
    return normalizeScNric(value);
  }
  if (input.entityType === "INDIVIDUAL" && emptyToNull(input.nationality)) return value;
  return normalizeScNric(value);
}

export function othersSpecifyValue(
  selected: string | null | undefined,
  other: string | null | undefined
): { value: string | null; issue: string | null } {
  const otherText = emptyToNull(other);
  if (selected === "OTHERS") {
    if (!otherText) {
      return {
        value: null,
        issue: "This Others (please specify) field is required when Others is selected.",
      };
    }
    return { value: otherText, issue: null };
  }
  return { value: null, issue: null };
}

export function identityPrefixVsNationalityIssue(input: {
  entityType: "INDIVIDUAL" | "CORPORATE";
  prefix: string | null | undefined;
  nationality: string | null | undefined;
}): string | null {
  if (input.entityType !== "INDIVIDUAL") return null;
  const prefix = emptyToNull(input.prefix);
  const nationality = emptyToNull(input.nationality);
  if (!prefix || !nationality) return null;
  if (isMalaysiaCountryName(nationality) && prefix === "PASSPORT") {
    return "Local Malaysian individuals: Insert NRIC number.";
  }
  if (!isMalaysiaCountryName(nationality) && prefix === "NRIC") {
    return "Foreign individuals: Insert Passport number.";
  }
  return null;
}

export type PartyComrepFields = {
  entityType: "INDIVIDUAL" | "CORPORATE";
  isOfficer: boolean;
  gender?: string | null;
  salutation?: string | null;
  identityPrefix?: string | null;
  identityNumber?: string | null;
  nationality?: string | null;
  shareType?: string | null;
  shareTypeOther?: string | null;
  designation?: string | null;
  designationOther?: string | null;
};

export type AppliedPartyComrepFields = {
  gender: ScGender | null;
  salutation: string | null;
  identityPrefix: ScIdentityPrefix | null;
  identityNumber: string | null;
  shareTypeOther: string | null;
  designationOther: string | null;
  issues: string[];
};

/** Coerce values SC allows to auto-set; collect issues SC does not allow to save. */
export function applyPartyComrepSemantics(input: PartyComrepFields): AppliedPartyComrepFields {
  const issues: string[] = [];
  const corporate = input.entityType === "CORPORATE";
  let gender = emptyToNull(input.gender) as ScGender | null;
  let salutation = emptyToNull(input.salutation);
  let identityPrefix = emptyToNull(input.identityPrefix) as ScIdentityPrefix | null;
  const nationality = emptyToNull(input.nationality);

  if (corporate) {
    gender = "NOT_APPLICABLE";
    salutation = null;
    identityPrefix = "ROC";
  } else {
    if (gender === "NOT_APPLICABLE") {
      issues.push(SC_GENDER_NOT_APPLICABLE_NOTE);
    }
    if (identityPrefix === "ROC") {
      issues.push(
        input.isOfficer
          ? "Identity Prefix for Board of Director/Management Team is IC or Passport."
          : "Identity Prefix ROC is only for a company."
      );
    }
    const prefixNationality = identityPrefixVsNationalityIssue({
      entityType: "INDIVIDUAL",
      prefix: identityPrefix,
      nationality,
    });
    if (prefixNationality) issues.push(prefixNationality);
  }

  const shareOther = othersSpecifyValue(input.shareType, input.shareTypeOther);
  if (shareOther.issue && input.shareType === "OTHERS") {
    issues.push("Type of Shares - Others (please specify) is required when Type of Shares is Others.");
  }
  const designationOther = othersSpecifyValue(input.designation, input.designationOther);
  if (designationOther.issue && input.designation === "OTHERS") {
    issues.push("Designation - Others (please specify) is required when Designation is Others.");
  }

  return {
    gender,
    salutation,
    identityPrefix,
    identityNumber: normalizeScIdentityNumber({
      value: input.identityNumber,
      entityType: input.entityType,
      prefix: identityPrefix,
      nationality,
    }),
    shareTypeOther: shareOther.value,
    designationOther: designationOther.value,
    issues,
  };
}
