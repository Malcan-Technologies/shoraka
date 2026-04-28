# CTOS Full System Context (Production Source of Truth)

## 1) System Overview

This backend supports onboarding and risk review for:
- issuer organizations
- investor organizations
- related parties (directors and shareholders)

CTOS is used as an external credit/business data source inside onboarding and admin review flows.

Main responsibilities:
- fetch CTOS XML report via SOAP
- parse XML into normalized JSON slices
- store parsed slices in DB (`ctos_reports`)
- expose report data to admin/portal APIs
- support CTOS subject-level reports for directors/shareholders (`subject_ref`)

How CTOS fits with KYC/AML:
- CTOS gives organization/party credit and legal signals.
- RegTank handles KYC/AML onboarding workflows.
- UI merges CTOS + RegTank + organization data for review decisions.

Relationship model in this system:
- **Organization**: core issuer/investor entity.
- **Directors/Shareholders**: from corporate entities and/or CTOS `company_json.directors`.
- **Applications**: financing applications linked to issuer org; admin can fetch CTOS snapshots during review.

---

## 2) End-to-End Data Flow

### Production flow

1. **Request build**
   - Service builds CTOS enquiry XML from organization or subject data.
   - Files:
     - `apps/api/src/modules/ctos/enquiry-builder.ts`
     - `apps/api/src/modules/ctos/resolve-subject-from-org.ts`

2. **CTOS call**
   - JWT assertion -> access token -> SOAP call (`ws:request`) -> base64 decode XML.
   - File: `apps/api/src/modules/ctos/client.ts`

3. **Parsing**
   - XML parsed using `xml2js`.
   - Parser extracts slices:
     - `summary_json`
     - `person_json`
     - `company_json`
     - `legal_json`
     - `ccris_json`
     - `financials_json`
   - File: `apps/api/src/modules/ctos/parser.ts`

4. **Persistence**
   - Parsed slices inserted into `ctos_reports`.
   - File: `apps/api/src/modules/ctos/ctos-report-service.ts`
   - Table: `ctos_reports` in Prisma schema.

5. **API exposure**
   - Admin endpoints return report lists/details/HTML/PDF.
   - File: `apps/api/src/modules/admin/controller.ts`

6. **Frontend consumption**
   - Admin UI reads `company_json`, `financials_json`, and subject reports.
   - Director/shareholder view merges CTOS + KYC/AML + supplements.
   - Key files:
     - `apps/admin/src/components/ssm-verification-panel.tsx`
     - `apps/admin/src/components/application-review/sections/financial-section.tsx`
     - `apps/admin/src/lib/onboarding-ctos-compare.ts`
     - `packages/types/src/director-shareholder-display.ts`

### Test harness flow (`ctos.new.ts`)

- File: `apps/api/src/ctos-test/ctos.new.ts`
- Similar parser logic to production.
- Extra harness-only behavior:
  - test case loops
  - verbose logs
  - auto handling for multi-entity (`requestConfirm` with `confirm_entity`)
- This is standalone and not wired into production services.

---

## 3) Raw CTOS Structure (Important XML sections)

Root shape:
- `report > enq_report`
  - `header`
  - `summary > enq_sum`
  - `enquiry`
    - `section_summary`
    - `section_a`
    - `section_d` / `section_d2` / `section_d4`
    - `section_ccris`
    - other optional sections

Key nodes:
- **header**
  - `enq_status code="1"` success
  - non-1 indicates failure/warning path
- **summary/enq_sum**
  - `ptype`, `pcode` (individual/company type)
  - `fico_index` score + factors
  - `enq_status` for enquiry-level state
- **section_summary**
  - aggregated flags and counts:
    - bankruptcy
    - legal totals/value
    - ccris counts
    - dcheqs entity flag
- **section_a**
  - primary party/company data:
    - identity, registration, status
    - address and breakdown
    - directors
    - accounts (financial rows)
