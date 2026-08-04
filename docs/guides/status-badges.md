# Status Badges Guide

Centralized status badge config for application, product, and admin pages. Single source of truth in `packages/config/src/status-badges.ts`.

**Dev-only showcase:** In development, visit `/dev/status-examples` (issuer app) to see all status badges.

## Colour groups (four semantics + neutral)

| Group | Meaning | Tailwind tokens | Bg | Text |
|-------|---------|-----------------|-----|-----|
| **issuer_action** | Issuer must act | `status.action` | `#FEFCE8` | `#CA8A04` |
| **admin_action** | Waiting on CashSouk | `status.submitted` | `#EFF6FF` | `#2563EB` |
| **completed** | Success / signed | `status.success` | `#D1FAE5` | `#047857` |
| **expired_closed** | Negative / closed | `status.rejected` | `#FEF2F2` | `#DC2626` |
| **neutral** | Inactive | `status.neutral` | `#F1F5F9` | `#475569` |

Classes: `bg-status-{token}-bg text-status-{token}-text` (e.g. issuer_action uses `status.action` tokens).

Indigo (`status.in-progress`) is no longer used for application status badges.

## Application status → group

| Group | Application statuses |
|-------|---------------------|
| issuer_action | DRAFT, AMENDMENT_REQUESTED, CONTRACT_SENT, INVOICES_SENT, OFFER_SENT |
| admin_action | SUBMITTED, RESUBMITTED, UNDER_REVIEW, CONTRACT_PENDING, INVOICE_PENDING, CONTRACT_ACCEPTED, INVOICE_ACCEPTED, SIGNING_PENDING |
| completed | COMPLETED; also APPROVED for section/item/contract/invoice review badges (not ApplicationStatus) |
| expired_closed | REJECTED, WITHDRAWN, DECLINED, OFFER_EXPIRED |
| neutral | PENDING, ARCHIVED |

## Offer acceptance phase → group

Use `getOfferAcceptancePhaseBadgeClass(status)` from `@cashsouk/config`.

| Group | Phases |
|-------|--------|
| issuer_action | PENDING_ISSUER, CHANGES_REQUESTED |
| admin_action | PENDING_ADMIN_REVIEW, APPROVED_FOR_SIGNING, SIGNING_IN_PROGRESS |
| completed | COMPLETED |
| expired_closed | REJECTED, DECLINED |

Labels stay in `getOfferAcceptanceStatusPresentation` (`@cashsouk/types`).

**Issuer card override:** application list/card badges map Step 3 (`APPROVED_FOR_SIGNING` / `SIGNING_IN_PROGRESS`) to **Offer Received** (`offer_sent` / issuer_action) so signing work stays high in the filter sort. Admin Acceptance-tab phase badges still use the table above.

## Signing envelope → group

Use `getSigningEnvelopeBadgeClass(status)` from `@cashsouk/config`.

| Group | Envelope statuses |
|-------|-------------------|
| neutral | DRAFT |
| issuer_action | SENT, IN_PROGRESS |
| completed | COMPLETED |
| expired_closed | DECLINED, VOIDED, EXPIRED |

## Badge sizing (application / offer / envelope)

- Shape: `rounded-md` (admin Badge)
- Type: `text-xs font-semibold`
- Padding: `px-2.5 py-0.5` (Badge default)
- Admin `sm`: `text-xs px-1.5 py-0`
- Issuer list pills may use `rounded-full px-3 py-1` but share the same colour groups

## Labels

| API Status | Label |
|------------|-------|
| DRAFT | Draft |
| SUBMITTED | Submitted |
| UNDER_REVIEW | Under Review |
| CONTRACT_PENDING | Contract Pending |
| CONTRACT_SENT | Contract Sent |
| CONTRACT_ACCEPTED | Contract Accepted |
| INVOICE_ACCEPTED | Invoice Accepted |
| SIGNING_PENDING | Signing Pending |
| INVOICE_PENDING | Invoice Pending |
| INVOICES_SENT | Invoices Sent |
| OFFER_EXPIRED | Offer Expired |
| OFFER_SENT | Offer Sent |
| AMENDMENT_REQUESTED | Amendment Requested |
| RESUBMITTED | Resubmitted |
| COMPLETED | Completed |
| REJECTED | Rejected |
| WITHDRAWN | Withdrawn (or formatWithdrawLabel) |
| ARCHIVED | Archived |
| PENDING | Pending |

**ARCHIVED:** Never shown in admin or issuer listing or filter. Excluded from both; API excludes ARCHIVED from admin applications list.

**Admin vs Issuer:**
- Admin: raw labels (Contract Pending, Contract Sent, Invoice Pending, Invoices Sent).
- Issuer card: collapsed to "Under Review" for those; uses getStatusPresentationByBadgeKey.

**AMENDMENT_REQUESTED:** API status. Mapped to badge key `amendment_requested` → "Action Required".

**Issuer display overrides:** `offer_sent` → "Offer Received".

## Usage

**Admin (ApplicationStatusBadge, ReviewStepStatusBadge):**
```ts
import { getReviewStatusPresentation } from "@/components/application-review/status-presentation";
const { label, badgeClass, iconClass, dotClass } = getReviewStatusPresentation(status);
```

**Acceptance phase badge:**
```ts
import { getOfferAcceptancePhaseBadgeClass } from "@cashsouk/config";
<Badge className={getOfferAcceptancePhaseBadgeClass(acceptance.status)}>{label}</Badge>
```

**Signing envelope badge:**
```ts
import { getSigningEnvelopeBadgeClass } from "@cashsouk/config";
<Badge className={getSigningEnvelopeBadgeClass(envelope.status)}>{label}</Badge>
```

**Issuer (inline badges, invoice):**
```ts
import { getStatusColorAndLabel } from "@cashsouk/config";
const { color, label } = getStatusColorAndLabel(apiStatus, withdrawReason);
```

**Issuer (card badge by badgeKey):**
```ts
import { getStatusPresentationByBadgeKey } from "@cashsouk/config";
const { color, label } = getStatusPresentationByBadgeKey(badgeKey, withdrawReason);
```
