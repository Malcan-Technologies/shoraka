# Issuer org financial statements: latest prefill

## Why this exists
Financial statements are “issuer organization” information (the issuer company), not one specific invoice. When an issuer applies again later (repeat / new invoice applications), we want to reduce repeated data entry by pre-filling the issuer’s financials.

The prefill is only a convenience for user effort. It must not change admin review behavior or change what was submitted in historical applications.

## Current data ownership (what is stored where)
1. `Application.financial_statements`
   - Stored as the current application’s v2 JSON financial statements.
   - This is what the issuer edits during the financial step.
   - This value is what gets snapshotted for review.

2. `ApplicationRevision.snapshot`
   - A submit/resubmit snapshot (“photo”) of the application at that point in time.
   - It keeps existing behavior unchanged.

3. `IssuerOrganizationFinancialStatement` (new)
   - Stores the latest reusable organization-level financial statements for future prefill.
   - One row per `issuer_organization_id`.
   - Only intended for “prefill the next application” use.

## Update rules (draft vs submit/resubmit)
This feature follows a strict “only submit becomes reusable” rule:

- Draft save (financial step “Save and Continue”):
  - Updates `Application.financial_statements` only.
  - Does NOT update `IssuerOrganizationFinancialStatement`.

- Submit (`DRAFT -> SUBMITTED`):
  - After `ApplicationRevision` is created, the backend upserts the org-level latest financial statements from the submitted `Application.financial_statements`.

- Resubmit (`AMENDMENT_REQUESTED -> RESUBMITTED`):
  - After `ApplicationRevision` is created, the backend upserts the org-level latest financial statements from the submitted `Application.financial_statements`.

Historical applications are not rewritten, and we never bypass `ApplicationRevision`.

## Prefill rules (frontend)
When the issuer opens the financial step:

- If the current application already has `financial_statements`:
  - We use the current application data as-is.
  - We do not overwrite with org-level data.

- If the current application has no `financial_statements` yet:
  - The frontend fetches the latest `IssuerOrganizationFinancialStatement` for the issuer organization.
  - If the stored JSON is compatible with v2 shape, we prefill:
    - `questionnaire.financial_year_end`
    - `unaudited_by_year` values
  - All fields remain editable.
  - The UI shows a note:
    “Auto-filled from previous submitted application. Please review before continuing.”

- If org-level data is missing or incompatible:
  - The financial step keeps the existing blank/manual behavior.

Prefill runs only once per page-load and never overwrites user edits.

## Example scenario (February / March / April)
1. February:
   - Issuer applies and submits financials for FYs (stored on `Application.financial_statements`).
   - On submit, backend updates `IssuerOrganizationFinancialStatement`.

2. March:
   - Issuer creates another application (new invoice flow) with blank `Application.financial_statements`.
   - Frontend fetches org latest and pre-fills FY end + values.

3. March edits + submits:
   - Draft edits update only `Application.financial_statements`.
   - On submit, backend updates `IssuerOrganizationFinancialStatement` with the new submitted values.

4. April:
   - Next application prefill uses April’s latest submitted org values (from the most recent submit/resubmit).

## Non-goals
- No full “financial history” table.
- No migration of existing `Application.financial_statements` data into a normalized schema.
- No per-year normalized storage (we store the full v2 JSON shape).
- No changes to admin review logic and no bypass of `ApplicationRevision`.

