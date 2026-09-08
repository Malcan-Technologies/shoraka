# ComRep field semantics matrix

Source of truth: Securities Commission Malaysia, *Reporting Manual for Recognised Market Operator for Peer-to-Peer Financing (RMO-P2P)* v1.0 (27/02/2026).

This matrix checks **what the SC field is allowed to contain**, not only decimal/integer format.

**Export is not built.** There is no ComRep/XBRL instance generator. A field cannot be **VERIFIED** on the full data path until export exists and maps the correct source. Collection-correct fields are **PARTIAL** for that reason.

Status values:

- **VERIFIED** — UI + API + persistence + export all match the SC definition. None today.
- **PARTIAL** — source and/or validation exist, but export is missing, a portal is weaker than another, or a semantic rule is only partly enforced.
- **MISSING** — no CashSouk field/source.
- **DERIVED** — SC wants a calculated/aggregated value; raw inputs exist or partially exist; no report query yet.
- **NEEDS BUSINESS CONFIRMATION** — the manual does not decide the CashSouk mapping.
- **MISSING REPORT SOURCE** — operational register/snapshot the product does not have (complaints, legal action, DPD position, R&R).

UI / API / Export: `checked` = rule is enforced there; `missing` = not enforced; `n/a` = not a user-entered field.

---

## Global SC rules (all reports)

| Rule | Manual | CashSouk |
|---|---|---|
| Amounts in absolute RM unless a field says otherwise | §2.2 | Monetary columns are numeric; export not built |
| ROC/BRN: no dash, space, or special characters; BRN and ROC must not be keyed interchangeably | §2.3 | `normalizeScRegistrationNumber` on operator ROC/trustee/advisor/interest and corporate party IDs. **Does not prove** the value is the one registered in ComRep vs the other number |
| NRIC: no dash, space, or special characters | §2.4 | Applied when prefix is NRIC or Malaysian individual. Passport is **not** put through NRIC stripping |
| Country names from Appendix A | §2.5 | UI dropdowns use `SC_APPENDIX_A_COUNTRIES`. Published v1.0 Appendix A **duplicates page 1 and omits Costa Rica–Ireland / Portugal–Tuvalu (including Singapore)**. Those names are not invented. API does not hard-reject extra names |
| Blank if no information; do not write N/A, “–”, or “Not Applicable” as a filler | §2.6 | Empty/null stored. Gender **Not Applicable** is an SC enum value, not a filler |
| Do not modify the ComRep form layout | §1.3 | N/A until export |
| Line numbers | “Automatic generated” | Must be generated at export; must not be collected |

---

## Cross-field dependencies

| Controller | Controlled field | Rule |
|---|---|---|
| Reporting Level | Trustee Company Registration Number | Required only when `Company(Trustee)`. Ordinary `Company` reports do not require it. Stored on Shoraka Profile for pre-fill; not a completeness blocker |
| Type of Company (Shoraka Profile helper, **not** an [01000] column) | [02000] share-capital block | `PRIVATE_LIMITED` → Sdn Bhd block. `LLP` → LLP block. Other SC company types are not mapped |
| Entity / shareholder type | Identity column (same SC label) | Individual Malaysian → NRIC. Foreign individual → Passport. Company → BRN/ROC. **Do not create extra ComRep columns** |
| Entity type | Date of Birth (dd/mm/yyyy) | Individual → DOB. Company → date of incorporation. Label stays Date of Birth except monthly investor, which is Date of Birth/Incorporation |
| Entity type | Nationality / Nationality/Country | Individual → nationality. Company → country of incorporation. Appendix A names |
| Entity type | Address | Annual [03000]: residential vs business. Monthly [05000]: Business/Residential Address. Monthly [06000]: residential only. Monthly [07000]/Position [10000]: current address, not necessarily IC address |
| Entity type | Gender | Not Applicable **only** for non-individuals. Individuals: Male/Female from verified documents. Blank ≠ Not Applicable |
| Entity type | Salutation | Annual [03000]: individual or beneficial owner. Monthly [05000]: individual only. Hidden/cleared for companies |
| Entity type | Identity Prefix | Monthly [05000]/[07000]/Position [10000]: NRIC / Passport / ROC. Monthly [06000]: **IC** or Passport only (stored as NRIC). Company → ROC |
| Type of Shares = Others | Type of Shares - Others (please specify) | Empty/hidden otherwise; required and exported only for Others |
| Designation = Others | Designation - Others | Same pattern; annual label is “Designation - Others (Please specify)” |
| Purpose of Fund Raising = Others | Purpose of Fund Raising - Others | Campaign field, not Profile |
| Repayment Type = Others | Repayment Type - Others | Campaign/repayment tabs |
| Classification of Default = Others | Classification of Default - Other | Defaulted Issuer tab |
| Complaints Category = Others | Complaints Category - Others | Annual [08000] |
| Investor Category (annual [06100]) | Country rows | Split signed-up-and-invested vs yet-to-invest |
| Campaign Status | [04500] Payment to / dates | Successful → Issuer + disbursement date. Unsuccessful → Investor + refund date |
| Is SARANA = Yes | SARANA Options / Scope | Only when Yes. Confirm whether CashSouk participates |
| Type of Investment Notes = Islamic | Name of Shariah Adviser | If applicable |
| Note >90 DPD | [10000] vs [11000] vs Position [03000] | ComRep default definition is >90 DPD on any scheduled payment, regardless of internal classification |
| Campaign ID uniqueness | All campaign tabs | Distinct; not reused. R&R may introduce a new ID; defaulted-issuer note says use the new ID if changed |

---

## Integer / no-decimal fields (only where SC says so)

SC text: “Integer value without decimal points.”

| Section | Field |
|---|---|
| Annual [02000] | Ordinary / Preference / Others **No. of Shares** |
| Annual [02000] | Total paid up capital (for Sdn Bhd) |
| Annual [02000] | Members' Capital **No. of Shares** |
| Annual [02000] | Members' Reserves **No. of Shares** |
| Annual [02000] | Subordinated Loans **No. of Shares** |

**Not** integer by SC: Nominal Value (RM), Total Limited Liability Partnership, shareholding units/amount on [03000]/[05000]/[10000], financing amounts, rates, percentages, financial-statement RM lines.

UI: digit-only on the [02000] integer columns. API: `isScIntegerWithoutDecimal` on those keys. Nominal RM and `totalLlp` stay decimal.

---

## Auto-generated / auto-populated (must not be Profile inputs)

| Field | Rule |
|---|---|
| LNSS / LNBO / LNTT / LNID / LNFC / LNCD / LNLI / LNOC / LNPI / LNSE / LNBS / LNPL / LNGI / LNRD / Line number | Automatic generated line number |
| Frequency | Auto populated from Report Name |
| Reporting Start Date | Auto populated from Reporting End Date |
| Report Name / Category / Sub-Category | Fixed per report (annual: RMO Information Report / Recognized Market Operator / RMO Operator; monthly P2P: RMO - P2P Report / P2P; position: RMO - P2P Position Report / P2P) |
| Registered Users / Nationality of Investor / Fees annual rows | Report-time aggregates, not Shoraka Profile |
| Age groups | `(Year of reporting period) − (Investor’s year of birth)` |
| Campaign Status Successful/Unsuccessful | ≥80% of target vs below |
| Outstanding Total | Principal + Interest |
| Effective interest examples | Manual example: 12% p.a. over 3 months → 3% |

