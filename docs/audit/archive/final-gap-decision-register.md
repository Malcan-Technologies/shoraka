# Final gap / decision register

Verified **2026-08-26** from source. **Only unresolved items.** Closed items are not listed.

This is the last coverage review. Do not reopen items classified SAFE_TO_DEFER unless product changes the live workflow.

Classification: `AUDIT_DEFECT` | `NOTIFICATION_GAP` | `ACTIVITY_GAP` | `COPY_ISSUE` | `PRODUCT_DECISION` | `CLIENT_DECISION` | `LEGAL_DECISION` | `PROVIDER_LIMITATION` | `SAFE_TO_DEFER`

| Item | Area | Current Behaviour | What Is Missing | Why It Matters | Proposed Action | Classification | Owner |
|---|---|---|---|---|---|---|---|
| Signing envelope expiry has no log row | Signing | Hourly job sets envelope `EXPIRED`. Signing panel shows status. `SIGNING_PACKAGE_EXPIRED` is not a live writer. Offer/signing **clock** expiry is a different job and **is** logged + notified | An `application_logs` row with SYSTEM / SYSTEM_JOB | Forensic timeline vs operational status. Admin can already reconstruct from the envelope | Leave it. Only add a log row if compliance requires a timeline line | SAFE_TO_DEFER | Eng / product |
| Notification type toggles have no history | Config | Admin Settings → Notifications → Configuration. Only `updated_at` | Who, when, before, after, append-only history | Cannot prove who turned a channel off | Add a `security_logs` row **only if** ops must prove notify-policy changes | CLIENT_DECISION | Ops |
| Issuer not notified when Admin records a repayment | Servicing | Investors get `note_payment_received`. Issuer submitted it; they see the note. Full payoff uses `note_repaid_issuer` | Per-payment issuer inbox | Nice-to-have confirmation | Do not add unless product wants issuer/investor parity | PRODUCT_DECISION | Product |
| Overall application reject has no reason | Application | Confirm dialog has no text field. Log and inbox have no reason | Reason text | Support cannot quote “why” | Collect a reason only if CashSouk requires it | PRODUCT_DECISION | Product / legal |
| COD reject reason sometimes empty | Onboarding | `COD_REJECTED` + `onboarding_rejected`. Reason only if provider payload has one | Reliable reason | User/Admin may see reject without why | Store provider reason when present; do not invent | PROVIDER_LIMITATION | Eng / provider |
| Signer IP / viewed time / provider certificate | Signing | Signed PDF, sha256, `signed_at`, name/email stored. `viewed_at` never written. No signer-IP column | Signer IP, viewed_at, certificate | Legal evidence pack is not full e-sign audit trail | Ask SigningCloud; do **not** copy sender request IP | PROVIDER_LIMITATION | Legal |
| Intermediate onboarding gates silent | Onboarding | SSM approve, AML auto-clear, submission-approved have Admin timeline, no user inbox. Final approval **does** notify | User inbox at each gate | Users wait until “Onboarding Approved” | Keep silent unless product wants stepwise mail | PRODUCT_DECISION | Product |
| `note_active_issuer` unused on live path | Disbursement | Live path: `withdrawal_completed` (“Your Disbursement Is Complete”). `activate` API unused in UI | Second “note is active” issuer inbox | Would duplicate disbursement complete | Do not send both | PRODUCT_DECISION | Product |
| Pause / unpublish / facility re-enable silent | Notes / facility | Logged on Admin note/application timeline. Pause/resume on issuer Activity. No inbox | Inbox | Visibility-only; no money moved | Keep silent | PRODUCT_DECISION | Product |
| Name-check pending / approved silent | Deposit | Reject notifies. Held/approved do not | Inbox while held | Avoid alarming user before Admin acts | Keep silent | PRODUCT_DECISION | Product |
| Onboarding-fee / processing-fee refunds silent | Gateway | Investor **deposit** refunds notify. Other purpose refunds do not | Inbox | Different product; money still on gateway detail | Notify only if those refunds are customer-facing | PRODUCT_DECISION | Product |
| Org member invite revoke not in Security logs | Access | Admin invite revoke **is** logged. Issuer/investor member revoke is on org members UI | `INVITATION_REVOKED` security row | Member list is enough for ops | Log only if forensic requirement | SAFE_TO_DEFER | Product |
| Archive application has no log | Application | Status + `archived_at` | `application_logs` row | Rare version-mismatch restart | Optional | SAFE_TO_DEFER | Product |
| Gateway happy-path has no event row | Deposit | COMPLETED payment + wallet + ledger | `gateway_payment_events` success row | 3-table join vs one event | Do not invent unless recon needs it | SAFE_TO_DEFER | Ops |
| Gateway poller correlation id | Gateway | EXPIRED event is SYSTEM / INTERNAL. Cron id `cron:gateway-stuck-order-poller` is in app logs | `correlation_id` on the event row | Trace job vs row | Optional pass-through | SAFE_TO_DEFER | Eng |
| `ACTIVATE` / `AML_APPROVED` / access `ROLE_*` / product inactivate unused | Various | Backend exists; no mounted Admin button | UI | Must not be described as current Admin workflow | Leave unused; do not wire for coverage | SAFE_TO_DEFER | Eng |
| Dead registry types | Notifications | `kyc_approved`, `kyc_rejected`, `login_new_device`, `application_approved` — never sent; hidden from config toggles | Automatic send | Historical FK rows | Leave in registry | SAFE_TO_DEFER | Eng |
| LO reminder days vs journey PDF | Compliance | One reminder near expiry (`days_before_expiry: 1`) | Day 3 and day 6 cadence | Written journey vs code | Change only with legal sign-off | LEGAL_DECISION | Compliance |
| Signing reminder days vs journey PDF | Compliance | Days-before 3 and 1, not journey 7+12 | Journey cadence | Same | Same | LEGAL_DECISION | Compliance |
| Onboarding fee before AML | Compliance | Company issuer: terms → fee → verify | Fee after AML | Sequence vs journey PDF | Product/legal, not logging | LEGAL_DECISION | Compliance |
| Notice of Assignment / paymaster ack | Compliance | No gate before disbursement | Workflow | Regulatory | Backlog | LEGAL_DECISION | Compliance |
| Guarantor acknowledgement at LO issue | Compliance | Guarantors contacted at signing | LO-time acknowledgement entity | Regulatory | Backlog | LEGAL_DECISION | Compliance |
| Risk Statement questionnaire payload | Compliance | Checkbox + PDF open; no questionnaire payload on acceptance | Exportable self-declaration answers | Regulatory | Backlog | LEGAL_DECISION | Compliance |
| Warning Statement every application | Compliance | Signup capture; compact footer omits Warning link | Per-application display log | Regulatory | Backlog | LEGAL_DECISION | Compliance |
| T&C SC-clearance gate | Compliance | Publish + hash + optional re-accept; no SC field | Clearance gate | Regulatory | Backlog | LEGAL_DECISION | Compliance |
| 18% p.a. profit cap | Compliance | Schema allows any non-negative rate | Cap validation | Regulatory | Backlog | LEGAL_DECISION | Compliance |

