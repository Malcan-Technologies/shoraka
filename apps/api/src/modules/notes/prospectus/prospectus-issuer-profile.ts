/**
 * SECTION: Build Page 2 About the Issuer view-model
 * WHY: Non-identifying frozen fields; Company Size from officer Prospectus content only
 */

import { normalizeProspectusCompanySize } from "@cashsouk/types";
import { parseIssuerSnapshot } from "./prospectus-json-guards";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_PROFILE_AUDIT,
  PROSPECTUS_ISSUER_PROFILE_SECTION_HEADING,
  type ProspectusIssuerProfile,
  type ProspectusIssuerProfileInput,
} from "./prospectus-issuer-profile.types";

function nonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Presentation only — stores raw country in snapshot; never "Registered in —". */
export function formatProspectusRegisteredCountry(
  country: string | null | undefined
): string {
  const value = nonEmptyString(country);
  if (!value) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return `Registered in ${value}`;
}

/**
 * Strip a leading issuer company name from business description so the
 * description cannot re-introduce a hidden identifier.
 */
export function sanitizeProspectusBusinessDescription(
  description: string | null | undefined,
  issuerName: string | null | undefined
): string {
  const text = nonEmptyString(description);
  if (!text) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const name = nonEmptyString(issuerName);
  if (!name) return text;
  if (text.toLowerCase() === name.toLowerCase()) {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  const prefix = new RegExp(
    `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[-–—:,]?\\s*`,
    "i"
  );
  const stripped = text.replace(prefix, "").trim();
  return stripped.length > 0 ? stripped : PROSPECTUS_DATA_NOT_AVAILABLE;
}

export function buildProspectusIssuerProfile(
  input: ProspectusIssuerProfileInput
): ProspectusIssuerProfile {
  // Observational only — prove live/org/Application/product values never become Canva fields.
  void input.liveOrganizationName;
  void input.liveRegistrationNumber;
  void input.oldRegistrationNumber;
  void input.employeeCount;
  void input.annualRevenue;
  void input.smeLabel;
  void input.liveWhatDoesCompanyDo;
  void input.productSnapshotDescription;

  const snapshot = parseIssuerSnapshot(input.issuerSnapshot);
  // Entity type may exist on snapshot but must never surface on Issuer Profile.
  void snapshot.entityType;

  const industry = snapshot.industry ?? PROSPECTUS_DATA_NOT_AVAILABLE;
  const officerSize = normalizeProspectusCompanySize(input.officerCompanySize);
  const companySize = officerSize ?? PROSPECTUS_DATA_NOT_AVAILABLE;

  return {
    sectionHeading: PROSPECTUS_ISSUER_PROFILE_SECTION_HEADING,
    industry,
    companySize,
    registeredCountry: formatProspectusRegisteredCountry(snapshot.country),
    businessDescription: sanitizeProspectusBusinessDescription(
      snapshot.businessDescription,
      snapshot.name
    ),
    audit: PROSPECTUS_ISSUER_PROFILE_AUDIT,
  };
}

/**
 * Admin Prospectus Review rows — same labels/values as Page 2 Canva HTML.
 * Does not re-resolve issuer data; maps an already-built Stage 1 view-model.
 */
export function toAdminIssuerProfileRows(
  profile: ProspectusIssuerProfile
): Array<{ label: string; value: string }> {
  return [
    { label: "Industry", value: profile.industry },
    { label: "Company Size", value: profile.companySize },
    { label: "Registered Country", value: profile.registeredCountry },
    { label: "Business Description", value: profile.businessDescription },
  ];
}
