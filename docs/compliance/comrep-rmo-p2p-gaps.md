# ComRep RMO-P2P — Data We Are Missing

Source: *Reporting Manual for Recognised Market Operator for Peer-to-Peer Financing (RMO-P2P)*, Securities Commission Malaysia, v1.0 (27/02/2026), 65 pages.

Companion document: [Data we already have](./comrep-rmo-p2p-coverage.md).

This lists every field the SC requires that the platform **cannot** produce today, or can only produce partially. "PDF p." is the page in the reporting manual where the field is defined.

Legend for **State**:

- **Missing** — no field, table, or derivable source anywhere in the codebase.
- **Partial** — some data exists but not in the shape, granularity, or taxonomy the SC requires.
- **Derivable** — the raw data exists but there is no query, aggregation, or export that produces it.

---

## 1. The seven blocking themes

Most of the ~150 individual gaps below collapse into seven root causes. Fixing these unblocks the bulk of the reporting.

| # | Theme | Impact | Rough shape of the fix |
|---|---|---|---|
| 1 | **No operator entity registry.** The platform stores data *about* issuers and investors, but almost nothing about CashSouk itself. | Kills ~90% of the annual RMO Information Report (share capital, own shareholders, own directors, advisors, subsidiaries, own audited financials). | New `operator_*` models plus an admin "Company Profile" settings area. Low technical risk, high data-entry volume. |
| 2 | **No complaints register.** | `[08000] Complaints` cannot be filed at all. | New `Complaint` model + admin CRUD. Categories are a fixed SC enum. |
| 3 | **No legal action register.** | `[09000] Legal Action` cannot be filed at all. | New `LegalAction` model + admin CRUD. |
| 4 | **Investor classification is a boolean.** `is_sophisticated_investor` is true/false; the SC needs Angel / Retail / Sophisticated with four Sophisticated sub-types. | Breaks investor type across three separate tabs in two reports. | Replace boolean with an enum; add the Angel means-test questions to onboarding (see §3). |
| 5 | **No days-past-due (DPD) persistence.** DPD is computed at runtime for late-charge purposes only; nothing is stored or bucketed. | Breaks the entire Position Report `[02000]` and `[03000]`, and the >90 DPD default definition. | Nightly job writing a per-note position snapshot with a DPD bucket. |
| 6 | **No reschedule & restructure (R&R) concept.** | `[04000] R&R notes` cannot be filed at all. | New `NoteRestructure` model linking original → revised campaign. |
| 7 | **Free-text taxonomies where the SC mandates enums.** Industry, company type, designation, purpose of financing, financing type are all free text or a non-matching list. | Values cannot be mapped to SC dropdowns without manual translation each month. | Add SC-aligned enums; back-fill existing rows. |

---

## 2. RMO Information Report (Annual)

This report is about **CashSouk as a company**. It is almost entirely absent from the system.

### [00000] Scoping Questions & [01000] General Information — pp. 8–10

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Reporting Level, Category, Sub-Category, Report Name, Type of Submission, Reporting Start/End Date | 8–9 | Missing | Submission metadata; nothing stores it. | Hardcode constants in the export builder; expose Type of Submission (New/Resubmission) and Reporting End Date as operator input at export time. |
| RMO Company Registration Number (BRN/ROC) | 8 | Partial | Only as the `RECEIPT_MERCHANT_REGISTRATION_NUMBER` env var used for receipt PDFs. Not a first-class record. | Operator Company Profile settings page (see theme 1). |
| Trustee Company Registration Number | 8 | Partial | `PlatformFinanceSetting.trustee_letter_config` holds trustee *name* and address, but no registration number. | Extend `trustee_letter_config`, or better, move the trustee into a proper Advisors table. |
| Name of RMO | 9 | Partial | `trustee_letter_config.platformDisplayName` (defaults to "CashSouk Sdn Bhd") and `RECEIPT_MERCHANT_LEGAL_NAME`. Two sources that can drift. | Single operator profile record; make receipts and letters read from it. |
| Name of Responsible Person | 9 | Missing | No concept of an SC-appointed Responsible Person. `Admin` rows are portal staff. | Operator Company Profile settings page. |
| Contact Number (Responsible Person) | 9 | Missing | — | Same as above. |
| Declaration (Yes/No) | 10 | Missing | — | Capture as a checkbox at export/submission time, with the approving user and timestamp recorded for audit. |

