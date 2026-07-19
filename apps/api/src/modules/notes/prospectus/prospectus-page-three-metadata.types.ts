/**
 * SECTION: Prospectus Page 3 — Detailed Financial Comparison metadata (DATA STAGE 1)
 * WHY: Title + metadata strip + reuse Page 2 Stage 4A years; no metrics/formulas yet
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
  issuer: "Issuer",
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
  issuer: {
    source: "notes.issuer_snapshot.name";
    liveFallbackAllowed: false;
  };
  sector: {
    source: "notes.issuer_snapshot.industry";
    liveFallbackAllowed: false;
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
    status: "unresolved";
    generatedValueAllowed: false;
  };
  confidenceGrading: {
    status: "unresolved";
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
  issuer: {
    source: "notes.issuer_snapshot.name",
    liveFallbackAllowed: false,
  },
  sector: {
    source: "notes.issuer_snapshot.industry",
    liveFallbackAllowed: false,
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
    status: "unresolved",
    generatedValueAllowed: false,
  },
  confidenceGrading: {
    status: "unresolved",
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
  issuer: string;
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
  /** Frozen notes.issuer_snapshot.name */
  issuerName?: unknown;
  /** Frozen notes.issuer_snapshot.industry (Canva label: Sector) */
  issuerSector?: unknown;
  /** Frozen notes.invoice_snapshot.offer_details.risk_rating */
  selectedRiskRating?: unknown;
  /** Frozen notes.paymaster_snapshot.name */
  paymasterName?: unknown;
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
  | "issuer"
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
  issuer: {
    label: "Issuer",
    canonicalSource: "notes.issuer_snapshot.name",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "live IssuerOrganization.name — not used",
    notes: "Frozen at Note create. No live fallback.",
  },
  sector: {
    label: "Sector",
    canonicalSource: "notes.issuer_snapshot.industry",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "live COD industry — not used",
    notes: "Portal label Industry; Canva label Sector. Same frozen field.",
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
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "PM1; SoukScore; CTOS — not used",
    notes: "No approved platform field.",
  },
  confidenceGrading: {
    label: "Confidence Grading",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "High; CTOS confidence — not used",
    notes: "No approved platform field.",
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