---

## False positives (do not treat as gaps)

| Appearance | Reality |
|---|---|
| Investor cash withdrawal has no `note_events` | `note_id` is null. Evidence: withdrawal instruction + wallet + inbox + `/transactions` |
| Successful deposit has no Activity row | Investor Activity is not the wallet. Evidence: `/transactions` + inbox (`deposit_successful`) + Admin gateway payment |
| Successful deposit had no inbox | Closed: webhook capture and Admin name-check approve send `deposit_successful` |
| `ACTIVATE` missing on disbursement | Not a current Admin button. Live path: `WITHDRAWAL_COMPLETED` + investor “Your Investment Is Active” |
| Trustee letters have no customer Activity | Admin note/settlement/withdrawal detail + (issuer disbursement) trustee-submit inbox. Trustee gets SES |
| Finance settings “only last editor” | `security_logs.PLATFORM_FINANCE_SETTINGS_UPDATED` stores full before/after |
| Role permissions “only last editor” | `ROLE_PERMISSIONS_UPDATED` stores previous/next permissions |
| AML never logged | Live path: `ONBOARDING_STATUS_UPDATED` + `metadata.amlApproved`. `AML_APPROVED` has no UI |
| Offer expiry looks like Admin | Cron writes SYSTEM / SYSTEM_JOB / SYS |
| `APPLICATION_APPROVED` missing writer | Live terminal success is `APPLICATION_COMPLETED`. Invoice “approved” row in issuer UI is a display alias |
| `CONTRACT_OFFER_REJECTED` missing | Live decline is `CONTRACT_WITHDRAWN` |
| `SIGNING_PACKAGE_COMPLETED` hidden on Admin timeline | User-facing success is `CONTRACT_OFFER_ACCEPTED`; signed files on the envelope |
| Settlement trustee email “missing notification” | Direct SES to trustee, not the user inbox |

---

## Stop rule

Do **not** add events or notifications to shrink this list. Client delivery of audit/notification coverage does not depend on the LEGAL_DECISION rows (those are product workflows) or the SAFE_TO_DEFER rows.
