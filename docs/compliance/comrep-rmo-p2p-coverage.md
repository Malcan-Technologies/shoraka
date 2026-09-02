# ComRep RMO-P2P — Data We Already Have

Source: *Reporting Manual for Recognised Market Operator for Peer-to-Peer Financing (RMO-P2P)*, Securities Commission Malaysia, v1.0 (27/02/2026), 65 pages.

Companion document: [Data we are missing](./comrep-rmo-p2p-gaps.md).

This lists every field the SC requires that the platform **can** produce today. "PDF p." is the page in the reporting manual where the field is defined.

Legend for **Availability**:

- **Stored** — a dedicated column or well-defined JSON key holds the value.
- **Derivable** — the underlying data is reliable and complete; only a query or computation is needed, with no new user input and no schema change.

Every row includes the caveats that matter when building the export, because several "stored" values need normalising before they will satisfy the SC's formats.

---

## Summary

| Report | Frequency | Coverage today |
|---|---|---|
| RMO Information Report | Annual | **Collection is in place** for `[01000]`–`[05000]`, `[10000]`, `[11000]` on Admin → Shoraka Profile. User statistics and fees remain derivable/partial. XBRL export is not built. |
| RMO - P2P Report | Monthly | **Moderate to good.** Campaign identity, amounts, dates, rates, risk grading, settlement, and investor identity are well covered. Classification enums and issuer financial granularity are the weak points. |
| RMO - P2P Position Report | Monthly | **Low to moderate.** The investor deposit/withdrawal tab is well covered by the wallet ledger; the outstanding and repayment-trend tabs need a position snapshot that does not exist yet. |

The platform's strongest area is **money movement** — the ledger, settlement, and gateway payment models are detailed and auditable. Its weakest area is **regulatory classification** — the taxonomies the SC mandates are mostly free text or absent.

---

## 1. RMO Information Report (Annual)

Operator company fields are stored on `OperatorProfile` and child models, edited at Admin → Settings → Shoraka Profile.

| Tab | Model | Notes |
|---|---|---|
| `[01000]` | `OperatorProfile` | Name, ROC, trustee ROC, responsible person name/phone. Declaration remains export-time. |
| `[02000]` | `OperatorShareCapital` | Ordinary / Preference / Others units+RM; explicit `total_paid_up_capital` and `total_llp`. No “Others specify” row on this annual tab. |
| `[03000]` | `OperatorShareholder` | `holder_type` (Shareholder / Member / Beneficial Owner) separate from `entity_type` (Individual / Corporate). |
| `[04000]` | `OperatorOfficer` | Board vs Management, Responsible Person, SC designations. |
| `[05000]` | `OperatorAdvisor` | Eight SC advisor types. |
| `[10000]` | `OperatorInterest` | Units and % only. |
| `[11000]` | `OperatorFinancialStatement` | Explicit `total_revenue` and `total_cost` plus breakdowns. |

Issuer/investor **master profile** (monthly `[02000]`/`[05000]`/`[06000]`/`[07000]`/`[09000]`/`[09100]` completeness) lives on `IssuerOrganization` / `InvestorOrganization` plus `organization_party_profiles`. CashSouk DB is master; CTOS/RegTank seed once; later external values never overwrite unless Admin adopts them.

### [06000] Registered Users — pp. 17–19

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Issuer — number of entities seeking funding | 17 | Derivable | `IssuerOrganization` (count) | Issuer signup → `POST /v1/organizations/issuer` | Decide whether to count all registered issuers or only those that reached `onboarding_status = COMPLETED`. The SC says "seeking funding on or through the platform", which suggests onboarded issuers. |
| Investor — total onboarded | 17 | Derivable | `InvestorOrganization` (count) | Investor signup → account type selection | Same onboarding-status decision. `onboarded_at` marks final admin approval. |
| Investor — signed up but yet to invest | 17–18 | Derivable | `InvestorOrganization` with zero `NoteInvestment` rows | — | The portfolio endpoint already exposes `investmentCount` per investor; the same join gives the platform-wide count. |
| Investor Age Group — 7 buckets | 18–19 | Derivable | `InvestorOrganization.date_of_birth` | RegTank eKYC (`userProfile.dateOfBirth`) | Personal accounts only — corporate investors have no DOB. Use the SC's formula: reporting year − birth year. Bucket boundaries overlap in the manual; pick and document a convention. |