---

## Calculated / derived (report layer)

| Field | Formula / rule |
|---|---|
| Investor age band | Reporting year − birth year. Buckets overlap as printed (30-35 and 35-40). Convention not in the manual |
| Campaign successful | Raised ≥ 80% of targeted amount |
| Defaulted note (ComRep) | >90 DPD on any scheduled payment |
| Platform-wide reconciliation | (Total Amount Raised + Total Interest Accrued) − (Total Repaid Principal + Total Repaid Interest) − (Total Outstanding Principal + Total Outstanding Interest) = Total Defaulted Amount |
| Outstanding Total | A + B |
| Issuer financing effective rate | Manual example only; confirm formula with compliance |
| Investor return rates | Exclude RMO fees/costs |
| Interest repaid / unpaid | Exclude late fees |
| Financing Amount - Interest (defaulted) | Effective interest rate × amount raised; exclude fees |
| Position [02000] trend | Principal + interest repaid since inception, by DPD bucket |
| [01000] monthly Total amount raised | “Funds **intended** to be raised” including successful and unsuccessful — confirm target vs actual |

---

## Uniqueness

| ID | Rule | CashSouk |
|---|---|---|
| Campaign ID | Distinct; not reused | `Note.note_reference` is unique. Confirm this is the ComRep Campaign ID |
| Issuer ID (if any) | Unique ID assigned to the issuer | Organization id is unique; **which** ID to file is not confirmed |
| Company Registration Number | The BRN **or** ROC initially registered in ComRep, not interchangeable | Stored; interchangeability is operational, not code-detectable |

---

## Fixed dropdowns / enums (exact SC lists)

| Field | Values |
|---|---|
| Reporting Level | Company; Company(Trustee) |
| Type of Submission | New; Resubmission |
| Category | Recognized Market Operator |
| Declaration | Yes; No |
| Type of Shares (annual [03000], monthly [05000]) | Ordinary shares; Preference shares; Others |
| Type of Shares (annual [10000]) | Ordinary; Preference; Others |
| Board of Director/Management Team | Annual: Board of director / Management team. Monthly: Board of Director / Management Team |
| Responsible Person | Yes; No |
| Type of Advisor | Accounting; Auditor; Banker; Compliance & Risk; Credit Rating; Legal; Taxation; Trustee/Escrow Account |
| Investor Category ([06100]) | Investor Types - Signed up and invested; Investor Types - Signed up and have yet to invest |
| Type of User ([07000] annual) | Investor; Issuer |
| Complaints Category | System Disruption; Operational Efficiency; Issuer; Others |
| Consolidated Accounts / UnModified Reports | Yes; No |
| Company category | Technology; Non-Technology |
| Type of Company | Sole proprietorship; Partnership; Limited Liability Partnership; Private Limited (Sdn Bhd); Public Limited (Bhd); Foreign |
| State | Johor … Terengganu + Outside Malaysia (16 + Outside Malaysia) |
| Campaign Sector | 21 SME Corp sectors including Other Service Activities. **No free-text Other** |
| Sustainability Category | 00 – None; G1–G17 |
| Type of Investment Notes | Islamic Investment Note; Investment Note |
| Purpose of Fund Raising | Working Capital; Business Expansion; Others |
| Campaign Status | Successful (≥80%); Unsuccessful |
| SARANA Yes/No; Options; Scope | Yes/No; Invoice financing / Financing for contract implementation (pre-financing); Supplies / Services / Works |
| Type of Financing | Receivables financing; Payables financing; Other revolving credit; Other term financing |
| Security Type | Secured: Property/real estate backed; Secured: Vehicle/ equipment backed; Secured: Other; Unsecured |
| Repayment Type | Balloon Payment; Bullet Payment; Equal Instalment; Others |
| Repayment Schedule | Monthly; Quarterly; Annually; Bullet; Others |
| Payment to | Issuer; Investor |
| Shareholder Type | Individual; Company |
| Identity Prefix [05000]/[07000] | NRIC; Passport; ROC |
| Identity Prefix [06000] | IC; Passport |
| Identity Prefix Position [10000] | Individual: IC / Passport; Company: ROC |
| Gender [05000]/[07000] | Male; Female; Not Applicable (non-individual only) |
| Gender [06000] / Position individual | Male; Female (no Not Applicable on [06000]) |
| Designation | 15 SC titles + Others |
| Type of Investor [07000] | Angel; Retail; Sophisticated – High net worth individual; Sophisticated – Accredited; Sophisticated – High net worth entity; Non-sophisticated entity |
| Type of Investor Position [10000] | Angel; Retail; Sophisticated (**3-value**) |
| Investment by Related Party | Shareholder of the RMO; Related co of the RMO; Officer of the RMO; Not applicable |
| Charged To | Investor; Issuer |
| Classification of Default | after 30/60/90/120 days past due; Others |
| Status of Notes / Repayment Trend buckets | Prompt or early; 1-30; 31-60; 61-90; >90 DPD |
| Company/Individual (Position [10000]) | Company; Individual |
| Currency [11000] | List of Currency (not specified in this manual) |

---

# Field matrix

Export = **missing** on every row until an XBRL builder exists.

## A. Annual RMO Information Report

### [00000] Scoping Questions

| Exact Label | Allowed Content | Condition | Format | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|---|
| Reporting Level | Company / Company(Trustee) | Filing-time | enum | Export input | missing | missing | missing | MISSING |
| Company Registration Number | BRN **or** ROC as registered in ComRep | Always | §2.3 | `OperatorProfile.registration_number` | checked | checked | missing | PARTIAL |
| Trustee Company Registration Number | Trustee BRN or ROC | Only if Reporting Level = Company(Trustee) | §2.3 | `OperatorProfile.trustee_registration_number` (pre-fill; not required for ordinary Company) | checked | checked | missing | PARTIAL |
| Category | Recognized Market Operator | Fixed | enum | Constant | n/a | n/a | missing | PARTIAL |
| Sub-Category | RMO Operator | Fixed | text | Constant | n/a | n/a | missing | PARTIAL |
| Frequency | Annually | Auto from Report Name | text | Constant | n/a | n/a | missing | PARTIAL |
| Report Name | RMO Information Report | Fixed | text | Constant | n/a | n/a | missing | PARTIAL |
| Type of Submission | New / Resubmission | Filing-time | enum | Export input | missing | missing | missing | MISSING |
| Reporting Start Date (dd/mm/yyyy) | Auto from end date | Auto | dd/mm/yyyy | Derived | n/a | n/a | missing | DERIVED |
| Reporting End Date (dd/mm/yyyy) | Year-end; must be month end | Filing-time | dd/mm/yyyy | Export input | missing | missing | missing | MISSING |