### [02000] Summary of Share Capital — pp. 10–12

**Entire tab missing.** No operator share capital data exists anywhere.

| Field | PDF p. | State | Suggested collection point |
|---|---|---|---|
| Paid-up capital: Ordinary / Preference / Others — number of shares and nominal value (RM) each | 10–11 | Missing | New `OperatorShareCapital` model, edited on an admin Company Profile page. Six numeric fields. |
| Total paid-up capital (Sdn Bhd) | 11 | Missing | Derive as the sum of the three share classes rather than storing separately. |
| LLP: Members' Capital, Members' Reserves, Subordinated Loans, Total | 11–12 | Missing | Same model. Only relevant if the operator is ever an LLP — likely leave blank per manual §2.6. |

### [03000] Shareholders / Members — pp. 12–14

**Entire tab missing.** Note the platform already models issuer shareholders; this is the same shape applied to the operator.

| Field | PDF p. | State | Suggested collection point |
|---|---|---|---|
| Name, Salutation, IC/Passport number, Date of Birth (or incorporation), Nationality, Address | 12–13 | Missing | New `OperatorShareholder` model + admin CRUD. Reuse the shareholder form components already built for issuer onboarding. |
| Date Acquired, Date Disposal | 13–14 | Missing | Same model. |
| Type of Shares (Ordinary/Preference/Others) + Others specify | 14 | Missing | Same model, SC enum. |
| Shareholding Units, Amount (RM), Percentage (%) | 14 | Missing | Same model. |

### [04000] Board of Director / Management Team — pp. 14–16

**Entire tab missing.**

| Field | PDF p. | State | Suggested collection point |
|---|---|---|---|
| Name, Salutation, Identity Number, Date of Birth, Nationality, Address | 14–15 | Missing | New `OperatorOfficer` model + admin CRUD. |
| Board of Director vs Management Team | 14 | Missing | Two-value enum on the same model. |
| Responsible Person flag (Yes/No) | 15 | Missing | Boolean on the same model — this also satisfies the `[01000]` Responsible Person field. |
| Designation (+ Others specify) | 15 | Missing | SC designation enum (CEO, CCO, CFO, Secretary, Chairman ×3, Deputy Chairman ×3, Director ×3, Alternate Director, Others). |
| Appointment Date, Resignation Date | 15–16 | Missing | Same model. |

### [05000] Advisor (Banker/Trustee/Auditor/Others) — pp. 16–17

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Type of Advisor (8-value enum: Accounting, Auditor, Banker, Compliance & Risk, Credit Rating, Legal, Taxation, Trustee/Escrow) | 16–17 | Missing | Only the trustee exists, and only as letter-template config. | New `OperatorAdvisor` model with the SC enum; migrate `trustee_letter_config` to reference it. |
| Advisor Name | 16 | Partial | `trustee_letter_config.trusteeName` only. | Same model. |
| Company Registration No., Country, Address | 16 | Missing | Trustee address exists as free-text letter lines. | Same model, structured. |
| Appointment Date, Cessation Date | 16 | Missing | — | Same model. |

### [06000] Registered Users — pp. 17–19

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Issuer count; Investor count; Investor signed-up-but-not-invested | 17 | Derivable | Countable from `IssuerOrganization`, `InvestorOrganization`, and `NoteInvestment`, but no query or export exists. | Add a reporting query. No schema change needed. |
| Investor Types — Angel / Retail / Sophisticated, split by invested vs not-yet-invested | 18 | Missing | Only `is_sophisticated_investor` (boolean). No Angel concept; corporate investors are auto-flagged sophisticated with reason "Company organization". | See theme 4. Requires an enum plus new onboarding questions. |
| Investor Age Group — 7 buckets, split by invested vs not-yet-invested | 18–19 | Derivable | `InvestorOrganization.date_of_birth` exists for personal accounts only. Bucketing logic does not exist. | Reporting query using the SC's formula (reporting year − birth year). Decide treatment of corporate investors, which have no DOB. |

> **Watch the bucket boundaries.** The SC's buckets ("30–35", "35–40", "50–55", "55–60") overlap at the edges. Pick a convention (e.g. lower-bound inclusive, upper exclusive), document it, and keep it stable across periods.

