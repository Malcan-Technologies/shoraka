/**
 * SECTION: Sample Page 2 About the Issuer inputs for Stage 1 preview
 * WHY: Frozen snapshot wins; live org/Application/SME/old SSM aliases ignored
 */

import { buildProspectusIssuerProfile } from "./prospectus-issuer-profile";
import type {
  ProspectusIssuerProfile,
  ProspectusIssuerProfileInput,
} from "./prospectus-issuer-profile.types";

export const SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT: ProspectusIssuerProfileInput = {
  issuerSnapshot: {
    id: "org-sample-issuer",
    name: "ABC Engineering Sdn Bhd",
    type: "ISSUER",
    industry: "Construction",
    registration_number: "201401012345",
    country: "Malaysia",
    business_description:
      "ABC Engineering Sdn Bhd is a civil and structural engineering company providing construction and maintenance services.",
  },
  liveOrganizationName: "Live Org Name Must Be Ignored",
  liveRegistrationNumber: "999999999999",
  oldRegistrationNumber: "1101234-X",
  employeeCount: 50,
  annualRevenue: 5_000_000,
  smeLabel: "SME",
  liveWhatDoesCompanyDo: "Live Application description must be ignored.",
  productSnapshotDescription: "Product description must not replace issuer business description.",
};

export const SAMPLE_PROSPECTUS_ISSUER_PROFILE: ProspectusIssuerProfile =
  buildProspectusIssuerProfile(SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT);
