---
title: "Financing Application Review: Operations Guide"
description: Admin application review workflow: tab gating, section and line-item actions, amendments, contract and invoice offers, and status interpretation.
category: Application Review
tags:
  - admin
  - operations
order: 11
updated: 2026-05-04
---

## Purpose

This document describes the **admin application review workflow** for issuer financing applications after submission. It covers review scope by tab, sequential gating, section-level and line-item actions (approve, reject, request amendment), how contract and invoice stages advance through offers, and how to interpret application statuses in the admin portal.

## Flow at a Glance

1. The issuer creates an application for a product and may keep it in **draft** until submission.
2. After submission, the application appears in the admin queue for review.
3. Review proceeds by **tab** (section). Some products also require review by **line item** (individual documents or invoices).
4. For each section or item, the reviewer records an outcome: **approve**, **reject**, or **request amendment** as appropriate.
5. When amendments are issued, the application enters **Amendment requested** until the issuer updates only the flagged areas and **resubmits**. A new review cycle begins; the portal may surface a comparison of changes.
6. After prerequisite sections are approved, the reviewer sends **contract** and/or **invoice offers** where the product requires them.
7. The issuer **accepts**, **signs**, or **rejects** each offer in the issuer portal.
8. The application reaches **approved** or **completed** when all required offers are accepted or signed, or it closes on **rejected**, **withdrawn**, or **archived**.

## Review Scope by Tab

Which tabs appear depends on the product. Typically the review covers:

- **Financing structure:** new contract, existing facility, or invoice-only path.
- **Contract or customer:** obligor or paymaster and related commercial fields.
- **Invoices:** attachments, requested amount, tenor, financing ratio, and other product-specific fields.
- **Company and business:** issuer profile, operating context, repayment position, guarantors where captured.
- **Financials:** issuer-supplied figures and bureau or registry data shown in the financial area.
- **People:** directors, shareholders, controllers, with identity and compliance status as displayed.
- **Supporting documents:** each upload as a separate row when the product uses item-level review.
- **Declarations:** issuer confirmations where the workflow includes them.

## Sections and Line Items

- **Section (tab):** a single workflow step, for example company details or contract details.
- **Line item:** one row in a list within a section, for example one invoice or one document.

For **documents** and **invoices**, review is usually **per line item**. Aggregate section status derives from item outcomes. Apply actions to the specific row that requires a decision rather than assuming a single section-level control replaces item review.

## Tab Gating and Order

The admin portal enforces **staged** access. Later tabs remain locked until earlier requirements are satisfied.

- **Financial**, **company**, **business**, and **documents** are generally available first.
- **Contract or customer** review unlocks after those sections are approved, for products that include that step.
- **Invoice** review unlocks after the preceding sections and contract or customer review are approved, when the product sequences invoices after contract.
- Applications linked to an **existing contract** may treat the contract step as already satisfied from the prior facility, without repeating the same contract approval from scratch.
- **Final application approval** remains blocked until every required review section is approved.

If a tab is locked, complete and approve the upstream tabs in the order shown by the workflow.

## Contract and Invoice Tabs: Offers and Completion

For **contract** and **invoice** stages, completion is driven by **offers**, not only by the same pattern as a purely internal **approve** action on static data tabs.

Typical sequence:

1. Validate the data shown on the contract or invoice tab.
2. **Send the contract offer** or **send the invoice offer** (per row where applicable).
3. Await issuer **acceptance** or **signature** (or issuer rejection) in the issuer portal.

For these stages, the commercial step is normally **closed** only after the offer is sent and the issuer has accepted or signed as required. Follow the primary actions shown on the tab (for example **send offer**) rather than assuming a single approve control completes the stage in the same way as company or document review.

## Approve

- **Approve section:** the entire tab satisfies review criteria for the current cycle and counts toward unlocking downstream steps.
- **Approve line item:** the individual document or invoice row satisfies review criteria.

Where the product enforces item-level review, each required row must be approved; section-level approval does not replace missing item decisions.

## Reject

- **Reject section or line item:** that portion of the submission does not pass review. Use for material failure of that unit of work, not for issues that a resubmission or replacement file would reasonably resolve.
- **Reject application:** terminates the application as an active financing case. Reserve for a final negative decision; use **request amendment** when the issuer should correct and continue on the same application record.

## Request Amendment

Use when the issuer must **correct**, **clarify**, or **replace** information while keeping the case open.

**Procedure:**

1. Attach a clear remark to the exact section or line item (what is deficient and what is required).
2. Open **Request amendment**, verify the grouped remarks, and send them to the issuer in one action.

