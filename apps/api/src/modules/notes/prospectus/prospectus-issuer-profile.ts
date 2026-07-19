/**
 * SECTION: Build Page 2 About the Issuer view-model
 * WHY: Frozen issuer_snapshot only; SME DNA; no live org/Application/product fallback
 */

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

/** Presentation only — stores raw country in snapshot; never "Registered in Data not available". */
export function formatProspectusRegisteredCountry(
  country: string | null | undefined
): string {
  const value = nonEmptyString(country);
  if (!value) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return `Registered in ${value}`;
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

  return {
    sectionHeading: PROSPECTUS_ISSUER_PROFILE_SECTION_HEADING,
    companyName: snapshot.name ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    registrationNumber: snapshot.registrationNumber ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    industry: snapshot.industry ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    companySize: PROSPECTUS_DATA_NOT_AVAILABLE,
    registeredCountry: formatProspectusRegisteredCountry(snapshot.country),
    businessDescription: snapshot.businessDescription ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: PROSPECTUS_ISSUER_PROFILE_AUDIT,
  };
}