### [06100] Nationality of Investor — pp. 19–20

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Number of Investor, by Country | 19 | Derivable | `InvestorOrganization.nationality` is populated by RegTank for personal accounts; corporate country sits in `corporate_onboarding_data.addresses.*.country`. | Reporting query. Normalise both sources and map to the SC's Appendix A country names. |
| Investor Category (signed up and invested / yet to invest) | 19 | Derivable | Join against `NoteInvestment`. | Same query. |

> Country names must match **Appendix A** (pp. 63–65) exactly. We have `REGTANK_ISO3166_COUNTRIES` in `packages/types`, but its spellings are ISO, not the SC's. A mapping table will be needed.

### [07000] Fees and Charges to Users — p. 20

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Type of Fees/Charges; Amount (RM); Percentage (%); Type of User (Investor/Issuer) | 20 | Partial | Fee values exist but are scattered across `PlatformFinanceSetting` (onboarding fee, processing fee), `Product` (service fee, facility fee), and per-note rate columns. There is no single table of "fee type → amount/% → who pays". | Add a `PlatformFeeSchedule` model that is the declared source of truth for published fees, and have the export read from it. This is a disclosure of the *published* schedule, so a curated table is more appropriate than deriving from transactions. |

### [08000] Complaints — pp. 20–21

**Entire tab missing.** There is no complaints, ticketing, or support-case model anywhere in the codebase. The only matches for "complaint" relate to AWS SES bounce handling.

| Field | PDF p. | State | Suggested collection point |
|---|---|---|---|
| Complaints Category (System Disruption / Operational Efficiency / Issuer / Others) | 20–21 | Missing | New `Complaint` model with the SC's 4-value enum + free-text "Others". |
| Complaints Category — Others (specify) | 21 | Missing | Same model. |
| Number of complaints received; Number resolved | 21 | Missing | Store one row per complaint with a status, and count at export. Note the manual's rule on p. 20: one complainant raising two issues counts as **two** complaints in two categories, so the model must allow multiple category rows per complainant. |

### [09000] Legal Action — pp. 21–22

**Entire tab missing.** `CtosReport.legal_json` holds *issuer* credit-bureau litigation data, which is a different thing entirely.

| Field | PDF p. | State | Suggested collection point |
|---|---|---|---|
| Date, Case (court reference), Details, Amount (RM), Status | 21–22 | Missing | New `LegalAction` model + admin CRUD. Should cover both actions by the operator (e.g. issuer debt recovery) and against it. Worth linking optionally to a `Note` so recovery actions tie back to a defaulted campaign. |

### [10000] Interest in Other Company — pp. 22–23

**Entire tab missing.**

| Field | PDF p. | State | Suggested collection point |
|---|---|---|---|
| Name, ROC, Country, Address, Acquisition Date, Disposal Date, Type of Shares (+Others), Shareholding Units, Percentage | 22–23 | Missing | New `OperatorInvestment` model + admin CRUD. Likely a very small table in practice. |

### [11000] Financial Statement — pp. 23–25

**Entire tab missing.** `IssuerOrganizationFinancialStatement` covers *issuers*; the operator's own statutory accounts are not stored.

| Field | PDF p. | State | Suggested collection point |
|---|---|---|---|
| Consolidated Accounts (Y/N), Auditor's Name, Financial Year End, UnModified Reports (Y/N), Date of Tabling to Board, Currency, Number of Shares | 24 | Missing | New `OperatorFinancialStatement` model, one row per financial year, entered by finance on an admin page. |
| Balance sheet: Total Assets, Non-Current Assets, Current Assets, Total Equity, Paid-up Capital, Share Application Account, Share Premium & Other Reserves, Accumulated Profit C/F, Minority Interest, Total Liabilities, Non-Current Liabilities, Current Liabilities | 24 | Missing | Same model. |
| P&L: Total Revenue split by Donation / Reward / Lending / Equity Based, Fees charges, Other Revenue | 24–25 | Missing | Same model. Only "Lending Based" and "Fees charges" will be non-zero for a P2P operator. |
| Other Income: Interest from deposit placement, Other Income | 25 | Missing | Same model. |
| Total Cost: Staff Cost, System Cost, Promotion Activities, Other Cost | 25 | Missing | Same model. |
| Profit/(Loss) Before Tax, Taxation, Profit/(Loss) After Tax, Minority Interest, Net Dividend | 25 | Missing | Same model. |

---

## 3. RMO-P2P Report (Monthly)