**After send:**

- Application status becomes **Amendment requested**.
- The issuer may edit only flagged sections or items, complete any required acknowledgements, and **resubmit**.

Prefer amendment for recoverable defects; prefer rejection when the application or that segment should not proceed.

## Financial Area, Bureau Data, and People

Use the **financial** (and related) views to compare issuer financials with organization bureau output and to inspect directors, shareholders, and controllers.

- Refresh the **organization** bureau pull when it is missing or stale.
- Run **subject** or party-level pulls when an individual director or corporate party requires a dedicated report.
- Monitor **KYC** and **KYB** status as rendered for each party.
- **Financial** section approval may remain blocked until required **individual KYC** outcomes are approved; follow blocking indicators on screen.
- If directors, shareholders, or controllers **changed** since the prior cycle, refresh data and confirm identity, role, and identifiers before approval.

**Presentation rules:** director rows always appear. Individual shareholders typically appear from the product threshold (commonly **5%** and above). Corporate shareholders appear as corporate parties. Incomplete party onboarding may block progress until the issuer completes the required steps from the issuer profile; after party onboarding is approved, fields are **locked**, and further changes require an amendment path if policy allows.

## Guarantor Screening

The **business and guarantor** area lists guarantors from issuer business details. The reviewer may initiate **AML screening** from the admin view for each guarantor.

- **Individual guarantors:** name, national ID, email, nationality.
- **Company guarantors:** registered name, company registration number, email.

Confirm screening outcome on the guarantor record before relying on guarantor support in the approval decision.

## Preconditions for Sending a Contract Offer

- Customer or **paymaster** details are accurate.
- **Large private company** indicator is correct where the product collects it.
- Offered facility does not exceed the requested facility.
- The offer is not already **accepted** or **signed**.

After issuer acceptance or signature, the contract becomes the reference for linked invoices on the same application.

## Preconditions for Sending an Invoice Offer

- Validate amount, ratio, tenor, profit rate, and risk attributes as shown.
- Offered amount does not exceed requested amount.
- Tenor satisfies **product rules**.
- If the invoice was previously **rejected**, return it to **pending** when the portal allows, before sending a new offer.

Send offers only when prerequisite sections are approved and the target tab is unlocked.

## Admin Stage Sequence (Contract and Invoice Products)

1. **Contract pending:** contract tab is active; the usual next action is to **send contract offer** when data are validated.
2. **Contract sent:** offer delivered to issuer; await issuer response.
3. **Contract accepted:** issuer agreed; proceed to invoice offers where the product requires them.
4. **Invoice pending:** invoice tab active; validate rows and **send invoice offer(s)** as required.
5. **Invoices sent:** required invoice offers are outstanding; await issuer responses.

**Invoice-only** products omit contract stages and move from **invoice pending** to **invoices sent**.

## Status Reference (Admin)

- **Draft:** issuer is still editing; no admin review actions apply.
- **Submitted** or **Under review:** section and item review may proceed.
- **Contract pending** or **Invoice pending:** prerequisite review is sufficiently complete; validate data and typically **send offers** for the active stage.
- **Amendment requested:** issuer must address remarks and resubmit.
- **Resubmitted:** issuer returned the application; perform a full pass against outstanding remarks and current data.
- **Contract sent** or **Invoices sent:** offers are with the issuer pending response (subject to any expiry rules configured for the product).
- **Approved** or **Completed:** required offer outcomes are satisfied.
- **Withdrawn**, **Rejected**, or **Archived:** the application is closed and does not advance further on that record.

## Issuer Portal Labels vs Admin Status

Issuer-facing labels may differ from admin filter values while describing the same stage. For example, the issuer may see **Under review** while admin shows **contract pending**; **Action required** may align with **Amendment requested**; **Offer received** may align with **contract sent** or **invoices sent** when an offer awaits issuer action. Align cases by **workflow stage** (intake review, amendment cycle, offer response, closure), not by identical wording.

## Review Discipline

- Bind each amendment remark to the **specific** section, document, or invoice it concerns.
- Use **amendment** for correctable defects; use **rejection** when the case or unit should stop.
- Refresh bureau and party data when material facts **changed** before approving financials.
- Confirm customer or paymaster data before sending commercial offers.
- Confirm guarantor screening before treating guarantor support as established.
- Use **invoice offers** for invoice-level commercial approval and **contract offers** for facility-level approval.
- Do not send offers until upstream sections are approved and the relevant tab is unlocked.
- After issuer acceptance or signature, verify **accepted terms** in the portal before treating the commercial outcome as final for downstream handoff.
