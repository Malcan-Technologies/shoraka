# ComRep requiredness matrix

CashSouk policy for profile/data-entry fields that map to a ComRep column:

**Required by default** (`*`, Save blocked, API rejects blank/invalid, completeness counts it)

unless the SC manual gives an explicit condition, or the field is derived, auto-generated, report-time metadata, a separate register, or genuinely not applicable.

This is a CashSouk completeness policy. It is not an “SC mandatory” list.

Exact SC labels are preserved. A visual `*` without matching Save/API/completeness is a bug.

Empty values: store blank/null. Do not persist `N/A`, `–`, or `Not Applicable` unless that last value is an SC dropdown option (Gender for non-individuals).

Shared validators: `packages/types/src/comrep-requiredness.ts`.

---

## Required State

| State | Meaning |
|---|---|
| REQUIRED | Permanent profile/data-entry requiredness |
| CONDITIONAL | Required only when the SC condition is active |
| NOT REQUIRED | Explicit SC exception or CashSouk-only extra |
| REPORT-TIME | Filing/submission; not profile completeness |
| DERIVED | Calculated at report time; no profile `*` |
| AUTO-GENERATED | Line numbers and similar |
| NEEDS BUSINESS CONFIRMATION | Mapping or source not decided; do not invent requiredness |

Status: **CONSISTENT** means UI `*`, Save, API, and completeness agree for that surface.

---

## Explicit SC exceptions (do not make permanently required)

| Field | Exception |
|---|---|
| Trustee Company Registration Number | Only when Reporting Level = Company(Trustee) |
| Members' Reserves | “where relevant” |
| Salutation (annual [04000], monthly [05000]/[06000]) | “if applicable” |
| Salutation (annual [03000]) | Individual / beneficial owner only |
| Type of Shares - Others | Only when Type of Shares = Others |
| Designation - Others | Only when Designation = Others |
| Date Disposal / Disposal Date | Active holding may be blank |
| Resignation date | “where applicable”; active person may be blank |
| Cessation Date | Active adviser may be blank |
| Issuer ID (if any) | “if any” |
| Website | “where applicable” |
| Registered/Business Postcode | Not required when State = Outside Malaysia |
| Equity\|Share Application Account (if applicable) | Monthly issuer BS |
| Equity\|Share Premium & Other Reserves (if applicable) | Monthly issuer BS |
| Equity\|Minority Interest (if applicable) | Monthly issuer BS |
| Amount Pledged (RM) | “if applicable” |
| Nominees Name / ROC | “if applicable” |
| Financing Security (if any) | Leave blank if none |
| Name of Shariah Adviser | “if applicable” |
| Gender = Not Applicable | Non-individual only; not a blank filler |

---

## Shoraka Profile — annual RMO Information Report

