# Logging demo matrix

Plain-language view of what users see, what Admin sees, what is kept as evidence, and how to trigger the **new or materially changed** journeys.

Git: BEFORE `2e80520c` → AFTER `1deb2f8b`.

Activity (timeline) and notifications (inbox/email) are different. Both can fire for one action.

---

## Client-facing summary

CashSouk already recorded the financing journey before this work: applications, offers, notes, repayments, legal acceptances, and many emails.

What changed is **who did it**, **whether the record can be lost**, and a set of **missing milestones** (fees, signing decline vs cancel, onboarding amendment, guarantor acceptance).

### What users see

On **Activity** (issuer / investor), a short milestone list, for example:

- Onboarding started / fee paid / amendment required / approved / rejected
- Application started / submitted / rejected / completed
- Offer sent / declined / expired / signed
- Signing package sent / completed / declined / expired
- Facility fee paid / processing fee paid
- Note published / funding closed / investment committed / settlement posted

Users do **not** see provider webhook names, job names, Admin review ticks, ledger internals, or legal file hashes.

### What Admin sees

The same milestones, plus operational timelines (section review, signing created/voided, trustee letters, prospectus, paymaster notices) and Audit screens: Access, Security, Products, Legal Documents, Legal Acceptances, External Acceptances, Notifications. Finance uses Gateway Payments.

### What is kept as evidence (not the Activity feed)

- Legal PDF acceptances (logged-in users)
- External acceptances (for example a guarantor on a signing link)
- Generated document hashes
- Gateway payment events and payment rows
- Access / security logs
- Notification delivery logs

### What notifications are sent

Inbox + email when configured. New since BEFORE: application submitted confirmation; signing deadline extended; facility disabled; repayment rejected; withdrawal completed; deposit success / name-check fail / refund; investment committed; investor withdrawal submitted/completed.

---

## Where each important thing shows

Y = yes. User Activity is issuer and/or investor global Activity. Org Activity = Admin issuer/investor Activity.

| What happened | Issuer Activity | Investor Activity | Admin application / facility | Admin note | Admin forensic / other | Notification |
|---|---|---|---|---|---|---|
| Application submitted | Y | — | Y | — | — | Application submitted confirmation **(new)** |
| Application created | Y | — | Y | — | Repair may fill a row with no person | — |
| Processing fee paid | Y **(new)** | — | Y | — | Gateway Payments | — |
| Facility fee paid | Y **(new)** | — | Y | — | Gateway Payments | Facility fee paid (existed) |
| Facility offer declined | Y (renamed) | — | Y | — | — | Withdrawal confirmation if application closes |
| Signing sent | Y | — | Y | — | Envelope | Signing email (provider, not this catalogue) |
| Signing completed | Y **(now on feed)** | — | Y | — | Envelope | — |
| Signing declined | Y **(new)** | — | Y | — | Envelope | — |
| Signing expired | Y **(new)** | — | Y | — | Envelope | Offer expired if the offer clock also lapsed |
| Signing voided | — | — | Y (Admin) | — | Envelope | — |
| Signer opened link | — | — | Envelope `viewed_at` **(new)** | — | Not an Activity event | — |
| Onboarding fee paid | Y **(new)** | — | Org Activity | — | Gateway | — |
| Onboarding amendment | Y **(new)** | Y **(new)** | Org + forensic status | — | Forensic `ONBOARDING_STATUS_UPDATED` | — |
| Membership change | — | — | Org Activity (Admin) | — | — | — |
| External guarantor accepted PDF | — | — | — | — | Audit → External Acceptances **(new)** | — |
| Generated LO | — | — | — | — | Generated document evidence **(new)** | — |
| Gateway payment completed | — | — | — | — | Gateway Payments **(new event)** | Deposit successful **(new)** if deposit |
| Investment committed | — | Y (event existed) | — | Y | — | Investment committed **(new)** |
| Settlement preview | — | — | — | Historical only | No longer written | — |

**Why the same action can appear twice:** occupancy is stored on the **application** (`CONTRACT_FACILITY_OCCUPANCY_UPDATED`) and the **note** (`FACILITY_OCCUPANCY_UPDATED`) because facility room and note servicing are different screens. Fee paid is both a **gateway row** and a **timeline milestone** so Activity is not the money ledger.

**Not duplication:** legal acceptance is never copied into Activity.

---

## Grouped by journey (meaningful only)

### 1. Account / security

Existed: login, logout, signup, password, roles.  
**New:** email verified as a security event; platform finance settings audit.  
**Not demoable:** Account locked (catalogue only, no writer).

### 2–3. Issuer / investor onboarding

Existed: started, approved, rejected, cancelled.  
**New user milestones:** onboarding fee paid; amendment required.  
**New Admin:** membership added/invited/removed/role changed.

### 4. Application

Existed: started, submitted, resubmitted, rejected, completed.  
**Changed:** submitted is now in the same save as the status; confirmation email.  
**New:** processing fee paid on the timeline.

### 5–7. Contract / invoice / offer

Existed: sent, accepted, retracted, expired, invoice declined.  
**Changed:** facility decline is “offer declined”, not “withdrawn”.