### [01000] General Information — pp. 27–28

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Name of Responsible Person; Contact Number; Declaration | 27–28 | Missing | Same operator gap as the annual report. | Operator Company Profile settings. |
| Total amount raised (RM) for the month, successful **and** unsuccessful | 28 | Derivable | Computable by summing `Note.funded_amount` over notes whose hosting period ended in the month, but no query exists. | Reporting query. Note the SC wants funds *intended* to be raised, so confirm whether this means target or actual across both outcomes. |

### [02000] Profile of Issuer — pp. 28–30

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Company category: Technology vs Non-Technology | 28 | Missing | Only free-text industry. "Technology (ICT)" appears in a filter list but is not a Tech/Non-Tech flag. | Derive from a mapping of the industry value, or add an explicit two-value field set during application review. A derived mapping is simpler and less error-prone. |
| Date of Incorporation | 29 | Missing | Not extracted from RegTank COD or SSM, and not asked of the issuer. | Best source is the CTOS/SSM company report already fetched at onboarding — parse and persist it onto `IssuerOrganization`. Avoids asking the issuer for something we already buy. |
| Date of Commencement | 29 | Missing | — | Add to the issuer application company details step. Not available from SSM. |
| Country of Incorporation | 29 | Partial | `IssuerOrganization.country` is populated for personal onboarding, not company incorporation. Registered-address country exists in JSON. | Add an explicit field; default to Malaysia and confirm at review. |
| Type of Company (6-value SC enum) | 29 | Partial | `corporate_onboarding_data.basicInfo.entityType` is free text from a RegTank picklist (e.g. "Private Limited Company (Sdn Bhd)"). | Add a mapping from RegTank values to the SC enum in the export layer. No new user input needed. |
| E-mail Address (company-level) | 29 | Missing | Only contact-person email and the owner's account email exist. | Add to the company details step, or designate the contact-person email as the company email and document that decision. |
| Company Activities | 30 | Partial | `Application.business_details.about_your_business.what_does_company_do` is a free-text narrative; the SC wants a short activity descriptor tied to the fundraising purpose. | Reuse the campaign sector value (see below) or add a short structured field. |

### [03000] Financing Details 1 — pp. 30–33

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Campaign Description | 31 | Partial | Spread across `NoteListing.summary`, `Note.product_snapshot.description`, and `Note.purpose_snapshot.financing_for`. No canonical field. | Pick one field as canonical for reporting — `purpose_snapshot.financing_for` is closest to the SC's intent — and document it. |
| Campaign Approval Date | 31 | Partial | No dedicated timestamp. Approval is spread across `ApplicationReview.reviewed_at` per section and the invoice offer approval. | Stamp an `approved_at` on `Application` (or `Note`) when the invoice offer is approved. Small, high-value change. |
| Campaign URL on Operator Website | 31 | Missing | The route `/investments/{note.id}` exists but no absolute URL is stored. | Compose at export time from a base-URL env var plus the note ID. No schema change needed. |
| Campaign Sector (21-value SME Corp / MSIC enum) | 31–32 | Partial | `Note.issuer_snapshot.industry` is one of 17 non-matching onboarding labels. MSIC codes exist only inside CTOS report XML. | Two options: (a) map the 17 labels to the 21 SC sectors, or (b) parse `msic_ssms` from the CTOS report we already fetch. Option (b) is more defensible to the regulator. |
| Sustainability Category (00–G17 UN SDG) | 32 | Missing | No SDG concept anywhere. | Add a dropdown in the admin prospectus/campaign review step. Defaults to "00 – None". |
| Type of Investment Note: Islamic vs conventional | 32 | Missing | Every note is treated as Shariah-compliant via fixed prospectus constants, but nothing records it as data. | Add a field on `Product` (inherited by notes) rather than per campaign, since it follows the product. |
| Name of Shariah Adviser | 32 | Missing | — | Operator-level setting, snapshotted onto the note at publish. It is the same adviser for all Islamic notes. |
| Purpose of Fund Raising (Working Capital / Business Expansion / Others) | 32 | Partial | `purpose_snapshot.financing_for` is free text up to 400 chars. | Add a three-value dropdown to the application's "why raising funds" step, keeping the free text as the "Others" detail. |
| Is SARANA Financing Scheme; Financing Options of SARANA; Financing Scope of SARANA | 33 | Missing | No SARANA support at all. | Only needed if CashSouk participates in the SARANA scheme. Confirm with compliance before building — may be permanently "No". |