| Surface | SC Section | Exact Field | Shows * | Required State | UI blocks blank? | API blocks blank? | Completeness blocker? | Reason | Status |
|---|---|---|---|---|---|---|---|---|---|
| Admin Shoraka General | [01000] | Name of RMO | yes | REQUIRED | yes | yes | yes | Default policy | CONSISTENT |
| Admin Shoraka General | [01000] | Company Registration Number | yes | REQUIRED | yes | yes | yes | Default + ROC charset | CONSISTENT |
| Admin Shoraka General | CashSouk | Type of Company | yes | REQUIRED | yes | yes | yes | Controls [02000] block | CONSISTENT |
| Admin Shoraka General | [00000] | Trustee Company Registration Number | no | REPORT-TIME | no | no (profile) | no | Company(Trustee) only | CONSISTENT |
| Admin Shoraka General | [01000] | Name of Responsible Person | yes | REQUIRED | yes | yes | yes | Default policy | CONSISTENT |
| Admin Shoraka General | [01000] | Contact Number | yes | REQUIRED | yes | yes | yes | Default policy | CONSISTENT |
| Admin Shoraka General | [01000] | Declaration | no | REPORT-TIME | — | — | no | Filing metadata | CONSISTENT |
| Admin Shoraka Capital | [02000] | Ordinary / Preference / Others units + RM | yes | REQUIRED | yes | yes | yes | Sdn Bhd block only | CONSISTENT |
| Admin Shoraka Capital | [02000] | Total paid up capital (for Sdn Bhd) | yes | REQUIRED | yes | yes | yes | Integer without decimals | CONSISTENT |
| Admin Shoraka Capital | [02000] | Members' Capital | yes | REQUIRED | yes | yes | yes | LLP block only | CONSISTENT |
| Admin Shoraka Capital | [02000] | Members' Reserves | no | NOT REQUIRED | no | no | no | SC “where relevant” | CONSISTENT |
| Admin Shoraka Capital | [02000] | Subordinated Loans | yes | REQUIRED | yes | yes | yes | LLP block | CONSISTENT |
| Admin Shoraka Capital | [02000] | Total Limited Liability Partnership | yes | REQUIRED | yes | yes | yes | LLP block | CONSISTENT |
| Admin Shoraka Ownership | [03000] | Name, IC/Passport number, Date of Birth, Nationality, Address, Date Acquired, Type of Shares, Units, Amount, % | yes | REQUIRED | yes | yes | yes | Row exists → default policy | CONSISTENT |
| Admin Shoraka Ownership | [03000] | Salutation | yes when individual/BO | CONDITIONAL | yes when shown | yes when individual | yes when individual | Individual/BO only | CONSISTENT |
| Admin Shoraka Ownership | [03000] | Type of Shares - Others | yes when Others | CONDITIONAL | yes when Others | yes when Others | yes when Others | SC Others specify | CONSISTENT |
| Admin Shoraka Ownership | [03000] | Date Disposal | no | NOT REQUIRED | no | no | no | Active holding may be blank | CONSISTENT |
| Admin Shoraka Board | [04000] | Board of Director/Management Team, Name, Identity Number, Date of Birth, Nationality, Address, Designation, Appointment Date | yes | REQUIRED | yes | yes | yes | Default policy | CONSISTENT |
| Admin Shoraka Board | [04000] | Salutation | no | NOT REQUIRED | no | no | no | SC “if applicable” | CONSISTENT |
| Admin Shoraka Board | [04000] | Responsible Person | yes | REQUIRED | yes (Yes/No) | stored boolean | at least one Yes | Profile needs one RP | CONSISTENT |
| Admin Shoraka Board | [04000] | Designation - Others | yes when Others | CONDITIONAL | yes when Others | yes when Others | yes when Others | SC Others specify | CONSISTENT |
| Admin Shoraka Board | [04000] | Resignation date | no | NOT REQUIRED | no | no | no | Active person may be blank | CONSISTENT |
| Admin Shoraka Advisers | [05000] | Name, Company Registration No., Country, Address, Appointment Date, Type of Advisor | yes | REQUIRED | yes if row | yes if row | yes if row exists | Empty list allowed | CONSISTENT |
| Admin Shoraka Advisers | [05000] | Cessation Date | no | NOT REQUIRED | no | no | no | Active adviser may be blank | CONSISTENT |
| Admin Shoraka Interest | [10000] | Name, ROC, Country, Address, Acquisition Date, Type of Shares, Units, % | yes | REQUIRED | yes if row | yes if row | yes if row exists | Empty list allowed | CONSISTENT |
| Admin Shoraka Interest | [10000] | Type of Shares - Others | yes when Others | CONDITIONAL | yes when Others | yes when Others | yes when Others | SC Others specify | CONSISTENT |
| Admin Shoraka Interest | [10000] | Disposal Date | no | NOT REQUIRED | no | no | no | Active holding may be blank | CONSISTENT |
| Admin Shoraka Financials | [11000] | All statement lines including Other - Revenue / Other - Income / Minority Interest | yes | REQUIRED | yes if row | yes if row | yes if a year exists | 0 is valid | CONSISTENT |
| Admin Shoraka | [06000] [06100] [07000] | Registered Users, nationality counts, fees aggregates | no | DERIVED | — | — | no | Report-time statistics | CONSISTENT |
| Admin Shoraka | [08000] [09000] | Complaints, Legal Action | no | REPORT-TIME | — | — | no | Separate registers, not Profile | CONSISTENT |

At least one shareholder and one officer are CashSouk profile rules. An adviser/interest row is not required to exist.

Integer without decimal points (UI + API): Ordinary/Preference/Others **No. of Shares**, Total paid up capital, Members' Capital units, Members' Reserves units (when entered), Subordinated Loans units. Nominal RM and Total LLP stay decimal.

---

## Issuer Profile — monthly [02000]

