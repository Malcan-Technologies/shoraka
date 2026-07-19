/**
 * SECTION: Future prospectus field-source research (not Note Identity)
 * WHY: Preserve prior Stage 1 audit notes for later sections without mixing into Note Identity POC
 *
 * Do not treat this catalog as the active Note Identity implementation.
 * Active Note Identity sources live in prospectus-note-identity.types.ts.
 *
 * =============================================================================
 * PAGE 1 PRISMA MAPPER + FULL ASSEMBLY (implemented)
 * =============================================================================
 *
 * Query boundary (prospectus-page-one-prisma.ts):
 * - Load Note by id with PROSPECTUS_PAGE_ONE_NOTE_SELECT only
 * - Includes listing.opens_at / listing.closes_at and Note snapshot JSON fields
 * - Does not load investor commitments, transactions, documents, live Product, or live Application
 *
 * Publication-state rule (isProspectusNotePublished):
 * - status === PUBLISHED AND published_at != null
 * - Same rule NoteService.publish establishes when freezing prospectus_snapshot
 *
 * Snapshot preference:
 * - Stage 1 description: notes.product_snapshot.description (no live Product fallback)
 * - Stage 4B purpose: notes.purpose_snapshot.financing_for (no live Application fallback)
 * - Stages 7–8 when published + valid prospectus_snapshot.page_1: use frozen values only
 * - Stages 7–8 when unpublished (no freeze yet): live preview via buildProspectusPage1TrackRecordSnapshot
 * - Stages 7–8 when published but snapshot missing/malformed: Data not available / empty table;
 *   do NOT live-recalculate (publication stability)
 *
 * Assembly order (prospectus-page-one.html.ts):
 * 1 Note Identity → 2 Dates/Paymaster → 3 Risk → 4A Financial → 4B Timing/Purpose →
 * 4C Payment/Shariah → 5A–5D Highlights → 6 At a Glance → 7 Track Record → 8 Historical Table
 *
 * Money formatting (confirmed):
 * - Always formatProspectusMoneyMyr full platform money (e.g. RM 3,450,000.00, RM 500,000.00, RM 100.00)
 * - Compact money (mil / million / k / K) is rejected for Page 1 — not required
 * - Stage 7 Total Amount Funded and Stage 8 Amount (RM) use full formatting (resolved)
 *
 * Preview:
 * - pnpm prospectus:page-one-preview
 * - pnpm prospectus:page-one-preview --note-id=<NOTE_ID>
 * - Output: apps/api/tmp/prospectus/prospectus-page-one-preview.html
 * - Sample path (no note-id) uses prospectus-page-one.sample-data.ts
 * - Individual Stage 1–8 preview commands remain available
 *
 * Page size: A4 210mm × 297mm from existing prospectus-page1.html.ts convention
 *
 * Still unresolved (not Page 1 money):
 * - Expected period return formula (Stages 4A / 5C / 6)
 * - Payment Basis / Shariah Principle stored fields (4C / 5D)
 * - Stage 5A–5B claim titles/explanations
 * - Page 2 rating scale alignment with SoukScore AAA–B
 *
 * =============================================================================
 * PAGE 2 — STAGE 2 INVOICE & PAYMASTER INFORMATION (implemented)
 * =============================================================================
 *
 * Module: prospectus-invoice-paymaster.*
 * Preview: pnpm prospectus:invoice-paymaster-preview
 * Output: apps/api/tmp/prospectus/prospectus-invoice-paymaster-preview.html
 *
 * Confirmed Canva fields:
 * - Invoice Amount → notes.invoice_snapshot.details.value (invoice face value)
 *   formatProspectusMoneyMyr only (e.g. RM 625,000.00). Compact money rejected.
 *   Do not use target_amount / funded_amount / requested_amount.
 * - Invoice Due Date → notes.maturity_date (copied from invoice maturity at create)
 *   formatProspectusDateUtc. No live Invoice fallback.
 * - Paymaster → notes.paymaster_snapshot.name (frozen at create)
 * - Nature of Paymaster → notes.paymaster_snapshot.entity_type (full value; no "Government" shorten)
 *
 * Unresolved (Data not available; no inference):
 * - Deed of Assignment (DOA) — no structured executed status
 * - Paymaster Rating — no PM1/PM2 field
 * - Confidence Grading — no High/Medium/Low field
 *
 * Snapshot rule: note_creation_snapshots only; liveFallbackAllowed = false.
 *
 * Corrections still needed when those stages are implemented:
 * - Purpose frozen at Note create: notes.purpose_snapshot.financing_for (from Application financing_for)
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
 * - Stage 7 (issuer track-record summary) in prospectus-issuer-track-record.* — implemented with dashboard-shared helpers
 *
 * Stage 1 Note identity — final decisions:
 * - Raw notes.note_reference (NOTE-...); no ARF; no formatNoteReferenceDisplay
 * - Financing type display uppercase from product_snapshot.product_name (presentation only)
 * - Product description frozen at create: product_snapshot.description from financing_type step config.description
 *
 * Stage 2 Dates — final decisions:
 * - Label Closing Date (not Listing Closing Date); source note_listings.closes_at
 * - Display order: Listing Date → Closing Date → Maturity Date → Paymaster
 *
 * Stage 7 Issuer track-record summary — final decisions:
 * - Static heading: ISSUER'S TRACK RECORD ON CASH SOUK
 * - Eligible statuses: ACTIVE, REPAID, ARREARS, DEFAULTED (exclude DRAFT/PUBLISHED/FUNDING/FAILED_FUNDING/CANCELLED)
 * - Group by notes.issuer_organization_id; exclude current notes.id
 * - Total Notes Funded: count eligible notes
 * - Total Amount Funded: SUM(funded_amount); never target_amount; display via formatProspectusMoneyMyr (full money; no compact mil/k)
 * - Successful Repayment: REPAID / (REPAID + ARREARS + DEFAULTED) × 100; ACTIVE excluded; DNA if denom 0
 * - On-time Payment Rate — Last 6 Months: shared schedule-level helper with dashboard; exclude current Note schedules
 * - Frozen at publish into notes.prospectus_snapshot.page_1.issuer_track_record
 * - Stage 8 (historical note table) in prospectus-historical-note-table.* — funded history table
 *
 * Stage 8 Historical note table — final decisions:
 * - Exact Canva columns: Note ID, Financing Type, Amount (RM), Tenure, Profit Rate (p.a.), Status, Repayment Date
 * - Same issuer; exclude current Note; statuses ACTIVE/REPAID/ARREARS/DEFAULTED
 * - Sort updated_at DESC; limit 4
 * - Amount = notes.funded_amount via formatProspectusMoneyMyr (full money; no compact mil/k)
 * - Status labels: Active / Repaid / In Arrears / Defaulted (not Settled / Fully Repaid / raw enum)
 * - Repayment Date = notes.repaid_at; empty state: "No notes are available yet."
 * - Frozen at publish into notes.prospectus_snapshot.page_1.historical_notes
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
 * - Purpose frozen at Note create: notes.purpose_snapshot.financing_for
 * - Original source at create: applications.business_details.why_raising_funds.financing_for
 * - Render must not read live Application; old Notes without snapshot → Data not available
 * - Related fields (how_funds_used, business_plan, etc.) are not fallbacks
 * - Closing Date (note_listings.closes_at) belongs only to Stage 2
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
    model: "notes",
    path: "purpose_snapshot.financing_for",
    origin: "note",
    availability: "stored",
    existingApi: "Frozen at Note create from Application financing_for (free text max 400)",
    notes:
      "Stage 4B: notes.purpose_snapshot.financing_for. No live Application at render. Closing Date is Stage 2 only.",
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
