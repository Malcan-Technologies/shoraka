/**
 * SECTION: Prospectus Page 2 — About the Issuer (non-identifying fields only)
 * WHY: Legal — no company name / registration / SSM / entity type on prospectus surfaces
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_ISSUER_PROFILE_SECTION_HEADING = "ABOUT THE ISSUER";

/** Admin / Canva combined line label. */
export const PROSPECTUS_ISSUER_PROFILE_INDUSTRY_SIZE_LABEL = "Industry | Company Size";

export interface ProspectusIssuerProfileAudit {
  identityHidden: {
    companyNameHidden: true;
    registrationNumberHidden: true;
    oldSsmHidden: true;
    entityTypeHidden: true;
  };
  industry: {
    source: "notes.issuer_snapshot.industry";
    isFrozen: true;
  };
  companySize: {
    source: "prospectus_review.page2.issuerProfile.companySize";
    isOfficerContent: true;
    inferenceAllowed: false;
    allowedValues: ["Micro", "Small", "Medium", "Large"];
  };
  industryAndCompanySize: {
    display: "combined";
    separator: " | ";
    missingBoth: typeof PROSPECTUS_DATA_NOT_AVAILABLE;
  };
  registeredCountry: {
    source: "notes.issuer_snapshot.country";
    isFrozen: true;
    hardcodedCountryAllowed: false;
  };
  businessDescription: {
    source: "notes.issuer_snapshot.business_description";
    originalSource: "applications.business_details.about_your_business.what_does_company_do";
    isFrozen: true;
    liveFallbackAllowed: false;
    issuerNamePrefixStripped: true;
  };
  snapshot: {
    sourceType: "note_creation_snapshot";
  };
}

export const PROSPECTUS_ISSUER_PROFILE_AUDIT: ProspectusIssuerProfileAudit = {
  identityHidden: {
    companyNameHidden: true,
    registrationNumberHidden: true,
    oldSsmHidden: true,
    entityTypeHidden: true,
  },
  industry: {
    source: "notes.issuer_snapshot.industry",
    isFrozen: true,
  },
  companySize: {
    source: "prospectus_review.page2.issuerProfile.companySize",
    isOfficerContent: true,
    inferenceAllowed: false,
    allowedValues: ["Micro", "Small", "Medium", "Large"],
  },
  industryAndCompanySize: {
    display: "combined",
    separator: " | ",
    missingBoth: PROSPECTUS_DATA_NOT_AVAILABLE,
  },
  registeredCountry: {
    source: "notes.issuer_snapshot.country",
    isFrozen: true,
    hardcodedCountryAllowed: false,
  },
  businessDescription: {
    source: "notes.issuer_snapshot.business_description",
    originalSource: "applications.business_details.about_your_business.what_does_company_do",
    isFrozen: true,
    liveFallbackAllowed: false,
    issuerNamePrefixStripped: true,
  },
  snapshot: {
    sourceType: "note_creation_snapshot",
  },
};

/** Canva-facing fields only — no issuer identifiers or entity type. */
export interface ProspectusIssuerProfile {
  sectionHeading: string;
  /** Combined investor-visible line: Industry | Company Size (or one side / DNA). */
  industryAndCompanySize: string;
  /** Component values (audit / tests). Not rendered as separate labeled rows. */
  industry: string;
  companySize: string;
  registeredCountry: string;
  businessDescription: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusIssuerProfileAudit;
}

/**
 * Raw inputs for preview/builder — not Prisma.
 * Observational fields prove live org/Application/product values are never used.
 */
export interface ProspectusIssuerProfileInput {
  /** notes.issuer_snapshot (JSON) */
  issuerSnapshot?: unknown;
  /**
   * Officer-selected Company Size from Prospectus review publication content.
   * Only Micro | Small | Medium | Large are accepted; everything else is empty.
   */
  officerCompanySize?: string | null;
  /** Observational — must not become company name. */
  liveOrganizationName?: string | null;
  /** Observational — must not become registration number. */
  liveRegistrationNumber?: string | null;
  /** Observational old-SSM-like alias — must be ignored. */
  oldRegistrationNumber?: string | null;
  /** Observational — must not become company size. */
  employeeCount?: number | null;
  /** Observational — must not become company size. */
  annualRevenue?: number | null;
  /** Observational SME label — must be ignored. */
  smeLabel?: string | null;
  /** Observational live Application description — must not replace snapshot. */
  liveWhatDoesCompanyDo?: string | null;
  /** Observational product description — must not replace issuer business description. */
  productSnapshotDescription?: string | null;
}

export interface ProspectusIssuerProfileFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "stored" | "unresolved" | "hidden";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES: Record<
  | "sectionHeading"
  | "industryAndCompanySize"
  | "industry"
  | "companySize"
  | "entityType"
  | "registeredCountry"
  | "businessDescription",
  ProspectusIssuerProfileFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "ABOUT THE ISSUER",
  },
  industryAndCompanySize: {
    label: PROSPECTUS_ISSUER_PROFILE_INDUSTRY_SIZE_LABEL,
    canonicalSource:
      "notes.issuer_snapshot.industry + prospectus_review.page2.issuerProfile.companySize",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "separate Industry / Company Size rows — not used",
    notes:
      'Show "Industry | Company Size" when both exist; one side alone if the other is missing; DNA if both missing.',
  },
  industry: {
    label: "Industry",
    canonicalSource: "notes.issuer_snapshot.industry",
    availability: "stored",
    surface: "audit",
    possibleAlternatives: "live COD industry — not used",
    notes: "Frozen at Note create. Combined into industryAndCompanySize for Canva.",
  },
  companySize: {
    label: "Company Size",
    canonicalSource: "prospectus_review.page2.issuerProfile.companySize",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "IssuerOrganization employees/revenue; large private — not used",
    notes: "Optional officer select: Micro | Small | Medium | Large. Empty when unset.",
  },
  entityType: {
    label: "Entity Type",
    canonicalSource: "notes.issuer_snapshot.entity_type",
    availability: "hidden",
    surface: "audit",
    possibleAlternatives: "none",
    notes: "Removed from Canva / Admin Issuer Profile display.",
  },
  registeredCountry: {
    label: "Registered Country",
    canonicalSource: "notes.issuer_snapshot.country",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "hardcoded Malaysia; live addresses — not used",
    notes: 'Display "Registered in {country}" when frozen country exists; else DNA.',
  },
  businessDescription: {
    label: "Business Description",
    canonicalSource: "notes.issuer_snapshot.business_description",
    availability: "stored",
    surface: "canva",
    possibleAlternatives:
      "live what_does_company_do; product_snapshot.description; purpose — not used",
    notes:
      "Frozen description; leading issuer company name stripped when present. Name/reg never rendered.",
  },
};
