/**
 * SECTION: Prospectus Page 2 — About the Issuer (DATA STAGE 1)
 * WHY: Frozen issuer_snapshot only; SME unresolved; no live org/Application fallback
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_ISSUER_PROFILE_SECTION_HEADING = "ABOUT THE ISSUER";

export interface ProspectusIssuerProfileAudit {
  companyName: {
    source: "notes.issuer_snapshot.name";
    isFrozen: true;
  };
  registrationNumber: {
    source: "notes.issuer_snapshot.registration_number";
    isFrozen: true;
    oldRegistrationNumberSupported: false;
  };
  industry: {
    source: "notes.issuer_snapshot.industry";
    isFrozen: true;
  };
  companySize: {
    status: "unresolved";
    structuredSourceAvailable: false;
    inferenceAllowed: false;
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
  };
  snapshot: {
    sourceType: "note_creation_snapshot";
  };
}

export const PROSPECTUS_ISSUER_PROFILE_AUDIT: ProspectusIssuerProfileAudit = {
  companyName: {
    source: "notes.issuer_snapshot.name",
    isFrozen: true,
  },
  registrationNumber: {
    source: "notes.issuer_snapshot.registration_number",
    isFrozen: true,
    oldRegistrationNumberSupported: false,
  },
  industry: {
    source: "notes.issuer_snapshot.industry",
    isFrozen: true,
  },
  companySize: {
    status: "unresolved",
    structuredSourceAvailable: false,
    inferenceAllowed: false,
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
  },
  snapshot: {
    sourceType: "note_creation_snapshot",
  },
};

/** Canva-facing fields only. */
export interface ProspectusIssuerProfile {
  sectionHeading: string;
  companyName: string;
  registrationNumber: string;
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
  availability: "static" | "stored" | "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES: Record<
  | "sectionHeading"
  | "companyName"
  | "registrationNumber"
  | "industry"
  | "companySize"
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
  companyName: {
    label: "Company Name",
    canonicalSource: "notes.issuer_snapshot.name",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "live IssuerOrganization.name; CTOS company name — not used",
    notes: "Frozen at Note create. No live fallback.",
  },
  registrationNumber: {
    label: "Registration Number",
    canonicalSource: "notes.issuer_snapshot.registration_number",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "old SSM; live registration_number — not used",
    notes: "New SSM only, displayed as stored. Old SSM unsupported.",
  },
  industry: {
    label: "Industry",
    canonicalSource: "notes.issuer_snapshot.industry",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "live COD industry — not used",
    notes: "Frozen at Note create. Preserve stored value.",
  },
  companySize: {
    label: "Company Size",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "SME; employees; revenue — not used",
    notes: "No approved SME classification. inferenceAllowed = false.",
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
      "Frozen from applications.business_details.about_your_business.what_does_company_do at Note create.",
  },
};
