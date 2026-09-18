# Financial Statements Step Guide

This guide describes the **v2** Financial Statements step: questionnaire, per-year issuer input, API validation, and how it relates to CTOS extracts.

---

## Overview

Issuers select **one** date: the **next financial year end** (`financial_year_end`, ISO `YYYY-MM-DD`). The issuer question is “What is your company's next financial year end?” Valid iff **today &lt; FYE** and **periodStart(FYE) ≤ today** (`periodStart = FYE − 1 year + 1 day`). Equivalent: **today &lt; FYE &lt; today + 12 months**. That bound means every generated tab is a period that has already started; the selected year is the in-progress YTD year and stays required.

Open-year period **display** is clamped to today (`1 Jun 2026 – 18 Sep 2026 (as at today)`), with management-accounts copy. Stored `pldd` remains the FY end for that column. Closed years still show the full period.

Shared error copy (`FINANCIAL_YEAR_END_ERROR_MESSAGES`):

- `not_future`: “Please select a future financial year end date.”
- `beyond_window`: “Financial year end must be within the next 12 months.”
- `invalid`: “Enter a valid date” (issuer UI)

Worked examples for today = 18 Sep 2026:

- FYE 31 Mar 2027 → valid → tabs FY2026 + FY2027 (both required).
- FYE 31 Dec 2026 → valid → FY2026 only.
- FYE 31 Dec 2027 → rejected (`beyond_window`).
- FYE 17 Sep 2027 → valid; FYE 18 Sep 2027 → rejected.
- FYE 18 Sep 2026 or earlier → rejected (`not_future`).

Tab count (1 or 2) and tab labels (**FY end calendar years**) still come from `getIssuerFinancialTabYears` in `packages/types/src/financial-unaudited-ctos-validation.ts`: **deadline** = previous FY end **+ 6 calendar months** (audited filing window); if **today &lt; deadline** → two tabs (previous + current FY end years); if **today ≥ deadline** → one tab (selected FY end year only). Only raw input values are stored. Computed metrics (`totass`, ratios, etc.) are derived with `calculateFinancialMetrics()` in `packages/types/src/financial-calculator.ts` and are not persisted.

---

## Database shape (`financial_statements` JSON)

| Key | Meaning |
|-----|---------|
| `questionnaire` | `{ financial_year_end: "YYYY-MM-DD" }` (next date the company’s books close; must be in the future and within the next 12 months when saved). |
| `unaudited_by_year` | Map of **FY end calendar year** string (e.g. `"2026"`, `"2027"`) → per-year block: numeric fields + **`pldd`** (ISO FY end for that column). No **`bsdd`** on issuer rows. |

**Year tabs (issuer)** — `getIssuerFinancialTabYears(questionnaire, ref)` in `@cashsouk/types`. In-progress year is always the selected next FYE calendar year (`getInProgressFinancialYearEndYear`), including one-tab mode.

**New-application prefill** — `buildApplicationFinancialPrefillByYear`: completed tabs use CTOS when that year has application line items; otherwise the newest submitted/resubmitted application revision that contains that same FY; otherwise blank. Organisation profile JSON is not a year-amount fallback. The in-progress tab always starts blank. See `docs/issuer-organization-financial-statements-prefill.md`.

**Admin Financial Summary** — Three fixed CTOS columns (latest three CTOS `financial_year` values, ascending, padded with empty slots on the **left** so the newest CTOS year sits next to user columns). Issuer columns are the numeric keys of stored `unaudited_by_year` (oldest → newest), not recomputed from today’s FYE window. An **open** issuer year shows a period clamped to today; a closed issuer year shows the full period. Both issuer columns are labelled **User Input**. Submitted / aged FYEs still render. Prospectus year resolution parses questionnaire **shape only** so aged FYEs stay available; expected-year ops warnings still use `getAdminFinancialSummaryUserColumnYears(questionnaire, ref)`.

**CTOS `financial_year`** — Parsed as the calendar year from CTOS `pldd` (see `apps/api/src/modules/ctos/parser.ts`).

---

## Stored field keys (per year)

Core application keys (unchanged): `pldd`, `bsfatot`, `othass`, `bscatot`, `bsclbank`, `curlib`, `bsslltd`, `bsclstd`, `bsqpuc`, `turnover`, `plnpbt`, `plnpat`, `plnetdiv`, `plyear`.

Optional ComRep extras (same year block, separate issuer section): `curlib_borrowing`, `curlib_non_borrowing`, `ncl_loan`, `ncl_non_loan`, `equity_share_application`, `equity_share_premium`, `equity_accumulated_profit`, `equity_minority`, `operating_cost`, `admin_cost`, `interest_cost`, `other_cost`, `pl_minority`. Blank extras are omitted from storage and do not block Save/Continue.

When required input is still missing, the footer shows a general hint (`Complete the next financial year end` or `Complete FY{year}`) next to Save and Continue. Additional Financial Details are not included in that hint.

See `financialStatementsInputSchema` in `apps/api/src/modules/applications/schemas.ts`.

---

## API

Save path uses `financialStatementsV2Schema` (shared 12-month FYE window + exact error copy) and validates `unaudited_by_year` keys against `getIssuerFinancialTabYears(questionnaire, new Date())`, then normalizes **`pldd`** per FY column.

**Amendment exception:** when status is `AMENDMENT_REQUESTED` and the issuer keeps the stored `financial_year_end`, save uses `financialStatementsV2StoredSchema` (shape only) and the already-stored year keys. Changing FYE on amendment still requires the live window and live expected years. Drafts and initial SUBMIT stay strict.

Initial **SUBMIT** (not RESUBMIT) re-runs that schema and expected-year check when `financial_statements` is an active workflow step and a stored payload exists. Failure is `400 VALIDATION_ERROR` with `Financial Statements: <message>` so a pre-window draft (e.g. FYE 31 Dec 2027) cannot be submitted by skipping the step.

Org-history merge reads already-stored JSON with `financialStatementsV2StoredSchema` (shape only, no today-relative refine) so an FYE that has aged past today is still merged as-is.

Lifecycle seeds that write `financial_statements` directly to the DB are not run through the save path and are not validated.

See `apps/api/src/modules/applications/service.ts`.
