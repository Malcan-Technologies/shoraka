# Issuer financials: Profile, new-application prefill, Admin review

## Why this exists
Financial statements for a financing live on the **application**. Several concepts read the same years but follow different rules, and they are deliberately not synchronised:

| Concept | What it is | Sources |
|---|---|---|
| Issuer Profile | Latest financial values the issuer actually submitted, per FY | Issuer-submitted User Input only |
| New-application prefill | Starting values for the eligible previous FY of a new application | Raw CTOS for that FY, else issuer-submitted User Input, else blank |
| Application User Input | What the issuer saved on this application | The application itself |
| Admin Financial Review | Reviewer view of one application | CTOS (+ Admin gap fills), User Input (+ Admin edits), Admin Input |

CTOS, Admin CTOS gap fills, whole-year Admin Input and Admin `edit_user_input` never feed the Profile or prefill.

## Data ownership
1. `Application.financial_statements` — the issuer's v2 JSON (`questionnaire`, `unaudited_by_year`) plus Admin review data on the same row (`admin_input_by_year`, `admin_field_overrides`). Admin review data is application-only.
2. `ApplicationRevision.snapshot` — immutable snapshot written on every submit and resubmit, with `submitted_at` and `review_cycle`. Source of truth for "what the issuer submitted, and when".
3. `IssuerOrganizationFinancialStatement` — organisation JSON merged on submit/resubmit. Not a Profile or prefill amount source. It may still seed `questionnaire.financial_year_end` for the FYE picker while that date is inside the live window.
4. `CtosReport.financials_json` — external evidence. Never written into the Profile.

## Issuer Profile
Shared helpers: `packages/types/src/issuer-submitted-financials.ts`.

- Built only from `ApplicationRevision` snapshots (`snapshot.application.financial_statements.unaudited_by_year`). Draft saves, live application JSON, `updated_at`, Admin data and CTOS are not read.
- Per application, revisions are compared in `review_cycle` order. A FY becomes newer only when its User Input is new, re-added, or changed compared with that application's previous revision (canonical raw keys; `0` is a value, missing is missing). An unchanged FY keeps its earlier time.
- Across applications, the FY with the newest effective time wins.
- Consequences:
  - Admin edits a reviewed value 100 → 120: Profile stays 100.
  - Documents-only (or any non-financial) resubmission: unchanged FYs do not become newer.
  - Financial amendment that changes FY2027 only: FY2027 gets the resubmission time, FY2026 keeps its earlier time.
  - Submissions of applications later withdrawn, rejected or archived still count.
  - Applications without any revision row contribute nothing.
- Endpoint `GET /v1/organizations/issuer/:id/financial-statements/latest` returns `submitted_financial_years` with per-FY `block`, `effectiveAt`, `applicationId` and `revisionId`. The admin organisation page uses the same index server-side.

## New-application prefill
Shared helper: `buildApplicationFinancialPrefillByYear` in `packages/types/src/application-financial-prefill.ts`.

Tabs come from `getIssuerFinancialTabYears` (`[previous, current]` until previous FYE + 6 months, then `[current]`). The current FY is `getInProgressFinancialYearEndYear` and is **always blank**.

For the eligible previous FY only (`resolveNewApplicationHistoricalPrefill`):

1. The latest CTOS report has a row for that FY → raw CTOS values for the whole year. Fields CTOS leaves blank stay blank; they are not filled from User Input or Admin gap fills. A CTOS row without amounts leaves the year blank.
2. Otherwise → the latest issuer-submitted User Input for that FY (same index as the Profile).
3. Otherwise → blank.

- Prefill only runs while the application has no saved financial statements. Once saved, the application owns its values and prefill is not reapplied.
- All prefilled fields stay editable.
- A draft save does not change the Profile; submitting does.

## Admin Financial Summary
Historical window = latest User Input FY − 3, − 2, − 1.

- CTOS and User Input for the same FY: both columns are shown, for comparison.
- Historical FY with User Input and no CTOS: only the User Input column. Stored Admin Input for that FY is inactive (kept for audit, not displayed, not used in calculations or year selection) and "Add statement" is not offered.
- FY with neither CTOS nor User Input: Admin Input may be shown and added as before.
- Calculations read only displayed reviewed columns, so inactive Admin Input cannot affect turnover growth, receivables days, payables days or the previous-year lookup.
- Prospectus keeps using the application's approved Financial review result.