### [01000] General Information

| Exact Label | Allowed Content | Condition | Format | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|---|
| Name of RMO | RMO name | Always | text | `OperatorProfile.name` | checked | checked | missing | PARTIAL |
| Name of Responsible Person | One appointed RP | If more than one, only one name | text | `OperatorProfile.responsible_person_name` | checked | checked | missing | PARTIAL |
| Contact Number | RP contact | Always | text | `OperatorProfile.responsible_person_phone` | checked | checked | missing | PARTIAL |
| Declaration | Yes / No | Filing-time | enum | Export input | missing | missing | missing | MISSING |

CashSouk **Type of Company** on Shoraka Profile is **not** this tab. It only chooses the [02000] block.

### [02000] Summary of Share Capital

| Exact Label | Allowed Content | Condition | Format | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|---|
| Ordinary (for Sdn Bhd) — No. of Shares | Count of ordinary shares issued | Sdn Bhd block | integer, no decimal | `OperatorShareCapital.ordinaryUnits` | checked | checked | missing | PARTIAL |
| Ordinary (for Sdn Bhd) — Nominal Value (RM) | Aggregate nominal RM | Sdn Bhd | RM | `ordinaryAmount` | checked | checked | missing | PARTIAL |
| Preference (for Sdn Bhd) — No. of Shares | Count | Sdn Bhd | integer | `preferenceUnits` | checked | checked | missing | PARTIAL |
| Preference (for Sdn Bhd) — Nominal Value (RM) | Aggregate RM | Sdn Bhd | RM | `preferenceAmount` | checked | checked | missing | PARTIAL |
| Others (for Sdn Bhd) — No. of Shares | Count of other shares | Sdn Bhd | integer | `othersUnits` | checked | checked | missing | PARTIAL |
| Others (for Sdn Bhd) — Nominal Value (RM) | Aggregate RM | Sdn Bhd | RM | `othersAmount` | checked | checked | missing | PARTIAL |
| Total paid up capital (for Sdn Bhd) | Inserted total of all share types (not a silent sum) | Sdn Bhd | integer RM | `totalPaidUpCapital` | checked | checked | missing | PARTIAL |
| Members' Capital — No. of Shares | LLP capital contribution as “shares” | LLP | integer | `llpMembersCapitalUnits` | checked | checked | missing | PARTIAL |
| Members' Capital — Nominal Value (RM) | Aggregate RM | LLP | RM | `llpMembersCapitalAmount` | checked | checked | missing | PARTIAL |
| Members' Reserves — No. of Shares | Reserve “shares” where relevant | LLP | integer | `llpMembersReservesUnits` | checked | checked | missing | PARTIAL |
| Members' Reserves — Nominal Value (RM) | Aggregate RM | LLP | RM | `llpMembersReservesAmount` | checked | checked | missing | PARTIAL |
| Subordinated Loans — No. of Shares | Relevant loan units | LLP | integer | `llpSubordinatedLoansUnits` | checked | checked | missing | PARTIAL |
| Subordinated Loans — Nominal Value (RM) | Relevant RM | LLP | RM | `llpSubordinatedLoansAmount` | checked | checked | missing | PARTIAL |
| Total Limited Liability Partnership | Total partners’ capital contribution | LLP | RM (SC does **not** say integer) | `totalLlp` | checked | checked | missing | PARTIAL |

No “Others specify” row on this tab.

### [03000] Shareholders/Members

Instruction: Shareholders, Members **and beneficial owners**. Beneficial Owner is an individual (CashSouk `holder_type`, not a ComRep column).

| Exact Label | Allowed Content | Condition | Format | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|---|
| LNSS: Line number | Auto | Auto | integer | Export | n/a | n/a | missing | DERIVED |
| Name | Full name as per IC/passport/company docs. Beneficial Owner: name of the shareholder | Always | text | `OperatorShareholder.name` | checked | checked | missing | PARTIAL |
| Salutation | Salutation | Individual or beneficial owner only | text | `salutation` | checked | checked (cleared for corporate) | missing | PARTIAL |
| IC/Passport number | NRIC / Passport / BRN or ROC | By citizenship/entity | §2.3/2.4 for NRIC/ROC; passport trim only | `identityNumber` | checked | checked | missing | PARTIAL |
| Date of Birth (dd/mm/yyyy) | DOB or incorporation date | Individual / entity | dd/mm/yyyy | `dateOfBirth` / `dateOfIncorporation` under one SC label | checked | checked | missing | PARTIAL |
| Nationality | Nationality or country of incorporation | Individual / entity | Appendix A | `nationality` | checked | stored | missing | PARTIAL |
| Address | Residential or business | Individual / entity | text | `address` (single string) | checked | checked | missing | PARTIAL |
| Date Acquired (dd/mm/yyyy) | SSM-recorded acquisition | | dd/mm/yyyy | `dateAcquired` | checked | checked | missing | PARTIAL |
| Date Disposal (dd/mm/yyyy) | SSM-recorded disposal | | dd/mm/yyyy | `dateDisposal` | checked | checked | missing | PARTIAL |
| Type of Shares | Ordinary shares / Preference shares / Others | | enum | `shareType` | checked | checked | missing | PARTIAL |
| Type of Shares - Others (please specify) | Free text | Only if Others | text | `shareTypeOther` | checked | checked | missing | PARTIAL |
| Shareholding Units (Unit) | Number of shares held | | number (not “integer without decimal”) | `shareholdingUnits` | checked | checked | missing | PARTIAL |
| Shareholding Amount (RM) | Value of shares held | | RM | `shareholdingAmount` | checked | checked | missing | PARTIAL |
| Shareholding Percentage (%) | Percentage holdings | | % | `shareholdingPercentage` | checked | checked | missing | PARTIAL |

### [04000] Board of Director/Management Team

Individuals only.

| Exact Label | Allowed Content | Condition | Format | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|---|
| LNBO: Line number | Auto | Auto | | Export | n/a | n/a | missing | DERIVED |
| Name | Full name as per IC/passport | | text | `OperatorOfficer.name` | checked | checked | missing | PARTIAL |
| Board of Director/Management Team | Board of director / Management team | One per row | enum | `personKind` | checked | checked | missing | PARTIAL |
| Salutation | If applicable | | text | `salutation` | checked | checked | missing | PARTIAL |
| Responsible Person | Yes / No | At least one Yes for completeness | enum | `isResponsiblePerson` | checked | checked | missing | PARTIAL |
| Identity Number (NRIC/ Passport No.) | NRIC or Passport | Malaysian / foreign | §2.4 for NRIC | `identityNumber` | checked | checked | missing | PARTIAL |
| Date of Birth (dd/mm/yyyy) | DOB of the individual | | dd/mm/yyyy | `dateOfBirth` | checked | checked | missing | PARTIAL |
| Nationality | Appendix A | | country | `nationality` | checked | stored | missing | PARTIAL |
| Address | Residential address | | text | `address` | checked | checked | missing | PARTIAL |
| Designation | 15 SC titles + Others | | enum | `designation` | checked | checked | missing | PARTIAL |
| Designation - Others (Please specify) | Free text | Only if Others | text | `designationOther` | checked | checked | missing | PARTIAL |
| Appointment Date (dd/mm/yyyy) | Date appointed to current designation | | dd/mm/yyyy | `appointmentDate` | checked | checked | missing | PARTIAL |
| Resignation date (dd/mm/yyyy) | Date ceased current designation | | dd/mm/yyyy | `resignationDate` | checked | checked | missing | PARTIAL |

