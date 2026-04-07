# Notification Testing Guide

This guide explains:

- what each notification type means,
- how it is triggered in the app,
- and how to test it quickly.

## Amendment notification

- `application_amendments_requested`
  - Sent immediately when admin submits amendments to issuer.
  - Trigger source: admin review flow submit action.
  - This is the only amendment-action notification.

## Where to verify notifications

- In-app:
  - bell dropdown in header
  - `/notifications` page in investor/issuer portals
- Email:
  - SES delivery output and inbox
- Admin config:
  - Admin portal `Settings -> Notification Management`
  - portal-scope tabs (`Investor`, `Issuer`, `Both`)

---

## Current notification matrix

### Both portals (`Investor` + `Issuer`)

| Type ID | Auto-triggered? | Trigger source | How to test |
|---|---|---|---|
| `password_changed` | Yes | Auth service password change flow | Change password from account settings; verify in-app and email. |
| `login_new_device` | No (currently not wired) | Type exists but no current sender call | Send manually from Admin Notification panel (Custom & Groups) using this type. |
| `kyc_approved` | No (currently not wired) | Type exists but no current sender call | Send manually from Admin Notification panel. |
| `kyc_rejected` | No (currently not wired) | Type exists but no current sender call | Send manually from Admin Notification panel. |
| `onboarding_approved` | Yes | Admin final onboarding approval | Complete final approval in onboarding admin flow. |
| `onboarding_rejected` | Yes | RegTank webhook handlers | Use a rejected onboarding webhook payload in test env, or send manually from admin panel for smoke test. |
| `system_announcement` | Manual | Admin bulk notification tool | Create and send from admin panel. |

### Investor-only

| Type ID | Auto-triggered? | Trigger source | How to test |
|---|---|---|---|
| `new_product_alert` | Manual (by admin) | Admin bulk notification tool | Send from admin panel targeting investors. |

### Issuer-only (application lifecycle)

| Type ID | Auto-triggered? | Trigger source | How to test |
|---|---|---|---|
| `application_amendments_requested` | Yes | Admin `submitPendingAmendments` | Add pending amendments in application review, then click "Request Amendment". |
| `application_approved` | Yes | Admin application status update | In admin review page, approve the application. |
| `application_rejected` | Yes | Admin application status update | In admin review page, reject the application. |
| `contract_offer_sent` | Yes | Admin `sendContractOffer` | Send contract offer from admin application review. |
| `invoice_offer_sent` | Yes | Admin `sendInvoiceOffer` | Send invoice offer from admin application review. |
| `offer_retracted_or_reset` | Yes | Admin reset/retract flows | Reset contract/invoice offer to pending after sending it. |
| `offer_expired` | Yes | Offer expiry job | Create expired offer data and run offer expiry job manually. |
| `offer_expiry_reminder_24h` | Yes | Offer expiry job (24h window reminder) | Create offer expiring within next 24h, run offer expiry job manually. |
| `application_resubmitted_confirmation` | Yes | Issuer resubmit flow | In issuer portal, resubmit an amended application. |
| `application_withdrawn_confirmation` | Yes | Issuer cancellation/offer-reject withdrawal path | Cancel application or reject offer in issuer portal. |
| `application_completed` | Yes | Issuer offer acceptance completion path | Accept final required offer(s) until application becomes `COMPLETED`. |

---

## Fast test commands

Run from repo root:

```bash
pnpm --filter @cashsouk/api run run-offer-expiry
```

Notes:

- This command processes both:
  - expired offer notifications (`offer_expired`)
  - 24h reminder notifications (`offer_expiry_reminder_24h`)
## Suggested smoke test checklist

- Issuer app:
  - [ ] Send amendment request -> issuer receives `application_amendments_requested`
  - [ ] Resubmit from issuer -> `application_resubmitted_confirmation`
  - [ ] Send contract offer -> `contract_offer_sent`
  - [ ] Reset/retract contract offer -> `offer_retracted_or_reset`
  - [ ] Approve application -> `application_approved`
  - [ ] Reject application -> `application_rejected`
- Scheduled:
  - [ ] Expired offer -> `offer_expired`
  - [ ] Offer expiring in 24h -> `offer_expiry_reminder_24h`

---

## Source references

- Type definitions/seed:
  - `apps/api/src/modules/notification/registry.ts`
  - `apps/api/src/modules/notification/seed-data.ts`
- Trigger sources:
  - `apps/api/src/modules/admin/service.ts`
  - `apps/api/src/modules/applications/service.ts`
  - `apps/api/src/lib/jobs/offer-expiry.ts`
  - `apps/api/src/modules/auth/service.ts`
  - `apps/api/src/modules/regtank/webhooks/cod-handler.ts`
  - `apps/api/src/modules/regtank/webhooks/individual-onboarding-handler.ts`
