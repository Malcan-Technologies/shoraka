/**
 * SECTION: Future prospectus field-source research (not Note Identity)
 * WHY: Preserve prior Stage 1 audit notes for later sections without mixing into Note Identity POC
 *
 * Do not treat this catalog as the active Note Identity implementation.
 * Active Note Identity sources live in prospectus-note-identity.types.ts.
 *
 * Corrections still needed when those stages are implemented:
 * - Purpose path is applications.business_details.why_raising_funds.financing_for
 * - Stage 4B (tenure / maturity / purpose) implemented in prospectus-timing-purpose.*
 * - Listing date must use note_listings.opens_at only
 * - Tenure must use opens_at → maturity_date only
 * - Expected period return still needs a business decision
 * - Stage 4C (payment basis / shariah principle) implemented as unresolved → Data not available
 * - Stage 5A (paymaster highlight) in prospectus-paymaster-highlight.* — name/entity only; claims unresolved
 * - Stage 5B (issuer fundamentals highlight) in prospectus-issuer-fundamentals-highlight.* — live FS; claims unresolved
 * - Stage 5C (return highlight) in prospectus-return-highlight.* — gross + tenure + annual net; marketing claims unresolved
 * - Stage 5D (Shariah highlight) in prospectus-shariah-highlight.* — compliance claim unresolved; not Tawarruq-as-proof
 * - Stage 6 (At a Glance) in prospectus-at-a-glance.* — composes Stage 4A + Stage 2 only
 * - Stage 7 (issuer track-record summary) in prospectus-issuer-track-record.* — identity key only; aggregates unresolved
 * - Stage 8 (historical note table) in prospectus-historical-note-table.* — row formatters; no eligibility filter
 *
 * Stage 3 risk (prospectus-risk-assessment.*) — correction notes:
 * - Current platform risk scale (SoukScore): AAA | AA | A | BBB | BB | B
 * - Canva design shows A- and an A–E presentation on page 2 — mismatch unresolved
 * - No approved SoukScore-to-label mapping (e.g. Low Risk)
 * - No numerical SoukScore on Note
 * - No Note-level risk explanation
 * - Page 2 scale must be corrected or approved before final publication
 * - Rating scale link text remains "See rating scale on page 2" with scaleStatus pending_scale_decision
 *
 * Stage 4A main financial terms (prospectus-main-financial-terms.*) — correction notes:
 * - Financing amount = notes.target_amount
 * - Minimum investment = MARKETPLACE_MIN_COMMIT_MYR (not capacity-adjusted minCommit)
 * - Profit rate = notes.profit_rate_percent = annual GROSS before investor service fees
 * - Expected period return = unresolved (Data not available); no approved formula
 * - No approved gross-versus-net, day-count, or rounding decision for period return
 * - Stage 6 At a Glance reuses buildProspectusMainFinancialTerms (same formatters)
 * - Canva sample 3.95% must not be used as production data
 */

export type ProspectusFutureFieldAvailability =
  | "stored"
  | "calculated"
  | "constant"
  | "inferred"
  | "missing"
  | "unresolved";

export type ProspectusFutureFieldOrigin =
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

export interface ProspectusFutureFieldSource {
  label: string;
  model: string;
  path: string;
  origin: ProspectusFutureFieldOrigin;
  availability: ProspectusFutureFieldAvailability;
  existingApi: string;
  notes: string;
}

/** Research-only keys for sections after Note Identity. */
export type ProspectusFutureFieldKey =
  | "listingDate"
  | "maturityDate"
  | "paymasterName"
  | "paymasterEntityType"
  | "financingAmount"
  | "minimumInvestment"
  | "profitRate"
  | "expectedReturnPeriod"
  | "tenure"
  | "purposeOfFinancing"
  | "paymentBasis"
  | "shariahPrinciple";

export const PROSPECTUS_FUTURE_FIELD_SOURCES: Record<
  ProspectusFutureFieldKey,
  ProspectusFutureFieldSource