### [05000] Advisor

| Exact Label | Allowed Content | Condition | Format | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|---|
| LNTT: Line number | Auto | | | Export | n/a | n/a | missing | DERIVED |
| Name | Full company name per official document | | text | `OperatorAdvisor.name` | checked | checked | missing | PARTIAL |
| Company Registration No. | BRN and/or ROC | | §2.3 | `registrationNumber` | checked | checked | missing | PARTIAL |
| Country | Nationality of person or country of incorporation | Appendix A | country | `country` | checked | stored | missing | PARTIAL |
| Address | Business address | | text | `address` | checked | checked | missing | PARTIAL |
| Appointment Date (dd/mm/yyyy) | Appointment | | date | `appointmentDate` | checked | checked | missing | PARTIAL |
| Cessation Date (dd/mm/yyyy) | Cessation | | date | `cessationDate` | checked | checked | missing | PARTIAL |
| Type of Advisor | Eight SC types with their definitions | One per row | enum | `advisorType` | checked | checked | missing | PARTIAL |

### [06000] Registered Users

Do **not** put on Shoraka Profile. Since inception to reporting end.

| Exact Label | Allowed Content | Condition | Format | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|---|
| Issuer | Entities seeking funding on/through the platform | Count | integer | `IssuerOrganization` count | n/a | missing query | missing | DERIVED |
| Investor | Total signed up/onboarded | Count | integer | `InvestorOrganization` | n/a | missing query | missing | DERIVED |
| Investor (signed up but yet to invest) | Onboarded, no investment amount deposited into any note | Count | integer | Zero `NoteInvestment` | n/a | missing query | missing | DERIVED |
| Investor Types - Signed up and invested: Angel / Retail / Sophisticated | Counts by SC guideline definitions | Invested | integer | `sc_investor_category` + investments. Annual 3-way vs monthly 6-way | n/a | missing query | missing | DERIVED / NEEDS BUSINESS CONFIRMATION |
| Investor Types - Signed up and have yet to invest: Angel / Retail / Sophisticated | Same types, not invested | | integer | Same | n/a | missing query | missing | DERIVED |
| Investor Age Group × invested / yet to invest (7 bands) | Age = reporting year − year of birth | Personal investors only | integer | DOB | n/a | missing query | missing | DERIVED |

Corporate investors have no DOB. Bucket edges overlap. Both are **NEEDS BUSINESS CONFIRMATION**.

### [06100] Nationality of Investor

| Exact Label | Allowed Content | Condition | Format | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|---|
| LNID: Line number | Auto | | | Export | n/a | n/a | missing | DERIVED |
| Number of Investor | Count | | integer | Aggregation | n/a | missing query | missing | DERIVED |
| Investor Category | Signed up and invested / yet to invest | | enum | Join | n/a | missing query | missing | DERIVED |
| Country | Appendix A nationality | | country | Investor nationality / corporate country | n/a | missing query | missing | DERIVED |

### [07000] Fees and Charges to Users

| Exact Label | Allowed Content | Condition | Format | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|---|
| LNFC: Line number | Auto | | | Export | n/a | n/a | missing | DERIVED |
| Type of Fees/Charges | Specify all fees imposed | | text | Scattered fee settings | missing schedule | missing | missing | PARTIAL |
| Amount (RM) | Amount | | RM | Same | missing | missing | missing | PARTIAL |
| Percentage (%) (Only if amount not available) | % only if amount not available | Conditional | % | Same | missing | missing | missing | PARTIAL |
| Type of User | Investor / Issuer | | enum | Implied by fee | n/a | missing | missing | PARTIAL |

### [08000] Complaints

Count **issues**, not complainants.

| Exact Label | Allowed Content | Condition | Format | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|---|
| LNCD: Line number | Auto | | | | n/a | n/a | missing | MISSING REPORT SOURCE |
| Complaints Category | Four SC categories with definitions | | enum | None | missing | missing | missing | MISSING REPORT SOURCE |
| Complaints Category - Others (please specify) | Text | Only if Others | text | None | missing | missing | missing | MISSING REPORT SOURCE |
| Number of complaints received | Count of issues | | number | None | missing | missing | missing | MISSING REPORT SOURCE |
| Number of complaints resolved | Count resolved | | number | None | missing | missing | missing | MISSING REPORT SOURCE |

### [09000] Legal Action

RMO register, **not** issuer CTOS litigation.

| Exact Label | Allowed Content | Condition | Format | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|---|
| LNLI: Line number | Auto | | | | n/a | n/a | missing | MISSING REPORT SOURCE |
| Date (dd/mm/yyyy) | Date initiated/filed/recorded | | dd/mm/yyyy | None | missing | missing | missing | MISSING REPORT SOURCE |
| Case | Official case number / short title | | text | None | missing | missing | missing | MISSING REPORT SOURCE |
| Details | Nature, parties, proceeding type, key dates | | text | None | missing | missing | missing | MISSING REPORT SOURCE |
| Amount (RM) | Claim/disputed/exposure where applicable | | RM | None | missing | missing | missing | MISSING REPORT SOURCE |
| Status | Current stage/outcome (examples only, not a closed enum) | | text | None | missing | missing | missing | MISSING REPORT SOURCE |

### [10000] Interest in Other Company

| Exact Label | Allowed Content | Condition | Format | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|---|
| LNOC: Line number | Auto | | | Export | n/a | n/a | missing | DERIVED |
| Name | Full company name | | text | `OperatorInterest.name` | checked | checked | missing | PARTIAL |
| ROC | BRN or ROC | | §2.3 | `registrationNumber` | checked | checked | missing | PARTIAL |
| Country | Country of incorporation | Appendix A | country | `country` | checked | stored | missing | PARTIAL |
| Address | Business address | | text | `address` | checked | checked | missing | PARTIAL |
| Acquisition Date (dd/mm/yyyy) | As recorded in official documents | | date | `acquisitionDate` | checked | checked | missing | PARTIAL |
| Disposal Date (dd/mm/yyyy) | Transfer recorded date | | date | `disposalDate` | checked | checked | missing | PARTIAL |
| Type of Shares | Ordinary / Preference / Others | | enum | `shareType` | checked | checked | missing | PARTIAL |
| Type of Shares - Others (please specify) | Text | Only if Others | text | `shareTypeOther` | checked | checked | missing | PARTIAL |
| Shareholding Units (unit) | Units | | number | `shareholdingUnits` | checked | checked | missing | PARTIAL |
| Shareholding Percentage (%) | % | | % | `shareholdingPercentage` | checked | checked | missing | PARTIAL |