### [06100] Nationality of Investor — pp. 19–20

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Country (nationality of investor) | 19–20 | Derivable | `InvestorOrganization.nationality` (personal); `corporate_onboarding_data.addresses.registered.country` (corporate) | RegTank eKYC / corporate onboarding webhook | Two different sources to unify. Values are ISO-style; must be mapped to the SC's **Appendix A** country names (pp. 63–65). `REGTANK_ISO3166_COUNTRIES` in `packages/types` is a useful starting list but its spellings differ. |
| Number of Investor | 19 | Derivable | Count per country | — | Straightforward aggregation once nationality is normalised. |

### [07000] Fees and Charges to Users — p. 20

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Issuer onboarding fee — Amount (RM) | 20 | Stored | `PlatformFinanceSetting.issuer_onboarding_fee_amount` (default 150) | Admin → Settings → Platform Finance | Charged to Issuer. |
| Application processing fee — Amount (RM) | 20 | Stored | `PlatformFinanceSetting.application_processing_fee_amount` (default 50) | Same | Charged to Issuer. |
| Platform fee — Percentage (%) | 20 | Stored | `PlatformFinanceSetting.platform_fee_rate_cap_percent` (cap, default 3); per-note `Note.platform_fee_rate_percent` | Same; per-note set at invoice offer | Charged to Issuer, withheld at disbursement. |
| Service fee — Percentage (%) | 20 | Stored | `Product.service_fee_rate_percent` (default 15); per-note `Note.service_fee_rate_percent` | Admin → Settings → Products | Charged to Investor, taken from profit. |
| Facility fee — Percentage (%) | 20 | Stored | `Product.default_facility_fee_rate_percent` (default 1); per-contract in `Contract.contract_details` | Admin → Settings → Products; contract offer | Charged to Issuer. |
| Late payment charges — Percentage (%) | 20 | Stored | `Note.tawidh_rate_cap_percent`, `Note.gharamah_rate_cap_percent`; platform defaults on `PlatformFinanceSetting` | Admin → Settings → Platform Finance | Charged to Issuer. Tawidh and gharamah will need mapping to a single SC "late charges" line or two separate rows. |
| Type of User (Investor/Issuer) | 20 | Derivable | Implied by fee type | — | Each fee above has an unambiguous payer, listed in this table. No stored field carries it, so the export must encode the mapping. |

> The values above are complete enough to file the tab, but they are scattered across three models. See gap theme 7 — a curated `PlatformFeeSchedule` would make this auditable rather than assembled by hand each year.

---

## 2. RMO - P2P Report (Monthly)

### [01000] General Information — pp. 27–28

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Total amount raised (RM) for the month, successful and unsuccessful | 28 | Derivable | `Note.funded_amount`, `Note.target_amount`, filtered by `NoteListing.closes_at` / `Note.funding_closed_at` within the period | Investor commitments → `commitInvestment` | Confirm whether the SC wants funds *intended* to be raised (target) or actually raised. The wording "intended to be raised… includes successful and unsuccessful" suggests target amounts across both outcomes. |

