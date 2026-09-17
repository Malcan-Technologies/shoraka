import { isIssuerOfficerRole } from "@cashsouk/types";
import type { PartyEditorValues } from "./organization-person-editor-dialog";

/**
 * Builds a PATCH payload for `party-profiles/:partyId` that only includes
 * fields relevant to the current `entityType`/role selection.
 *
 * This must not include unsupported keys (e.g. `entityType`) because the backend
 * patch schema is `strict()`.
 */
export function buildPartyPatchPayloadFromEditorValues(values: PartyEditorValues): Record<string, unknown> {
  const corporate = values.entityType === "CORPORATE";
  const officer = !corporate && isIssuerOfficerRole(values);
  const showShare = corporate || values.isShareholder;

  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    identityPrefix: corporate ? "ROC" : values.identityPrefix || null,
    identityNumber: values.identityNumber.trim() || null,
    isDirector: corporate ? false : values.isDirector,
    isShareholder: corporate ? true : values.isShareholder,
    isBoard: corporate ? false : values.isBoard,
    isManagement: corporate ? false : values.isManagement,
    gender: corporate ? "NOT_APPLICABLE" : values.gender || null,
    salutation: corporate ? null : values.salutation.trim() || null,
    email: values.email.trim() || null,
    address: {
      line1: values.line1.trim() || null,
      line2: values.line2.trim() || null,
      state: values.state || null,
      postalCode: values.postalCode.trim() || null,
    },
  };

  if (!corporate) {
    payload.dateOfBirth = values.dateOfBirth || null;
    payload.nationality = values.nationality.trim() || null;
  } else {
    payload.dateOfIncorporation = values.dateOfIncorporation || null;
    payload.countryOfIncorporation = values.countryOfIncorporation.trim() || null;
  }

  if (showShare) {
    payload.shareholdingPercentage = values.shareholdingPercentage.trim() || null;
    payload.shareType = values.shareType || null;
    payload.shareTypeOther = values.shareType === "OTHERS" ? values.shareTypeOther.trim() || null : null;
    payload.shareholdingUnits = values.shareholdingUnits.trim() || null;
    payload.shareholdingAmount = values.shareholdingAmount.trim() || null;
  }

  if (officer) {
    payload.designation = values.designation || null;
    payload.designationOther =
      values.designation === "OTHERS" ? values.designationOther.trim() || null : null;
    payload.appointmentDate = values.appointmentDate || null;
    payload.resignationDate = values.resignationDate || null;
  }

  return payload;
}