No shareholding amount on this tab.

### [11000] Financial Statement

Latest FY figures; audited, else certified management accounts. Totals are **inserted**, not assumed to equal component sums.

| Exact Label | Allowed Content | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|
| Consolidated Accounts | Yes/No with SC note | `consolidatedAccounts` | checked | checked | missing | PARTIAL |
| Auditor's Name | Audit firm official name | `auditorName` | checked | checked | missing | PARTIAL |
| Financial Year End (dd/mm/yyyy) | FYE | `financialYearEnd` | checked | checked | missing | PARTIAL |
| UnModified Reports | Yes/No | `unmodifiedReports` | checked | checked | missing | PARTIAL |
| Date of Tabling to Board (dd/mm/yyyy) | Date | `dateTabledToBoard` | checked | checked | missing | PARTIAL |
| Currency | List of Currency | `currency` | checked | checked | missing | NEEDS BUSINESS CONFIRMATION |
| Number of Shares | Number | `numberOfShares` | checked | checked | missing | PARTIAL |
| Total Assets | RM | `totalAssets` | checked | checked | missing | PARTIAL |
| Non-Current Assets | RM | `nonCurrentAssets` | checked | checked | missing | PARTIAL |
| Current Assets | RM | `currentAssets` | checked | checked | missing | PARTIAL |
| Total Equity | RM | `totalEquity` | checked | checked | missing | PARTIAL |
| Paid-up Capital | RM | `paidUpCapital` | checked | checked | missing | PARTIAL |
| Share Application Account | RM | `shareApplicationAccount` | checked | checked | missing | PARTIAL |
| Share Premium & Other Reserves | RM | `sharePremiumAndReserves` | checked | checked | missing | PARTIAL |
| Accumulated Profit Carried Forward | RM | `accumulatedProfitCarriedForward` | checked | checked | missing | PARTIAL |
| Minority Interest (BS) | RM | `equityMinorityInterest` | checked | checked | missing | PARTIAL |
| Total Liabilities | RM | `totalLiabilities` | checked | checked | missing | PARTIAL |
| Non-Current Liabilities | RM | `nonCurrentLiabilities` | checked | checked | missing | PARTIAL |
| Current Liabilities | RM | `currentLiabilities` | checked | checked | missing | PARTIAL |
| Total Revenue | Inserted total | `totalRevenue` | checked | checked | missing | PARTIAL |
| Donation Based / Reward Based / Lending Based / Equity Based / Fees charges / Other - Revenue | Components | matching columns | checked | checked | missing | PARTIAL |
| Other Income / Interest from deposit placement / Other - Income | Components | matching columns | checked | checked | missing | PARTIAL |
| Total Cost | Inserted total | `totalCost` | checked | checked | missing | PARTIAL |
| Staff Cost / System Cost / Promotion Activities / Other - Cost | Components | matching columns | checked | checked | missing | PARTIAL |
| Profit/(Loss) Before Tax | RM | `profitBeforeTax` | checked | checked | missing | PARTIAL |
| Taxation | RM | `taxation` | checked | checked | missing | PARTIAL |
| Profit/(Loss) After Tax | RM | `profitAfterTax` | checked | checked | missing | PARTIAL |
| Minority Interest (P&L) | RM | `pnlMinorityInterest` | checked | checked | missing | PARTIAL |
| Net Dividend | RM | `netDividend` | checked | checked | missing | PARTIAL |

---

## B. Monthly RMO-P2P Report

### [00000] Scoping Questions

Same pattern as annual except Sub-Category = **P2P**, Frequency = **Monthly**, Report Name = **RMO - P2P Report**. Trustee ROC same conditional. Status: same PARTIAL/MISSING mix.

### [01000] General Information

| Exact Label | Allowed Content | Source | Status |
|---|---|---|---|
| Name of Responsible Person | One RP | Operator profile | PARTIAL |
| Contact Number | RP | Operator profile | PARTIAL |
| Declaration | Yes/No | Filing-time | MISSING |
| Total amount raised (RM) (successful and unsuccessful campaign) for the month | Funds **intended** to be raised including both outcomes | Notes whose hosting ended in the month | DERIVED / NEEDS BUSINESS CONFIRMATION |

### [02000] Profile of Issuer

Report campaigns whose hosting ended in the period.

| Exact Label | Allowed Content | Condition | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|
| LNPI | Auto | | Export | n/a | n/a | missing | DERIVED |
| Name of Issuer | Official company name | | Org / COD businessName | checked | checked | missing | PARTIAL |
| Issuer ROC | BRN or ROC | §2.3 | `registration_number` | checked | checked | missing | PARTIAL |
| Company category | Technology / Non-Technology (issuer **or campaign** activity) | Campaign/offer, not a frozen issuer-only fact | `Invoice.offer_details.company_category` | checked | checked | missing | PARTIAL |
| Issuer ID (if any) | Unique issuer ID | Optional | Org id (candidate) | n/a | stored | missing | NEEDS BUSINESS CONFIRMATION |
| Date of Incorporation (dd/mm/yyyy) | SSM/equivalent incorporation | | `date_of_incorporation` | checked | checked | missing | PARTIAL |
| Date of Commencement (dd/mm/yyyy) | Business commencement | | `date_of_commencement` | checked | checked | missing | PARTIAL |
| Country of Incorporation | Appendix A | | `country_of_incorporation` | checked | stored | missing | PARTIAL |
| Type of Company | Six SC types | | `sc_company_type` | checked | checked | missing | PARTIAL |
| Registered Address | Registered address | Align with state | COD registered | checked | checked | missing | PARTIAL |
| Registered Address - State | States + Outside Malaysia | Must align with address | state | checked | checked | missing | PARTIAL |
| Registered Address - Postcode | Postcode; international if outside MY | | postalCode | checked | checked | missing | PARTIAL |
| Business Address | Business address; if subsidiary, subsidiary info | | COD business | checked | checked | missing | PARTIAL |
| Business Address - State / Postcode | Same as registered | Must align | | checked | checked | missing | PARTIAL |
| Phone Number | Issuer contact; for SP/partnership, liaison person | | `phone_number` | checked | checked | missing | PARTIAL |
| E-mail Address | Same liaison rule | | `company_email` | checked | checked | missing | PARTIAL |
| Website | URL where applicable | Blank OK | COD website | checked | checked | missing | PARTIAL |
| Company Activities | Activity **based on the purpose of the issuer’s fundraising** | Not silently the profile “what does your company do?” | Profile narrative exists; mapping unconfirmed | checked label | stored separate | missing | NEEDS BUSINESS CONFIRMATION |

### [03000] Financing Details 1

Only campaigns whose hosting **ended**. Active campaigns wait for the next period.