### [02000] Profile of Issuer — pp. 28–30

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Name of Issuer | 28 | Stored | `corporate_onboarding_data.basicInfo.businessName` (authoritative); `IssuerOrganization.name` (display) | RegTank corporate onboarding (COD) webhook | **Two sources that can drift** — the COD webhook updates the JSON but not `IssuerOrganization.name`. Use `businessName` for reporting, as it is the verified SSM legal name. |
| Issuer ROC (BRN) | 28 | Stored | `IssuerOrganization.registration_number`; also `corporate_onboarding_data.basicInfo.ssmRegistrationNumber` | RegTank COD ("New SSM registration number") | The SC requires **no dashes, spaces, or special characters** (manual §2.3). Nothing enforces this at storage time, so strip them at export. |
| Issuer ID | 28 | Stored | `IssuerOrganization.id` (cuid, primary key) | Auto-generated at org creation | Satisfies "unique ID assigned to the issuer". Stable across campaigns, which is what the SC expects. |
| Registered Address | 29 | Stored | `corporate_onboarding_data.addresses.registered` → `{ line1, line2, city, postalCode, state, country }` | RegTank COD; editable on issuer profile | Fully structured. |
| Registered Address — **State** | 29 | Stored | `...addresses.registered.state` | Same | Map to the SC's 16-value state list plus "Outside Malaysia". |
| Registered Address — **Postcode** | 29 | Stored | `...addresses.registered.postalCode` | Same | Validated as required alongside line1/city/state/country. |
| Business Address | 29 | Stored | `corporate_onboarding_data.addresses.business` | Same | Same structure as registered. |
| Business Address — **State** | 29 | Stored | `...addresses.business.state` | Same | Same mapping needed. |
| Business Address — **Postcode** | 29 | Stored | `...addresses.business.postalCode` | Same | — |
| Phone Number | 30 | Stored | `IssuerOrganization.phone_number`; mirror in `corporate_onboarding_data.basicInfo.phoneNumber` | RegTank COD; editable on profile | Both are written by the COD webhook, so they stay in sync. |
| Website | 30 | Stored | `corporate_onboarding_data.basicInfo.website` | RegTank COD | Read-only in the UI after onboarding. Often empty for SMEs — blank is acceptable per §2.6. |

### [03000] Financing Details 1 — pp. 30–33

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Campaign ID | 30 | Stored | `Note.note_reference` (unique, format `NOTE-{YYYYMMDD}-{last8OfInvoiceId}`) | Generated at note creation from an approved invoice | Meets the SC's "distinct and not reused" requirement — enforced by a unique constraint. Use `note_reference` rather than `Note.id`, as it is the human-readable identifier shown across the product. |
| Issuer ID | 30 | Stored | `Note.issuer_organization_id` | Set at note creation | Same ID as `[02000]`, so the tabs join cleanly. |
| Issuer ROC | 30–31 | Stored | Via `issuer_organization_id` → `IssuerOrganization.registration_number` | RegTank COD | Same dash-stripping caveat. |
| Campaign Name | 31 | Stored | `Note.title` | Auto-generated at creation, editable by admin while in draft (max 180 chars) | This is the public-facing name shown on the marketplace, which matches the SC's definition. |
| Campaign Application Date | 31 | Stored | `Application.submitted_at` | Issuer submits the financing application | Null while the application is in `DRAFT`. For resubmitted applications, confirm whether the SC wants the original or latest submission date. |
| Campaign Status (Successful/Unsuccessful) | 32–33 | Stored | `Note.funding_status` (`FUNDED`/`CLOSED` vs `FAILED`), `Note.status` (`FAILED_FUNDING`) | `closeFunding()` / `failFunding()` at end of hosting period | **The 80% threshold already matches the SC exactly** — `Note.minimum_funding_percent` defaults to 80 and `meetsMinimumFunding()` gates the success path. It is configurable per note, so verify no note was published with a different value before relying on the status alone. |

