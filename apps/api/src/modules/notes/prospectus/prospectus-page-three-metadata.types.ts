/**
 * SECTION: Prospectus Page 3 — title + metadata (visible Stages 1–2 at HTML composition)
 * WHY: Internal module builds both; full Page 3 HTML splits title vs metadata strip
 */

import type {
  ProspectusFinancialComparisonSource,
  ProspectusFinancialComparisonYear,
} from "./prospectus-financial-comparison-source.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva Page 3 title — not a database field. */
export const PROSPECTUS_PAGE_THREE_PAGE_TITLE = "DETAILED FINANCIAL COMPARISON";

export const PROSPECTUS_PAGE_THREE_METADATA_LABELS = {
  sector: "Sector",
  riskRating: "Risk Rating",
  paymaster: "Paymaster",
  paymasterGrading: "Paymaster Grading",
  confidenceGrading: "Confidence Grading",
} as const;

export interface ProspectusPageThreeMetadataAudit {
  title: {
    sourceType: "static_template";
  };
  subtitle: {
    status: "unresolved";
    approvedStaticCopyAvailable: false;
  };
  issuerIdentity: {
    status: "hidden";
    companyNameHidden: true;
    reason: "legal_privacy";
  };
  sector: {
    industrySource: "notes.issuer_snapshot.industry";
    companySizeSource: "page2.issuerProfile.companySize";
    displayFormat: "industry_pipe_company_size";
    liveFallbackAllowed: false;
    page3StorageAllowed: false;
  };
  riskRating: {
    source: "notes.invoice_snapshot.offer_details.risk_rating";
    validator: "isSoukscoreRiskRating";
    canvaAtoEMappingAllowed: false;
  };
  paymaster: {
    source: "notes.paymaster_snapshot.name";
    liveFallbackAllowed: false;
  };
  paymasterGrading: {
    source: "page2.invoicePaymaster.paymasterRating";
    catalogue: "normalizeProspectusPaymasterRating";
    page3StorageAllowed: false;
    generatedValueAllowed: false;
  };
  confidenceGrading: {
    source: "page2.invoicePaymaster.confidenceGrading";
    catalogue: "normalizeProspectusConfidenceGrading";
    page3StorageAllowed: false;
    generatedValueAllowed: false;
  };
  financialSource: {
    reusedFrom: "page_2_financial_comparison_source";
    independentYearSelectionAllowed: false;
    ctosFallbackAllowed: false;
  };
  snapshot: {
    sharedFinancialFreeze: "page_2.financial_comparison";
    separatePageThreeFinancialSnapshotRecommended: false;
    extensionPending: true;
  };
}

export const PROSPECTUS_PAGE_THREE_METADATA_AUDIT: ProspectusPageThreeMetadataAudit = {
  title: {
    sourceType: "static_template",
  },
  subtitle: {
    status: "unresolved",
    approvedStaticCopyAvailable: false,
  },
  issuerIdentity: {
    status: "hidden",
    companyNameHidden: true,
    reason: "legal_privacy",
  },
  sector: {
    industrySource: "notes.issuer_snapshot.industry",
    companySizeSource: "page2.issuerProfile.companySize",
    displayFormat: "industry_pipe_company_size",
    liveFallbackAllowed: false,
    page3StorageAllowed: false,
  },
  riskRating: {
    source: "notes.invoice_snapshot.offer_details.risk_rating",
    validator: "isSoukscoreRiskRating",
    canvaAtoEMappingAllowed: false,
  },
  paymaster: {
    source: "notes.paymaster_snapshot.name",
    liveFallbackAllowed: false,
  },
  paymasterGrading: {
    source: "page2.invoicePaymaster.paymasterRating",
    catalogue: "normalizeProspectusPaymasterRating",
    page3StorageAllowed: false,
    generatedValueAllowed: false,
  },
  confidenceGrading: {
    source: "page2.invoicePaymaster.confidenceGrading",
    catalogue: "normalizeProspectusConfidenceGrading",
    page3StorageAllowed: false,
    generatedValueAllowed: false,
  },
  financialSource: {
    reusedFrom: "page_2_financial_comparison_source",
    independentYearSelectionAllowed: false,
    ctosFallbackAllowed: false,
  },
  snapshot: {
    sharedFinancialFreeze: "page_2.financial_comparison",
    separatePageThreeFinancialSnapshotRecommended: false,
    extensionPending: true,
  },
};

export interface ProspectusPageThreeMetadataStrip {
  sector: string;
  riskRating: string;
  paymaster: string;
  paymasterGrading: string;
  confidenceGrading: string;
}