- **section_d / d2 / d4**
  - legal cases and legal metadata
- **section_ccris**
  - borrower liabilities summary and totals
- **entities** (multi-entity case)
  - appears when `enq_sum enq_status code="2"` (`MULTIPLE ENTITIES`)
  - includes candidate `entity key="..."` rows for disambiguation

Example multi-entity signal from your CTOS response:
- `enq_status code="2">MULTIPLE ENTITIES`
- `entities > subject > entity key="..."`

---

## 4) Parsed JSON Structure (Critical)

Parser output object:
- `raw_xml: string`
- `summary_json: object`
- `person_json: object | null`
- `company_json: object | null`
- `legal_json: object`
- `ccris_json: object`
- `financials_json: array`

### `summary_json`
- `fico_score`
- `fico_factors[]`
- `bankruptcy`
- `legal.total_cases`
- `legal.total_amount`
- `ccris.applications / approved / pending / arrears`
- `dcheqs.raw_flag`
- `enquiry_error` (`{code,message}` or `null`)

### `person_json`
Used when `ptype = I`:
- `name`
- `nic_brno`
- `ic_lcno`
- `nationality`
- `birth_date`
- `addr`

### `company_json`
Used when non-individual:
- `ptype`, `pcode`
- `name`
- `brn_ssm`
- `ic_lcno`, `nic_brno`
- `additional_registration_no`
- `status`, `type_of_business`
- `comp_type`, `comp_category`
- `address.{full,line1,line2,city,state,postcode}`
- `msic_ssms[]`
- `partners[]`
- `directors[]` (including `position`, `equity`, `equity_percentage`, `party_type`)

### `legal_json`
- `cases[]`, each includes:
  - source section (`d`, `d2`, `d4`)
  - case metadata (type/title/no/court/date/amount/status)
  - nested action/dates/cedcon/other_defendants

### `ccris_json`
- `summary.total_limit`
- `summary.total_outstanding`

### `financials_json`
Array of year rows:
- `financial_year` (derived from `pldd` calendar year only)
- `dates.pldd`, `dates.bsdd`
- `account` object with numeric CTOS codenames allowlist

### Real parsed example (from `ctos.response.txt`)

- `summary_json.fico_score = 901`
- `company_json.name = "9 HEARTS SDN BHD"`
- `company_json.directors[0].position = "DS"`
- `legal_json.cases[0].case_no = "3016022-D103"`
- `financials_json[0].financial_year = 2024`
- `financials_json[0].account.plnpat = 137514`

---

## 5) Database Structure (Very Important)

Primary table: `ctos_reports`

From Prisma (`apps/api/prisma/schema.prisma`):
- `id`
- `issuer_organization_id` (nullable FK)
- `investor_organization_id` (nullable FK)
- `subject_ref` (nullable text)
- `fetched_at`
- `raw_xml` (text)
- `report_html` (text nullable)
- `summary_json` (json)
- `company_json` (json nullable)
- `person_json` (json nullable)
- `legal_json` (json)
- `ccris_json` (json)
- `financials_json` (json)
- timestamps (`created_at`, `updated_at`)

Organization linkage:
- Organization-level report:
  - `subject_ref = null`
  - linked by issuer/investor org id
- Subject-level report:
  - `subject_ref != null`
  - normalized by `normalizeCtosSubjectRefKey` (trim/space-strip/lowercase)
  - represents director/shareholder targeted snapshots

Related table for CTOS party onboarding metadata:
- `ctos_party_supplements`
  - org FK + `party_key` + `onboarding_json`
  - stores email/sent/request/status-like metadata for CTOS party workflows

---

## 6) Field Mapping (CTOS -> Meaning)

Core party/report fields:
- `ptype` -> party type (`I` individual, `C` company)
- `pcode` -> CTOS product/type code
- `ic_lcno` -> company reg / ID field (context-dependent)
- `nic_brno` -> alternate ID/business registration field
- `brn_ssm` -> business registration identifier
- `comp_type` -> company type label
- `comp_category` -> category label

