# Issuer org financial statements: latest copy and CTOS prefill

## Why this exists
Financial statements for a financing live on the **application**. CTOS is the first prefill source for completed years. If CTOS has no matching year, the newest **submitted/resubmitted** application revision that contains that **same FY** is used. The organisation JSON is submitted-application **history** (and a future ComRep source), not a second editable master and not an application year-amount prefill fallback.

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
   - May still supply a future `questionnaire.financial_year_end` for the FYE picker.
   - Issuer Profile shows this as read-only history.

4. `CtosReport.financials_json`
   - External evidence. Latest org report is read for prefill; never merged into org master by prefill.

## Prefill source (new applications with empty `financial_statements`)

Shared helper: `buildApplicationFinancialPrefillByYear` in `packages/types/src/application-financial-prefill.ts`.

In-progress year = calendar year of the selected **next** financial year end (`getInProgressFinancialYearEndYear`). Same whether the UI shows one tab or two.

| Year | Effective starting value |
|------|--------------------------|
| Completed / previous tab | CTOS application fields for that year, if present; else the newest submitted revision that contains that **same** FY; else blank |
| In-progress / current tab | Always blank (not org, not CTOS, not submitted history) |

- Do not copy year blocks before FYE is known (stale FYE must not leave figures on the current tab).
- Do not copy FY N into FY N+1.
- CTOS maps only the existing issuer application money keys (`bsfatot` … `plyear`). ComRep-only splits are not in CTOS and are not derived from related totals.
- Submitted same-FY fallback copies that year’s stored block (core keys plus any ComRep extras already saved on that revision).
- All prefilled fields stay editable. Save/submit store the issuer’s values on the application.

## Update rules (draft vs submit/resubmit)

- Draft save: `Application.financial_statements` only. Drafts are not a prefill source.
- Submit / resubmit: after `ApplicationRevision`, merge application years into org history (existing year-key merge; older years are kept). That merge is history, not prefill.