### [03100] Financing Details 2 — pp. 33–36

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Campaign Extension Date | 34 | Missing | `NoteListing.closes_at` can be changed but no extension request or audit trail is kept. | Record an extension event (and date) when `closes_at` is moved after publish. `NoteAdminAction` already captures before/after state — could be derived from there if extensions go through it. |
| Type of Financing (4-value SC enum) | 34 | Partial | `Note.product_snapshot` holds free-text product names/slugs. | Map product → SC enum in the export layer. In practice all current products are "Receivables financing". |
| Security Type (4-value SC enum) | 34 | Missing | No secured/unsecured classification. | Derive from guarantor and collateral presence, or add an explicit dropdown at invoice-offer time. |
| Investment Note Tenure (months) | 34 | Partial | Only `Note.maturity_date` is stored; tenure is displayed in **days**. | Compute months at export. Define and document rounding (the SC example implies whole months). |
| Financing Security (description) | 34 | Partial | `ApplicationGuarantor` captures guarantor identity well, but there is no free-text security descriptor (personal guarantee, post-dated cheque, asset-backed). | Compose from guarantor types at export, or add a short field at offer time. |
| Issuer Financing Interest Rate — **effective** | 34–35 | Missing | Only the annualised simple rate (`profit_rate_percent`) exists. | Compute at export: simple rate × tenure. The manual's own example (12% p.a. over 3 months → 3%) defines the formula, so no storage is needed. |
| Investor Return Interest Rate — **simple** | 35 | Derivable | Computed at runtime by `computeNetExpectedReturnRatePercent` (gross rate less service fee) but never persisted. | Reuse the existing helper in the export. |
| Investor Return Interest Rate — **effective** | 35 | Missing | — | Compute at export from the net simple rate × tenure. |
| Repayment Type (Balloon / Bullet / Equal Instalment / Others) | 35 | Partial | Not stored. The platform is bullet-only via the fixed constant `PROSPECTUS_FIXED_PAYMENT_BASIS = "Bullet Payment at Maturity"`. | Report the constant "Bullet Payment" for now. Add a real field only when a second repayment type ships. |
| Repayment Schedule (Monthly / Quarterly / Annually / Bullet / Others) | 35 | Partial | `NotePaymentSchedule` supports multiple sequences but exactly one row is created per note, due at maturity. | Same as above — report "Bullet" until instalment products exist. |

### [04500] Campaign Settlement — pp. 36–37

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Fund Disbursement Date to Issuer/Third party | 36 | Partial | `WithdrawalInstruction.completed_at` records trustee payout completion, which is the closest proxy but is only set when the admin marks the trustee flow complete. | Confirm with finance that `completed_at` is the correct regulatory date, then use it. Watch for rows left uncompleted. |

### [05000] Issuer — Shareholding Structure — pp. 37–39

Shareholder data comes from RegTank corporate onboarding and CTOS. Identity and percentage are captured; the equity detail and demographics are not.

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Salutation | 37 | Missing | Not collected for any party anywhere on the platform. | Low value, high friction. Consider leaving blank per manual §2.6 unless the SC rejects it. |
| Identity Prefix (NRIC / Passport / ROC) | 37 | Partial | `documents.documentType` from RegTank; no explicit three-value prefix. | Derive at export from shareholder type + document type. No new input needed. |
| Date of Birth / Date of Incorporation | 38 | Partial | Not extracted into structured fields. May be inside raw RegTank `formContent`; CTOS holds `person_json.birth_date` for individuals. | Extract from the RegTank/CTOS payloads we already store into structured columns. |
| Gender | 38 | Missing | Not extracted for issuer-side parties. | Derivable from NRIC (12th digit) for Malaysians; otherwise extract from the RegTank KYC payload. |
| Business/Residential Address + **State** + **Postcode** | 38–39 | Partial | Only CTOS `directors[].addr`, a single unstructured string. | Parse the CTOS address, or collect structured addresses for shareholders during onboarding. |
| Type of Shares (Ordinary/Preference/Others) | 39 | Missing | — | Add to the director/shareholder capture step. |
| Shareholding Units | 39 | Missing | Only percentage is captured. | Add to the same step, or parse from the CTOS/SSM company report. |
| Shareholding Amount (RM) | 39 | Missing | CTOS has an `equity` numeric on director rows that is not surfaced. | Surface the existing CTOS `equity` field. |

