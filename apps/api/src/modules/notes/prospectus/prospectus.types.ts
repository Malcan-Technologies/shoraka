/**
 * SECTION: Prospectus view-model types
 * WHY: Keep HTML rendering free of Prisma/S3; Stage 1 proves note identity + investment terms
 */

/** How a Stage 1 prospectus value is obtained. */
export type ProspectusFieldAvailability =
  | "stored"
  | "calculated"
  | "constant"
  | "inferred"
  | "missing"
  | "unresolved";

/** Where Stage 1 data should be read from when wiring Prisma later. */
export type ProspectusFieldOrigin =
  | "note"
  | "note_listing"
  | "note_snapshot_product"
  | "note_snapshot_paymaster"
  | "note_snapshot_invoice"
  | "application"
  | "invoice"
  | "contract"
  | "product"
  | "platform_constant"
  | "calculated"
  | "none";

export interface ProspectusStage1FieldSource {
  label: string;
  /** Best Prisma model / table */
  model: string;
  /** Column or JSON path */
  path: string;
  origin: ProspectusFieldOrigin;
  availability: ProspectusFieldAvailability;
  /** Existing mapper/DTO/helper that already exposes or computes it */
  existingApi: string;
  notes: string;
}

/**
 * Stage 1: Note identity + basic investment terms (display strings only).
 * Formatting stays outside Prisma; later mapper fills these from Note + joins.
 */
export interface ProspectusStage1Terms {
  noteReference: string;
  financingType: string;
  listingDate: string;
  maturityDate: string;
  paymaster: string;
  financingAmount: string;
  minimumInvestment: string;
  profitRate: string;
  expectedReturn: string;
  tenure: string;
  purposeOfFinancing: string;
  paymentBasis: string;
  shariahPrinciple: string;
}

export interface ProspectusStage1FieldRow {
  key: keyof ProspectusStage1Terms;
  label: string;
  value: string;
  source: ProspectusStage1FieldSource;
}

/** Field-source catalog for Stage 1 (documentation + HTML preview). */
export const PROSPECTUS_STAGE1_FIELD_SOURCES: Record<
  keyof ProspectusStage1Terms,
  ProspectusStage1FieldSource