| Exact Label | Allowed Content | Condition | Source | Status |
|---|---|---|---|---|
| LNPI | Auto | | Export | DERIVED |
| Campaign ID | Unique; not reused | Distinct | `note_reference` (unique) | PARTIAL |
| Issuer ID (if any) | Unique issuer ID | Optional | Candidate org id | NEEDS BUSINESS CONFIRMATION |
| Issuer ROC | BRN/ROC | §2.3 | Issuer org | PARTIAL |
| Campaign Name | Public-facing name on platform | | `Note.title` | PARTIAL |
| Campaign Description | Summary of purpose as presented to investors | | Several snapshot fields | PARTIAL / NEEDS BUSINESS CONFIRMATION |
| Campaign Application Date (dd/mm/yyyy) | Date issuer sought financing for this Campaign ID | | `submitted_at` candidate | NEEDS BUSINESS CONFIRMATION |
| Campaign Approval Date (dd/mm/yyyy) | Date RMO approved fundraising for this Campaign ID | | Several timestamps | NEEDS BUSINESS CONFIRMATION |
| Campaign URL on Operator Website | URL to the campaign | | Compose from base URL | PARTIAL |
| Campaign Sector | 21 SME Corp values; no Other-specify | Definitions per SME Corp | `campaign_sector` on offer/snapshot | PARTIAL |
| Sustainability Category of the Campaign | 00 – None; G1–G17 | | `sustainability_category` | PARTIAL |
| Type of Investment Notes | Islamic Investment Note / Investment Note | | Not stored | MISSING / NEEDS BUSINESS CONFIRMATION |
| Name of Shariah Adviser (if applicable) | Name who approved Islamic product | If Islamic | Not stored | MISSING / NEEDS BUSINESS CONFIRMATION |
| Purpose of Fund Raising | Working Capital / Business Expansion / Others | Campaign | `sc_purpose_of_fund_raising` | PARTIAL |
| Purpose of Fund Raising - Others (please specify) | Text | Only if Others | `sc_purpose_other` (cleared otherwise) | PARTIAL |
| Campaign Status | Successful ≥80% of target; else Unsuccessful | Hosting ended | `funding_status` + 80% default | PARTIAL |
| Remark (if any) | Free | | Not a dedicated field | MISSING |
| Is SARANA Financing Scheme | Yes/No | | Not stored | MISSING / NEEDS BUSINESS CONFIRMATION |
| Financing Options of SARANA | Invoice financing / pre-financing | If SARANA Yes | Not stored | MISSING |
| Financing Scope of SARANA | Supplies / Services / Works | If SARANA Yes | Not stored | MISSING |

### [03100] Financing Details 2

| Exact Label | Allowed Content | Condition | Source | Status |
|---|---|---|---|---|
| Campaign ID / Issuer ID / Issuer ROC | Same as [03000] | | Same | PARTIAL |
| Fund Raising Start Date | Date fundraising began for this ID | | `NoteListing.opens_at` | PARTIAL |
| Campaign Extension Date | Date issuer sought extension | If extended | No dedicated event | MISSING |
| Fund Raising End Date | End of fundraising irrespective of success | | `closes_at` candidate | PARTIAL |
| Type of Financing | Four SC types | | Product names, not SC enum | NEEDS BUSINESS CONFIRMATION |
| Security Type | Four SC types | | Not stored | MISSING / NEEDS BUSINESS CONFIRMATION |
| Investment Note Tenure (months) | Whole months (example: 2 for 2 months) | | Derived from dates | PARTIAL |
| Assigned Risk Grading | RMO-assigned grade for this campaign | | CashSouk A–F | PARTIAL |
| Target Financing Amount (RM) | Aimed raise as on platform | | `target_amount` | PARTIAL |
| Financing Amount (RM) | Actual raised at end of hosting | | `funded_amount` | PARTIAL |
| Financing Security (if any) | Collateral description; blank if none | Do not write N/A | Guarantors, no descriptor | PARTIAL |
| Issuer Financing Interest Rate p.a. (%) – simple | Annualised issuer rate; **exclude RMO fees**; cap 18% per RMO Guidelines ¶14.05(h) | | `profit_rate_percent`; 18% not enforced | PARTIAL |
| Issuer Financing Interest Rate p.a. (%) - effective | Actual issuer interest for the campaign (manual example 12% × 3 months = 3%); exclude fees | | Not stored | DERIVED / NEEDS BUSINESS CONFIRMATION |
| Investor Return Interest Rate p.a. (%) - simple | Annualised investor rate; exclude fees | | Runtime helper, not persisted | DERIVED |
| Investor Return Interest Rate p.a. (%) - effective | Actual investor interest; exclude fees | | Not stored | DERIVED |
| Repayment Type | Balloon / Bullet / Equal Instalment / Others | | Bullet-only product constant | PARTIAL / NEEDS BUSINESS CONFIRMATION |
| Repayment Type - Others (please specify) | Text | Only if Others | None | MISSING |
| Repayment Schedule | Monthly / Quarterly / Annually / Bullet / Others | | One maturity row | PARTIAL |
| Amount Raised (RM) | Principal raised for this Campaign ID | | `funded_amount` | PARTIAL |
| Remarks | Free | | None dedicated | MISSING |

### [04500] Campaign Settlement

| Exact Label | Allowed Content | Condition | Source | Status |
|---|---|---|---|---|
| Campaign ID / Issuer ID / Issuer ROC | Same uniqueness/format | | Same | PARTIAL |
| Payment to | Issuer if successful; Investor if unsuccessful | Outcome | Derivable | DERIVED |
| Fund Disbursement Date to Issuer/Third party - Successful Campaign | Disbursement date | Successful | `WithdrawalInstruction.completed_at` candidate | NEEDS BUSINESS CONFIRMATION |
| Settlement Amount (RM) | Disbursed to issuer/third party **or** refunded to investors | Outcome | Withdrawal vs released investments | PARTIAL |
| Fund Refunded Date to Investor - Unsuccessful Campaign | Bank or platform wallet credit | Unsuccessful | `released_at` | PARTIAL |
| Remark (if any) | Free | | None | MISSING |

### [05000] Issuer - Shareholding Structure (Successful Campaign)

| Exact Label | Allowed Content | Condition | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|---|
| LNSS | Auto | | Export | n/a | n/a | missing | DERIVED |
| Issuer ROC / Issuer ID | Same | Successful campaign | Issuer | checked | checked | missing | PARTIAL |
| Shareholder Type | Individual / Company | | `entityType` | checked | checked | missing | PARTIAL |
| Shareholder Name | Individual or Company or Beneficial Owner as per docs | | party `name` | checked | checked | missing | PARTIAL |
| Salutation (if applicable) | Individual only | | `salutation` | checked | checked | missing | PARTIAL |
| Identity Prefix | NRIC / Passport / ROC | By holder | `identityPrefix` | checked | checked | missing | PARTIAL |
| Shareholder Identity (NRIC/Passport/Company Registration No.) | NRIC / Passport / BRN or ROC | Prefix + type | `identityNumber` | checked | checked | missing | PARTIAL |
| Date of Birth (dd/mm/yyyy) | DOB or incorporation | Type | `dateOfBirth` / `dateOfIncorporation` | checked | checked | missing | PARTIAL |
| Gender | Male / Female / Not Applicable | NA **only** if non-individual; individuals from verified docs | `gender` | checked | checked | missing | PARTIAL |
| Nationality/Country | Nationality or country of incorporation | Type | nationality / countryOfIncorporation | checked | stored | missing | PARTIAL |
| Business/Residential Address | Address of the shareholder | | structured address | checked | checked | missing | PARTIAL |
| Business/Residential Address - State | 16 states + Outside Malaysia | Must align with **business** address (SC note wording) | state enum | checked | checked | missing | PARTIAL |
| Business/Residential Address - Postcode | Postcode; international if outside MY | | postalCode | checked | checked | missing | PARTIAL |
| Type of Shares | Ordinary shares / Preference shares / Others | | `shareType` | checked | checked | missing | PARTIAL |
| Type of Shares - Others (please specify) | Text | Only Others | `shareTypeOther` | checked | checked | missing | PARTIAL |
| Shareholding Units / Amount / Percentage | Units, RM, % | | party fields | checked | checked | missing | PARTIAL |