> = {
  listingDate: {
    label: "Listing date",
    model: "note_listings",
    path: "opens_at",
    origin: "note_listing",
    availability: "stored",
    existingApi: "NoteDetail.listing.opensAt",
    notes: "Implemented in DATA STAGE 2 (prospectus-dates-paymaster). published_at not used.",
  },
  maturityDate: {
    label: "Maturity date",
    model: "notes",
    path: "maturity_date",
    origin: "note",
    availability: "stored",
    existingApi: "NoteListItem.maturityDate",
    notes: "Implemented in DATA STAGE 2 (prospectus-dates-paymaster).",
  },
  paymasterName: {
    label: "Paymaster name",
    model: "notes",
    path: "paymaster_snapshot.name",
    origin: "note_snapshot_paymaster",
    availability: "stored",
    existingApi: "NoteListItem.paymasterName",
    notes: "Implemented in DATA STAGE 2 — name only, no aliases.",
  },
  paymasterEntityType: {
    label: "Paymaster entity type",
    model: "notes",
    path: "paymaster_snapshot.entity_type",
    origin: "note_snapshot_paymaster",
    availability: "stored",
    existingApi: "NoteDetail.paymasterSnapshot only (no typed DTO field)",
    notes: "Implemented in DATA STAGE 2. Display-ready issuer ENTITY_TYPES labels.",
  },
  financingAmount: {
    label: "Financing Amount",
    model: "notes",
    path: "target_amount",
    origin: "note",
    availability: "stored",
    existingApi: "NoteListItem.targetAmount",
    notes: "Stage 4A canonical. Not invoice/offered/funded/disbursed amount.",
  },
  minimumInvestment: {
    label: "Minimum Investment",
    model: "n/a",
    path: "MARKETPLACE_MIN_COMMIT_MYR",
    origin: "platform_constant",
    availability: "constant",
    existingApi: "MARKETPLACE_MIN_COMMIT_MYR (not computeMarketplaceCommitBounds().minCommit)",
    notes: "Stage 4A platform floor. Capacity-adjusted minCommit is not prospectus minimum.",
  },
  profitRate: {
    label: "Profit Rate (p.a.)",
    model: "notes",
    path: "profit_rate_percent",
    origin: "note",
    availability: "stored",
    existingApi: "NoteListItem.profitRatePercent",
    notes: "Stage 4A annual GROSS before investor service fees. Not net / period return.",
  },
  expectedReturnPeriod: {
    label: "Expected Return for Investment Period",
    model: "n/a",
    path: "no period-% field",
    origin: "calculated",
    availability: "unresolved",
    existingApi: "none approved; do not use Canva 3.95% or annual net as period %",
    notes:
      "Stage 4A: Data not available. Pending formula, gross-vs-net, day-count, rounding. Stage 6 reuses Stage 4A value.",
  },
  tenure: {
    label: "Tenure",
    model: "n/a",
    path: "calculateCalendarDayCount(note_listings.opens_at, notes.maturity_date)",
    origin: "calculated",
    availability: "calculated",
    existingApi: "calculateCalendarDayCount()",
    notes: "Implemented in DATA STAGE 2. Marketplace days-left is not used.",
  },
  purposeOfFinancing: {
    label: "Purpose of financing",
    model: "applications",
    path: "business_details.why_raising_funds.financing_for",
    origin: "application",
    availability: "missing",
    existingApi: "Application review / issuer business-details step",
    notes: "Not on Note snapshots. Prior map omitted why_raising_funds.",
  },
  paymentBasis: {
    label: "Payment basis",
    model: "n/a",
    path: "none",
    origin: "none",
    availability: "unresolved",
    existingApi: "paymentSchedules[] only (amounts/due_date; no label)",
    notes:
      "Stage 4C: Data not available. No Bullet helper. Do not infer from single schedule row.",
  },
  shariahPrinciple: {
    label: "Shariah principle",
    model: "n/a",
    path: "none",
    origin: "none",
    availability: "unresolved",
    existingApi: "none",
    notes:
      "Stage 4C: Data not available. Not in schema. Marketing / Tawarruq ops ≠ principle wording.",
  },
};