### [03100] Financing Details 2 — pp. 33–36

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Fund Raising Start Date | 33 | Stored | `NoteListing.opens_at`; mirrored by `Note.published_at` | Admin publishes the note to the marketplace | Both are set to the same timestamp at publish. |
| Fund Raising End Date | 34 | Stored | `NoteListing.closes_at`; `Note.funding_closed_at` when funding succeeds | `closes_at` = publish time + `Product.marketplace_listing_duration_days` (1–90) | The SC wants the end date "irrespective of whether the campaign is successful". Use `closes_at` for consistency across both outcomes rather than `funding_closed_at`, which is only set on success. |
| Assigned Risk Grading | 34 | Stored | `Note.invoice_snapshot.offer_details.risk_rating`; live source `Invoice.offer_details.risk_rating` | Required field when an admin sends the invoice offer | Six-grade CashSouk scale **A–F** (`packages/types/src/invoice-offer-risk-rating.ts`). Required on all new offers; may be null on notes predating the feature. |
| Target Financing Amount (RM) | 34 | Stored | `Note.target_amount` (`Decimal(18,6)`, required) | Set at note creation from the invoice offer / contract facility | — |
| Financing Amount (RM) | 34 | Stored | `Note.funded_amount` (`Decimal(18,6)`, default 0) | Incremented on each investor commitment | This is the actual amount raised at the end of the hosting period. |
| Amount Raised (RM) — principal | 36 | Stored | `Note.funded_amount` | Same | The SC clarifies this is the principal amount, which is exactly what `funded_amount` holds. Same value as the field above. |
| Issuer Financing Interest Rate p.a. — **simple** | 34–35 | Stored | `Note.profit_rate_percent` (`Decimal(7,4)`) | From `Invoice.offer_details.offered_profit_rate_percent`; editable while the note is in draft | Already annualised, which matches the SC's definition. **Verify it never exceeds 18%** — RMO Guidelines ¶14.05(h) caps it, and nothing in the code enforces this. Excludes platform fees, as the SC requires. |

### [04500] Campaign Settlement — pp. 36–37

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Campaign ID / Issuer ID / Issuer ROC | 36 | Stored | As in `[03000]` | — | — |
| Payment to (Issuer vs Investor) | 36 | Derivable | Successful → `WithdrawalInstruction` with `withdrawal_type = ISSUER_DISBURSEMENT`; unsuccessful → `NoteInvestment.status = RELEASED` | `closeFunding()` / `failFunding()` | Cleanly determined by campaign outcome; no ambiguity. |
| Settlement Amount (RM) | 36 | Stored | Successful: `WithdrawalInstruction.amount` (disbursed to issuer); repayments: `NoteSettlement.gross_receipt_amount`. Unsuccessful: sum of released `NoteInvestment.amount` | Trustee withdrawal flow; settlement posting | The SC wants the amount disbursed to the issuer for successful campaigns, or refunded to investors for unsuccessful ones. Pick the disbursement amount, not the settlement receipt, for successful campaigns. |
| Fund Refunded Date to Investor — unsuccessful | 37 | Stored | `NoteInvestment.released_at`; corresponding `InvestorBalanceTransaction.posted_at` (source `NOTE_INVESTMENT_RELEASE`) | Set by `failFunding()` | Funds are credited back to the platform wallet rather than the bank account, which the SC explicitly permits ("credited to their platform account/wallet"). |

### [05000] Issuer — Shareholding Structure — pp. 37–39

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Issuer ROC / Issuer ID | 37 | Stored | As above | — | — |
| Shareholder Type (Individual / Company) | 37 | Stored | `corporate_entities.shareholders[]` vs `corporate_entities.corporateShareholders[]`; CTOS `company_json.directors[].party_type` (`I`/`C`) | RegTank corporate onboarding; CTOS enquiry | Normalised for display by `DirectorShareholderPartyType` (`INDIVIDUAL` / `COMPANY`) in `packages/types`. |
| Shareholder Name | 37 | Stored | `corporate_entities.*.personalInfo.fullName` (or first/last); CTOS `company_json.directors[].name` | RegTank EOD / CTOS | Two sources; the platform already has merge logic (`ctos-directors-verification-merge`) to reconcile them. |
| Shareholder Identity Number | 38 | Stored | `corporate_entities.*.personalInfo.governmentIdNumber`; CTOS `ic_lcno` / `nic_brno` | RegTank EOD form ("Government ID Number") | Strip dashes at export per §2.3/§2.4. Normalisation helpers exist (`normalizeStrictPartyId`) but are used for matching, not storage. |
| Shareholding Percentage (%) | 39 | Stored | RegTank `"% of Shares"` in `formContent`, parsed by `percentOfSharesFromOnboardingCePerson`; CTOS `equity_percentage` | RegTank EOD; CTOS | The only equity field currently captured — units and RM amount are not (see gaps). |