### [06000] Board of Director / Management Team — pp. 39–42

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Board of Director vs Management Team | 40 | Missing | The platform distinguishes Director vs Shareholder, not Board vs Management. | Add a two-value classification on the party record. |
| Salutation | 40 | Missing | — | Same call as shareholders — likely leave blank. |
| Identity Prefix (IC / Passport) | 40 | Partial | Same as shareholders. | Derive at export. |
| Gender | 40–41 | Missing | — | Derive from NRIC or extract from RegTank. |
| Date of Birth | 41 | Partial | Not extracted structurally. | Extract from stored RegTank/CTOS payloads. |
| Nationality | 41 | Partial | Only document country code. | Extract properly from the KYC payload. |
| Residential Address + **State** + **Postcode** | 41 | Partial | CTOS unstructured string only. | Parse or collect structured. |
| Designation (15-value SC enum) | 42 | Partial | Free text (e.g. "Director") from RegTank; CTOS position codes (DO, SO, DS, AD, AS) are unmapped. | Add a mapping layer from RegTank/CTOS values to the SC enum, with "Others" as the fallback. |
| Appointment Date, Resignation Date | 42 | Partial | Available only from CTOS `company_json.directors[].appoint` / `.resign_date`, which is a point-in-time snapshot that may be stale. | Surface the CTOS values and refresh the report at reporting time. |

### [07000] Investor Details (Successful Campaign) — pp. 42–45

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Identity Prefix (NRIC / Passport / ROC) | 43 | Partial | `document_type` free text from RegTank for individuals; corporate implied by `type = COMPANY`. | Derive at export from org type + document type. |
| Date of Incorporation (corporate investors) | 43 | Missing | `date_of_birth` exists for individuals; no equivalent for companies. | Extract from the corporate onboarding/SSM data already collected. |
| Business/Residential Address — **State** and **Postcode** | 44 | Partial | **Personal investors store address as one free-text string** (max 500 chars). Corporate investors have structured addresses with state and postcode. | Split the personal investor address into structured components. This affects the profile edit form and the RegTank ingest mapping. |
| Type of Investor (6-value SC enum: Angel, Retail, Sophisticated ×3, Non-sophisticated entity) | 44–45 | Missing | Boolean only. See theme 4. | Replace `is_sophisticated_investor` with an enum. Add the Angel means-test to onboarding — note the Angel thresholds (RM180k individual income, RM250k joint, Malaysian tax residency) are **different** from the sophisticated thresholds we currently ask about (RM300k income), so new questions are genuinely required. |
| Amount Pledged (RM) | 45 | Partial | `NoteInvestment.amount` serves as both pledged and invested; the distinction is only the `status` transition COMMITTED → CONFIRMED. | Report `amount` while COMMITTED as pledged and while CONFIRMED as invested. Document the interpretation. |
| Nominees Name; Nominees ROC | 45 | Missing | No nominee concept. Investments are held directly. | Only needed if nominee structures are supported. Confirm with compliance — likely permanently blank. |
| Investment by Related Party (4-value enum) | 45 | Missing | `is_related_party` exists only on the **paymaster** in contract `customer_details`, not for investors. | Add a related-party declaration to investor onboarding, plus an admin override for staff/shareholder accounts we know about. |

### [08000] Fees and Charges (per campaign) — pp. 45–46

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Type of Fees/Charges by Operator; Amount (RM); Percentage (%); Charged To (Investor/Issuer) | 45–46 | Partial | Rates are stored per note (`platform_fee_rate_percent`, `service_fee_rate_percent`) and actuals land in `NoteSettlement.service_fee_amount` and ledger entries, but there is no itemised per-campaign fee table with a payer column. | Build the export as a query that emits one row per (campaign, fee type) from the note rates, settlement amounts, and gateway payments. No new schema strictly required, but a `NoteFee` table would make this far more auditable. |

### [09000] Balance Sheet & [09100] Profit and Loss (Successful Campaign) — pp. 46–49