### [06000] Board of Director/Management Team (Successful Campaign)

Individuals connected to the issuer. Gender has **no** Not Applicable.

| Exact Label | Allowed Content | Source | UI | API | Export | Status |
|---|---|---|---|---|---|---|
| Issuer ROC / Issuer ID | Same | Issuer | checked | checked | missing | PARTIAL |
| Board of Director/Management Team | Board of Director / Management Team | `personKind` / flags | checked | checked | missing | PARTIAL |
| Name | As per IC/passport | `name` | checked | checked | missing | PARTIAL |
| Salutation (if applicable) | Salutation | `salutation` | checked | checked | missing | PARTIAL |
| Identity Prefix | **IC** or Passport (not ROC) | `identityPrefix` NRIC/PASSPORT | checked | checked | missing | PARTIAL |
| Identity Number (NRIC/Passport No.) | NRIC or Passport | `identityNumber` | checked | checked | missing | PARTIAL |
| Gender | Male / Female from verified docs | `gender` | checked | checked | missing | PARTIAL |
| Date of Birth (dd/mm/yyyy) | DOB | `dateOfBirth` | checked | checked | missing | PARTIAL |
| Nationality | Appendix A | `nationality` | checked | stored | missing | PARTIAL |
| Residential Address + State + Postcode | Residential; state must align | structured | checked | checked | missing | PARTIAL |
| Designation | 15 titles + Others | `designation` | checked | checked | missing | PARTIAL |
| Designation - Others (please specify) | Text if Others | `designationOther` | checked | checked | missing | PARTIAL |
| Appointment Date / Resignation Date | Dates | matching fields | checked | checked | missing | PARTIAL |

### [07000] Investor Details (Successful Campaign)

| Exact Label | Allowed Content | Condition | Source | Status |
|---|---|---|---|---|
| Campaign ID / Issuer ID / Issuer ROC | Same | Successful | Note + issuer | PARTIAL |
| Investor Name | As per verified docs. MyCIF: “Maybank Trustees Berhad – MyCIF" | Special MyCIF rule | `legal_name_on_id` / company name | PARTIAL / NEEDS BUSINESS CONFIRMATION for MyCIF |
| Identity Prefix | NRIC / Passport / ROC | Type | Derived or stored | PARTIAL |
| Investor Identification (NRIC / Passport / Company Registration No.) | NRIC / Passport / BRN or ROC | Type | `document_number` / `registration_number` | PARTIAL |
| Date of Birth/Incorporation (dd/mm/yyyy) | DOB or incorporation | Type | DOB / `date_of_incorporation` | PARTIAL |
| Gender | Male / Female / Not Applicable | NA only non-individual (note says “shareholder” but field is investor) | `gender`; corporate coerced NA | PARTIAL |
| Business/Residential Address - State | States + Outside Malaysia | **Current** address, may differ from IC | structured state | PARTIAL |
| Business/Residential Address - Postcode | Postcode | | postalCode | PARTIAL |
| Nationality/Country | Nationality or country of incorporation | Appendix A | nationality / country | PARTIAL |
| Type of Investor | Six SC types | Personal vs corporate option sets | `sc_investor_category` | PARTIAL |
| Date of Pledge (dd/mm/yyyy) | Date investor made the investment | | `committed_at` | PARTIAL |
| Amount Pledged (RM) | Intended amount if applicable | | `NoteInvestment.amount` while COMMITTED | PARTIAL / NEEDS BUSINESS CONFIRMATION |
| Amount Invested (RM) | Amount invested | | amount while CONFIRMED | PARTIAL |
| Nominees Name (if applicable) | Nominee name | If nominee | None | MISSING / NEEDS BUSINESS CONFIRMATION |
| Nominees ROC (if applicable) | BRN/ROC | If nominee | None | MISSING |
| Investment by Related Party | Four values including Not applicable | If related to RMO | Not stored for investors | MISSING |
| Remarks | Free | | None dedicated | MISSING |

Position [10000] Type of Investor is the **3-value** list. Do not collapse Profile to 3 values.

### [08000] Fees and Charges (per campaign)

| Exact Label | Allowed Content | Condition | Source | Status |
|---|---|---|---|---|
| Type of Fees/Charges by Operator (please specify) | All fee types charged to issuer and/or investor | All types | Scattered rates | PARTIAL |
| Amount (RM) | Total per itemised fee | | Ledger/settlement | PARTIAL |
| Fees/Charges by Operator in Percentage (%) (Only if amount not available) | All-inclusive % on the relevant base | Only if amount not available | Rates | PARTIAL |
| Charged To | Investor or Issuer | One | Implied | PARTIAL |

### [09000] Balance Sheet / [09100] Profit & Loss (Successful Campaign)

Latest audited FS or management account.

Balance sheet: Assets Current / Non Current; Liabilities Current Borrowing vs Non Borrowing; Non Current Loan vs Non Loan; Equity Capital / Share Application / Share Premium & Other Reserves / Accumulated Profit / Minority Interest.

P&L: Total Revenue and Income; Operating / Administrative / Interest / Other Cost; PBT; PAT; Minority Interest; Net Dividend.

Issuer profile now collects these SC lines. Status: **PARTIAL** (collected; export missing). “If applicable” equity/minority lines may be blank per §2.6.

### [10000] Repayment

Non-defaulted notes only (ComRep default = >90 DPD).

| Exact Label | Allowed Content | Source | Status |
|---|---|---|---|
| Financing Amount (RM) | Successfully raised for this ID | `funded_amount` | PARTIAL |
| Repayment Type / Others | Same four types | Bullet constant | PARTIAL |
| Amount Repaid - Principal (RM) | Principal repaid | Settlements (schedule columns unused) | PARTIAL |
| Amount Repaid - Interest (RM) | Interest repaid; **exclude late fees** | `investor_profit_gross` candidate | PARTIAL |

### [11000] Defaulted Issuer

Defaulted notes only (>90 DPD for **which rows appear**). Classification dropdown is the **operator rulebook**, not the ComRep default test.