| Surface | SC Section | Exact Field | Shows * | Required State | UI blocks blank? | API blocks blank? | Completeness blocker? | Reason | Status |
|---|---|---|---|---|---|---|---|---|---|
| Issuer / Admin company | [02000] | Name of Issuer | yes | REQUIRED | yes | yes | yes | Default policy | CONSISTENT |
| Issuer / Admin company | [02000] | Issuer ROC | yes | REQUIRED | locked | locked | yes | Default + charset | CONSISTENT |
| Issuer / Admin company | [02000] | Issuer ID (if any) | no | NOT REQUIRED | no | no | no | SC “if any” | CONSISTENT |
| Issuer / Admin company | [02000] | Date of Incorporation (dd/mm/yyyy) | yes | REQUIRED | yes | yes | yes | Default policy | CONSISTENT |
| Issuer / Admin company | [02000] | Date of Commencement (dd/mm/yyyy) | yes | REQUIRED | yes | yes | yes | Default policy | CONSISTENT |
| Issuer / Admin company | [02000] | Country of Incorporation | yes | REQUIRED | yes | yes | yes | Appendix A | CONSISTENT |
| Issuer / Admin company | [02000] | Type of Company | yes | REQUIRED | yes | yes | yes | Default policy | CONSISTENT |
| Issuer / Admin addresses | [02000] | Registered Address / State / Postcode | yes | REQUIRED / CONDITIONAL postcode | yes | yes | yes | Postcode waived if Outside Malaysia | CONSISTENT |
| Issuer / Admin addresses | [02000] | Business Address / State / Postcode | yes | REQUIRED / CONDITIONAL postcode | yes | yes | yes | Same | CONSISTENT |
| Issuer / Admin Person in Charge | [02000] | Phone Number | yes | REQUIRED | yes | yes | yes | Source is `contactPerson.contact` with PIC fallback | CONSISTENT |
| Issuer / Admin Person in Charge | [02000] | E-mail Address | yes | REQUIRED | yes | yes | yes | Source is `contactPerson.email` with PIC fallback | CONSISTENT |
| Issuer / Admin company | [02000] | Website | no | NOT REQUIRED | no | no | no | SC “where applicable” | CONSISTENT |
| Issuer / Admin | [02000] | Company Activities | no | NEEDS BUSINESS CONFIRMATION | no | no | no | Profile stores general/current activity; campaign-specific ComRep source unresolved | CONSISTENT |
| Issuer Invoice step | [02000] | Company category | yes | CashSouk-required for application completeness | yes | yes (create) | no (profile) | Per invoice/campaign; Admin reviews/corrects | CONSISTENT |
| Issuer Invoice step | [03000] | Sustainability Category of the Campaign | yes | CashSouk-required for application completeness | yes | yes (create) | no (profile) | Per invoice/campaign; Admin reviews/corrects | CONSISTENT |
| Issuer / Admin company | CashSouk | TIN, Industry, Number of Employees, Annual Revenue | no | NOT REQUIRED | no | no | no | Not ComRep [02000] | CONSISTENT |

**E-mail Address * (issuer Person in Charge)**

| Check | Before | After |
|---|---|---|
| `*` shown | company email | Person in Charge |
| Blank Save | company email | blocked on Contact Person |
| Completeness | `company_email` | `contactPerson.email` with PIC fallback |

---

## Issuer people — monthly [05000] / [06000]

| Surface | SC Section | Exact Field | Shows * | Required State | Status |
|---|---|---|---|---|---|
| Issuer / Admin people | [05000] | Shareholder Type, Shareholder Name, Identity Prefix, Shareholder Identity, Date of Birth, Gender, Nationality/Country, Business/Residential Address, State, Postcode, Type of Shares, Units, Amount, % | yes | REQUIRED | CONSISTENT |
| Issuer / Admin people | [05000] | Salutation (if applicable) | no permanent `*` | CONDITIONAL (individual, not forced) | CONSISTENT |
| Issuer / Admin people | [05000] | Type of Shares - Others | when Others | CONDITIONAL | CONSISTENT |
| Issuer / Admin people | [05000] | Issuer ID (if any) | no | NOT REQUIRED | CONSISTENT |
| Issuer / Admin people | [06000] | Board of Director/Management Team, Name, Identity Prefix, Identity Number, Gender, Date of Birth, Nationality, Residential Address/State/Postcode, Designation, Appointment Date | yes | REQUIRED | CONSISTENT |
| Issuer / Admin people | [06000] | Salutation (if applicable) | no | NOT REQUIRED | CONSISTENT |
| Issuer / Admin people | [06000] | Designation - Others | when Others | CONDITIONAL | CONSISTENT |
| Issuer / Admin people | [06000] | Resignation Date | no | NOT REQUIRED | CONSISTENT |

Gender: Male/Female for individuals. Not Applicable only for non-individuals.

---

## Issuer financials — monthly [09000] / [09100]

