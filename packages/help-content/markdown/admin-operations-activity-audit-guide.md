---
title: "Operations Guide: Activity, Audit Logs and Notifications"
description: Simple Operations guide to Activity, audit trails, legal and payment evidence, and notifications in CashSouk.
category: Platform Operations
tags:
  - admin
  - operations
  - audit
  - notifications
order: 29
updated: 2026-08-31
---

This guide is for Operations, customer support, Admin users, and business users.

It explains what happened, where to look, what the customer sees, whether a message was sent, and what you should do.

It is not a developer catalogue. A longer event list lives in Help → **Logs, Activity & Notifications**. Use this page first.

---

## 1. Very simple explanation

**Activity** tells you the important things that happened in a customer journey.

**Audit** tells you who or what caused an action, especially for sign-in, security, products, legal files, and messages.

**Timeline** is the list of those events on an application, facility, organisation, Note, or payment.

**Notifications** tell you what message was sent to the customer in the portal or by email.

**Legal evidence** keeps proof that a person accepted a document.

**Financial evidence** keeps proof of money movement. Look at Gateway Payments, ledgers, and Finance screens — not Activity alone.

**Security log** tells you about sign-in, password changes, and role changes.

**Gateway Payments** tells you what happened to a payment.

**Legal Acceptances** keeps proof that a logged-in person accepted a document.

**External Acceptances** keeps proof that an outside person, such as a guarantor, accepted a document.

---

## 2. The golden rule

One business action can appear in more than one place.

That does **not** always mean the system logged the same thing twice.

Example: an issuer pays a facility fee.

- Customer **Activity** may show **Facility fee paid**
- **Gateway Payments** keeps the actual payment evidence
- **Notifications** may show the message sent to the customer
- Finance / ledger screens keep the money accounting where it applies

Why:

- Activity answers: “What happened in my journey?”
- Gateway answers: “What happened to the money?”
- Notification answers: “What did we tell the customer?”

Use the right screen for the right question.

---

## 3. Where Operations should look

| What I want to check | Where to look | Example |
| --- | --- | --- |
| Customer business journey | Issuer or Investor → **Activity** | Application submitted, offer received, fee paid |
| Application history | Admin → **Applications** → open the application → **Activity Timeline** | Submitted, rejected, offer sent |
| Facility history | Admin → **Facilities** → open the facility → **Activity** | Offer accepted, occupancy updated, signing |
| Onboarding / company history | Admin → **Issuers** or **Investors** → **Activity** | Onboarding started, fee paid, member invited |
| Investment Note history | Admin → **Notes** → open the Note → **Activity** | Published, investment committed, repayment, default |
| Login / security activity | Admin → **Audit** → **Access** or **Security** | Login, logout, password changed, role change |
| Product changes | Admin → **Audit** → **Products** | Product created or updated |
| Legal document history | Admin → **Audit** → **Legal Documents** | Document uploaded, published, archived |
| Logged-in document acceptance | Admin → **Audit** → **Legal Acceptances**, or Admin → Issuers / Investors → **Acceptances** | User accepted terms |
| External guarantor acceptance | Admin → **Audit** → **External Acceptances** | Guarantor accepted via signing |
| Notification sent | Admin → **Audit** → **Notifications** | Inbox or email send record |
| Payment / gateway status | Admin → **Finance** → **Payments** → **Gateway Payments** | Payment completed, failed, refunded |
| Generated document proof | Recorded as legal / generated-document evidence. On some Notes, **Activity** may show **Generated document** when a letter file exists. There is no dedicated Audit tab for this. | Letter of offer or trustee letter proof |
| Provider / internal troubleshooting | Open the timeline row. Admin can see actor, source, portal, and time. Customers do not see this. | Source may say Portal, Webhook, System job, or Internal process |

You also need the right Admin permission. If a tab is missing, you may not have access.

Related Help: **Notifications**, **Gateway Payments**.

---

## 4. Business journey guide

Work by journey, not by technical name.

Use the tables below to find the first place to look. Section 6 explains the most important events in more detail.

### How to read the tables

- **Customer?** means Issuer or Investor **Activity**, unless the row says otherwise.
- **Admin where** uses the real Admin screen names.
- **Notification?** is the usual message type. Admin can turn inbox or email on or off in **Settings → Notifications**, except password-changed alerts which always go both ways.

### 4.1 Account and security

| What happened | Customer? | Admin where | Usual notification |
| --- | --- | --- | --- |
| Login | No | Audit → **Access** | None |
| Logout | No | Audit → **Access** | None |
| Password changed | No Activity row. They may get a message. | Audit → **Security** | Password Changed |
| Role permissions updated | No | Audit → **Security** | None |
| Role added / removed / switched | No | Audit → **Security** | None |
| Invitation revoked | No | Audit → **Security** | None |
| Sign-up | No | Audit → **Access** | None |

### 4.2 Issuer onboarding

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Onboarding started | Yes | Issuers → **Activity** | None |
| Onboarding fee paid | Yes | Issuers → **Activity**, and Gateway Payments | None |
| More information required | Yes | Issuers → **Activity** | None |
| Onboarding submission approved | Yes, as **Onboarding Submission Approved** | Issuers → **Activity** as **Onboarding Approved** | Not the completion email |
| Onboarding fully approved | Yes, as **Onboarding Approved** | Issuers → **Activity** as **Final Approval Completed** | Onboarding Completed |
| Onboarding rejected | Yes | Issuers → **Activity** | Onboarding Rejected |
| Onboarding restarted | Yes, as **Onboarding Restarted** | Issuers → **Activity** | None |
| Director / shareholder still needs to finish | Not always as Activity | Organisation **Activity** / People | Director/Shareholder Action Required |

### 4.3 Investor onboarding

Same pattern as issuer onboarding, on Admin → **Investors** → **Activity**.

Investor director or shareholder action uses **Investor Director/Shareholder Action Required**.

### 4.4 Application

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Application started | Yes, as **Application Started** | Applications → **Activity Timeline** as **Application Created** | None |
| Application submitted | Yes | Applications → **Activity Timeline** | Application Submitted Confirmation |
| Amendment request sent | Yes | Applications → **Activity Timeline** | Application Amendments Requested |
| Application resubmitted | Yes | Applications → **Activity Timeline** | Application Resubmitted Confirmation |
| Application rejected | Yes | Applications → **Activity Timeline** | Application Rejected |
| Application withdrawn | Yes | Applications → **Activity Timeline** | Application Withdrawn Confirmation |
| Application completed | Yes | Applications → **Activity Timeline** | Application Completed |
| Returned to review | No | Applications → **Activity Timeline** | None |

Old rows may still say **Application Approved**. New live flows do not use that as the main completion step. Use current application status plus **Application Completed** / offer / signing events.

### 4.5 Contract / facility

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Facility offer sent | Yes | Applications **Activity Timeline**, Facilities → **Activity**, Facilities → **Facility & Offer** | Facility Offer Sent |
| Facility occupancy updated | Yes | Facilities → **Activity** | None |
| Facility fee waived | No | Applications / Facilities **Activity** | None |
| Facility disabled | No | Applications / Facilities **Activity** | Facility Disabled |
| Facility enabled | No | Applications / Facilities **Activity** | None |