| Exact Label | Allowed Content | Status |
|---|---|---|
| Campaign ID | Unique; if changed on R&R, insert **new** ID | PARTIAL / MISSING R&R |
| Classification of Default | 30/60/90/120 DPD / Others | MISSING |
| Classification of Default - Other (please specify) | e.g. after 180 days | MISSING |
| Actual Due Repayment Date | Due date of the unpaid instalment | DERIVED |
| Repayment Type / Others | Same four types | PARTIAL |
| Financing Amount - Principal / Interest | Principal raised; interest payable via effective rate × amount raised, exclude fees | PARTIAL / DERIVED |
| Repaid Amount - Principal / Interest / Late charges/fees / Reserves / Other charges | Interest repaid excludes late fees | PARTIAL / MISSING reserves |
| Unpaid Amount - Principal / Interest / Late charges/fees / Reserves / Other charges | Outstanding after repaid | MISSING snapshot |

---

## C. Monthly Position Report

### [00000] / [01000]

Same scoping/general pattern. Sub-Category P2P. Name of RMO is on this [01000]. Status: PARTIAL collection / MISSING filing metadata.

### [02000] Repayment Trend (since inception)

| Exact Label | Allowed Content | Status |
|---|---|---|
| Prompt or early repayment | Principal + interest repaid, that bucket, since inception | MISSING REPORT SOURCE (no DPD-at-payment) |
| Repayment made within 1 - 30 days past due | Same | MISSING REPORT SOURCE |
| Repayment made within 31 - 60 days past due | Same | MISSING REPORT SOURCE |
| Repayment made within 61 - 90 days | Same (label omits “past due”) | MISSING REPORT SOURCE |
| Repayment made >90 days past due | Same | MISSING REPORT SOURCE |

### [03000] Outstanding — non-defaulted notes

| Exact Label | Allowed Content | Status |
|---|---|---|
| Campaign ID | Unique | PARTIAL |
| Status of Notes | Five DPD buckets (includes >90 even on this “non-defaulted” tab — follow the printed list) | MISSING REPORT SOURCE |
| R&R Campaign ID (if any) | New ID if assigned | MISSING |
| Outstanding Amount - Principle (RM) | Unpaid principal = (A) | MISSING REPORT SOURCE |
| Outstanding Amount - Interest (RM) | Accrued unpaid interest = (B) | MISSING REPORT SOURCE |
| Outstanding Amount - Total (RM) | A + B | DERIVED once A,B exist |

### [04000] R&R notes

Entire tab **MISSING REPORT SOURCE** unless CashSouk offers R&R: Campaign ID; R&R Campaign ID (repeat original if no new ID); Interest rate (%) p.a. revised excluding fees; Tenure original / R&R months (R&R tenure from fund-raising date); Commencement date of R&R; Financing Amount Original = principal outstanding immediately prior; R&R amount revised including capitalised charges; R&R Payment structure (please specify).

### [10000] Investor’s month end gross deposit & withdrawal

| Exact Label | Allowed Content | Condition | Source | Status |
|---|---|---|---|---|
| Line number | Auto | | Export | DERIVED |
| Company/Individual | Company only if corporate depositor; individuals are natural persons | | Org type | PARTIAL |
| Investor Name | As per verified docs | | Name fields | PARTIAL |
| Identity prefix | Individual: IC / Passport. Company: ROC | Type | Derived | PARTIAL |
| Investor Identification | NRIC / Passport / BRN or ROC | Type | Doc/ROC | PARTIAL |
| Gender | Company → Not Applicable. Individual → Male/Female from docs | Type | `gender` | PARTIAL |
| Nationality/Country | Appendix A | | nationality / country | PARTIAL |
| Type of Investor | Angel / Retail / Sophisticated (3-way) | Export mapping from 6-way Profile | `sc_investor_category` | PARTIAL / NEEDS BUSINESS CONFIRMATION for Non-sophisticated entity |
| Gross Deposit (RM) | Sum of deposits in the period (example: 10×100 = 1000) | | Wallet ledger | DERIVED |
| Gross Withdrawal (RM) | Sum of withdrawals in the period | | Wallet ledger | DERIVED |

---

## Fixes made in this pass

1. Shared semantic rules (`packages/types/src/comrep-semantic-rules.ts`): gender by entity; identity prefix by role; NRIC vs passport vs ROC normalisation; Others-specify required/cleared.
2. API: operator shareholder/officer/interest Others-specify; party create/patch applies the same rules; corporate gender/prefix/salutation coerced; individual Not Applicable rejected; investor company gender cannot be Male/Female.
3. Identity numbers: Malaysian/NRIC stripped; ROC/BRN stripped; **passport not put through NRIC stripping**.
4. UI: individual gender Male/Female only (Admin, Issuer, Investor); salutation hidden for companies; corporate identity prefix locked to ROC; nationality/country of incorporation use Appendix A selects; [02000] integer columns digit-only.
5. Purpose of Fund Raising other-text cleared when purpose is not Others.
6. Completeness: individual cannot complete with ROC prefix; company cannot complete with NRIC/Passport; board cannot complete with ROC.

## Remaining PARTIAL (collection exists, export missing, or mapping incomplete)

All collected operator/issuer/investor ComRep fields above. Campaign uniqueness stored but not filed. 80% success exists in funding logic but is not exported. Investor 6-way type is stored; annual 3-way and Position 3-way are not mapped.

## Remaining MISSING / MISSING REPORT SOURCE

Filing metadata (Reporting Level, Type of Submission, dates, Declaration). Complaints. Legal action. SARANA. Type of Investment Note / Shariah Adviser. Security Type. Campaign Extension Date. R&R. DPD snapshots / repayment trend / outstanding position. Nominees. Related-party investor flag. Operator rulebook default classification. Remarks columns without a source.

## Remaining business/compliance questions

1. Appendix A missing middle page (Singapore and others) — use printed list only, or SC-corrected full ISO list?
2. Age-band overlap convention.
3. Corporate investors in age statistics.
4. Count “seeking funding” / onboarded definitions.
5. Annual Angel/Retail/Sophisticated mapping from 6-way, especially Non-sophisticated entity.
6. Position [10000] Sophisticated mapping from three sophisticated subtypes.
7. Total amount raised = target or actual.
8. Company Activities vs profile narrative vs campaign purpose.
9. Campaign Application Date / Approval Date / Fund Disbursement Date which timestamp.
10. Issuer ID which identifier.
11. Campaign ID = `note_reference`?
12. Islamic vs conventional / Shariah Adviser / SARANA participation.
13. Type of Financing and Security Type closed mapping.
14. Confirm Bullet Payment / Bullet schedule as constants.
15. Effective rate formula beyond the example.
16. 18% issuer rate cap enforcement.
17. Tawidh/Gharamah → Late charges.
18. Nominee structures.
19. Related-party investor declaration.
20. Reserves.
21. Will R&R be offered?
22. MyCIF investor name exact string.
23. Currency list for annual [11000].
24. Legal Action Status: examples vs closed list.
25. Position [03000] listing notes with >90 DPD while titled non-defaulted.
