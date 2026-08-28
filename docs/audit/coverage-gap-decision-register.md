# Coverage gap / decision register

> **Superseded for coverage decisions (2026-08-26).** Unresolved items now live in [`final-gap-decision-register.md`](./final-gap-decision-register.md). Do not reopen this review from this file.

Verified: **2026-08-26** from source. Only items that affect **current reachable or system** flows, plus honest false-positive notes.

Classification: `AUDIT_DEFECT` | `NOTIFICATION_GAP` | `ACTIVITY_GAP` | `COPY_ISSUE` | `PROVIDER_LIMITATION` | `PRODUCT_DECISION` | `LEGAL_DECISION` | `SAFE_TO_DEFER`

| Item | Area | Current Behavior | Evidence | Proposed Action | Classification | Owner |
|---|---|---|---|---|---|---|
| Application overall reject has no reason | Application | Confirm dialog has no reason field; `APPLICATION_REJECTED` stores none; notification has no reason | `application-detail-hero` / page confirm; `admin/service.ts` reject log has no remark | Decide whether CashSouk must collect a reason | PRODUCT_DECISION | Product / legal |
| Successful deposit has no inbox | Investor money | Wallet credits; `/transactions` shows it; no `sendTyped` on happy-path capture | `creditCompletedDeposit`; no gateway success event | Keep silent (status page) or add a deposit-success notification | PRODUCT_DECISION | Product |
| Signing envelope expiry has no audit event | Signing | Hourly job sets envelope `EXPIRED`; `SIGNING_PACKAGE_EXPIRED` is not a live writer | `signing-envelope-expiry` job; no `logApplicationActivity` | Smallest fix: write one application_logs row on expiry (reuse existing ID only if product agrees) | AUDIT_DEFECT | Eng / product |
| Notification type toggles have no history | Config | Admin can change platform/email defaults; only `updated_at` | `notification/service.ts` `updateType` | Append-only security/config row if ops must prove who changed notify policy | PRODUCT_DECISION | Ops |
| Signer IP / viewed timestamp | Signing | Signed PDF, sha256, `signed_at` stored. `viewed_at` never written. No signer-IP column. Do not use sender request IP | Prisma signing models; repository writers | Treat as provider limitation unless SigningCloud supplies fields | PROVIDER_LIMITATION | Legal |
| Issuer “note active” notification unused on live path | Disbursement | `note_active_issuer` only from `activate` API (no UI). Live path notifies `withdrawal_completed` | `markWithdrawalCompleted` vs `activate` | Keep disbursement copy for issuers (already correct). Do not add a second inbox item unless product wants both | PRODUCT_DECISION | Product |
| Archive application has no log | Application | Archive updates status/`archived_at` only | `archiveApplication` | Optional application_logs if archive is a compliance action | SAFE_TO_DEFER | Product |
| Org member invite revoke has no security log | Access | Admin invite revoke is logged; issuer/investor member revoke is not | org invitation service | Only if member-invite revoke must be forensic | SAFE_TO_DEFER | Product |
| Gateway happy-path has no event row | Gateway | COMPLETED payment + wallet + ledger | `creditCompletedDeposit` | Do not invent a success event unless recon needs it | SAFE_TO_DEFER | Ops |
| `ACTIVATE` unused in Admin UI | Notes | API + unused hook | `useActivateNote` zero mounts | Do not present as a current Admin workflow | SAFE_TO_DEFER | Eng |
| `AML_APPROVED` / `ONBOARDING_RESET` / access `ROLE_*` unused | Onboarding / access | Writers/routes without UI | hooks unused / route-only | Do not treat as live Admin actions | SAFE_TO_DEFER | Eng |
| Dead notification types in registry | Notifications | Four types never sent; hidden from Admin config toggles | no `sendTyped` | Leave in registry for FK/history | SAFE_TO_DEFER | Eng |
| LO reminder days vs journey PDF | Compliance | One reminder near expiry, not day 3+6 | `deadline-config.ts` | Timing change is a business decision | LEGAL_DECISION | Compliance |
| Signing reminder days vs journey PDF | Compliance | Reminders at configured days-before, not journey 7+12 | `deadline-config.ts` | Same | LEGAL_DECISION | Compliance |
| Notice of Assignment / guarantor / 18% cap | Compliance | Not implemented as gates | repo search | Backlog | LEGAL_DECISION | Compliance |

---

## False positives removed (looked missing; actually covered)

| Appearance | Reality |
|---|---|
| Investor cash withdrawal has no `note_events` | Correct: `note_id` is null. Evidence is `withdrawal_instructions` + wallet + inbox + `/transactions` |
| Successful deposit has no Activity row | Investor Activity is not the wallet. Evidence is `/transactions` and gateway payment (Admin) |
| `ACTIVATE` missing on disbursement | Intentional. Live activation evidence is `WITHDRAWAL_COMPLETED`; investor Activity/inbox use investment-active copy |
| Trustee letters have no customer Activity | Admin note/settlement/withdrawal detail + (for issuer disbursement) trustee-submit inbox |
| Role permissions / finance settings “only last editor” | Append-only `security_logs` with before/after (`ROLE_PERMISSIONS_UPDATED`, `PLATFORM_FINANCE_SETTINGS_UPDATED`) |
| Security CSV “missing” | Access panel export is wired; security panel reuses access export control — operational records still in Security logs UI |
| `APPLICATION_APPROVED` missing writer | Live terminal success is `APPLICATION_COMPLETED`. Approved-invoice display alias is client-side only |
| `CONTRACT_OFFER_REJECTED` missing | Live decline is `CONTRACT_WITHDRAWN` |
| AML never logged | Live path is `ONBOARDING_STATUS_UPDATED` + `metadata.amlApproved`. `AML_APPROVED` is an unused override |
| Offer expiry “looks like Admin” | Cron now `SYSTEM` / `SYSTEM_JOB` / `SYS` |
| No issuer notification on disbursement | `withdrawal_completed` (“Your Disbursement Is Complete”) is live for ISSUER_DISBURSEMENT |
| Settlement trustee email “missing notification” | Direct SES to trustee, not the user inbox registry |
| `SIGNING_PACKAGE_COMPLETED` hidden on Admin timeline | User-facing success is `CONTRACT_OFFER_ACCEPTED`; signed files live on the envelope |
| Product inactivate filters | Unreachable writers; empty filters are not a user-facing gap |