Legal:
- `section_d*` records -> legal case entries
- `amount` -> case amount
- `court_detail` -> court info
- `hear_date` -> hearing date

CCRIS:
- `total_limit` -> borrower total limit
- outstanding text/value -> borrower total outstanding

Financial account mappings (stored in `financials_json[].account`):
- `bsfatot` -> Fixed assets total
- `othass` -> Other assets
- `bscatot` -> Current assets total
- `bsclbank` -> Non-current assets/bank-related asset line (system label usage)
- `totass` -> Total assets
- `curlib` -> Current liabilities
- `bsslltd` -> Long-term liabilities
- `bsclstd` -> Non-current liabilities (line)
- `totlib` -> Total liabilities
- `bsqpuc` -> Equity / paid-up capital
- `turnover` -> Revenue / turnover
- `plnpbt` -> Profit before tax
- `plnpat` -> Profit after tax
- `plnetdiv` -> Net dividend related line
- `plyear` -> Year profit/earnings line (not year index)
- `networth` -> Net worth
- `turnover_growth` -> Growth indicator (CTOS-provided when present)
- `profit_margin` -> Margin indicator (CTOS-provided when present)
- `return_on_equity` -> ROE indicator (CTOS-provided when present)
- `currat` -> Current ratio
- `workcap` -> Working capital

Note:
- `financial_year` is **not** raw CTOS field. It is derived from `pldd`.

---

## 7) Derived Metrics / Calculations

There are two layers:

1) **Parser layer** (`apps/api/src/modules/ctos/parser.ts`)
- No formula recomputation for these metrics.
- It stores CTOS-provided numeric values for:
  - `turnover_growth`
  - `profit_margin`
  - `return_on_equity`
  - `currat`
  - `workcap`

2) **Admin table math fallback layer** (`packages/types/src/ctos-report-table-math.ts`)
- Used for UI fallback when CTOS field missing in table rendering.

Formulas:
- `turnover_growth = (targetTurnover - priorTurnover) / priorTurnover`
  - only if prior year is exactly targetYear - 1
- `profit_margin = plnpat / turnover`
- `return_on_equity = plnpat / equity(bsqpuc)`
- `current_ratio = bscatot / curlib`
- `working_capital = bscatot - curlib`

Additional fallback computations:
- `total_assets` fallback:
  - `bsfatot + othass + bscatot + bsclbank`
- `total_liabilities` fallback:
  - `curlib + bsslltd + bsclstd`
- `networth` fallback:
  - `total_assets - total_liabilities`

---

## 8) Business Logic (Your System)

### A) Director/shareholder filtering

Unified rules in `packages/types/src/director-shareholder-display.ts`:
- directors: always include
- individual shareholders: include only when share >= 5%
- corporate shareholders: always include

CTOS row eligibility for individual KYC action:
- eligible only if:
  - is individual, and
  - director OR shareholder with share >= 5%

### B) Role mapping from CTOS position codes

Known CTOS codes:
- `DO` director only
- `SO` shareholder only
- `DS` director + shareholder
- `AD` alternate director
- `AS` alternate director + shareholder

### C) Legal handling

System flattens and merges legal records from:
- `section_d`
- `section_d2`
- `section_d4`

Each case is stored under `legal_json.cases[]`.

### D) Risk signals consumed

Risk-relevant fields used in review include:
- bankruptcy flag
- legal totals and case entries
- CCRIS aggregates (applications/arrears/limits/outstanding)
- FICO score + factors
- financial trend rows in `financials_json`

### E) Multi-entity behavior

- Harness (`ctos.new.ts`) auto-resolves status=2 using first entity key + `requestConfirm`.
- Production CTOS client currently calls only `ws:request` (no `requestConfirm` path in client).

---

## 9) Data Limitations (Very Important)