### 4.6 Invoice

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Invoice offer sent | Yes | Applications **Activity Timeline** | Invoice Offer Sent |
| Invoice withdrawn | Yes | Applications **Activity Timeline** | None as a dedicated invoice-withdrawn type |

### 4.7 Offer

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Facility / invoice offer sent | Yes | Applications **Activity Timeline** | Facility or Invoice Offer Sent |
| Acceptance submitted | Yes | Applications **Activity Timeline** | None |
| Acceptance resubmitted | Yes | Applications **Activity Timeline** | None |
| Offer accepted | Yes | Applications **Activity Timeline** | None |
| Offer declined | Yes | Applications **Activity Timeline** | None |
| Offer expired | Yes | Applications **Activity Timeline** | Offer Expired |
| Offer retracted | Yes | Applications **Activity Timeline** | Offer Retracted or Reset |
| Offer expiry reminder | No extra Activity needed | Check offer deadline on the application | Offer Expiry Reminder |

### 4.8 Signing

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Signing package created | No | Applications → **Acceptance** → **Signing package**, and **Activity Timeline** | None |
| Signing package sent | Yes | Same | None as a dedicated “signing sent” type |
| Signing completed | Yes | Same | None |
| Signing declined | Yes | Same | None |
| Signing expired | Yes | Same | None |
| Signing voided | No | Same | None |
| Signing deadline extended | Yes | Same | Facility or Invoice Signing Deadline Extended |
| Signer opened the link | **No Activity event** | Signing package signer status **Viewed** | None |

