# Status Badges Guide

Centralized status badge config for application, product, and admin pages. Single source of truth in `packages/config/src/status-badges.ts`.

## Color Palette (Tailwind)

| Variant | Color | Statuses |
|---------|-------|----------|
| **success** | `emerald-500` | Approved, Completed, Offer Sent, Contract Accepted |
| **in-progress** | `blue-500` | Submitted, Under Review, Contract Pending/Sent, Invoice Pending/Sent |
| **action** | `amber-500` | Draft, Amendment Requested, Resubmitted |
| **rejected** | `red-500` | Rejected |
| **neutral** | `slate-500` | Pending, Archived, Withdrawn |
| **expired** | `amber-500` | Withdrawn (Offer expired) |

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

All badges use: `border-transparent bg-{color}-500/10 text-{color}-600` (or `-700` for emerald/amber).
