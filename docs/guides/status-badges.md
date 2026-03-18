# Status Badges Guide

Centralized status badge config for application, product, and admin pages. Single source of truth in `packages/config/src/status-badges.ts`.

**Dev-only showcase:** In development, visit `/dev/status-examples` (issuer app) to see all status badges.

## Color Groups (by meaning)

| Group | Meaning | Statuses | Bg | Text |
|-------|---------|----------|-----|-----|
| **action** | User must act | Draft, Amendment Requested | #FEFCE8 | #CA8A04 |
| **submitted** | Waiting for admin | Submitted, Resubmitted | #EFF6FF | #2563EB |
| **in-progress** | Admin processing | Under Review, Contract Pending/Sent, Invoice Pending/Sent | #EEF2FF | #4F46E5 |
| **success** | Done | Approved, Completed, Offer Sent, Contract Accepted | #ECFDF2 | #15803D |
| **rejected** | Negative outcome | Rejected, Withdrawn | #FEF2F2 | #DC2626 |
| **neutral** | Inactive | Pending, Archived | #F1F5F9 | #64748B |

Classes: `bg-status-{group}-bg text-status-{group}-text`. Add `packages/config/src` to Tailwind content.

## Labels

| API Status | Label |
|------------|-------|
| DRAFT | Draft |
| SUBMITTED | Submitted |
| UNDER_REVIEW | Under Review |
| CONTRACT_PENDING | Contract Pending |
| CONTRACT_SENT | Contract Sent |
| CONTRACT_ACCEPTED | Contract Accepted |
| INVOICE_PENDING | Invoice Pending |
| INVOICES_SENT | Invoices Sent |
| OFFER_SENT | Offer Sent |
| AMENDMENT_REQUESTED | Amendment Requested |
| RESUBMITTED | Resubmitted |
| APPROVED | Approved |
| COMPLETED | Completed |
| REJECTED | Rejected |
| WITHDRAWN | Withdrawn (or formatWithdrawLabel) |
| ARCHIVED | Archived |
| PENDING | Pending |

**Issuer display overrides:** `amendment_requested` / `pending_amendment` → "Action Required"; `offer_sent` → "Offer Received".

## Usage

**Admin (ApplicationStatusBadge, ReviewStepStatusBadge):**
```ts
import { getReviewStatusPresentation } from "@/components/application-review/status-presentation";
const { label, badgeClass, iconClass, dotClass } = getReviewStatusPresentation(status);
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

## Badge Class Pattern

Amendment: `bg-[#FEFCE8] text-[#CA8A04]`. Success: `bg-[#ECFDF2] text-[#15803D]`. Others: `bg-{color}-100 text-{color}-600/700`.