> = {
  noteReference: {
    label: "Note ID / note reference",
    model: "notes",
    path: "note_reference",
    origin: "note",
    availability: "stored",
    existingApi: "NoteListItem.noteReference / formatNoteReferenceDisplay()",
    notes: "Created as NOTE-{YYYYMMDD}-{suffix}. Canva sample used ARF-… branding.",
  },
  financingType: {
    label: "Financing type",
    model: "notes",
    path: "product_snapshot.product_name (fallback: name / productName / productLabel); category via product_snapshot.category",
    origin: "note_snapshot_product",
    availability: "stored",
    existingApi: "NoteListItem.productName / productCategory (mapper resolveProductName)",
    notes: "Frozen from Application.financing_type + Product.workflow at note create. Marketing blurb is not stored.",
  },
  listingDate: {
    label: "Listing date",
    model: "note_listings",
    path: "opens_at (prefer) or published_at; also notes.published_at",
    origin: "note_listing",
    availability: "stored",
    existingApi: "NoteDetail.listing.opensAt / listing.publishedAt / NoteListItem.publishedAt",
    notes: "Set on publish. Prefer opens_at as listing date for prospectus.",
  },
  maturityDate: {
    label: "Maturity date",
    model: "notes",
    path: "maturity_date",
    origin: "note",
    availability: "stored",
    existingApi: "NoteListItem.maturityDate",
    notes: "Seeded from invoice_snapshot.details.maturity_date / Invoice.details.maturity_date.",
  },
  paymaster: {
    label: "Paymaster",
    model: "notes",
    path: "paymaster_snapshot.name (+ entity_type); source Contract.customer_details",
    origin: "note_snapshot_paymaster",
    availability: "stored",
    existingApi: "NoteListItem.paymasterName / NoteDetail.paymasterSnapshot",
    notes: "Mapper exposes name only; prospectus may append entity_type for Canva-style label.",
  },
  financingAmount: {
    label: "Financing amount",
    model: "notes",
    path: "target_amount",
    origin: "note",
    availability: "stored",
    existingApi: "NoteListItem.targetAmount / NoteMoneySummary.targetAmount",
    notes: "Marketplace raise amount. Alt snapshot: invoice_snapshot.offer_details.offered_amount.",
  },
  minimumInvestment: {
    label: "Minimum investment",
    model: "n/a (platform constant)",
    path: "MARKETPLACE_MIN_COMMIT_MYR (= 100) via computeMarketplaceCommitBounds().minCommit",
    origin: "platform_constant",
    availability: "constant",
    existingApi: "computeMarketplaceCommitBounds() — not a Note DTO field",
    notes: "Not stored on Note. Cap at remaining capacity; floor is 100 MYR.",
  },
  profitRate: {
    label: "Profit rate",
    model: "notes",
    path: "profit_rate_percent",
    origin: "note",
    availability: "stored",
    existingApi: "NoteListItem.profitRatePercent",
    notes: "From invoice.offer_details.offered_profit_rate_percent at create (resolveOfferedProfitRate).",
  },
  expectedReturn: {
    label: "Expected return",
    model: "n/a (calculated)",
    path: "inputs: profit_rate_percent, service_fee_rate_percent, tenure days",
    origin: "calculated",
    availability: "calculated",
    existingApi:
      "NoteInvestorRepaymentSummary.expectedReturnRatePercent via computeNetExpectedReturnRatePercent()",
    notes:
      "API exposes annual NET rate (profit * (1 - serviceFee/100)). Canva 3.95% matches period GROSS ≈ profitRate * tenureDays/365. Prospectus must pick one semantics.",
  },
  tenure: {
    label: "Tenure",
    model: "n/a (calculated)",
    path: "calculateCalendarDayCount(listing.opens_at | published_at, maturity_date)",
    origin: "calculated",
    availability: "calculated",
    existingApi: "calculateCalendarDayCount() in notes/calculators.ts — no tenureDays on Note DTO",
    notes: "Marketplace resolveMarketplaceDaysToMaturity() is days-left countdown, not contractual tenure.",
  },
  purposeOfFinancing: {
    label: "Purpose of financing",
    model: "applications",
    path: "business_details.financing_for (or financingFor)",
    origin: "application",
    availability: "missing",
    existingApi: "Application review UI only — not on Note snapshots / note DTOs",
    notes: "Requires join Note.source_application_id → Application.business_details, or freeze into snapshot later.",
  },
  paymentBasis: {
    label: "Payment basis",
    model: "note_payment_schedules (inferred)",
    path: "single schedule at maturity ⇒ Bullet Payment",
    origin: "calculated",
    availability: "inferred",
    existingApi: "NoteDetail.paymentSchedules[] — no paymentBasis label field",
    notes: "Platform currently creates one schedule (sequence 1). No stored payment-basis enum.",
  },
  shariahPrinciple: {
    label: "Shariah principle",
    model: "n/a",
    path: "none",
    origin: "none",
    availability: "unresolved",
    existingApi: "none",
    notes: "Not in Prisma. Canva hardcodes Bai' Al-Dayn Bi Al-Sila'. Needs product/config or platform constant.",
  },
};

// --- Legacy page-1 Canva POC types (kept for existing PDF script; not Stage 1 focus) ---

export interface ProspectusMetaItem {
  label: string;
  value: string;
}

export interface ProspectusRiskRating {
  grade: string;
  levelLabel: string;
  description: string;
  scaleLinkLabel: string;
}

export interface ProspectusSummaryRow {
  label: string;
  value: string;
}

export interface ProspectusHighlight {
  title: string;
  description: string;
}

export interface ProspectusGlanceMetric {
  label: string;
  value: string;
}

export interface ProspectusTrackRecordMetric {
  label: string;
  value: string;
}

export interface ProspectusHistoricalNoteRow {
  noteId: string;
  financingType: string;
  amountRm: string;
  tenure: string;
  profitRatePa: string;
  status: string;
  repaymentDate: string;
}

export interface ProspectusPage1Data {
  brandName: string;
  tagline: string;
  complianceBadge: string;
  documentTitle: string;
  noteReference: string;
  financingTypeLabel: string;
  financingTypeBlurb: string;
  metaItems: ProspectusMetaItem[];
  riskRating: ProspectusRiskRating;
  investmentSummary: ProspectusSummaryRow[];
  keyHighlights: ProspectusHighlight[];
  atAGlance: ProspectusGlanceMetric[];
  trackRecordHeading: string;
  trackRecordMetrics: ProspectusTrackRecordMetric[];
  historicalNotes: ProspectusHistoricalNoteRow[];
  trackRecordDisclaimer: string;
  footerDisclaimer: string;
}
