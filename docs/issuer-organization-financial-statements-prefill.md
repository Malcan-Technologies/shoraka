# Issuer org financial statements: latest prefill

## Why this exists
Financial statements are “issuer organization” information (the issuer company), not one specific invoice. When an issuer applies again later, we prefill **completed** years so they do not re-type filed figures. The **in-progress** year always starts blank.

Prefill is a convenience. It must not change admin review behavior or rewrite historical applications. CTOS is not written into org master.

## Current data ownership (what is stored where)
1. `Application.financial_statements`
   - Stored as the current application’s v2 JSON financial statements.
   - This is what the issuer edits during the financial step.
   - This value is what gets snapshotted for review.

2. `ApplicationRevision.snapshot`
   - A submit/resubmit snapshot of the application at that point in time.

3. `IssuerOrganizationFinancialStatement`
   - Latest reusable organization-level financial JSON (one row per issuer org).
   - Updated on submit/resubmit only (not draft save).

4. `CtosReport.financials_json`
   - External evidence. Latest org report is read for prefill; never merged into org master by prefill.

## Prefill source (new applications with empty `financial_statements`)

Shared helper: `buildApplicationFinancialPrefillByYear` in `packages/types/src/application-financial-prefill.ts`.

In-progress year = calendar year of the selected **next** financial year end (`getInProgressFinancialYearEndYear`). Same whether the UI shows one tab or two.

| Year | Effective starting value |
|------|--------------------------|
| Completed / previous tab | CTOS application fields for that year, if present; otherwise org master |
| In-progress / current tab | Always blank (not org, not CTOS) |

- Do not copy year blocks before FYE is known (stale FYE must not leave figures on the current tab).
- Prefill maps only the issuer application field set (`bsfatot` … `plyear`). No ComRep borrowing/cost splits.
- All prefilled fields stay editable. Save/submit store the issuer’s values on the application.

## Update rules (draft vs submit/resubmit)

- Draft save: `Application.financial_statements` only.
- Submit / resubmit: after `ApplicationRevision`, upsert org master from the application (existing merge). Prefill does not change that path.