### [06000] Board of Director / Management Team — pp. 39–42

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Issuer ROC / Issuer ID | 40 | Stored | As above | — | — |
| Name | 40 | Stored | `corporate_entities.directors[].personalInfo`; `director_kyc_status.directors[].name`; CTOS `directors[].name` | RegTank EOD; CTOS | Same merge caveat as shareholders. |
| Identity Number (NRIC/Passport) | 40 | Stored | `corporate_entities.directors[].personalInfo.governmentIdNumber` | RegTank EOD | Strip dashes at export. |

> Directors are captured well enough to identify the person, but the demographic and designation fields the SC wants are largely absent. See the gaps document.

### [07000] Investor Details (Successful Campaign) — pp. 42–45

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Campaign ID | 42 | Stored | `NoteInvestment.note_id` → `Note.note_reference` | Investor commits on the marketplace | — |
| Issuer ID / Issuer ROC | 43 | Stored | Via `Note.issuer_organization_id` | — | — |
| Investor Name | 43 | Stored | `InvestorOrganization.legal_name_on_id` (IC/passport legal name); falls back to `first_name` + `middle_name` + `last_name`; `name` for companies | RegTank eKYC OCR | Prefer `legal_name_on_id` — the SC asks for the name "as reflected per verified official documents". `User.first_name`/`last_name` are self-entered at signup and may differ. |
| Investor Identification (NRIC / Passport / Company Reg No.) | 43 | Stored | `InvestorOrganization.document_number` (individual); `registration_number` (corporate) | RegTank eKYC / corporate onboarding | Strip dashes at export. |
| Date of Birth | 43 | Stored | `InvestorOrganization.date_of_birth` | RegTank `userProfile.dateOfBirth` | Individuals only — corporate investors have no incorporation date stored (see gaps). |
| Gender | 43–44 | Stored | `InvestorOrganization.gender` | RegTank `userProfile.gender` | Free text from RegTank, not an enum; values such as `UNSPECIFIED` occur. Map to Male/Female/Not Applicable, using "Not Applicable" for corporate investors as the SC directs. |
| Nationality / Country | 44 | Stored | `InvestorOrganization.nationality`, `country`, `id_issuing_country` | RegTank eKYC | Map to Appendix A names. |
| Date of Pledge | 45 | Stored | `NoteInvestment.committed_at` | Set on commitment | — |
| Amount Invested (RM) | 45 | Stored | `NoteInvestment.amount` where `status = CONFIRMED` | Confirmed at funding close, with `confirmed_at` set | The same column serves as pledged (while `COMMITTED`) and invested (once `CONFIRMED`). Document this interpretation for the SC. |

### [08000] Fees and Charges (per campaign) — pp. 45–46

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Campaign ID / Issuer ID / Issuer ROC | 45 | Stored | As above | — | — |
| Platform fee — Amount (RM) and % | 46 | Derivable | Rate: `Note.platform_fee_rate_percent`; actual: `NoteLedgerEntry` posted at disbursement | Set at invoice offer; posted by `postDisbursementLedger` | Charged to Issuer. |
| Service fee — Amount (RM) and % | 46 | Stored | Rate: `Note.service_fee_rate_percent`; actual: `NoteSettlement.service_fee_amount` | Product default, applied per note; computed at settlement | Charged to Investor. |
| Facility fee — Amount (RM) | 46 | Stored | `Contract.contract_details.facility_fee_rate_percent` and `facility_fee_paid_amount` | Deducted at `closeFunding` | Charged to Issuer. |
| Application processing fee — Amount (RM) | 46 | Stored | `GatewayPayment` with `purpose = APPLICATION_PROCESSING_FEE`, linked via `application_id` | Curlec payment at application submission | Charged to Issuer. Traceable to a specific campaign through the application. |
| Late charges — Amount (RM) | 46 | Stored | `NoteSettlement.tawidh_amount`, `gharamah_amount` | Computed at settlement when overdue | Charged to Issuer. |
| Charged To (Investor / Issuer) | 46 | Derivable | Implied by fee type | — | Encode the mapping in the export, as with the annual fee tab. |