Issuers submit a simplified unaudited financial schema. The SC wants more granularity.

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Liabilities \| Current — **Borrowing** vs **Non-Borrowing** split | 47 | Missing | Single `curlib` ("Current Liability"). | Split the field in the application's financial statements step. |
| Liabilities \| Non-Current — **Loan** vs **Non-Loan** split | 47 | Missing | `bsslltd` (Long-Term) and `bsclstd` (Non-Current) exist but are not a loan/non-loan split. | Same step. |
| Equity \| Share Application Account | 47 | Missing | — | Same step. |
| Equity \| Share Premium & Other Reserves | 47 | Missing | — | Same step. |
| Equity \| Accumulated Profit Carried Forward | 48 | Missing | — | Same step. Note `plyear` (P&L of the year) is captured, which is related but not the same. |
| Equity \| Minority Interest | 48 | Missing | — | Same step. |
| Operating Cost; Administrative Cost; Interest Cost; Other Cost | 48 | Missing | Only `turnover`, `plnpbt`, `plnpat` are captured — no cost breakdown at all. | Same step. This is the single largest addition to the issuer application form. |
| Minority Interest (P&L) | 49 | Missing | — | Same step. |

> Some of these are available in `CtosReport.financials_json` for issuers with filed accounts. Prefer CTOS where available and fall back to issuer-entered management accounts, mirroring the existing audited/unaudited pattern.

### [10000] Repayment — pp. 49–50

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Repayment Type | 50 | Partial | Bullet-only constant, as in `[03100]`. | Report the constant. |
| Amount Repaid — Principal (RM) | 50 | Partial | **`NotePaymentSchedule.paid_principal` / `paid_profit` / `paid_total` are read by the API mapper but never written** — there is no `update` or `upsert` on that model anywhere. Actual repayments live in `NoteSettlement.investor_principal` and `NotePayment.receipt_amount`. | Either back-fill the schedule columns during settlement posting (recommended — they are already exposed via the API and currently return misleading zeros), or derive solely from settlements and treat the schedule columns as dead. |
| Amount Repaid — Interest (RM) | 50 | Partial | Same as above. Derivable from `NoteSettlement.investor_profit_gross`, which correctly excludes late charges as the SC requires. | Same. |

> The manual's **reconciliation rule** (p. 49) requires (Raised + Interest Accrued) − (Repaid Principal + Interest) − (Outstanding Principal + Interest) = Total Defaulted. This cannot be satisfied until both the repayment figures above and the outstanding position (Position Report `[03000]`) are trustworthy.

### [11000] Defaulted Issuer — pp. 51–54

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Classification of Default (30 / 60 / 90 / 120 days / Others) | 52 | Missing | The platform uses `arrears_threshold_days` (default **14**) after a grace period, then a **manual** `markDefault()`. This is our rulebook definition and does not map to the SC's options. | Add the operator's rulebook classification as a platform setting. Separately, the SC requires >90 DPD for reporting **regardless** of internal policy — so the export must apply its own >90 DPD test rather than reading `default_marked_at`. |
| Actual Due Repayment Date | 52 | Derivable | `NotePaymentSchedule.due_date` exists. | Reporting query. |
| Financing Amount — Interest | 52–53 | Derivable | Computable as effective rate × amount raised, per the manual's own definition. | Compute at export. |
| Repaid Amount — Late charges/fees | 53 | Partial | `NoteSettlement.tawidh_amount` and `gharamah_amount` capture late charges. | Map tawidh + gharamah to the SC's "late charges/fees". Document the mapping. |
| Repaid Amount — Reserves | 53 | Missing | No reserve-retention concept. | Confirm whether CashSouk retains reserves at all; likely permanently blank. |
| Repaid Amount — Other charges | 53 | Missing | — | Likely blank. |
| Unpaid Amount — Principal; Interest | 53 | Missing | Not stored. Must be derived from funded amount less posted settlement components. | Covered by the position-snapshot job (theme 5). |
| Unpaid Amount — Late charges/fees | 53 | Partial | `remainingTawidhAmount` / `remainingGharamahAmount` are computed at runtime but never persisted. | Persist in the position snapshot. |
| Unpaid Amount — Reserves; Other charges | 53–54 | Missing | — | Likely blank. |

---

## 4. RMO-P2P Position Report (Monthly)

### [01000] General Information — pp. 56–57

Same operator gaps as the other two reports: Name of RMO, Responsible Person, Contact Number, Declaration. See §2.

### [02000] Repayment Trend since inception — p. 57

**Entire tab missing.** This needs total repayments (principal + interest) bucketed by how late they were, since inception.

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Total Repayment Made by status: prompt/early, 1–30, 31–60, 61–90, >90 days past due | 57 | Missing | DPD is calculated at runtime only for late-charge decisions; it is never stored, and repayments are never classified by lateness. | When posting a `NoteSettlement`, compute and store the DPD at the time of payment. Without this, historical buckets cannot be reconstructed accurately — so this should be prioritised even ahead of the export itself. |