See [Signing explanation](#7-signing-explanation).

### 4.9 Legal acceptance

These are **not** normal Activity events.

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Logged-in person accepted a legal document | No | Audit → **Legal Acceptances**, or organisation → **Acceptances** | None |
| External person accepted (for example a guarantor) | No | Audit → **External Acceptances** | None |
| Legal document uploaded / published / archived | No | Audit → **Legal Documents**, or Directory → **Legal Documents** | None |

### 4.10 Fees and payments

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Application processing fee paid | Yes | Applications **Activity Timeline** and Gateway Payments | None |
| Facility fee requested | Not the payment proof | Application / facility fee status | Upfront facility fee payment required |
| Facility fee paid | Yes | Applications **Activity Timeline** and Gateway Payments | Upfront facility fee paid |
| Gateway payment completed | No | Gateway Payments | Depends on the purpose (fee, deposit, and so on) |
| Late charges due / paid | Check Note and issuer Activity | Notes **Activity**, Gateway Payments | Outstanding late charges / Late payment charges received |

### 4.11 Investment / Note

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Note created from invoice | Issuer yes | Notes → **Activity** | None |
| Note published | Issuer yes | Notes → **Campaign** and **Activity** | Note published |
| Campaign paused / resumed | Yes | Notes → **Activity** | None |
| Investment committed | Investor yes | Notes → **Activity** | Investment committed |
| Funding closed | Yes | Notes → **Activity** | Note funding succeeded |
| Funding unsuccessful | Yes | Notes → **Activity** | Funding Unsuccessful |
| Note activated | Yes | Notes → **Activity** | Note active |

### 4.12 Funding

Look at Admin → **Notes** → **Campaign** and **Activity**.

Customer Activity shows funding closed or unsuccessful. Do not use Activity as the only money proof.

### 4.13 Disbursement

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Disbursement instruction created | No | Notes → **Disbursement** and **Activity** | None |
| Withdrawal submitted to trustee | No as the main customer milestone | Notes → **Disbursement** and **Activity** | Withdrawal submitted to trustee |
| Disbursement completed | Issuer may see **Your Disbursement Is Complete** | Notes → **Activity** | Disbursement completed |
| Facility occupancy updated | Issuer may see occupancy | Facilities **Activity** and Notes **Activity** | None |

### 4.14 Repayment

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Issuer submitted a repayment | Issuer yes, **You Submitted a Repayment** | Notes → **Activity**, Finance → **Repayments** | None for submit |
| Repayment received | Investor may be notified | Notes → **Activity** as **Repayment received**, Finance → **Repayments**, Gateway Payments | Repayment Received |
| Repayment approved | No | Notes → **Activity** | None |
| Repayment rejected | No | Notes → **Activity** | Repayment rejected |

### 4.15 Late / arrears / default

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Note in arrears | Check issuer / investor Activity | Notes → **Late Payment** and **Activity** | Note in arrears |
| Note defaulted | Yes | Notes → **Activity** as **Note Defaulted** | Note defaulted |
| Late charges | See fees table | Notes **Activity** and Gateway Payments | Late charge types above |

### 4.16 Settlement

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Settlement posted | Investor yes | Notes → **Servicing** / **Activity**, Finance → **Settlements** | Note settlement posted |
| Settlement approved | No | Notes → **Activity** | None |
| Trustee letter / email | No | Notes → **Activity** (letter rows). Some rows show **Generated document** | None |

Old records may still show a settlement preview row. New live work should not treat that as a current action.

### 4.17 Withdrawal / refund

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Issuer disbursement completed | Issuer may see disbursement complete | Notes → **Activity**, Finance → **Issuer Payouts** | Disbursement completed |
| Investor withdrawal submitted | Check investor Activity | Finance → **Investor Withdrawals** | Withdrawal submitted |
| Investor withdrawal completed | Check investor Activity | Finance → **Investor Withdrawals** | Withdrawal completed |
| Deposit successful | Not a Note Activity event | Gateway Payments | Deposit successful |
| Deposit verification failed | No | Gateway Payments | Deposit verification failed |
| Deposit refund started / completed | No | Gateway Payments | Deposit refund started / completed |

### 4.18 Admin review

Admin review ticks (section or item approved, pending, rejected, or amendment requested) appear on Admin → **Applications** → **Activity Timeline**.

Customers do **not** see those review ticks as Activity. They see the later journey event, such as amendment requested or application rejected.

### 4.19 Product administration

| What happened | Customer Activity | Admin where | Usual notification |
| --- | --- | --- | --- |
| Product created / updated / deleted | No | Audit → **Products**, Settings → **Products** | New Product Alert only if Operations sends that investor alert |
| Platform finance settings updated | No | Audit → **Security** | None |

---

## 5. Event table format

For important events, this guide uses:

- **What happened** — plain name first
- **Technical event** — the stored name, for matching screens and exports
- **What it means**
- **Trigger**
- **Customer can see?**
- **Admin can see?**
- **Where Admin sees it**
- **Notification?**
- **Normal Ops action**
- **Investigate when**

---

## 6. Important events in detail

### Application created

**Technical event:** `APPLICATION_CREATED`

**What it means:** The issuer started a financing application.

**Trigger:** Issuer creates a new application.

**Customer can see:** Yes, on **Activity** as **Application Started**.

**Admin can see:** Yes. Admin → **Applications** → open the application → **Activity Timeline** as **Application Created**.

**Notification:** None.

**Normal Ops action:** None until the issuer submits.

**Investigate when:** The application exists, but Activity has no started/created row. The application record itself is still the proof that it was created. Timeline repair may fill a missing created row later.

### Application submitted

**Technical event:** `APPLICATION_SUBMITTED`

**What it means:** The issuer sent the application to CashSouk.

**Trigger:** Issuer clicks Submit.

**Customer can see:** Yes, on **Activity** as **Application Submitted**.

**Admin can see:** Yes, in the application **Activity Timeline**.

**Notification:** **Application Submitted Confirmation**. Default is inbox on, email off, unless you change **Settings → Notifications**.

**Normal Ops action:** Continue normal application review.

**Investigate when:** Application status says Submitted but the timeline is missing this row.

### Application resubmitted

**Technical event:** `APPLICATION_RESUBMITTED`

**What it means:** The issuer sent the application back after making requested changes.

**Trigger:** Issuer resubmits after an amendment request.

**Customer can see:** Yes, **Application Resubmitted**.

**Admin can see:** Yes, application **Activity Timeline**.

**Notification:** **Application Resubmitted Confirmation**.

**Normal Ops action:** Review the updated sections.

**Investigate when:** Status is resubmitted but there is no resubmitted row, or the issuer says they resubmitted and status is still waiting for amendments.

### Application rejected

**Technical event:** `APPLICATION_REJECTED`

**What it means:** CashSouk rejected the application. It will not continue.

**Trigger:** Admin rejects the application.

**Customer can see:** Yes, **Application Rejected**.

**Admin can see:** Yes, application **Activity Timeline**.

**Notification:** **Application Rejected**.

**Normal Ops action:** Confirm the reason is recorded. No further financing action on this application.

**Investigate when:** Customer says they were rejected but Activity, status, and notification do not agree.

### Application withdrawn

**Technical event:** `APPLICATION_WITHDRAWN`

**What it means:** The application was withdrawn and is no longer active.

**Trigger:** Issuer withdraws, or the flow withdraws it.

**Customer can see:** Yes, **Application Withdrawn**.

**Admin can see:** Yes, application **Activity Timeline**.

**Notification:** **Application Withdrawn Confirmation**.

**Normal Ops action:** Confirm nothing is still waiting in review.

**Investigate when:** Status is withdrawn but Activity or notification is missing.

### Application processing fee paid

**Technical event:** `APPLICATION_PROCESSING_FEE_PAID`

**What it means:** The application processing fee was paid.

**Trigger:** Successful fee payment.

**Customer can see:** Yes, **Application Processing Fee Paid**.

**Admin can see:** Yes, application **Activity Timeline**. Also check **Gateway Payments**.

**Notification:** None for this milestone.

**Normal Ops action:** Confirm Gateway Payments shows a successful payment before treating money as received.

**Investigate when:** Activity says paid but Gateway Payments does not, or the other way around.

### Facility fee paid

**Technical event:** `FACILITY_FEE_PAID`

**What it means:** A facility fee payment was received.

**Trigger:** Successful facility fee payment.

**Customer can see:** Yes, **Facility fee paid**.

**Admin can see:** Yes, application / facility **Activity**. Also **Gateway Payments**.

**Notification:** **Upfront facility fee paid**.

**Normal Ops action:** Continue the facility / invoice flow. Use Gateway / Finance for money proof.

**Investigate when:** Customer says “I paid” but Gateway Payments is not completed.

### Facility offer sent

**Technical event:** `CONTRACT_OFFER_SENT`

**What it means:** CashSouk sent a facility offer to the issuer.

**Trigger:** Admin sends the facility offer.

**Customer can see:** Yes, **You Received a Facility Offer**.

**Admin can see:** Yes, **Facility Offer Sent** on the application **Activity Timeline**, and Facilities → **Facility & Offer**.

**Notification:** **Facility Offer Sent**.

**Normal Ops action:** Wait for issuer acceptance, or follow the review checklist.

**Investigate when:** Admin believes the offer was sent but Activity and the offer status disagree.

### Facility offer accepted

**Technical event:** `CONTRACT_OFFER_ACCEPTED`

**What it means:** The facility offer was accepted.

**Trigger:** Offer acceptance completes.

**Customer can see:** Yes, **Facility Offer Accepted**.

**Admin can see:** Yes, **Facility Offer Accepted**.

**Notification:** None for this exact event.

**Normal Ops action:** Continue acceptance documents / signing as required.

**Investigate when:** Status says accepted but the timeline has no accepted row.

### Facility offer declined

**Technical event:** `CONTRACT_OFFER_DECLINED`

**What it means:** The issuer declined the facility offer. The application is closed.

**Trigger:** Issuer declines the offer.

**Customer can see:** Yes, **Facility Offer Declined**.

**Admin can see:** Yes, **Facility Offer Declined**.

**Notification:** None for this exact event.

**Normal Ops action:** Treat the offer as closed. Do not confuse this with a voided signing package.

**Investigate when:** You see an old **Facility Offer Withdrawn** row. That is an old name for a historical event, not the current decline event.

### Facility offer expired

**Technical event:** `CONTRACT_OFFER_EXPIRED`

**What it means:** The time to accept the facility offer ran out.

**Trigger:** The offer deadline passed.

**Customer can see:** Yes, **Facility Offer Expired**.

**Admin can see:** Yes.

**Notification:** **Offer Expired**.

**Normal Ops action:** Confirm whether a new offer is needed.

**Investigate when:** Status is expired but Activity is missing, or the customer still sees an open offer.

### Invoice offer sent

**Technical event:** `INVOICE_OFFER_SENT`

**What it means:** CashSouk sent an invoice offer.

**Trigger:** Admin sends the invoice offer.

**Customer can see:** Yes, **You Received an Invoice Offer**.

**Admin can see:** Yes. The label may include the invoice number, such as **Invoice 123 Offer Sent**.

**Notification:** **Invoice Offer Sent**.

**Normal Ops action:** Wait for issuer response.

**Investigate when:** Offer status and Activity do not match.

### Invoice offer accepted

**Technical event:** `INVOICE_OFFER_ACCEPTED`

**What it means:** The invoice offer was accepted.

**Trigger:** Invoice offer acceptance completes.

**Customer can see:** Yes, **Invoice Offer Accepted**.

**Admin can see:** Yes. Label may include the invoice number.

**Notification:** None for this exact event.

**Normal Ops action:** Continue signing / note creation as required.

**Investigate when:** Invoice is accepted but the timeline is missing.

### Invoice offer declined

**Technical event:** `INVOICE_OFFER_REJECTED`

**What it means:** The issuer declined the invoice offer.

**Trigger:** Issuer rejects the invoice offer.

**Customer can see:** Yes, **Invoice Offer Declined**.

**Admin can see:** Yes, **Invoice Offer Declined**.

**Notification:** None for this exact event.

**Normal Ops action:** Treat the offer as closed.

**Investigate when:** Status and Activity disagree.

### Invoice offer expired

**Technical event:** `INVOICE_OFFER_EXPIRED`

**What it means:** The invoice offer deadline passed.

**Trigger:** The offer deadline passed.

**Customer can see:** Yes, **Invoice Offer Expired**.

**Admin can see:** Yes.

**Notification:** **Offer Expired**.

**Normal Ops action:** Confirm whether a new offer is needed.

**Investigate when:** Deadline passed but Activity still looks open.

### Signing package sent

**Technical event:** `SIGNING_PACKAGE_SENT`

**What it means:** The signing package was sent to signers.

**Trigger:** Admin sends the signing package, or the send step completes.

**Customer can see:** Yes, **Signing package sent**.

**Admin can see:** Yes. Admin → Applications → **Acceptance** → **Signing package**, and **Activity Timeline**.

**Notification:** None as a dedicated signing-sent type. Signers also get the signing link separately. That link is not the Audit → Notifications list for this event.

**Normal Ops action:** Wait for signing, or send reminders from the signing package.

**Investigate when:** Package status is sent but Activity has no sent row.

### Signing package completed

**Technical event:** `SIGNING_PACKAGE_COMPLETED`

**What it means:** Signing finished.

**Trigger:** All required signers signed.

**Customer can see:** Yes, **Signing package completed**.

**Admin can see:** Yes, **Signing Package Completed**.

**Notification:** None for this exact event.

**Normal Ops action:** Continue the next financing step.

**Investigate when:** Customer says they signed but the package is not completed. Check the signing package, not Activity alone.

### Signing package declined

**Technical event:** `SIGNING_PACKAGE_DECLINED`

**What it means:** A signer said no.

**Trigger:** A signer declines.

**Customer can see:** Yes, **Signing package declined**.

**Admin can see:** Yes.

**Notification:** None for this exact event.

**Normal Ops action:** Treat this as a customer/signer decision. It is not the same as CashSouk voiding the package.

**Investigate when:** Someone says the package was “cancelled” but the row says declined, or the other way around.

### Signing package expired

**Technical event:** `SIGNING_PACKAGE_EXPIRED`

**What it means:** Signing time ran out.

**Trigger:** The signing deadline passed.

**Customer can see:** Yes, **Signing package expired**.

**Admin can see:** Yes.

**Notification:** None for this exact event. If Ops later extends a deadline, that is a different event.

**Normal Ops action:** Decide whether to send a new package or extend a live deadline before expiry.

**Investigate when:** Package shows expired but Activity is missing, or a signer still thinks they can sign.

### Signing package voided

**Technical event:** `SIGNING_PACKAGE_VOIDED`

**What it means:** The package was cancelled / voided by Operations.

**Trigger:** Admin voids the signing package.

**Customer can see:** No Activity row.

**Admin can see:** Yes, **Signing package voided**, and the **Signing package** card.

**Notification:** None.

**Normal Ops action:** Record why it was voided. Send a new package if needed.

**Investigate when:** Customer thinks they declined, but Admin voided it — or Activity is empty because customers do not see voided.

### Onboarding started

**Technical event:** `ONBOARDING_STARTED`

**What it means:** The organisation started onboarding.

**Trigger:** Onboarding begins.

**Customer can see:** Yes, **Onboarding Started**.

**Admin can see:** Yes. Issuers or Investors → **Activity**.

**Notification:** None.

**Normal Ops action:** None until review is needed.

**Investigate when:** Organisation exists in onboarding but there is no started row.

### Onboarding fee paid

**Technical event:** `ONBOARDING_FEE_PAID`

**What it means:** The issuer registration / onboarding fee was paid.

**Trigger:** Successful onboarding fee payment.

**Customer can see:** Yes, **Onboarding Fee Paid**.

**Admin can see:** Yes, organisation **Activity**. Also **Gateway Payments**.

**Notification:** None.

**Normal Ops action:** Confirm Gateway Payments before treating money as received.

**Investigate when:** Activity says paid but Gateway Payments does not.

### Onboarding amendment required

**Technical event:** `ONBOARDING_AMENDMENT_REQUIRED`

**What it means:** The organisation must provide more onboarding information.

**Trigger:** Admin or the onboarding check asks for more information.

**Customer can see:** Yes, **Additional onboarding information is required**.

**Admin can see:** Yes, **Additional Information Required**.

**Notification:** None for this exact event. A director/shareholder action message may be sent separately if a person still needs to finish.

**Normal Ops action:** Wait for the organisation to update, then continue review.

**Investigate when:** Customer says they were not told, but organisation Activity shows this row.

### Onboarding approved (two different rows)

There are two different “approved” rows. Do not mix them up.

**Onboarding submission approved**

**Technical event:** `ONBOARDING_APPROVED`

**What it means:** The onboarding submission was approved. Onboarding may not be fully finished yet.

**Trigger:** The onboarding submission is approved.

**Customer can see:** Yes, **Onboarding Submission Approved**.

**Admin can see:** Yes, **Onboarding Approved**.

**Notification:** Not the completion message.

**Onboarding fully complete**

**Technical event:** `FINAL_APPROVAL_COMPLETED`

**What it means:** Organisation onboarding is fully approved. No further onboarding action is needed.

**Trigger:** Admin completes final approval.

**Customer can see:** Yes, **Onboarding Approved**.

**Admin can see:** Yes, **Final Approval Completed**.

**Notification:** **Onboarding Completed**.

This notification type used to be called `onboarding_approved`. If someone mentions the old name, they mean the same completion message, now called **Onboarding Completed**.

**Normal Ops action:** After final approval, the organisation can use the portal.

**Investigate when:** Customer says they are approved, but you only see submission approved and not **Final Approval Completed**.

### Onboarding rejected

**Technical event:** `ONBOARDING_REJECTED` (and sometimes `COD_REJECTED`)

**What it means:** Organisation onboarding was not approved.

**Trigger:** Admin or the onboarding check rejects it.

**Customer can see:** Yes, **Onboarding Rejected**.

**Admin can see:** Yes. Both technical events can show as **Onboarding Rejected**.

**Notification:** **Onboarding Rejected**.

**Normal Ops action:** Confirm the reason. Do not expect the organisation to continue as approved.

**Investigate when:** Status, Activity, and notification do not agree.

### Onboarding cancelled / restarted

**Technical event:** `ONBOARDING_CANCELLED`

**What it means:** The previous onboarding request was cancelled and a new request was started.

**Trigger:** Admin restarts onboarding.

**Customer can see:** Yes, as **Onboarding Restarted**.

**Admin can see:** Yes, **Onboarding Restarted**.

**Notification:** None.

**Normal Ops action:** Tell the customer they must continue the new onboarding, not the old one.

**Investigate when:** Someone reads “cancelled” as a permanent rejection. The customer-facing meaning is restart.

### Member added

**Technical event:** `MEMBER_ADDED`

**What it means:** A person was added to the organisation.

**Trigger:** A member is added.

**Customer can see:** No.

**Admin can see:** Yes. Issuers or Investors → **Activity** as **Member Added**. Also check **People**.

**Notification:** None for this exact event.

**Normal Ops action:** Confirm the person has the right role.

**Investigate when:** The People list and Activity disagree.

### Member invited

**Technical event:** `MEMBER_INVITED`

**What it means:** A person was invited to the organisation.

**Trigger:** An invitation is sent.

**Customer can see:** No.

**Admin can see:** Yes, **Member Invited**.

**Notification:** Invitation email is separate from Audit → Notifications for this event. Director/shareholder action notifications may also be sent.

**Normal Ops action:** If they did not join, check the invitation and People tab.

**Investigate when:** Customer says nobody was invited, but Activity shows invited.

### Member removed

**Technical event:** `MEMBER_REMOVED`

**What it means:** A person was removed from the organisation.

**Trigger:** A member is removed.

**Customer can see:** No.

**Admin can see:** Yes, **Member Removed**.

**Notification:** None for this exact event.

**Normal Ops action:** Confirm they no longer have portal access they should not have.

**Investigate when:** They can still sign in with an unexpected role. Then also check Audit → **Security**.

### Member role changed

**Technical event:** `MEMBER_ROLE_CHANGED`

**What it means:** A person’s organisation role changed.

**Trigger:** Role change on the organisation.

**Customer can see:** No.

**Admin can see:** Yes, **Member Role Changed**.

**Notification:** None for this exact event.

**Normal Ops action:** Confirm the new role is intended.

**Investigate when:** Access does not match the new role. Also check Audit → **Security**.

### Investment committed

**Technical event:** `INVESTMENT_COMMITTED`

**What it means:** An investor committed funds to the Note.

**Trigger:** Investor completes the investment commitment.

**Customer can see:** Investor **Activity** as **Investment Committed**. Issuer does not use this as their row.

**Admin can see:** Yes, Notes → **Activity** as **Investment committed**.

**Notification:** **Investment committed** (investor). Default is inbox on, email off, unless you change settings.

**Normal Ops action:** Confirm the Note campaign and Gateway / wallet evidence if money is in question.

**Investigate when:** Investor says they invested but Note Activity has no committed row, or Gateway / wallet does not match.

### Issuer payment submitted

**Technical event:** `ISSUER_PAYMENT_SUBMITTED`

**What it means:** The issuer submitted a repayment.

**Trigger:** Issuer submits repayment.

**Customer can see:** Issuer **Activity** as **You Submitted a Repayment**.

**Admin can see:** Yes, Notes → **Activity** as **Repayment Submitted**. Also Finance → **Repayments**.

**Notification:** None for submit. Investors are notified later if repayment is received.

**Normal Ops action:** Review the repayment. Approve or reject as required.

**Investigate when:** Issuer says they paid / submitted but Notes **Activity** and Repayments do not show it. Then also check Gateway Payments.

### Payment approved

**Technical event:** `PAYMENT_APPROVED`

**What it means:** Operations approved the issuer repayment.

**Trigger:** Admin approves the repayment.

**Customer can see:** No.

**Admin can see:** Yes, Notes → **Activity** as **Repayment approved**.

**Notification:** None for this exact event. Investors may get **Repayment Received** when the repayment is recorded as received.

**Normal Ops action:** Continue servicing.

**Investigate when:** Repayment status is approved but Note Activity has no approved row.

### Payment rejected

**Technical event:** `PAYMENT_REJECTED`

**What it means:** Operations rejected the issuer repayment.

**Trigger:** Admin rejects the repayment.

**Customer can see:** No Activity row.

**Admin can see:** Yes, **Repayment Rejected**.

**Notification:** **Repayment rejected** (issuer). Default is inbox on, email off, unless you change settings.

**Normal Ops action:** Tell the issuer why, using the repayment record. Ask them to submit again if needed.

**Investigate when:** Issuer says they were not told, but Audit → **Notifications** shows the rejected message — or the reverse.

### Note default marked

**Technical event:** `NOTE_DEFAULT_MARKED`

**What it means:** The Note was marked in default.

**Trigger:** Admin / servicing marks default.

**Customer can see:** Yes. Issuer: **Your Note Is in Default**. Investor: **Your Investment Is in Default**.

**Admin can see:** Yes, **Note Defaulted**. Also Notes → **Late Payment**.

**Notification:** **Note defaulted (issuer)** and **Note defaulted** (investor).

**Normal Ops action:** Follow default servicing. Do not use Activity as legal proof of notices. Check generated letters where they exist.

**Investigate when:** Status is defaulted but Activity or notifications are missing.

### Settlement posted

**Technical event:** `SETTLEMENT_POSTED`

**What it means:** Settlement was posted for the Note.

**Trigger:** Settlement is posted.

**Customer can see:** Investor **Activity** as **Settlement Posted**.

**Admin can see:** Yes, Notes → **Activity** as **Settlement posted**. Also Finance → **Settlements**.

**Notification:** **Note settlement posted** (investor).

**Normal Ops action:** Confirm Finance / settlement records, not Activity alone.

**Investigate when:** Customer asks where the money went. Use Finance and Gateway, then Activity.

### Withdrawal completed

**Technical event:** `WITHDRAWAL_COMPLETED`

**What it means:** A Note withdrawal / disbursement (or residual return) completed.

**Trigger:** The withdrawal instruction completes.

**Customer can see:** Issuer may see **Your Disbursement Is Complete**.

**Admin can see:** Yes, **Withdrawal Completed**, or **Residual Return Completed** when it is a residual return.

**Notification:** **Disbursement completed** for issuer disbursement. Investor wallet withdrawals use **Withdrawal completed**.

**Normal Ops action:** Confirm Finance → **Issuer Payouts** or **Investor Withdrawals**, plus Gateway / trustee records.

**Investigate when:** Activity says complete but Finance still shows pending.

### Gateway payment completed

**Technical event:** `GATEWAY_PAYMENT_COMPLETED`

**What it means:** The payment gateway recorded a completed payment.

**Trigger:** The payment succeeds.

**Customer can see:** No as this technical name. They may see a related Activity milestone such as fee paid.

**Admin can see:** Yes. Admin → **Finance** → **Payments** → **Gateway Payments**. Open the payment. The payment page also has an **Activity Timeline**.

**Notification:** Depends on purpose (facility fee, deposit, and so on).

**Normal Ops action:** Use this as money-in evidence.

**Investigate when:** Customer says they paid. Always open Gateway Payments. Do not stop at Activity.

### Login

**Technical event:** `LOGIN`

**What it means:** Someone signed in.

**Trigger:** Successful sign-in.

**Customer can see:** No.

**Admin can see:** Yes. Audit → **Access**.

**Notification:** None.

**Normal Ops action:** None unless the customer reports a strange sign-in.

**Investigate when:** Unexpected logins. Check time, actor, and portal on the Access row.

### Logout

**Technical event:** `LOGOUT`

**What it means:** Someone signed out.

**Trigger:** Sign-out.

**Customer can see:** No.

**Admin can see:** Yes. Audit → **Access**.

**Notification:** None.

**Normal Ops action:** None.

**Investigate when:** Combined with unexpected logins.

### Password changed

**Technical event:** `PASSWORD_CHANGED`

**What it means:** The account password was changed.

**Trigger:** Password change.

**Customer can see:** No Activity row. They should get a message.

**Admin can see:** Yes. Audit → **Security**.

**Notification:** **Password Changed**. Always inbox and email. This cannot be turned off.

**Normal Ops action:** If the customer did not change it, treat as a security issue.

**Investigate when:** Customer says they did not change the password. Check Security log time and notification delivery.

### Role permissions updated

**Technical event:** `ROLE_PERMISSIONS_UPDATED`

**What it means:** An Admin role’s permissions changed.

**Trigger:** Admin updates a role in **Settings → Roles**.

**Customer can see:** No.

**Admin can see:** Yes. Audit → **Security**.

**Notification:** None.

**Normal Ops action:** Confirm the change was intended.

**Investigate when:** Someone lost or gained Admin screens unexpectedly.

### Legal document acceptance

**Technical event:** `LEGAL_DOCUMENT_ACCEPTANCE`

**What it means:** A logged-in person accepted a legal document.

**Trigger:** The person accepts the document in the portal.

**Customer can see:** No as an Activity event.

**Admin can see:** Yes. Audit → **Legal Acceptances**, or Issuers / Investors → **Acceptances**. Open the row for document version, time, and opened/accepted details.

**Notification:** None.

**Normal Ops action:** For a dispute, use this evidence, not Activity.

**Investigate when:** Customer says they never accepted the document.

### External legal acceptance

**Technical event:** `LEGAL_EXTERNAL_ACCEPTANCE`

**What it means:** An external person, such as a guarantor, accepted a document through the signing flow.

**Trigger:** External signer accepts in the signing flow.

**Customer can see:** No as an Activity event.

**Admin can see:** Yes. Audit → **External Acceptances**.

**Notification:** None.

**Normal Ops action:** Use this for guarantor / external acceptance disputes.

**Investigate when:** Customer says the guarantor never accepted.

### Generated document evidence

**Technical event:** `GENERATED_DOCUMENT_EVIDENCE`

**What it means:** CashSouk kept proof of a generated document (template / output proof).

**Trigger:** A document is generated, such as a letter.

**Customer can see:** No as an Activity event.

**Admin can see:** Not on a dedicated Audit tab. On some Notes, **Activity** may show a **Generated document** block when a letter file exists. Hash proof is stored as legal/generated-document evidence.

**Notification:** None.

**Normal Ops action:** For a dispute about a generated letter, use the letter record and this evidence. Do not rely on Activity wording alone.

**Investigate when:** A letter should exist but Notes **Activity** has no generated document block. That does not always mean the evidence row is missing.

---

## 7. Signing explanation

This is important.

**Sent** = the signing package was sent.

**Completed** = signing finished.

**Declined** = a signer or customer said no.

**Expired** = signing time ran out.

**Voided** = Operations cancelled / voided the package.

**Declined is not the same as voided.**

- Declined is a signer decision.
- Voided is an Operations cancel.

Where to look:

- Admin → **Applications** → open the application → **Acceptance** → **Signing package**
- Admin → **Applications** → **Activity Timeline**
- Admin → **Facilities** → **Activity** for related facility events
- Issuer → **Activity** for sent, completed, declined, and expired

Customers do **not** see voided on Activity.

### Signer viewed / opened the signing link

This is stored on the signing recipient as viewed time.

On the **Signing package**, the signer row shows status **Viewed**.

This is evidence on the signing record.

It is **not** a separate Activity event.

If a customer says “I never opened the signing link”, look at the signing package signer status. Do not look for an Activity row named “viewed”.

---

## 8. Payment explanation

Activity, Gateway Payments, Finance, and Notifications answer different questions.

Example: processing fee paid.

- **Activity** shows the user milestone: **Application Processing Fee Paid**
- **Gateway Payments** shows payment processing evidence
- **Ledger / Finance** shows money accounting where it applies
- **Notification** is the message to the customer, if one is configured

**Never use Activity alone to prove exact money movement.**

Use Gateway Payments and Finance records.

If those disagree with Activity, trust the payment / Finance evidence and then investigate why Activity is missing or extra.

---

## 9. Legal evidence

**Legal document acceptance** = a logged-in party accepted a document.

**External acceptance** = an external person, such as a guarantor, accepted a document through signing.

**Generated document evidence** = proof of a generated document / template / output.

These are **not** normal Activity events.

For a legal dispute, Operations should use Legal evidence, not only the Activity timeline.

Also check Directory → **Legal Documents** if you need the current published file, and Audit → **Legal Documents** if you need the history of document changes.

---

## 10. Forensic / technical details

Some Admin records contain:

- **Actor** — who did it
- **Source** — how it was recorded
- **Portal** — Admin, issuer, or investor
- **Time**
- **Reference IDs** — application, facility, Note, and similar

On Admin screens, source is shown in plain labels:

| What you may see | Simple meaning |
| --- | --- |
| Portal | A person used CashSouk |
| Webhook | An outside payment or onboarding provider sent CashSouk an update |
| System job | A scheduled CashSouk job did it |
| Internal process | CashSouk created or repaired the record internally |

Customers should not normally see these details.

Do not read a system job or internal repair as “the customer clicked this”.

If a created/submitted application row was repaired later, the actor may be empty and the source may say Internal process. That still does not invent a submitter.

---

## 11. Notifications

Activity and Notifications are separate.

A user can have:

- Activity only
- Notification only
- both

A notification in the log means CashSouk **tried** to send a portal and/or email message. It is not proof that the person opened the email.

Where to verify:

- Admin → **Audit** → **Notifications**
- Turn types on or off in Admin → **Settings** → **Notifications**
- Customers open the bell, or **Notifications**

**Password Changed** always uses inbox and email.

The **Inbox?** and **Email?** columns below are the **defaults**. Admin can change most of them.

Types marked **(new)** were added in the logging revamp.

`onboarding_completed` replaced the old type id `onboarding_approved`. The Admin name is **Onboarding Completed**.

### Notification catalogue (49 types)

| Plain name | Type id | Recipient | Trigger | Inbox? | Email? | Related Activity event | Where Admin can verify | Ops action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Password Changed | `password_changed` | Issuer and investor | Password is changed | Yes (always) | Yes (always) | `PASSWORD_CHANGED` | Audit → Notifications; Audit → Security | If unexpected, treat as security |
| Onboarding Completed | `onboarding_completed` | Issuer and investor | Final onboarding approval | Yes | Yes | `FINAL_APPROVAL_COMPLETED` | Audit → Notifications; organisation Activity | Confirm they can use the portal |
| Onboarding Rejected | `onboarding_rejected` | Issuer and investor | Onboarding rejected | Yes | Yes | `ONBOARDING_REJECTED` | Audit → Notifications; organisation Activity | Confirm the organisation is not treated as approved |
| System Announcement | `system_announcement` | Chosen audience | Admin sends a custom announcement | Yes | Yes | None | Audit → Notifications (Admin row) | Check the custom send, not Activity |
| New Product Alert | `new_product_alert` | Investor | Product announcement / alert | Yes | Yes | None | Audit → Notifications | Do not treat as a product audit row |
| Application Amendments Requested | `application_amendments_requested` | Issuer | Admin requests application changes | Yes | Yes | `AMENDMENTS_SUBMITTED` | Application Activity Timeline | Wait for resubmit |
| Acceptance Documents Need Updates | `acceptance_document_changes_requested` | Issuer | Admin requests acceptance-document changes | Yes | Yes | Application review Activity | Application → Acceptance | Wait for updated documents |
| Application Rejected | `application_rejected` | Issuer | Application rejected | Yes | Yes | `APPLICATION_REJECTED` | Application Activity Timeline | Close the application |
| Facility Offer Sent | `contract_offer_sent` | Issuer | Facility offer sent | Yes | Yes | `CONTRACT_OFFER_SENT` | Application / facility Activity | Wait for response |
| Invoice Offer Sent | `invoice_offer_sent` | Issuer | Invoice offer sent | Yes | Yes | `INVOICE_OFFER_SENT` | Application Activity Timeline | Wait for response |
| Offer Retracted or Reset | `offer_retracted_or_reset` | Issuer | Offer pulled back | Yes | Yes | `CONTRACT_OFFER_RETRACTED` or `INVOICE_OFFER_RETRACTED` | Application Activity Timeline | Confirm the offer is no longer live |
| Offer Expired | `offer_expired` | Issuer | Offer deadline passed | Yes | Yes | `CONTRACT_OFFER_EXPIRED` or `INVOICE_OFFER_EXPIRED` | Application Activity Timeline | Decide whether to send a new offer |
| Offer Expiry Reminder | `offer_expiry_reminder_24h` | Issuer | Offer will expire soon | Yes | Yes | None required | Audit → Notifications; offer deadline | Reminder only. Not proof of expiry |
| Application Resubmitted Confirmation | `application_resubmitted_confirmation` | Issuer | Application resubmitted | Yes | Yes | `APPLICATION_RESUBMITTED` | Application Activity Timeline | Review updates |
| Application Withdrawn Confirmation | `application_withdrawn_confirmation` | Issuer | Application withdrawn | Yes | Yes | `APPLICATION_WITHDRAWN` | Application Activity Timeline | Confirm it is closed |
| Application Completed | `application_completed` | Issuer | Application completed | Yes | Yes | `APPLICATION_COMPLETED` | Application Activity Timeline | None |
| Application Submitted Confirmation **(new)** | `application_submitted_confirmation` | Issuer | Application submitted | Yes | No | `APPLICATION_SUBMITTED` | Application Activity Timeline | Continue review |
| Facility Signing Deadline Extended **(new)** | `contract_signing_deadline_extended` | Issuer | Facility signing deadline extended | Yes | Yes | `CONTRACT_SIGNING_DEADLINE_EXTENDED` | Signing package; Activity Timeline | Confirm the new deadline |
| Invoice Signing Deadline Extended **(new)** | `invoice_signing_deadline_extended` | Issuer | Invoice signing deadline extended | Yes | Yes | `INVOICE_SIGNING_DEADLINE_EXTENDED` | Signing package; Activity Timeline | Confirm the new deadline |
| Facility Disabled **(new)** | `facility_disabled` | Issuer | Facility disabled | Yes | Yes | `CONTRACT_FACILITY_DISABLED` | Facilities Activity | Confirm the facility should stay disabled |
| Director/Shareholder Action Required | `director_shareholder_action_required` | Issuer | A director or shareholder still needs to finish | Yes | Yes | May sit with member / onboarding Activity | Organisation Activity / People | Follow up with the person |
| Investor Director/Shareholder Action Required | `investor_director_shareholder_action_required` | Investor | A director or shareholder still needs to finish | Yes | Yes | May sit with member / onboarding Activity | Organisation Activity / People | Follow up with the person |
| Note published | `note_published` | Issuer | Note published | Yes | Yes | `PUBLISH` | Notes → Campaign / Activity | None |
| Note funding succeeded | `note_funding_succeeded` | Issuer | Funding closed successfully | Yes | Yes | `CLOSE_FUNDING` | Notes Activity | Confirm with Finance if money is in question |
| Funding Unsuccessful | `note_funding_failed_issuer` | Issuer | Note did not fund | Yes | Yes | `FAIL_FUNDING` | Notes Activity | Explain funding failed |
| Funding Unsuccessful | `note_funding_failed_investor` | Investor | Note they reserved did not fund | Yes | Yes | `FAIL_FUNDING` | Notes Activity | Explain funding failed |
| Note active | `note_active_issuer` | Issuer | Note became active | Yes | Yes | `ACTIVATE` | Notes Activity | None |
| Note active | `note_active_investor` | Investor | Their investment became active | Yes | Yes | `ACTIVATE` | Notes Activity | None |
| Note repaid | `note_repaid_issuer` | Issuer | Note fully repaid | Yes | Yes | Check Note status and Activity | Notes Activity; Finance | Confirm with Finance |
| Repayment Received | `note_payment_received` | Investor | A repayment was received | Yes | Yes | Notes Activity **Repayment received** | Notes Activity; Repayments; Gateway Payments | Use Finance for money proof |
| Note settlement posted | `note_settlement_posted` | Investor | Settlement posted | Yes | Yes | `SETTLEMENT_POSTED` | Notes Activity; Settlements | Use Finance for money proof |
| Note in arrears | `note_arrears` | Issuer | Note entered arrears | Yes | Yes | Check Late Payment / Activity | Notes → Late Payment | Follow arrears process |
| Note in arrears | `note_arrears_investor` | Investor | Note entered arrears | Yes | Yes | Check investor Activity | Notes → Late Payment | Follow arrears process |
| Note defaulted (issuer) | `note_defaulted` | Issuer | Note marked in default | Yes | Yes | `NOTE_DEFAULT_MARKED` | Notes Activity | Follow default process |
| Note defaulted | `note_defaulted_investor` | Investor | Note marked in default | Yes | Yes | `NOTE_DEFAULT_MARKED` | Notes Activity | Follow default process |
| Withdrawal submitted to trustee | `withdrawal_submitted_to_trustee` | Issuer and investor | Withdrawal instruction sent to trustee | Yes | Yes | `WITHDRAWAL_SUBMITTED_TO_TRUSTEE` | Notes Activity; Issuer Payouts / Investor Withdrawals | Wait for trustee / completion |
| Repayment rejected **(new)** | `note_payment_rejected` | Issuer | Repayment rejected | Yes | No | `PAYMENT_REJECTED` | Notes Activity | Ask issuer to resubmit if needed |
| Disbursement completed **(new)** | `withdrawal_completed` | Issuer | Issuer disbursement completed | Yes | No | `WITHDRAWAL_COMPLETED` | Notes Activity; Issuer Payouts | Confirm Finance |
| Upfront facility fee payment required | `facility_fee_payment_requested` | Issuer | Upfront facility fee is due | Yes | Yes | Not the payment proof | Facility / application fee status | Direct them to pay. Then check Gateway |
| Upfront facility fee paid | `facility_fee_upfront_paid` | Issuer | Upfront facility fee paid | Yes | Yes | `FACILITY_FEE_PAID` | Activity and Gateway Payments | Confirm Gateway |
| Outstanding late charges to pay | `excess_late_charges_due` | Issuer | Late charges are due | Yes | Yes | Check Notes Activity | Notes Activity; Gateway Payments | Follow collection |
| Late payment charges received | `excess_late_charges_paid` | Issuer | Late charges paid | Yes | Yes | Check Notes Activity | Notes Activity; Gateway Payments | Confirm Gateway |
| Deposit verification failed **(new)** | `deposit_name_check_rejected` | Investor | Deposit name check failed | Yes | No | None on Activity | Gateway Payments | Use Gateway, not Activity |
| Deposit refund started **(new)** | `deposit_refund_initiated` | Investor | Deposit refund started | Yes | No | None on Activity | Gateway Payments | Use Gateway |
| Deposit refund completed **(new)** | `deposit_refunded` | Investor | Deposit refund completed | Yes | No | None on Activity | Gateway Payments | Use Gateway |
| Deposit successful **(new)** | `deposit_successful` | Investor | Deposit succeeded | Yes | No | None on Activity | Gateway Payments | Use Gateway |
| Investment committed **(new)** | `investment_committed` | Investor | Investment committed | Yes | No | `INVESTMENT_COMMITTED` | Notes Activity | Confirm Note and money evidence |
| Withdrawal submitted **(new)** | `investor_withdrawal_submitted` | Investor | Investor withdrawal submitted | Yes | No | Check investor Activity | Finance → Investor Withdrawals | Wait for completion |
| Withdrawal completed **(new)** | `investor_withdrawal_completed` | Investor | Investor withdrawal completed | Yes | No | Check investor Activity | Finance → Investor Withdrawals | Confirm Finance |

Invitation emails, signing links, and one-time codes are sent separately. They are not this 49-type list.

---

## 12. Troubleshooting decision tree

### Case: “I submitted but nothing happened.”

Check:

1. Application status
2. Admin → Applications → **Activity Timeline**
3. Audit → **Notifications** for Application Submitted Confirmation

If status is submitted but Activity is missing, the application record is still the submit proof. Check whether a timeline repair later filled the row. Do not tell the customer it was not submitted if status is submitted.

### Case: “I paid.”

Check:

1. **Gateway Payments**
2. Payment status on that payment
3. Activity fee milestone, if any
4. Notification, if one exists for that fee

Never trust only the Activity text for money proof.

### Case: “I signed.”

Check:

1. Application → **Acceptance** → **Signing package**
2. **Signing Package Completed** on Activity
3. Each signer’s status on the package
4. Legal Acceptances or External Acceptances if the question is about a legal document, not the facility/invoice signing package

### Case: “I never opened the signing link.”

Check the signing package signer status **Viewed**.

Do not look for an Activity event.

### Case: “I never accepted this legal document.”

Check:

- Audit → **Legal Acceptances** or organisation → **Acceptances**
- Audit → **External Acceptances** for a guarantor
- Document version and acceptance details on the row

Do not use Activity as the only proof.

### Case: “I did not receive the email.”

Check Admin → **Audit** → **Notifications**.

Also check whether that type has email turned on in **Settings → Notifications**.

Some types default to inbox only, including Application Submitted Confirmation, several deposit messages, investment committed, repayment rejected, and disbursement / investor withdrawal messages.

Do not assume Activity means email delivery succeeded.

### Case: “Who made this change?”

Open the Admin timeline or Audit row.

Check actor, source, portal, and time.

Portal means a person used CashSouk. System job or Internal process is not a customer click.

---

## 13. What Operations should not do

- Do not use customer Activity as the only financial proof.
- Do not use Activity as the only legal proof.
- Do not expose webhook, request, or internal IDs to customers.
- Do not tell a customer a system job or internal repair was a user action.
- Do not treat **Declined** and **Voided** as the same.
- Do not treat old catalogue events as new live actions.
- Do not use development-only webhook events as production evidence.
- Do not rely on notification delivery to prove the business action happened.
- Do not tell a customer they were “cancelled” when Activity says **Onboarding Restarted**.

---

## 14. Historical and development events

You may still see some old rows.

**Historical** means old records may still show this event, but new flows should not create it.

Examples you might still see:

- **Application Approved**
- Old facility offer withdrawn / rejected wording
- Settlement previewed
- Old product inactivated / reactivated names
- Old onboarding ticks such as T&C accepted or user completed

**Development only** means testing/development. Do not use those webhook-style rows as production evidence.

Do not present the full historical catalogue to customers.

If you need the long list, use Help → **Logs, Activity & Notifications**.

---

## 15. Quick reference

| If you need to know | Look here |
| --- | --- |
| What happened to the application? | Admin → Applications → **Activity Timeline** |
| What happened during onboarding? | Admin → Issuers or Investors → **Activity** |
| What happened to the Note? | Admin → Notes → **Activity** |
| Did money move? | Finance → **Gateway Payments** and the matching Finance screen |
| Was a legal document accepted? | Audit → **Legal Acceptances** |
| Did an external guarantor accept? | Audit → **External Acceptances** |
| Did we notify the customer? | Audit → **Notifications** |
| Who did this? | Open the Admin row. Check actor, source, and portal |
| Did the signer open the link? | Signing package signer status **Viewed** |
| What does the customer see? | Issuer or Investor → **Activity** |

---

## 16. Client-safe explanation

You can use this language with customers.

“Your Activity page shows the important milestones in your financing journey.”

“For payment questions, we also keep separate payment records.”

“For signed or accepted documents, we keep separate legal evidence.”

“Technical system information is available to our Operations team but is not shown in your Activity feed.”

“A message in your bell or email is how we told you about a change. It is not the only record of what happened.”

“If you declined to sign, that is different from CashSouk cancelling a signing package.”

---

## 17. Screens used in this guide

These are the real Admin and portal labels used above.

| Need | Screen | Who can open it |
| --- | --- | --- |
| Customer journey | Issuer / Investor **Activity** | Signed-in issuer or investor |
| Customer messages | Bell → **Notifications** | Signed-in issuer or investor |
| Application history | Admin → **Applications** → **Activity Timeline** | `applications.view` |
| Signing package | Admin → Applications → **Acceptance** → **Signing package** | Application access |
| Facility history | Admin → **Facilities** → **Activity** | `contracts.view` |
| Organisation history | Admin → **Issuers** or **Investors** → **Activity** | `organizations.view` |
| Organisation acceptances | Admin → Issuers / Investors → **Acceptances** | `document_management.view` |
| Note history | Admin → **Notes** → **Activity** | `notes.view` |
| Note money / letters | Admin → Notes → **Ledger**, **Disbursement**, **Servicing**, **Late Payment** | Note access |
| Access logs | Admin → **Audit** → **Access** | `audit.access.view` |
| Security logs | Admin → **Audit** → **Security** | `audit.security.view` |
| Product logs | Admin → **Audit** → **Products** | `audit.product.view` |
| Legal document history | Admin → **Audit** → **Legal Documents** | `document_management.view` |
| Legal acceptances | Admin → **Audit** → **Legal Acceptances** | `document_management.view` |
| External acceptances | Admin → **Audit** → **External Acceptances** | `document_management.view` |
| Notification log | Admin → **Audit** → **Notifications** | `notifications.view` |
| Notification settings | Admin → **Settings** → **Notifications** | `notifications.view` |
| Gateway payments | Admin → **Finance** → **Payments** → **Gateway Payments** | `gateway_payments.view` |
| Repayments | Admin → **Finance** → **Money movement** → **Repayments** | `repayments.view` |
| Settlements | Admin → **Finance** → **Money movement** → **Settlements** | `settlements.view` |
| Issuer payouts | Admin → **Finance** → **Money movement** → **Issuer Payouts** | `disbursements.view` |
| Investor withdrawals | Admin → **Finance** → **Money movement** → **Investor Withdrawals** | `investor_withdrawals.view` |
| Legal files | Admin → **Directory** → **Legal Documents** | `document_management.view` |
| Products | Admin → **Settings** → **Products** | `products.view` |
| Roles | Admin → **Settings** → **Roles** | `roles.view` |

The Audit menu itself appears if you have any of the Audit, legal-document, or notifications view permissions.

**Generated document evidence** is recorded for internal evidence. There is **no** dedicated Operations screen named Generated Documents.

---

## 18. Related Help

- **Logs, Activity & Notifications** — longer event list
- **Notifications** — how to turn inbox and email on or off
- **Gateway Payments** — how to search payment evidence