### [09000] Balance Sheet (Successful Campaign) — pp. 46–47

Issuer financial statements are submitted per application (`Application.financial_statements`, v2 shape) and prefilled onto the organisation.

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Assets \| Current (RM) | 47 | Stored | `financial_statements.unaudited_by_year.{year}.bscatot` ("Current Assets") | Issuer application → Financial Statements step | Also available from CTOS `financials_json` for issuers with filed accounts; the platform already has audited/unaudited resolution logic. |
| Assets \| Non Current (RM) | 47 | Stored | `...bsclbank` ("Non-Current Assets"); related `bsfatot` (Fixed Assets), `othass` (Other Assets) | Same | Confirm with finance which field the SC's "Non-Current Assets" maps to — the platform captures fixed, other, and non-current separately, and the labels do not align one-to-one. |
| Equity \| Capital (RM) | 47 | Stored | `...bsqpuc` ("Paid-Up Capital") | Same | Covers the SC's "Equity \| Capital" line only; the other equity lines are missing. |

### [09100] Profit and Loss Account (Successful Campaign) — pp. 48–49

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Total Revenue and Income (RM) | 48 | Stored | `...turnover` ("Turnover") | Issuer application → Financial Statements step | Turnover is revenue only. If the issuer has other income, the SC's "Revenue **and** Income" will understate it. Flag this to finance. |
| Profit/Loss Before Tax (RM) | 49 | Stored | `...plnpbt` | Same | — |
| Profit/Loss After Tax (RM) | 49 | Stored | `...plnpat` | Same | — |
| Net Dividend (RM) | 49 | Stored | `...plnetdiv` | Same | — |

### [10000] Repayment — pp. 49–50

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Campaign ID / Issuer ID / Issuer ROC | 50 | Stored | As above | — | — |
| Financing Amount (RM) | 50 | Stored | `Note.funded_amount` | — | Same value as `[03100]`. |

> The repaid principal and interest columns on this tab are only partially available — see the gaps document. In short, `NotePaymentSchedule.paid_*` columns are never written; the real figures must come from `NoteSettlement`.

### [11000] Defaulted Issuer — pp. 51–54

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Campaign ID / Issuer ID / Issuer ROC | 51 | Stored | As above | — | If a campaign were restructured with a new ID, the SC wants the new one — but the platform has no R&R concept, so this is moot today. |
| Defaulted note identification | 51 | Stored | `Note.status = DEFAULTED`, `Note.servicing_status = DEFAULTED`, `Note.default_marked_at`, `default_reason`, `default_marked_by_admin_user_id` | Admin `markDefault()`, permitted only from `ARREARS` | **Do not use this as the reporting default test.** The SC defines a defaulted note as >90 DPD regardless of internal policy; the platform marks default manually after a 14-day arrears threshold. The export must apply its own >90 DPD rule. |
| Actual Due Repayment Date | 52 | Derivable | `NotePaymentSchedule.due_date` | Created at note creation, set to the invoice maturity date | One schedule row per note today (bullet repayment). |
| Financing Amount (RM) — Principal | 52 | Stored | `Note.funded_amount` | — | The SC confirms this is the principal amount. |
| Repaid Amount (RM) — Principal | 53 | Derivable | `NoteSettlement.investor_principal` on posted settlements | Settlement posting | — |
| Repaid Amount (RM) — Interest | 53 | Derivable | `NoteSettlement.investor_profit_gross` on posted settlements | Settlement posting | Gross profit correctly **excludes** late charges, which is what the SC asks for. Do not use `investor_profit_net`, which is after the investor service fee. |
| Repaid Amount (RM) — Late charges/fees | 53 | Stored | `NoteSettlement.tawidh_amount` + `gharamah_amount` | Settlement posting | Two Shariah-specific charge types mapping to one SC line. Document the mapping. |

---

## 3. RMO - P2P Position Report (Monthly)

### [03000] Outstanding — non-defaulted notes — pp. 57–58

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Campaign ID | 57 | Stored | `Note.note_reference` | — | Filter to notes that are not >90 DPD. |