Required when a financial year is collected, except SC “(if applicable)” equity lines.

| Exact Field | Required State |
|---|---|
| Assets\|Current / Non Current; Liabilities current/non-current splits; Equity\|Capital; Accumulated Profit; P&L costs, PBT, PAT, Minority Interest, Net Dividend | REQUIRED |
| Equity\|Share Application Account (if applicable) | NOT REQUIRED |
| Equity\|Share Premium & Other Reserves (if applicable) | NOT REQUIRED |
| Equity\|Minority Interest (if applicable) | NOT REQUIRED |

`0` is a valid number. Blank is not.

---

## Investor Profile — monthly [07000]

| Surface | Exact Field | Shows * | Required State | Completeness | Status |
|---|---|---|---|---|---|
| Investor / Admin personal | Investor Name | yes | REQUIRED | yes | CONSISTENT |
| Investor / Admin personal | Investor Identification | yes | REQUIRED | yes | CONSISTENT |
| Investor / Admin personal | Date of Birth/Incorporation | yes | REQUIRED | yes | CONSISTENT |
| Investor / Admin personal | Gender | yes | REQUIRED | yes | CONSISTENT |
| Investor / Admin personal | Nationality/Country | yes | REQUIRED | yes | CONSISTENT |
| Investor / Admin personal | Business/Residential Address - State | yes | REQUIRED | yes | CONSISTENT |
| Investor / Admin personal | Business/Residential Address - Postcode | yes | CONDITIONAL | yes unless Outside Malaysia | CONSISTENT |
| Investor / Admin personal | CashSouk free-text residential address | no | NOT REQUIRED | no | Not a [07000] column |
| Investor / Admin corporate | same identity/date/country/state/postcode | yes | REQUIRED | yes | CONSISTENT |
| Investor classification | Type of Investor | yes | REQUIRED | yes | CONSISTENT |

Corporate Gender must be Not Applicable. Individual Gender must not use Not Applicable as a blank filler.

---

## Campaign / application (not Profile)

Do not move these into Profile completeness. Requiredness applies when the campaign reaches the stage where the data must exist, except explicit SC conditions.

| Exact Field | Required State |
|---|---|
| Campaign Sector, Purpose of Fund Raising, Campaign Description, Campaign dates, Target amount, Financing amount | REQUIRED at campaign stage (existing collection) |
| Company category, Sustainability Category of the Campaign | CashSouk-required on Issuer Invoice step (application completeness); not issuer profile |
| Purpose of Fund Raising - Others | CONDITIONAL when Others |
| Type of Investment Notes | NEEDS BUSINESS CONFIRMATION |
| Name of Shariah Adviser (if applicable) | NEEDS BUSINESS CONFIRMATION |
| Type of Financing | NEEDS BUSINESS CONFIRMATION |
| Security Type | NEEDS BUSINESS CONFIRMATION |
| Repayment Type / Others | NEEDS BUSINESS CONFIRMATION |
| Is SARANA / Options / Scope | NEEDS BUSINESS CONFIRMATION |
| Campaign Extension Date | NEEDS BUSINESS CONFIRMATION |
| Financing Security (if any) | NOT REQUIRED if none; source unconfirmed |
| Company Activities (campaign vs issuer) | NEEDS BUSINESS CONFIRMATION |

---

## Report-time / derived (not profile `*`)

Report-time: Reporting Level, Category, Sub-Category, Frequency, Report Name, Type of Submission, Reporting Start/End Date, Declaration.

Derived: Registered Users, investor nationality counts, age groups, fee aggregates, line numbers, repayment trend, DPD buckets, calculated totals, campaign success where derived, outstanding totals.

---

## PATCH rule

Unrelated partial updates may omit a required field. Explicit `null` / `""` / whitespace of a required field is rejected.

---

## Remaining inconsistencies

1. Campaign ComRep fields listed as NEEDS BUSINESS CONFIRMATION — no requiredness invented.
2. Company Activities: profile stores general/current activity; campaign-specific ComRep source unresolved.
3. Investment by Related Party: belongs on `NoteInvestment`; who sets it (system-derived vs Admin/Ops) needs confirmation. Not investor profile.
4. Investor free-text address is CashSouk-only; [07000] only has State and Postcode.
5. Completeness treats presence, not email/ROC format; Save and API enforce format.
6. Investor master PATCH that clears `name` may surface the issuer label “Name of Issuer” (same schema).
7. Browser Save of issuer E-mail Address was not exercised in a live logged-in session in this pass; UI validator + API tests cover the same rules.