What CTOS does not reliably provide for your system:
- direct DSCR
- direct interest coverage ratio
- guaranteed complete debt service schedule
- guaranteed fully normalized statement series year-by-year

Known limitations:
- missing/empty fields common in XML
- CCRIS section may be absent or partial
- legal section can be partial or uneven by entity
- multiple entities (`code="2"`) can make subject resolution ambiguous
- financial years may be non-continuous
- parser only keeps one row per `pldd` calendar year (first seen)

Important parser constraints:
- `financial_year` derived only from `pldd`
- if `pldd` cannot be parsed into year, row is skipped
- some CTOS account tags intentionally not stored in parser allowlist (e.g. `tabledt`, `gear`, `bsqmint`, `plminin`)

---

## 10) How To Use This Data Safely (For AI)

1. Start from `ctos_reports` row scope:
- org-level report: `subject_ref = null`
- party-level report: `subject_ref != null`

2. Prefer latest row by `fetched_at desc` for the same scope.

3. Treat these fields as most reliable first:
- `summary_json` high-level signals
- `company_json` identity + directors list
- `financials_json` normalized annual rows

4. Always null-check:
- `company_json` can be null for individual report
- `person_json` can be null for company report
- `ccris_json.summary` can be null-valued
- legal and financial entries may have partial nulls

5. For financial analysis:
- do not assume year continuity
- use `financial_year` as parser-derived display key
- if ratio field missing, use fallback formulas only when required inputs exist

6. For director/shareholder workflows:
- use normalized key matching (`normalizeDirectorShareholderIdKey` logic)
- apply `>=5%` threshold for individual shareholder inclusion and onboarding eligibility
- corporate shareholders are included but not individual KYC eligible

7. For subject lookups:
- use normalized `subject_ref` semantics
- if subject missing in org JSON, production resolver returns null and request should fail safely

---

## 11) Common Mistakes / Gotchas

- Misreading `plyear` as calendar year. It is a financial value line item, not year index.
- Assuming `bsdd` determines `financial_year`. In this system, only `pldd` determines year.
- Assuming consecutive financial years exist.
- Assuming all legal dates/amounts are complete.
- Ignoring null checks in nested JSON.
- Mixing organization-level and subject-level reports.
- Treating harness multi-entity confirm behavior as guaranteed production behavior.

---

## 12) AI Usage Rules (Strict)

1. Do not assume missing CTOS fields.
2. Always use explicit fallback logic, not invented values.
3. Do not derive DSCR or Interest Coverage from CTOS unless all required inputs are explicitly present and approved by system rules.
4. Do not assume continuous yearly financial data.
5. Do not treat `plyear` as financial year.
6. Use `financial_year` from parsed rows for display/grouping.
7. Respect `>=5%` rule for individual shareholder inclusion logic.
8. Separate org-level (`subject_ref = null`) and subject-level (`subject_ref != null`) analysis.
9. Treat null and missing as first-class outcomes.
10. If multi-entity ambiguity exists, mark as unresolved unless disambiguation is explicitly available in production path.

---

## Appendix A: Verified Source Files

- Parser: `apps/api/src/modules/ctos/parser.ts`
- CTOS service/persist: `apps/api/src/modules/ctos/ctos-report-service.ts`
- CTOS client: `apps/api/src/modules/ctos/client.ts`
- Enquiry XML builders: `apps/api/src/modules/ctos/enquiry-builder.ts`
- Subject resolver: `apps/api/src/modules/ctos/resolve-subject-from-org.ts`
- Prisma schema: `apps/api/prisma/schema.prisma`
- Admin routes: `apps/api/src/modules/admin/controller.ts`
- Director/shareholder merge rules: `packages/types/src/director-shareholder-display.ts`
- Financial fallback formulas: `packages/types/src/ctos-report-table-math.ts`
- Test harness and examples:
  - `apps/api/src/ctos-test/ctos.new.ts`
  - `apps/api/src/ctos-test/ctos.response.txt`

