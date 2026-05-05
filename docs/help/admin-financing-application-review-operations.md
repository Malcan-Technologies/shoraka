---
title: "Financing Application Review"
description: "Admin application review workflow: tab gating, section and line-item actions, amendments, contract and invoice offers, and status interpretation."
category: Application Review
tags:
  - admin
  - operations
order: 11
updated: 2026-05-05
---

## Purpose

This document describes the admin application review workflow for issuer financing applications after submission. It covers review scope by tab, sequential gating, section-level and line-item actions (approve, reject, request amendment), how contract and invoice stages advance through offers, and how to interpret application statuses in the admin portal.

## Flow at a Glance

1. The issuer creates an application for a product and may keep it in **draft** until submission.
2. After submission, the application appears in the admin queue for review.
3. Review proceeds by tab (section). Some products also require review by line item (individual documents or invoices).
4. For each section or item, the reviewer records an outcome: approve, reject, or request amendment as appropriate.
5. When amendments are issued, the application enters **Amendment requested** until the issuer updates only the flagged areas and resubmits. A new review cycle begins. The portal may surface a comparison of changes.
6. After prerequisite sections are approved, the reviewer sends contract and/or invoice offers where the product requires them.
7. The issuer accepts, signs, or rejects each offer in the issuer portal.
8. The application reaches **approved** or **completed** when all required offers are accepted or signed, or it closes on **rejected** or **withdrawn**.

## Review Scope by Tab

The admin UI builds tabs from the product workflow. **Financial** is always first. Other steps appear only when the product includes them, in this order when present: **Company**, **Business & Guarantor**, **Documents**, **Contract**, **Invoice**.

- **Financial:** issuer-entered financials, CTOS figures where loaded, and the **Director and Shareholders** block (identity and compliance as shown). This tab uses one section-level outcome for the whole tab.
- **Company:** legal entity and issuer profile from onboarding (addresses, registration context, bank details, and other company fields the step collects).
- **Business & Guarantor:** operating and trading context, repayment position where captured, guarantors and their screening, and **Declarations** when the workflow includes that confirmation. Declarations are not a separate tab.
- **Documents:** supporting uploads. When the product uses item-level review, each file is its own row with per-row actions.
- **Contract:** facility and customer data for the product (new contract, existing facility, or invoice-only path). For invoice-only structures the content centers on customer or paymaster fields. Contract offers and signing run from this tab when the product requires them.
- **Invoice:** each invoice as its own row where applicable (attachments, amounts, tenor, ratio limits, and other invoice fields the product defines). Per-row review and invoice offers follow the product rules.

## Sections and Line Items

- Section (tab): a single workflow step, for example company details or contract details.
- Line item: one row in a list within a section, for example one invoice or one document.

For documents and invoices, review is usually per line item. The overall status for that step follows from the rows you complete. Use the row controls for the file or invoice that needs a decision instead of looking for one control that approves the entire list at once.

## Supporting documents and invoices

The Documents tab is not structured like the Company tab or the Financial tab. On the Documents tab, select approve, reject, or request amendment for each file row. When every row has an outcome, the work for that tab is complete. The interface does not provide a separate control that approves the full Supporting documents list after the rows are already complete.

The Documents tab status is derived from the file rows. A rejected row leaves the Documents tab in rejected until that row is cleared or the case is closed. A pending row leaves the Documents tab in pending. When all rows are approved, the Documents tab moves to approved as soon as the last pending row is approved. No additional approval action exists for the list as a whole.

Each file row requires a recorded outcome.

The Invoice tab uses the same row-by-row model. Complete each invoice row in turn (review, then send an offer when the product requires it). The status displayed for the Invoice tab applies to all invoice rows together. The reviewer cannot approve the entire invoice list with one action in the same way as a single approve on the Company tab.

## Tab Gating and Order

The admin portal enforces staged access. Later tabs remain locked until earlier requirements are satisfied.

- Financial, Company, Business & Guarantor, and Documents are generally available first.
- Contract unlocks after those sections are approved, for products that include that step.
- Invoice unlocks after the preceding sections and Contract are approved, when the product sequences invoices after contract.
- Applications linked to an existing contract may treat the contract step as already satisfied from the prior facility, without repeating the same contract approval from scratch.
- Final application approval remains blocked until every required review section is approved.

If a tab is locked, complete and approve the upstream tabs in the order shown by the workflow.

## Contract and Invoice Tabs: Offers and Completion

For contract and invoice stages, completion is driven by offers, not only by the same pattern as a purely internal approve action on static data tabs.

Typical sequence:

1. Validate the data shown on the contract or invoice tab.
2. Send the contract offer or send the invoice offer (per row where applicable).
3. Await issuer acceptance or signature (or issuer rejection) in the issuer portal.

For these stages, the commercial step is normally closed only after the offer is sent and the issuer has accepted or signed as required. Follow the primary actions shown on the tab (for example send offer) rather than assuming a single approve control completes the stage in the same way as company or document review.

## Approve

- Approve section: the entire tab satisfies review criteria for the current cycle and counts toward unlocking downstream steps.
- Approve line item: the individual document or invoice row satisfies review criteria.