### 8. Signing

Existed: created, sent, completed, voided.  
**New:** declined, expired; completed still logged if there is no creating user; user feed shows completed/declined/expired.  
**New evidence:** recipient viewed time on the envelope (not Activity).

### 9. Legal acceptance

Existed: logged-in user accepted a published PDF.  
**New:** unauthenticated party (guarantor) acceptance; generated file hashes.

### 10. Fee / gateway

Existed: gateway payments, name-check, refunds, facility-fee emails.  
**New:** timeline fee-paid events; `GATEWAY_PAYMENT_COMPLETED`; deposit notifications.

### 11–16. Note / funding / disbursement / repayment / arrears / settlement

Mostly existed.  
**New Admin:** paymaster notices.  
**Changed:** settlement preview no longer writes a timeline row.  
**New notification:** repayment rejected; investment committed.

### 17. Withdrawal / refund

Existed: trustee withdrawal events.  
**New notifications:** issuer withdrawal completed; investor withdrawal submitted/completed; deposit refund initiated/refunded.

### 18–19. Admin review / products

Existed: section/item review, product created/updated/deleted.  
Inactivate/reactivate are historical only.

---

## How to trigger the important NEW / changed demos

Do not treat this as a 145-case script. Use these.

### Application submitted

1. Log in as issuer.
2. Complete a draft application.
3. Click Submit.

Expect: status submitted; timeline “Application submitted” with the issuer as actor; confirmation notification if enabled; Admin application timeline shows the same.

### Processing fee paid

1. Reach a step that charges the application processing fee.
2. Pay successfully via the gateway test path.

Expect: gateway payment completed; Activity “processing fee paid”; Admin Gateway Payments.

### Facility offer declined

1. Admin sends a facility offer.
2. Issuer declines.

Expect: `CONTRACT_OFFER_DECLINED` (not withdrawn-unless the application actually closes); issuer Activity shows declined.

### Signing declined vs voided

**Decline:** signer declines in the signing provider. Expect “Signing package declined”.  
**Void:** Admin voids the package. Expect “Signing package voided” (Admin), not declined.

### Signing expired

1. Send a package with a short expiry (or seed/job).
2. Wait until `expires_at` passes; expiry job runs.

Expect: `SIGNING_PACKAGE_EXPIRED` on application timeline; issuer Activity.

### Signer viewed

1. Open the signing link without completing.

Expect: recipient `viewed_at` on the envelope. **No** new Activity row.

### Onboarding amendment required

1. Drive COD to amendment (provider/Admin path used in staging).

Expect: issuer/investor Activity “amendment required”. Admin still has forensic status separately. Users must not see request IDs.

### Onboarding fee paid

1. Pay issuer registration fee successfully.

Expect: Activity “onboarding fee paid” + Gateway Payments.

### External legal acceptance

1. Send a signing package that includes a published legal PDF for a guarantor.
2. Guarantor accepts on the unauthenticated link.

Expect: Admin → Audit → External Acceptances. Not an Activity row. Deleting the envelope must not delete this row.

### Investment committed (notification)

1. Investor commits on a published note.

Expect: note event (already existed) **and** `investment_committed` inbox/email (new).

---

## Developer trigger cheat sheet (new/changed only)

| Label | How | Event | Table | Source | User visible |
|---|---|---|---|---|---|
| Application submitted | Issuer Submit | `APPLICATION_SUBMITTED` | `application_logs` | API (atomic) | Y |
| Processing fee paid | Curlec success | `APPLICATION_PROCESSING_FEE_PAID` | `application_logs` | WEBHOOK | Y |
| Facility fee paid | Curlec success | `FACILITY_FEE_PAID` | `application_logs` | WEBHOOK | Y |
| Facility offer declined | Issuer reject | `CONTRACT_OFFER_DECLINED` | `application_logs` | API | Y |
| Signing declined | Signer/provider decline | `SIGNING_PACKAGE_DECLINED` | `application_logs` | WEBHOOK/INTERNAL | Y |
| Signing expired | Envelope clock | `SIGNING_PACKAGE_EXPIRED` | `application_logs` | SYSTEM_JOB | Y |
| Onboarding fee paid | Registration fee success | `ONBOARDING_FEE_PAID` | `onboarding_logs` | WEBHOOK | Y |
| Amendment required | COD amendment | `ONBOARDING_AMENDMENT_REQUIRED` | `onboarding_logs` | WEBHOOK | Y |
| Member added | Invite/accept member | `MEMBER_ADDED` | `onboarding_logs` | API | Admin org |
| Gateway completed | Payment success | `GATEWAY_PAYMENT_COMPLETED` | `gateway_payment_events` | WEBHOOK | Finance UI |
| External acceptance | Guarantor accept | (row, not event_type) | `legal_external_acceptances` | signing | Legal UI |
| Generated LO evidence | Generate LO | (row) | `generated_document_evidence` | API | Legal/ops |

Full LIVE catalogue: `docs/logging-event-catalogue.md`. Engineering evidence: `docs/audit/logging-before-after.md`.
