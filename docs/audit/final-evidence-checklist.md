# Final evidence checklist

Verified **2026-08-26** from source. Plain English. This is the last coverage review.

Companions: [master journal](./final-master-audit-notification-journal.md) · [client matrix](./final-client-facing-log-notification-matrix.md) · [gap register](./final-gap-decision-register.md)

---

## WHAT WE HAVE

- Login, logout, signup, and password change are logged. Password change also emails and inboxes the user.
- Admin Access logs and Security logs show who did access and security-sensitive work. CSV export exists.
- Role catalogue create/delete/permission edits keep before/after permission history.
- Platform finance settings saves keep full before/after snapshots (account numbers and trustee emails included; only real auth secrets would be redacted).
- Onboarding start, restart, reject, and final approval are on org Activity. Reject and final approval also notify the applicant.
- SSM approve, AML refresh, and sophisticated-investor toggle are on Admin org timeline. Live AML is automatic (`ONBOARDING_STATUS_UPDATED` + `amlApproved`), not a separate Admin “Approve AML” button.
- Legal T&C/consent acceptances store version, hash, user, organisation, time, IP, and the exact acknowledgement wording. Admin can open the acceptance list.
- Applications: create, submit, amend, resubmit, reject, withdraw, complete — logged and (except create) notified.
- Section/item review reject and amend require a remark. Overall application Reject does not collect a reason.
- Facility and invoice offers: send, decline, retract, expire, sign, signing-deadline extend — logged. Expiry and reminders are the hourly job, not an Admin “Expire” button.
- Notes: publish, pause/resume, close funding, fail funding — logged. Close/fail can also run from cron as SYSTEM, not as a fake Admin click.
- Investment commit is on investor Activity and the wallet.
- Issuer disbursement: submit to trustee, complete. Completing payout starts servicing. Issuer inbox: “Your Disbursement Is Complete”. Investors: “Your Investment Is Active”. There is no current Admin “Activate note” button.
- Investor cash withdrawal: request and complete notify the requesting investor. Status is on `/transactions` and Admin finance withdrawal pages. No note Activity row (there is no note).
- Deposits: success is on `/transactions` and Admin gateway detail. Name-check reject and deposit refunds notify the investor.
- Repayments, settlement, arrears, default: Admin settlement panel plus note Activity. Investors are notified on recorded repayment, settlement, arrears, and default. Issuer is notified on repayment reject, arrears, default, and full note repaid.
- Trustee letters go by direct email to the trustee (not the user inbox). Admin can see the letter/submit/complete trail on the note.
- Scheduled listing close/fail and offer/signing-clock expiry are attributed as SYSTEM / SYSTEM_JOB / SYS.

---

## WHAT WE SHOULD HAVE BUT DO NOT HAVE

Nothing required to reconstruct live customer journeys is missing from **all** surfaces.

These are the honest remaining holes — **not** delivery blockers:

1. **Signing envelope expiry job** sets the envelope to EXPIRED and writes no Activity row. Admin still sees EXPIRED on the signing panel. Offer/signing **clock** expiry is a different job and **is** logged and notified.
2. **Notification type on/off toggles** keep only last `updated_at`. No who/before/after history.
3. **Successful deposit** has no inbox item. The investor can see the credit on `/transactions`.
4. **Issuer is not inbox-notified** when Admin records a repayment (investors are). Issuer already submitted it and can see the note.
5. **Overall application Reject** stores no reason because the Admin dialog never asks for one.

Issuer-journey PDF items (reminder days, fee-after-AML, Notice of Assignment, guarantor acknowledgement at LO, 18% cap, SC T&C gate) are **product/legal workflow** gaps, not audit-coverage gaps.

---

## WHAT EVIDENCE IS INCOMPLETE

**Code / system**

- Envelope expiry: status + `updated_at` only. No `application_logs` row, no SYSTEM actor on a log line.
- Notification configuration: last write time only.
- Gateway abandoned-checkout expiry: SYSTEM / INTERNAL event on the payment; cron correlation id is in server logs, not always on the event row.
- Successful deposit: wallet + payment record; no extra gateway event row.