/** Canva-facing Stage 1 fields. Later Page 3 stages reuse financialYears.rawFinancials. */
export interface ProspectusPageThreeMetadata {
  pageTitle: string;
  pageSubtitle: string;
  metadata: ProspectusPageThreeMetadataStrip;
  /**
   * Pass-through of Page 2 Stage 4A years (same order, same FYE labels, same raw map).
   * Do not re-select years in Page 3.
   */
  financialYears: ProspectusFinancialComparisonYear[];
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusPageThreeMetadataAudit;
}

/**
 * Minimal Stage 1 input. Caller must supply an existing Page 2 Stage 4A source result.
 * Observational fields prove live/CTOS values are never used.
 */
export interface ProspectusPageThreeMetadataInput {
  /**
   * Observational / sanitization only — never rendered on Page 3.
   * Legal: issuer company name is hidden.
   */
  issuerName?: unknown;
  /** Frozen notes.issuer_snapshot.industry (Sector left half) */
  issuerSector?: unknown;
  /**
   * Officer-confirmed Page 2 Company Size (Micro|Small|Medium|Large).
   * Read-only reuse for Sector right half — not stored under Page 3.
   */
  officerCompanySize?: unknown;
  /** Frozen notes.invoice_snapshot.offer_details.risk_rating */
  selectedRiskRating?: unknown;
  /** Frozen notes.paymaster_snapshot.name */
  paymasterName?: unknown;
  /**
   * Officer-confirmed Page 2 Paymaster Rating (PM1–PM4).
   * Read-only reuse — not stored under Page 3.
   */
  officerPaymasterRating?: unknown;
  /**
   * Officer-confirmed Page 2 Confidence Grading (High|Medium|Low).
   * Read-only reuse — not stored under Page 3.
   */
  officerConfidenceGrading?: unknown;
  /** Existing Page 2 Stage 4A result — required; never re-parsed here. */
  financialSource: ProspectusFinancialComparisonSource;
  /** Observational — must never fill issuer/sector/years. */
  liveOrganizationName?: string | null;
  /** Observational — must never fill paymaster. */
  livePaymasterName?: string | null;
  /** Observational — must never select years or fill metrics. */
  ctosFinancials?: unknown;
}

export interface ProspectusPageThreeMetadataFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "stored" | "unresolved" | "reused";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_PAGE_THREE_METADATA_FIELD_SOURCES: Record<
  | "pageTitle"
  | "pageSubtitle"
  | "sector"
  | "riskRating"
  | "paymaster"
  | "paymasterGrading"
  | "confidenceGrading"
  | "financialYears",
  ProspectusPageThreeMetadataFieldSource
> = {
  pageTitle: {
    label: "Page title",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "DETAILED FINANCIAL COMPARISON",
  },
  pageSubtitle: {
    label: "Page subtitle",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Canva deeper-issuer-analysis subtitle — not used (no approved copy)",
    notes: "Data not available until approved production wording exists.",
  },
  sector: {
    label: "Sector",
    canonicalSource:
      "notes.issuer_snapshot.industry + page2.issuerProfile.companySize",
    availability: "reused",
    surface: "canva",
    possibleAlternatives: "live COD industry; SME inference; entity type — not used",
    notes:
      "Anonymous Canva form `{Industry} | {Company Size}` using Page 2 Industry + officer Company Size catalogue. Partial → single side only; both missing → DNA.",
  },
  riskRating: {
    label: "Risk Rating",
    canonicalSource: "notes.invoice_snapshot.offer_details.risk_rating",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "Canva A–E; CTOS — not used",
    notes: "Validated by isSoukscoreRiskRating (AAA–B). Invalid → DNA.",
  },
  paymaster: {
    label: "Paymaster",
    canonicalSource: "notes.paymaster_snapshot.name",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "live contract customer — not used",
    notes: "Frozen at Note create. No live fallback.",
  },
  paymasterGrading: {
    label: "Paymaster Grading",
    canonicalSource: "page2.invoicePaymaster.paymasterRating",
    availability: "reused",
    surface: "canva",
    possibleAlternatives: "Page 3 storage; CTOS — not used",
    notes: "Same officer value and catalogue as Page 2 Paymaster Rating (PM1–PM4).",
  },
  confidenceGrading: {
    label: "Confidence Grading",
    canonicalSource: "page2.invoicePaymaster.confidenceGrading",
    availability: "reused",
    surface: "canva",
    possibleAlternatives: "Page 3 storage; CTOS — not used",
    notes: "Same officer value and catalogue as Page 2 Confidence Grading (High|Medium|Low).",
  },
  financialYears: {
    label: "Selected financial years",
    canonicalSource: "page_2_financial_comparison_source.years",
    availability: "reused",
    surface: "canva",
    possibleAlternatives: "Independent Page 3 year selection; CTOS — not used",
    notes:
      "Pass-through Page 2 Stage 4A years/FYE/raw. Future freeze extension under page_2.financial_comparison only. bsclbank = Non-Current Assets (not Cash & Bank).",
  },
};
