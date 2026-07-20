/**
 * SECTION: Future prospectus field-source research (not Note Identity)
 * WHY: Preserve prior Stage 1 audit notes for later sections without mixing into Note Identity POC
 *
 * Do not treat this catalog as the active Note Identity implementation.
 * Active Note Identity sources live in prospectus-note-identity.types.ts.
 *
 * =============================================================================
 * BOSS-REVIEW ALIGNMENT — VALUE CATEGORIES (immediate step)
 * =============================================================================
 *
 * AUTO-DERIVED (portal / frozen Note / shared calculators)
 * - Listing Date → note_listings.opens_at
 * - Closing Date → note_listings.closes_at (canonical; display may append duration)
 * - Maturity Date → notes.maturity_date
 * - Expected Return (p.a.) → resolveNetExpectedReturnRatePercent (portal net annual)
 * - Confirmed Page 2/3 financial rows from Application freeze (no live published fallback)
 * - SoukScore grade scale AAA | AA | A | BBB | BB | B (marketplace-consistent; Canva A- rejected)
 *
 * FIXED TEMPLATE (product/template; not free text)
 * - Payment Basis / Shariah Principle — typed fixed_template placeholders until approved copy
 * - Six Investor Takeaway category names + order (fixed)
 * - Dropdown option catalogues versioned in code (placeholders for now)
 *
 * FUTURE OFFICER-SELECTED (pre-marketplace review workflow — NOT built yet)
 * - Key Investor Highlights
 * - Credit Insights labels
 * - Invoice / work-performed statements
 * - Investor Takeaway description option keys
 * - Missing Page 3 financial values (manual fills only for unsupported rows)
 * - Paymaster track-record metrics (no reliable source today)
 *
 * HIDDEN (legal privacy — boss-review removal is issuer identity only)
 * - Issuer company name
 * - SSM / registration number (and old SSM)
 * - Page 3 Issuer metadata strip item
 * - Shariah badge is NOT hidden; it remains via shared prospectus-header on Pages 1–3
 *
 * SHARED HEADER (prospectus-header.*)
 * - Logo, brand name, tagline, Shariah Status Badge — same module for Page 2/3 HTML
 * - No Page 3-specific header without the badge
 *
 * PLACEHOLDERS
 * - Central module: prospectus-placeholder-publication-content.ts
 * - Sample/preview builders may pass publicationContent
 * - Prisma Note mappers must leave publicationContent undefined (no silent production fill)
 * - Do not overwrite Application or CTOS source records
 * - Final approved dropdown wording pending risk/legal
 *
 * CTOS BOUNDARY (unchanged production mapping)
 * - Page 3 financials remain Application-statement derived via Page 2 freeze
 * - CTOS may exist as admin/suggestion source later; not investor display mapping now
 * - Never overwrite CTOS or Application with prospectus-specific entries
 *
 * CONFLICT NOTE (meeting vs portal)
 * - Meeting suggested Expected Return start = Closing Date
 * - Portal net annual rate does NOT use Closing Date as profit-start
 * - Period $ returns use activated_at → maturity on position surfaces
 * - Prospectus follows portal net annual helper; Closing Date is date display only
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
 * Still unresolved / deferred to pre-marketplace workflow:
 * - Officer-selected highlight / credit / invoice / takeaway persistence
 * - Approved Payment Basis / Shariah Principle production copy
 * - Paymaster track-record reliable source
 * - Final SoukScore grade-scale copy confirmation (scale itself unchanged)
 *
 * =============================================================================
 * PAGE 2 — STAGE 1 ABOUT THE ISSUER (implemented; identity hidden)
 * =============================================================================
 *
 * Module: prospectus-issuer-profile.*
 * Preview: pnpm prospectus:issuer-profile-preview
 * Output: apps/api/tmp/prospectus/prospectus-issuer-profile-preview.html
 * Freeze helper: note-issuer-snapshot.ts (NoteService.createFromInvoiceSource)
 *
 * Visible non-identifying fields (frozen notes.issuer_snapshot):
 * - Industry → notes.issuer_snapshot.industry (separate field)
 * - Company Size → officer Prospectus content page2.issuerProfile.companySize
 *   (Micro | Small | Medium | Large; required for Approve; never inferred)
 * - Registered Country → notes.issuer_snapshot.country
 *   display: "Registered in {country}"; no hardcoded Malaysia; missing → DNA
 * - Business Description → notes.issuer_snapshot.business_description
 *   (leading issuer name stripped when present)
 *
 * HIDDEN (not rendered; rows removed — not "Data not available"):
 * - Company Name / Registration Number / old SSM / Entity Type
 *
 * Backward compatibility: old Notes missing new snapshot keys → Data not available
 * No live IssuerOrganization / Application fallback at render.
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
 * Officer-selected (Prospectus review content; required before Approve):
 * - Deed of Assignment (DOA) → page2.invoicePaymaster.deedOfAssignment (Yes | No)
 * - Paymaster Rating → page2.invoicePaymaster.paymasterRating (PM1–PM4)
 * - Confidence Grading → page2.invoicePaymaster.confidenceGrading (High | Medium | Low)
 * Not inferred from uploads, CTOS, Contract, or Invoice.
 *
 * Snapshot rule: note_creation_snapshots for frozen facts; officer fields from publication content.
 *
 * =============================================================================
 * PAGE 2 — STAGE 3 PAYMASTER TRACK RECORD (officer-entered; no system aggregate)
 * =============================================================================
 *
 * Module: prospectus-paymaster-track-record.*
 * Preview: pnpm prospectus:paymaster-track-record-preview
 * Output: apps/api/tmp/prospectus/prospectus-paymaster-track-record-preview.html
 *
 * Canva metrics are officer-entered via page2.paymasterTrackRecord:
 * - Total Invoices Paid
 * - Total Amount Paid (formatProspectusMoneyMyr; no compact mil)
 * - Successful Repayment
 * - On-Time Payment
 * - Average Payment Period
 *
 * No structured paymaster-history source. No approved stable grouping key.
 * Candidate keys only (not implemented): paymaster_snapshot.ssm_number, .name
 * Name grouping is not approved. Do not reuse Page 1 issuer track-record helpers.
 *
 * =============================================================================
 * PAGE 2 — STAGE 4A 3-YEAR FINANCIAL COMPARISON SOURCE (implemented)
 * =============================================================================
 *
 * Module: prospectus-financial-comparison-source.*
 * Preview: pnpm prospectus:financial-comparison-source-preview
 * Output: apps/api/tmp/prospectus/prospectus-financial-comparison-source-preview.html
 *
 * Selected source: applications.financial_statements.unaudited_by_year only
 * CTOS financials_json: not used
 * Source mixing: forbidden
 *
 * Year rule: latest three valid 4-digit year keys
 * - select: numeric descending
 * - display: ascending as FY{year}
 * - supports 0–3 years; never invent/pad years
 *
 * Financial year end: questionnaire.financial_year_end (ISO YYYY-MM-DD)
 * - reusable month/day applied per selected year via fyEndDateForYear
 * - display: d MMM yyyy (e.g. 31 Dec 2024)
 * - no hardcoded 31 December when source missing/invalid
 *
 * Table unit label: Data not available (no MYR mil. / compact conversion)
 * Future Stage 4B cells: full MYR via formatProspectusMoneyMyr
 * Source note: Data not available (no audited/management claim)
 *
 * Live Application values; freeze later at prospectus publication
 * (notes.prospectus_snapshot.page_2). Stage 4B calculates supported metrics.
 *
 * =============================================================================
 * PAGE 2 — STAGE 4B 3-YEAR FINANCIAL COMPARISON METRICS (implemented)
 * =============================================================================
 *
 * Module: prospectus-financial-comparison-metrics.*
 * Preview: pnpm prospectus:financial-comparison-metrics-preview
 * Output: apps/api/tmp/prospectus/prospectus-financial-comparison-metrics-preview.html
 *
 * Consumes Stage 4A ProspectusFinancialComparisonSource only (no independent year selection).
 *
 * Supported rows:
 * - Revenue → rawFinancials.turnover → formatProspectusMoneyMyr
 * - Profit After Tax → rawFinancials.plnpat → formatProspectusMoneyMyr
 * - Net Profit Margin → calculateProfitMargin(plnpat, turnover) → percent from ratio
 * - ROE → calculateReturnOnEquity(plnpat, bsqpuc) → percent from ratio
 * - Current Ratio → calculateCurrentRatio(bscatot, curlib) → "{n}x"
 *
 * Officer-configurable when unset → Data not available (no approximation):
 * - Net Debt / Equity — page2.financialComparison.overrides; do NOT substitute calculateGearing
 * - Interest Coverage — officer override per year
 * - DSCR — officer override per year
 * - Receivables Days — officer override per year
 *
 * Application unaudited source only; CTOS not used; no source mixing.
 * Full MYR cells; no compact/million conversion (Canva "MYR mil." unit label remains DNA).
 * Table unit label remains Stage 4A DNA. No visible source statement/note.
 *
 * =============================================================================
 * PAGE 2 — STAGE 5 CREDIT INSIGHTS (implemented as DNA-first)
 * =============================================================================
 *
 * Module: prospectus-credit-insights.*
 * Preview: pnpm prospectus:credit-insights-preview
 * Output: apps/api/tmp/prospectus/prospectus-credit-insights-preview.html
 *
 * No approved investor-facing credit classification mapping.
 * CTOS / CCRIS raw values are not displayed.
 * SoukScore is not reused for Credit Score.
 * RegTank / AML / KYC are not mixed into this section.
 *
 * All Canva fields currently Data not available:
 * - Credit Score
 * - Payment Behaviour
 * - Credit Utilisation
 * - Litigation Check
 * - CCRIS Status
 * - Credit Score Explanation
 *
 * Rejected Canva labels: Good / Healthy / Clear / No record
 * Rejected Canva SSM creditworthiness explanatory sentence
 * Zero/empty legal or CCRIS records do not mean Clear / No record
 * Legal/compliance approval required before any non-DNA implementation
 * Future approved values should freeze at publication
 *
 * =============================================================================
 * PAGE 2 — STAGE 6 ABOUT THE INVOICE / WORK PERFORMED (implemented as DNA-first)
 * =============================================================================
 *
 * Module: prospectus-invoice-work-narrative.*
 * Preview: pnpm prospectus:invoice-work-narrative-preview
 * Output: apps/api/tmp/prospectus/prospectus-invoice-work-narrative-preview.html
 *
 * Four separate factual/legal claims — no automatic inference allowed.
 * Contract snapshot does not prove work completion.
 * Invoice document / status does not prove certification or paymaster acceptance.
 * Trustee workflow / product config / maturity do not prove direct paymaster-to-trust payment.
 * DOA upload slot or file does not prove valid execution or assignment.
 * Application free text is not used as legal proof.
 *
 * All four current statements are Data not available:
 * - Work Under Contract Statement
 * - Certification and Acceptance Statement
 * - Paymaster-to-Trust-Account Statement
 * - Deed of Assignment Statement
 *
 * Future preferred source (not created yet):
 * notes.prospectus_snapshot.page_2.invoice_work_narrative
 * {
 *   work_under_contract_statement: string | null,
 *   certification_acceptance_statement: string | null,
 *   paymaster_trust_account_statement: string | null,
 *   deed_of_assignment_statement: string | null
 * }
 * Admin/legal-approved frozen text; publication freeze required when approved.
 * Legal/compliance approval required before any non-DNA implementation.
 *
 * =============================================================================
 * PAGE 2 — STAGE 7 SOUKSCORE RATING SCALE (structural AAA–B; copy DNA)
 * =============================================================================
 *
 * Module: prospectus-soukscore-rating-scale.*
 * Preview: pnpm prospectus:soukscore-rating-scale-preview
 * Output: apps/api/tmp/prospectus/prospectus-soukscore-rating-scale-preview.html
 *
 * Page 2 scale uses SoukScore (not Canva A–E).
 * Canonical grades (SOUKSCORE_RISK_RATING_GRADES): AAA, AA, A, BBB, BB, B
 * Selected grade source: notes.invoice_snapshot.offer_details.risk_rating
 * Validator reused: isSoukscoreRiskRating
 * Canva A–E scale rejected; no A–E mapping; no numeric score or threshold ranges
 * Labels unresolved; definitions unresolved; assessment note unresolved
 * CTOS / CCRIS / RegTank / AML / KYC not mixed
 * Selected grade may be structurally highlighted (isSelected / data-selected)
 *
 * Future preferred source: versioned approved static configuration
 * Future prospectus snapshot should record configuration version at publication
 * Current labels, definitions, and assessment note remain Data not available
 *
 * Page 1 relationship (Page 1 not modified here):
 * - Page 1 links with "See rating scale on page 2"
 * - Page 2 now has the correct AAA–B structural scale
 * - Page 1 audit.scaleStatus remains pending_scale_decision until approved copy exists
 * - Scale decision is not fully resolved while labels/definitions/note are DNA
 *
 * =============================================================================
 * PAGE 2 — STAGE 8 CTA AND SHARED HEADER
 * =============================================================================
 *
 * Modules:
 * - prospectus-header.* (reusable across prospectus pages)
 * - prospectus-investment-cta.*
 * Preview: pnpm prospectus:investment-cta-preview
 * Output: apps/api/tmp/prospectus/prospectus-investment-cta-preview.html
 *
 * Header:
 * - Official logo: apps/investor/public/logo.svg (packages/ui Logo → /logo.svg)
 * - Tagline requires confirmed existing brand copy — Canva-only wording not approved
 * - Shariah badge unresolved (Data not available)
 * - No inference from -i product names, Tawarruq, or Shoraka
 *
 * CTA:
 * - Heading static: INVEST WITH CONFIDENCE
 * - Paragraph unresolved (Data not available)
 * - Button label static: INVEST NOW
 * - Destination: confirmed investor route /investments/{notes.id}
 * - Auth required in investor portal; URL alone does not prove investability
 * - Investability: Page 2 mapper uses computeMarketplaceCommitBounds(target, funded)
 * - Minimum investment: MARKETPLACE_MIN_COMMIT_MYR via formatProspectusMoneyMyr
 * - Display: Minimum investment: RM 100.00 (full money; not Canva RM 100)
 * - No attractive / short-term / Shariah-compliant investment claims
 *
 * No prospectus shared footer. No Investment Risk Warning / Product Terms block.
 * No visible source statement on Pages 1–3.
 *
 * =============================================================================
 * PAGE 2 — FULL PRISMA MAPPER + PUBLICATION SNAPSHOT + HTML ASSEMBLY
 * =============================================================================
 *
 * Modules: prospectus-page-two.*
 * Preview: pnpm prospectus:page-two-preview [--note-id=<NOTE_ID>]
 * Output: apps/api/tmp/prospectus/prospectus-page-two-preview.html
 * Page size: A4 210mm × 297mm (same as Page 1)
 *
 * Prisma query boundary (PROSPECTUS_PAGE_TWO_NOTE_SELECT):
 * - Note snapshots: issuer_snapshot, invoice_snapshot, paymaster_snapshot, prospectus_snapshot
 * - Note fields: id, note_reference, status, published_at, source_application_id,
 *   maturity_date, target_amount, funded_amount, listing opens_at/closes_at/status
 * - Application.financial_statements loaded ONLY for unpublished Stage 4 preview
 * - No CTOS; no live organization fields; no live invoice/paymaster fallbacks
 *
 * Publication rule (same as Page 1):
 * status === PUBLISHED && published_at != null
 *
 * Page 2 snapshot shape (notes.prospectus_snapshot.page_2):
 * {
 *   financial_comparison: {
 *     source: "application_financial_statements",
 *     selected_years: [{ year, year_label, financial_year_end_label, raw_financials }],
 *     calculated_at: ISO string
 *   },
 *   config_versions?: { soukscore_scale, legal_copy, marketing_copy }
 * }
 * raw_financials keys (shared Page 2 + Page 3):
 *   turnover, plnpat, bsqpuc, bscatot, curlib,
 *   plnpbt, bsfatot, othass, bsclbank, bsslltd, bsclstd
 * (JSON-safe scalars; bsclbank = Non-Current Assets, never Cash & Bank)
 * No formatted money/HTML/CTOS/legal/marketing claims in snapshot.
 *
 * Publish merge (NoteService.publish):
 * - Build page_1 track-record snapshot as before
 * - Build page_2 financial_comparison from Application financial_statements
 * - Merge via wrapProspectusSnapshotWithPageTwo (preserve unknown branches; replace page_1/page_2)
 * - Missing financials → valid empty selected_years (publication continues)
 *
 * Snapshot preference:
 * - Published + valid page_2 → frozen Stage 4 only (no live Application read)
 * - Unpublished → live Application → Stage 4A → Stage 4B
 * - Published missing/malformed page_2 → empty Stage 4 (no live fallback; no repair)
 *
 * Investability: computeMarketplaceCommitBounds(target, funded).investable
 * CTA href /investments/{note.id} only when investable; else disabled button
 *
 * Assembly order:
 * header → Stage 1 → 2 → 3 → 4B financial table → 5 → 6 → 7 → CTA
 * Stage 4A is internal source model only (not a duplicate final section)
 * Page 2 ends after Investment CTA — no source statement, no shared footer
 *
 * Money: formatProspectusMoneyMyr only; no compact/mil/million/k; no (MYR mil.)
 *
 * =============================================================================
 * PAGE 3 — SIX VISIBLE CONTENT STAGES (Canva / Data-First map)
 * =============================================================================
 *
 * Visible content stages (not technical layers):
 * 1. Page Title (+ subtitle DNA)
 * 2. Metadata Strip (Sector, Risk Rating, Paymaster, gradings DNA; Issuer identity omitted)
 * 3. 3-Year Income Statement Summary
 * 4. 3-Year Balance Sheet & Liquidity
 * 5. Cash Flow, Coverage, Efficiency + Trend (3-Yr) column
 * 6. Investor Takeaways
 *
 * Plus: Shared header via buildProspectusHeaderHtml (logo, brand, tagline, Shariah badge)
 * No source statement. No shared footer.
 *
 * Technical integration (NOT a seventh visible stage):
 * - Prisma loader / mapper / shared page_2 financial freeze / HTML assembly / preview
 * Modules: prospectus-page-three.*
 * Preview: pnpm prospectus:page-three-preview [--note-id=<NOTE_ID>]
 * Output: apps/api/tmp/prospectus/prospectus-page-three-preview.html
 * Page size: A4 210mm × 297mm
 *
 * Internal helper modules (may stay split; final HTML follows six stages):
 * - prospectus-page-three-metadata.* → title + metadata (split at HTML composition)
 * - prospectus-page-three-income-statement.* → Stage 3
 * - prospectus-page-three-balance-sheet.* → Stage 4
 * - prospectus-page-three-coverage-efficiency.* → Stage 5 metric values
 * - prospectus-page-three-trends.* → internal 26-metric DNA model; only ten coverage
 *   trends render in Stage 5 Trend (3-Yr) column (no standalone FINANCIAL TRENDS section)
 * - prospectus-page-three-investor-takeaways.* → Stage 6
 *
 * Shared financial source (internal only — not a visible prospectus field):
 * - Page 2 Stage 4A years/FYE/raw via prospectus_snapshot.page_2.financial_comparison
 * - Live unpublished preview may read applications.financial_statements.unaudited_by_year
 * - No independent Page 3 year selection; no CTOS; no published live Application fallback
 * - Extended freeze keys: plnpbt, bsfatot, othass, bsclbank, bsslltd, bsclstd
 * - bsclbank = Non-Current Assets (never Cash & Bank); bsqpuc ≠ Total Equity
 *
 * Assembly order:
 * header → Stage 1 title → Stage 2 metadata → Stage 3 income → Stage 4 balance →
 * Stage 5 coverage+trends → Stage 6 takeaways (page ends)
 *
 * Confirmed helpers (must match Page 2 for shared metrics):
 * - Revenue/PAT/NPM/ROE/Current Ratio; computeTotalAssets/Liabilities; full MYR
 *
 * No standalone visible Financial Trends section.
 * Canva sample claims / trend arrows are not production truth.
 * Final Canva styling remains a later task.
 *
 * Business still unresolved (DNA / finance/product/legal):
 * - subtitle; Paymaster/Confidence grading
 * - Gross Profit; EBITDA; EBIT; Cash & Bank; Trade Receivables; Total Equity; Quick Ratio
 * - OCF; FCF; Interest Coverage; DSCR; Debt/Equity; ROA; days; Asset Turnover
 * - all trends; all investor takeaways
 * - finance policy for zero-default Total Assets/Liabilities
 * - approved narrative snapshot workflow (page_3.investor_takeaways)
 *
 * =============================================================================
 * PAGE 1 / SHARED — CORRECTIONS STILL NEEDED (when remaining stages are implemented)
 * =============================================================================
 *
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
