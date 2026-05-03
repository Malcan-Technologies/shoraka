---
title: Issuer Application Review Guide
description: A concise admin guide to how issuer financing applications move from submission to accepted offers.
category: Application Review
tags:
  - admin
order: 10
updated: 2026-04-28
---

## Purpose

Use this guide when reviewing issuer financing applications in the admin portal. It explains what the issuer submitted, what must be checked before approval, when to request amendments, and when commercial offers can be sent.

For a shorter, **operations-first** walkthrough of approve / reject / amendment behaviour and status meanings (without the detailed checklist), see [Financing Application Review — Operations Guide](./admin-financing-application-review-operations.md).

## Flow at a Glance

1. The issuer selects a product and creates a draft application.
2. The issuer completes the application wizard and submits the application. A RM 50 application fee will be required at submission after payment gateway support is ready.
3. Admin reviews the financial, company, business, document, contract or customer, and invoice sections that are required for the selected product.
4. Admin either approves sections, rejects sections, or adds amendment remarks.
5. If amendments are sent, the issuer edits only the flagged areas and resubmits for the next review cycle.
6. Once prerequisites are approved, admin sends contract or invoice offers where applicable.
7. The issuer accepts, signs, or rejects each offer.
8. The application is complete when all required offers are accepted or signed.

## What Admins Review

- Financing structure: whether the request is for a new contract, an existing contract, or invoice-only financing.
- Contract or paymaster details: the customer or obligor expected to pay the obligation.
- Invoice details: invoice documents, requested financing amount, maturity, and financing ratio.
- Company and business details: issuer profile, operating context, and repayment information.
- Financial statements and CTOS data: uploaded unaudited figures compared with pulled CTOS financials where available.
- Directors, shareholders, and guarantors: ownership, controller, KYC/KYB, and AML status.
- Supporting documents: uploaded evidence reviewed at document-item level.
- Declarations: final confirmations submitted by the issuer.

## Approval Gating

The admin portal unlocks review work in stages:

- Financial, company, business, and documents can be reviewed first.
- Contract or customer review unlocks after financial, company, business, and documents are approved.
- Invoice review unlocks after the earlier sections and contract or customer review are approved.
- Existing-contract applications treat the contract step as already approved from the earlier facility.
- Final application approval is blocked until every required review section is approved.

Documents and invoices are reviewed item by item. The overall Documents and Invoice sections update from those item statuses, so approve or amend the specific document or invoice rather than relying on a broad section action.

## CTOS, KYC, and Director Checks

Use the Financial tab to compare issuer-provided financials with CTOS data and to review directors, shareholders, and controllers.

- Pull the organization CTOS report when the latest report is missing or stale.
- Use subject CTOS reports for individual directors or corporate parties when a party-level report is needed.
- Review KYC/KYB status for directors and shareholders shown from the latest CTOS company data and RegTank onboarding records.
- Financial approval is blocked until required latest individual KYC records are approved.
- If a director, shareholder, or controller changed, pull the latest CTOS/company data and make sure the relevant party appears with the correct role and ID before approving.

Director and shareholder rows are matched by normalized IC or SSM numbers. Directors are always included. Individual shareholders are included when they hold at least 5%. Corporate shareholders are shown as corporate parties. If a party has not completed onboarding, the issuer must provide or update the email and send the RegTank onboarding link from the issuer profile; approved party onboarding is locked.

## Guarantor AML

Business and guarantor review includes guarantors captured from the issuer's business details. Admin can start RegTank Acuris screening for each guarantor:

- Individual guarantors require name, IC number, email, and nationality.
- Company guarantors require business name, SSM number, and email.
- Screening results are stored back on the application guarantor record and reflected in the admin review view.

## Review Outcomes

### Request Amendments

Use an amendment request when the issuer needs to correct, clarify, or replace submitted information. Add remarks at the exact section, document, or invoice that needs work.

Amendments work in two steps:

1. Add the section or item to the pending amendment list with a clear remark.
2. Open Request Amendment, review the grouped remarks, then proceed to send them to the issuer.

Once sent, the application becomes Amendment Requested. The issuer can edit only the flagged areas, acknowledges the requested changes, and resubmits. Resubmission creates a new review cycle and comparison snapshot so admins can see what changed.

### Send Contract Offer

Use a contract offer when the application requires a facility or contract-level approval. Before sending:

- Confirm the customer or paymaster details.
- Confirm whether the customer is a large private company.
- Make sure the offered facility does not exceed the requested facility.
- Make sure the offer has not already been accepted or signed.

Once accepted or signed, the approved terms become the contract reference for related invoices.

### Send Invoice Offer

Use an invoice offer when an individual invoice is ready for approval. Before sending:

- Review invoice value, requested financing ratio, requested amount, maturity, profit rate, and risk rating.
- Make sure the offered amount does not exceed the requested amount.
- Make sure the maturity rules for the selected product are satisfied.
- Reset rejected invoices to pending before sending an offer.

## Status Guide

- Draft: issuer is still preparing the application.
- Submitted or Under Review: admin can begin review actions.
- Contract Pending or Invoice Pending: the relevant offer stage is unlocked.
- Amendment Requested: issuer must address admin remarks and resubmit.
- Resubmitted: issuer has returned the application for another review cycle.
- Contract Sent or Invoices Sent: issuer must accept, sign, or reject the offer.
- Approved or Completed: required offers have been resolved.
- Withdrawn, Rejected, or Archived: the application is no longer progressing.

## Admin Best Practices

- Keep amendment remarks specific and tied to the exact section, document, or invoice that needs attention.
- Use amendments for fixable issues and rejection for issues that should stop the application.
- Pull and review fresh CTOS data before approving financials when director, shareholder, or company information changed.
- Confirm paymaster/customer details before sending commercial offers.
- Check guarantor AML status before relying on guarantor support.
- Use invoice offers for invoice-level approval and contract offers for facility-level approval.
- Do not send offers until upstream sections are approved and the relevant tab is unlocked.
- Do not treat application fees as investor funding or note repayment activity. Issuer onboarding fees are RM 150 before onboarding; issuer application fees are RM 50 at financing application submission after payment gateway support is ready.
- Review accepted terms carefully before any future note creation or financing instrument is prepared.