> The outstanding principal, interest, and total columns are **not** available — there is no position snapshot. See the gaps document, priority 1.

### [10000] Investor's month-end gross deposit & withdrawal — pp. 59–61

This is the best-covered tab in the entire manual, thanks to the append-only wallet ledger.

| Field | PDF p. | Availability | Where it lives | Where it's collected | Caveats |
|---|---|---|---|---|---|
| Company / Individual | 60 | Stored | `InvestorOrganization.type` (`COMPANY` / `PERSONAL`) | Account type selection at signup | Maps directly onto the SC's two values. |
| Investor Name | 60 | Stored | `InvestorOrganization.legal_name_on_id` / name parts / `name` | RegTank eKYC | Prefer the IC/passport legal name, as in `[07000]`. |
| Investor Identification (NRIC / Passport / Company Reg No.) | 60 | Stored | `InvestorOrganization.document_number` / `registration_number` | RegTank | Strip dashes at export. |
| Gender | 60–61 | Stored | `InvestorOrganization.gender` | RegTank | "Not Applicable" for companies, per the SC. |
| Nationality / Country | 61 | Stored | `InvestorOrganization.nationality` / `country` | RegTank | Map to Appendix A. |
| Gross Deposit (RM) | 61 | Derivable | Sum of `InvestorBalanceTransaction` where `direction = IN` and `source = GATEWAY_DEPOSIT` (and `MANUAL_TOPUP` if in scope), filtered by `posted_at` within the month | Curlec deposit flow → wallet credit | **Gross, not net** — sum every deposit rather than the balance change, which is exactly what the append-only ledger supports. The model is indexed on `[investor_organization_id, posted_at]`, so this aggregates efficiently. Decide whether refunds (`GATEWAY_DEPOSIT_REFUND`) net off the gross figure. |
| Gross Withdrawal (RM) | 61 | Derivable | Sum of `InvestorBalanceTransaction` where `direction = OUT` and `source = INVESTOR_WITHDRAWAL_REQUEST`, filtered by `posted_at` | Investor withdrawal request | Same gross treatment. Exclude `NOTE_INVESTMENT_COMMIT` — that is capital deployed into a note, not a withdrawal from the platform. Cross-check against `WithdrawalInstruction` records for completeness. |

> `GatewayPayment` (with `purpose = INVESTOR_DEPOSIT`) and `GatewayPaymentReceipt` provide an independent audit trail for deposits, which is useful for reconciling the ledger figures before filing.

---

## 4. Cross-cutting notes for whoever builds the export

1. **Identifier hygiene.** Manual §2.3 and §2.4 require BRN, ROC, and NRIC values with no dashes, spaces, or special characters. Nothing enforces this at write time anywhere in the platform, so normalise in the export layer, not the database.
2. **BRN and ROC are not interchangeable.** The manual is emphatic about this. We store a single `registration_number` field without recording which kind it is. Confirm with the SC which number was registered in ComRep for CashSouk, and check whether issuer numbers need the same distinction.
3. **Country names.** Every country field must use the Appendix A spellings (pp. 63–65), which differ from the ISO names in `REGTANK_ISO3166_COUNTRIES`. Build a mapping table once and reuse it.
4. **Blank, not "N/A".** Manual §2.6 requires genuinely unavailable non-mandatory fields to be left empty. Do not emit "N/A", "-", or "Not Applicable" as placeholder strings.
5. **Absolute values in RM.** All amounts are absolute Ringgit values. Money is stored as `Decimal(18,6)`; round consistently and document the rounding convention.
6. **Month-end alignment.** Reporting End Date must be a month-end date, and the P2P Report covers campaigns whose hosting period **ended** in the period — a campaign running 31 May to 3 June belongs in the June report, not May. Filter on `NoteListing.closes_at`, not on publish date.
7. **Snapshots vs live data.** `Note.issuer_snapshot`, `invoice_snapshot`, and `product_snapshot` freeze issuer and offer data at note creation. For campaign-level tabs, prefer the snapshot so figures stay stable across resubmissions; for issuer profile tabs, prefer live organisation data so the SC sees current details.
