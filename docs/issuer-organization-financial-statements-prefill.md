# Issuer org financial statements: latest copy and CTOS prefill

## Why this exists
Financial statements for a financing live on the **application**. For a new application, the current FY starts blank. Each previous FY is copied once from CTOS plus explicit CTOS gap fills, otherwise Admin Input, otherwise reviewed User Input. The organisation JSON is not a year-amount source.

The **in-progress** year always starts blank.

Prefill is a convenience. It must not change admin review behavior or rewrite historical applications. CTOS is not written into org master.

## Current data ownership (what is stored where)
1. `Application.financial_statements`
   - Stored as the current application’s v2 JSON financial statements.
   - This is what the issuer edits during the financial step.
   - This value is what gets snapshotted for review.

2. `ApplicationRevision.snapshot`
   - A submit/resubmit snapshot of the application at that point in time.
   - Canonical submitted financial truth for same-FY prefill (`snapshot.application.financial_statements`).

3. `IssuerOrganizationFinancialStatement`
   - Organisation-level history merged on submit/resubmit (one row per issuer org).
   - Not used to prefill a new application’s year amounts.
   - May still supply `questionnaire.financial_year_end` for the FYE picker only if that date is still within the next-12-month window.
   - Issuer Profile shows this as read-only history.

4. `CtosReport.financials_json`
   - External evidence. Latest org report is read for prefill; never merged into org master by prefill.

## Prefill source (new applications with empty `financial_statements`)

Shared helper: `buildApplicationFinancialPrefillByYear` in `packages/types/src/application-financial-prefill.ts`.

In-progress year = calendar year of the selected **next** financial year end (`getInProgressFinancialYearEndYear`). Same whether the UI shows one tab or two.

| Year | Effective starting value |
|------|--------------------------|
| Completed / previous tab | CTOS for that exact FY, plus explicit Admin CTOS gap fills for fields CTOS left empty. Else that FY's Admin Input. Else that FY's User Input plus Admin edits of that User Input. Else blank. One source per FY. A blank field on the selected source stays blank. |
| In-progress / current tab | Always blank (not org, not CTOS, not Admin Input, not User Input) |

- Do not copy year blocks before FYE is known (stale FYE must not leave figures on the current tab).
- Do not copy FY N into FY N+1.
- CTOS maps only the existing issuer application money keys (`bsfatot` … `plyear`). ComRep-only splits are not in CTOS and are not derived from related totals.
- When CTOS has that FY, Admin Input and User Input are not used. Only explicit `add_missing_ctos_field` values fill CTOS gaps.
- If CTOS does not have that FY, Admin Input wins over User Input.
- User Input fallback includes Admin `edit_user_input` values. The original issuer snapshot stays on the revision.
- Organisation JSON is not read for year amounts. A blank optional field is not filled from an older same-FY block.
- All prefilled fields stay editable. Save/submit store the issuer’s values on the application.

## Update rules (draft vs submit/resubmit)

- Draft save: `Application.financial_statements` only. Drafts are not a prefill source.
- Submit / resubmit: after `ApplicationRevision`, merge application years into org history (existing year-key merge; older years are kept). That merge is history, not prefill.