**Product decision (UI never collects it)**

- Overall application rejection reason.
- Pause/unpublish/facility-enable notifications (intentionally quiet).

**Provider limitation**

- Signing: no signer IP column. `viewed_at` exists but is never written. No provider certificate / audit-trail file stored. Do **not** copy the envelope-sender’s request IP as the signer IP.
- COD reject reason only if the provider payload includes one.

---

## USER POV

Can the user normally understand what happened? **MOSTLY / YES for money and status.**

They use a mix of:

- Activity (applications, onboarding, notes, investments)
- Inbox (deadlines, rejects, funding, disbursement, withdrawals, repayments)
- Status / detail pages
- `/transactions`

They do **not** need an Activity row for wallet deposits or investor cash withdrawals. Those live on transactions + inbox (withdrawals) or transactions only (successful deposit).

**Exceptions**

- Successful deposit: no inbox. User must open transactions.
- Overall application reject: no reason text.
- Intermediate Admin gates (SSM, AML refresh, submission approved): Admin-only until “Onboarding Approved”.

Can they explain a problem to support with what they see? **YES**, except they may not have a written reject reason on overall application reject, and they may not have an inbox line for a successful deposit.

---

## ADMIN / SUPPORT POV

Can Admin trace important user issues without opening the database? **YES.**

| Question | Answer |
|---|---|
| What happened? | YES — Activity, detail pages, Security/Access, gateway, withdrawal, settlement |
| Who? | YES on human actions |
| User vs Admin vs System vs Webhook? | YES on live writers (`actor_type` / `source`). Jobs use SYSTEM / SYSTEM_JOB. Webhooks use INTEGRATION / WEBHOOK |
| When? | YES — `created_at` |
| Which record? | YES — target / note / payment / withdrawal / envelope ids |
| Previous / new state? | YES on funding, occupancy, finance settings, role permissions, legal versions. Gateway happy-path is status on the payment row |
| Why rejected/failed? | YES when the UI or provider collected a reason. NO on overall application reject (not collected) |
| Linked money / legal record? | YES via operational pages even when there is no Activity row |

---

## LEGAL EVIDENCE

| Evidence | Status |
|---|---|
| T&C / consent: version, hash, user, org, time, IP, acknowledgement text, accepted PDF/version | SUPPORTED |
| Signing: envelope id, document id, signer name/email, signed time, signed PDF, PDF hash, provider status | SUPPORTED |
| Signing: signer IP | PROVIDER_NOT_AVAILABLE (no column; do not invent) |
| Signing: viewed timestamp | BUG / unused column (`viewed_at` never written) — treat as PROVIDER_NOT_AVAILABLE until SigningCloud supplies it |
| Signing: provider certificate / audit trail file | PROVIDER_NOT_AVAILABLE |

---

## FINANCIAL EVIDENCE

| Flow | Traceable? | Main evidence |
|---|---|---|
| Deposit | MOSTLY | Gateway payment + wallet + ledger. No success event row |
| Investment | YES | `INVESTMENT_COMMITTED` + wallet hold |
| Funding close / fail | YES | `CLOSE_FUNDING` / `FAIL_FUNDING` + ledger/wallet release |
| Issuer disbursement | YES | Withdrawal instruction + `WITHDRAWAL_*` + note ACTIVE |
| Repayment | YES | Settlement panel + `PAYMENT_*` + investor inbox |
| Settlement | YES | Panel + `SETTLEMENT_*` + ledger |
| Investor cash withdrawal | YES | Instruction + wallet + inbox + `/transactions` (no note event) |
| Refund (investor deposit) | YES | Gateway events + inbox. Wallet-reversal fail is an Admin gateway event |

---

## FINAL FIX LIST

**None for audit / Activity / notification coverage.**

Do not add events or inboxes “for completeness”. Remaining items are product, legal, or provider choices. You can stop this review after client confirmation of the client-facing matrix.