### [03000] Outstanding — non-defaulted notes — pp. 57–58

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Status of Notes (5 DPD buckets) | 58 | Missing | `NoteServicingStatus` (CURRENT / LATE / ARREARS / …) is a different taxonomy and is not DPD-based. | Position snapshot job (theme 5). |
| R&R Campaign ID | 58 | Missing | No R&R concept. | See theme 6. |
| Outstanding Amount — Principal / Interest / Total | 58 | Missing | No stored position. Derivable from `funded_amount` less posted settlement components, but there is no snapshot table and no query. | Nightly `NotePositionSnapshot` writing principal, interest, total, and DPD bucket per note. This single addition serves this tab, `[02000]`, and the defaulted-issuer unpaid columns. |

### [04000] List of Reschedule & Restructure notes — pp. 58–59

**Entire tab missing.** There is no R&R workflow in the product.

| Field | PDF p. | State | Suggested collection point |
|---|---|---|---|
| Campaign ID; R&R Campaign ID; Interest rate (%) p.a.; Tenure original (months); Tenure R&R (months); Commencement date of R&R; Financing Amount original (RM); R&R amount revised (RM); R&R Payment structure | 58–59 | Missing | New `NoteRestructure` model linking the original note to revised terms, plus an admin R&R workflow. Note the manual's instruction that if no new ID is created, the original Campaign ID is repeated — so a new note record is not strictly required. Confirm with compliance whether CashSouk will offer R&R before building. |

### [10000] Investor's month-end gross deposit & withdrawal — pp. 59–61

Largely supported by the wallet ledger. Two gaps:

| Field | PDF p. | State | Current situation | Suggested collection point |
|---|---|---|---|---|
| Identity prefix (IC / Passport / ROC) | 60 | Partial | Same as `[07000]`. | Derive at export. |
| Type of Investor (Angel / Retail / Sophisticated) | 61 | Missing | Boolean only. See theme 4. | Same fix as `[07000]`; note this tab uses the 3-value list, not the 6-value one. |

---

## 5. Suggested sequencing

Ordered by "unblocks the most reporting per unit of work".

| Priority | Work | Unblocks |
|---|---|---|
| 1 | **Note position snapshot job** (per-note outstanding principal/interest + DPD bucket, written nightly; DPD-at-payment stored on settlements) | Position Report `[02000]`, `[03000]`; P2P Report `[11000]` unpaid columns; the reconciliation rule |
| 2 | **Operator entity registry** (company profile, share capital, shareholders, officers, advisors, investments, financial statements) | ~90% of the annual RMO Information Report |
| 3 | **Investor type enum + Angel means-test questions** | RMO Info `[06000]`, `[06100]`; P2P `[07000]`; Position `[10000]` |
| 4 | **Complaints and legal action registers** | RMO Info `[08000]`, `[09000]` |
| 5 | **Enum mapping layer** (industry→MSIC sector, entity type, designation, financing type, identity prefix) — mostly export-time translation, little new user input | P2P `[02000]`, `[03000]`, `[05000]`, `[06000]` |
| 6 | **Issuer financials expansion** (liability splits, reserves, cost breakdown) | P2P `[09000]`, `[09100]` |
| 7 | **Campaign metadata additions** (approval date stamp, SDG category, purpose enum, Islamic flag, Shariah adviser, security type) | P2P `[03000]`, `[03100]` |
| 8 | **R&R workflow** | Position `[04000]` — only if CashSouk will offer R&R |

## 6. Open questions for compliance

These cannot be resolved from the codebase and need a decision before building:

1. Does CashSouk participate in the **SARANA** scheme? If not, three fields in `[03000]` stay blank permanently.
2. Will **R&R** be offered? If not, the whole Position Report `[04000]` tab stays blank.
3. Are **nominee** investment structures in scope? If not, two `[07000]` fields stay blank.
4. Does CashSouk retain **reserves** against default? If not, four `[11000]` fields stay blank.
5. What is our **rulebook default classification** (30/60/90/120 days)? The platform currently uses a 14-day arrears threshold plus manual marking, which matches none of the SC options.
6. For fields we genuinely do not have, manual §2.6 says leave blank — do **not** write "N/A". Confirm which of the above the SC will accept as blank.
7. Age-group bucket boundaries in `[06000]` overlap as written in the manual. Which convention do we adopt?
