# Status Badges Guide

Centralized status badge config for application, product, and admin pages. Single source of truth in `packages/config/src/status-badges.ts`.

**Dev-only showcase:** In development, visit `/dev/status-examples` (issuer app) to see all status badges.

## Colour groups (four semantics + neutral)

| Group | Meaning | Tailwind tokens | Bg | Text |
|-------|---------|-----------------|-----|-----|
| **issuer_action** | Issuer must act | `status.action` | `#FEFCE8` | `#854D0E` |
| **admin_action** | Waiting on CashSouk | `status.submitted` | `#EFF6FF` | `#1E40AF` |
| **completed** | Success / signed | `status.success` | `#D1FAE5` | `#065F46` |
| **expired_closed** | Negative / closed | `status.rejected` | `#FEF2F2` | `#991B1B` |
| **neutral** | Inactive | `status.neutral` | `#F1F5F9` | `#334155` |

Classes: `bg-status-{token}-bg text-status-{token}-text` (e.g. issuer_action uses `status.action` tokens).

Indigo (`status.in-progress`) is no longer used for application status badges.

## Application status → group

| Group | Application statuses |
|-------|---------------------|
| issuer_action | AMENDMENT_REQUESTED, CONTRACT_SENT, INVOICES_SENT, OFFER_SENT |
| admin_action | SUBMITTED, RESUBMITTED, UNDER_REVIEW, CONTRACT_PENDING, INVOICE_PENDING, CONTRACT_ACCEPTED, INVOICE_ACCEPTED, SIGNING_PENDING |
| completed | COMPLETED; also APPROVED for section/item/contract/invoice review badges (not ApplicationStatus) |
| expired_closed | REJECTED, DECLINED, OFFER_EXPIRED. Admin raw `WITHDRAWN` also uses this group |
| neutral | DRAFT, PENDING, ARCHIVED. Issuer card `withdrawn` is grey |

Issuer **card badge keys:** `completed` → green (`completed` / `success`). `withdrawn` → grey (`neutral`). `draft` → grey. Yellow/blue on user portals are viewer-centric (you vs them); admin uses the inverse via `getAdminStatusToken`.

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

- Shape: `rounded-full` (`StatusBadge`) in admin tables
- Type: `text-ui font-normal` (do not bold badge labels; darker status text tokens provide contrast)
- Padding: `px-2.5 py-0.5` (Badge / StatusBadge default)
- Compact (steppers, count chips): `StatusBadge` `size="sm"` (`text-meta px-1.5 py-0`)
- Admin `sm`: same compact size
- Issuer list pills share the same type size. Do not pass `text-[Npx]` or `font-semibold` on chips.

## Admin tables

Canonical chrome and colour map: **BRANDING.md §3.2**.

Admin list badges use `StatusBadge` from `@cashsouk/ui`:

- **Company / Personal:** same chip everywhere, text only (no dot). Company = blue (`submitted`), Personal = grey (`neutral`).
- **Investor / Issuer:** `PortalBadge` — Investor = earth brown (investor portal), Issuer = brand red (issuer portal). Identity chips are text only (no marker). Account **portal access** uses `access`: circled check in brand colour when granted, muted X when not. Do not paint access chips green.
- **Verified / Required:** `VerifiedBadge` / `RequiredBadge` — green success chip + solid circled check (`CheckCircleIcon`). Same chrome as other status pills.
- **User roles:** `UserRoleBadges` — Investor/Issuer via `PortalBadge`; Admin is a purple (`violet`) chip with the same chrome. Do not map Admin to a status token.
- **Status:** colour dot + label.
  - Yellow (`action`): admin must act (submitted, under review, pending approval, gateway Paid)
  - Blue (`submitted`): waiting on issuer / investor / signers / trustee (offer sent, amendment requested, funding open)
  - Violet (`active`): live / in force (Active · servicing, investment Confirmed)
  - Green (`success`): completed / approved / settled / repaid / signed
  - Grey (`neutral`): draft / idle / cancelled / refunded
  - Red (`rejected`): rejected / failed / withdrawn / expired / void / defaulted / arrears

Issuer and investor portals use the same six tokens with yellow/blue flipped for the viewer (yellow = you must act). Map with `badgeKeyToStatusToken` / `getUserPortalStatusToken` — not `getAdminStatusToken`. Completed is green; draft and withdrawn are grey. Do not use indigo or sky on user-portal workflow chips.

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

**Admin (ApplicationStatusBadge, ReviewStepStatusBadge, tables):**
```ts
import { StatusBadge } from "@cashsouk/ui";
import { getAdminStatusToken } from "@/lib/admin-status-token";
<StatusBadge label={label} status={getAdminStatusToken(status)} />
```

Company / Personal type chips:
```ts
import { OrganizationTypeBadge } from "@/components/organization-type-badge";
<OrganizationTypeBadge type={organization.type} />
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
