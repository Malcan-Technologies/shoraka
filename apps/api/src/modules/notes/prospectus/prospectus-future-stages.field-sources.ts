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
 *
 * Stage 5A paymaster highlight — correction notes:
 * - Paymaster name and entity type reuse Stage 2 (notes.paymaster_snapshot.*); both frozen on Note
 * - No government-classification helper; entity_type does not prove payment quality
 * - No paymaster-history data model; Note repayments are not paymaster track record
 * - Highlight title/explanation unsupported; no claim without approved rules and copy
 * - Future options (not implemented): classification mapping, paymaster-history model, admin-authored highlight, claim approval workflow, frozen highlight snapshot
 * - Stage 5B (issuer fundamentals highlight) in prospectus-issuer-fundamentals-highlight.* — live FS; claims unresolved
 *
 * Stage 5B issuer fundamentals highlight — correction notes:
 * - Canonical FS source: applications.financial_statements
 * - Years from unaudited_by_year keys (caller order preserved; no invented sort)
 * - Financial data is live Application data; not frozen on Note (snapshotDecision pending)
 * - Shared calculators exist (profit_margin, gearing, currat, workcap) but are not approved claim rules
 * - No profitability or leverage classification; title/explanation unsupported
 * - Future options (not implemented): approved ratio thresholds, admin-authored narrative, risk/compliance approval, frozen FS summary / highlight snapshot
 * - Stage 5C (return highlight) in prospectus-return-highlight.* — gross + tenure + annual net; marketing claims unresolved
 *
 * Stage 5C return highlight — correction notes:
 * - Annual gross: notes.profit_rate_percent via Stage 4A buildProspectusMainFinancialTerms
 * - Annual net expected return: computeNetExpectedReturnRatePercent (fee on gross profit, not principal)
 * - Annual net ≠ period return; expected period return remains unresolved (Stage 4A DNA)
 * - Prospectus tenure (opens_at→maturity) differs from settlement accrual (activated_at→profit maturity)
 * - No attractive / short-term classification; no approved title or explanation
 * - Stage 6 continues using Stage 4A for gross rate and unresolved period return
 * - Future decisions: gross vs net period value, % vs RM, start date, day-count, rounding, approved wording
 * - Stage 5D (Shariah highlight) in prospectus-shariah-highlight.* — compliance claim unresolved; not Tawarruq-as-proof
 *
 * Stage 5D Shariah highlight — correction notes:
 * - No structured Product-level or Note-level Shariah-compliant status
 * - No structured Shariah-principle source; Stage 5D reuses Stage 4C (Data not available)
 * - Tawarruq/Shoraka is operational evidence only — not legal proof for prospectus wording
 * - No adviser, committee, certificate, opinion, or approval reference stored
 * - No approved title or explanation; landing-page marketing is not a Note-level source
 * - Future options (not implemented): Product compliance flag, approved principle field, adviser/committee reference, approval date/certificate, frozen Note snapshot, approved highlight copy, legal/compliance sign-off
 * - Stage 6 (At a Glance) in prospectus-at-a-glance.* — composes Stage 4A + Stage 2 only
 *
 * Stage 6 At a Glance — correction notes:
 * - Composes Stage 4A (buildProspectusMainFinancialTerms) and Stage 2 (buildProspectusTenureAndMaturity)
 * - Financing amount = notes.target_amount via Stage 4A
 * - Profit rate = notes.profit_rate_percent = annual gross before fees via Stage 4A
 * - Final profit-rate label is Profit Rate (p.a.); Canva "Profit Rate for Investors" rejected as misleading
 * - Expected return remains unresolved (Stage 4A DNA); final label is singular Expected Return
 * - Tenure reuses Stage 2; minimum investment uses MARKETPLACE_MIN_COMMIT_MYR via Stage 4A
 * - No duplicate calculations or formatters; no Canva-specific money/rate formatting in Stage 6
 * - Stage 7 (issuer track-record summary) in prospectus-issuer-track-record.* — identity key only; aggregates unresolved
 *
 * Stage 7 Issuer track-record summary — correction notes:
 * - Static heading: ISSUER'S TRACK RECORD ON CASH SOUK
 * - Issuer grouping key: notes.issuer_organization_id
 * - Current Note exclusion: notes.id != current_note_id
 * - Total Notes Funded: unresolved definition and status filter
 * - Total Amount Funded: candidate source notes.funded_amount; aggregate filter unresolved
 * - Successful Repayment: numerator and denominator unresolved; REPAID does not prove on-time
 * - On-time Payment Rate: issuer dashboard has a six-month schedule metric; not approved for prospectus reuse
 * - No investor-facing track-record block exists today
 * - All metrics would be live if computed; no Note snapshot; freeze-at-publication pending
 * - No positive narrative is approved
 * - Stage 8 (historical note table) in prospectus-historical-note-table.* — row formatters; no eligibility filter
 *
 * Stage 8 Historical note table — correction notes:
 * - Exact Canva columns: Note ID, Financing Type, Amount (RM), Tenure, Profit Rate (p.a.), Status, Repayment Date
 * - Issuer grouping: notes.issuer_organization_id
 * - Current Note exclusion: notes.id != current_note_id (future query; builder preserves caller rows)
 * - Note ID: notes.note_reference (stored value; no ARF conversion)
 * - Financing Type: notes.product_snapshot.product_name (no live Product / alias fallback)
 * - Amount (RM): unresolved; target and funded amounts remain audit-only candidates
 * - Tenure: Stage 2 buildProspectusTenureAndMaturity reuse
 * - Profit Rate: Stage 4A formatProspectusProfitRatePercent (annual gross; no duplicate p.a. in cell)
 * - Status: notes.status raw; display mapping pending (no Fully Repaid inference)
 * - Repayment Date: notes.repaid_at via formatProspectusDateUtc
 * - No on-time inference; no investor return column
 * - Eligibility filter, sort, and row limit pending
 * - Rows are live_historical_notes; isFrozen false; snapshotDecision pending
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
 *
 * Stage 4B timing and purpose (prospectus-timing-purpose.*) — correction notes:
 * - Tenure and maturity reuse Stage 2 buildProspectusTenureAndMaturity
 * - Purpose path: applications.business_details.why_raising_funds.financing_for
 * - Purpose is live Application data (not frozen on Note); snapshotDecision pending
 * - Related fields (how_funds_used, business_plan, etc.) are not fallbacks
 * - Listing Closing Date (note_listings.closes_at) belongs only to Stage 2
 * - Canva "Working Capital" is sample content only — preserve free text as stored
 *
 * Stage 4C payment basis & Shariah principle (prospectus-payment-basis-shariah.*) — correction notes:
 * - Payment Basis: no stored field; create path often has one maturity schedule; schedule shape is not an approved label; inferenceAllowed = false; future enum/config or frozen Note snapshot required
 * - Shariah Principle: no Product/Note structured field; Tawarruq is operational evidence only and must not be the investor-facing principle; legal/adviser decision required; future Product field + frozen Note snapshot + approval reference
 * - Stage 5D must reuse Stage 4C unresolved principle (Data not available) and must not invent a Shariah claim
 * - Canva "Bullet Payment at Maturity" and "Bai' Al-Dayn Bi Al-Sila'" are sample only — never hardcoded as production values
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
    label: "Purpose of Financing",
    model: "applications",
    path: "business_details.why_raising_funds.financing_for",
    origin: "application",
    availability: "stored",
    existingApi: "Application review / issuer business-details step (free text max 400)",
    notes:
      "Stage 4B: live via source_application_id; not frozen on Note. No fallbacks. Listing Closing Date is Stage 2 only.",
  },
  paymentBasis: {
    label: "Payment Basis",
    model: "n/a",
    path: "none",
    origin: "none",
    availability: "unresolved",
    existingApi: "paymentSchedules[] only (amounts/due_date; no label)",
    notes:
      "Stage 4C: Data not available. One maturity schedule observed in create path is insufficient. No inference. Future: stored enum/config or frozen Note snapshot.",
  },
  shariahPrinciple: {
    label: "Shariah Principle",
    model: "n/a",
    path: "none",
    origin: "none",
    availability: "unresolved",
    existingApi: "none",
    notes:
      "Stage 4C: Data not available. Tawarruq ops ≠ investor-facing principle. Stage 5D reuses DNA. Future: Product field + Note snapshot + adviser approval reference.",
  },
};