Where the product enforces item-level review, each required row must be approved. Section-level approval does not replace missing item decisions.

## Reject

- Reject section or line item: that portion of the submission does not pass review. Use for material failure of that unit of work, not for issues that a resubmission or replacement file would reasonably resolve.
- Reject application: terminates the application as an active financing case. Reserve for a final negative decision. Use request amendment when the issuer should correct and continue on the same application record.

## Request Amendment

Use when the issuer must correct, clarify, or replace information while keeping the case open.

Procedure:

1. Attach a clear remark to the exact section or line item (what is deficient and what is required).
2. Open Request amendment, verify the grouped remarks, and send them to the issuer in one action.

After send:

- Application status becomes **Amendment requested**.
- The issuer may edit only flagged sections or items, complete any required acknowledgements, and resubmit.

Prefer amendment for recoverable defects. Prefer rejection when the application or that segment should not proceed.

## Financial tab: Organization CTOS, Financial Summary, and people

On the **Financial** tab, use **Organization CTOS** (fetch report / view report), **Financial Summary** (issuer columns next to CTOS columns where loaded), **Company Credit Score**, **Cashsouk Intelligence**, and **Director and Shareholders** as labeled in the UI.

- Run a fresh organization CTOS report when the snapshot is missing or stale. In the UI, use **Fetch CTOS report** and check **Last organization CTOS fetch** for recency.
- Run subject-level CTOS for a person or entity when an individual director or corporate party needs their own enquiry. The confirm dialog describes a **CTOS enquiry** for that party.
- Monitor **KYC** and **KYB** status as rendered for each party.
- **Approve** on the Financial tab may stay disabled until all visible directors and shareholders are onboarding-complete (review-ready or approved) and **AML** is approved per row. An amber banner explains incomplete verification. This is stricter than **KYC** only.
- If directors, shareholders, or controllers changed since the prior cycle, refresh CTOS and related data and confirm identity, role, and identifiers before approval.

**Presentation rules:** director rows always appear. Individual shareholders typically appear from the product threshold (commonly 5% and above). Corporate shareholders appear as corporate parties. Incomplete party onboarding may block progress until the issuer completes the required steps from the issuer profile. After party onboarding is approved, fields are locked, and further changes require an amendment path if policy allows.

## Guarantor Screening

The Business & Guarantor tab lists guarantors from issuer business details. The reviewer may start AML screening from the admin view for each guarantor.

- Individual guarantors: name, national ID, email, nationality.
- Company guarantors: registered name, company registration number, email.

Confirm screening outcome on the guarantor record before relying on guarantor support in the approval decision.

## Preconditions for Sending a Contract Offer

- Customer or paymaster details are accurate.
- Large private company indicator is correct where the product collects it.
- Offered facility does not exceed the requested facility.
- The offer is not already accepted or signed.

After issuer acceptance or signature, the contract becomes the reference for linked invoices on the same application.

## Preconditions for Sending an Invoice Offer

- Validate amount, ratio, tenor, profit rate, and risk attributes as shown.
- Offered amount does not exceed requested amount.
- Tenor satisfies product rules.
- If the invoice was previously rejected, return it to pending when the portal allows, before sending a new offer.

Send offers only when prerequisite sections are approved and the target tab is unlocked.

## Admin Stage Sequence (Contract and Invoice Products)

1. **Contract pending**: contract tab is active. The usual next action is to send contract offer when data are validated.
2. **Contract sent**: offer delivered to issuer. Wait for issuer response.
3. **Contract accepted**: issuer agreed. Proceed to invoice offers where the product requires them.
4. **Invoice pending**: invoice tab active. Validate rows and send invoice offer(s) as required.
5. **Invoices sent**: required invoice offers are outstanding. Wait for issuer responses.

Invoice-only products omit contract stages and move from **invoice pending** to **invoices sent**.

## Status Reference (Admin)

- **Draft**: issuer is still editing. No admin review actions apply.
- **Submitted** or **Under review**: section and item review may proceed.
- **Contract pending** or **Invoice pending**: prerequisite review is sufficiently complete. Validate data and typically send offers for the active stage.
- **Amendment requested**: issuer must address remarks and resubmit.
- **Resubmitted**: issuer returned the application. Perform a full pass against outstanding remarks and current data.
- **Contract sent** or **Invoices sent**: offers are with the issuer pending response (subject to any expiry rules configured for the product).
- **Approved** or **Completed**: required offer outcomes are satisfied.
- **Withdrawn** or **Rejected**: the application is closed and does not advance further on that record.

## Review Discipline

- Bind each amendment remark to the specific section, document, or invoice it concerns.
- Use amendment for correctable defects. Use rejection when the case or unit should stop.
- Refresh organization and subject CTOS (and related party data) when material facts changed before approving financials.
- Confirm customer or paymaster data before sending commercial offers.
- Confirm guarantor screening before treating guarantor support as established.
- Use invoice offers for invoice-level commercial approval and contract offers for facility-level approval.
- Do not send offers until upstream sections are approved and the relevant tab is unlocked.
- After issuer acceptance or signature, verify accepted terms in the portal before treating the commercial outcome as final for downstream handoff.
