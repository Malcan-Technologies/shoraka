# Activity Log Authoring Guide

This guide defines how to add user-facing items to the investor and issuer `/activity` feed.

## Purpose

The `/activity` page is a user timeline, not a raw audit trail.

A log should appear here only when it helps a user answer one of these questions:

- What major milestone did I reach?
- Does this need my attention?
- Is this flow finished, blocked, or closed?

If the event is only useful for admin audit, debugging, or detailed review traceability, keep it in the audit logs and do not surface it in `/activity`.

## Current implementation points

- Shared API contract: `packages/types/src/index.ts`
- Shared domain badge config: `packages/types/src/activity-config.ts`
- Adapter base contract: `apps/api/src/modules/activity/adapters/base.ts`
- Onboarding feed shaping: `apps/api/src/modules/activity/adapters/organization-log.ts`
- Application feed shaping: `apps/api/src/modules/activity/adapters/application-log.ts`
- Note feed shaping: `apps/api/src/modules/activity/adapters/note-log.ts`
- Shared row UI: `packages/ui/src/components/activity-item.tsx`
- Shared badge UI: `packages/ui/src/components/activity-badge.tsx`
- Shared toolbar UI: `packages/ui/src/components/activity-toolbar.tsx`

## Feed fields

Each visible activity item must provide:

- `domain`: high-level area such as `onboarding`, `application`, or later `note`
- `title`: short event name users can scan quickly
- `description`: one sentence that explains what happened or whether action is needed
- `references` for `application` domain rows when a stable application, contract, or invoice reference exists

`activity` remains as a backward-compatible alias for `title`, but new work should treat `title` and `description` as the source of truth.

Use a structured `references` object instead of asking the UI to inspect raw metadata:

- `applicationId`
- `applicationReference`
- `contractId`
- `contractNumber`
- `invoiceId`
- `invoiceNumber`

Keep `applicationId` as the raw ID and expose the visible issuer-style label separately as `applicationReference`. For contract and invoice rows, prefer `contractNumber` or `invoiceNumber`; keep the underlying IDs as fallback data.

The adapter should weave these references into the sentence itself, not bolt them on as labels or a separate metadata row. Prefer natural phrasing such as `An invoice offer for invoice INV-12872 is ready for your review and response.`

## Domain rules

Use domains to answer "what part of the product is this about?"

- `onboarding`
  - Organization setup and approval lifecycle
- `application`
  - Financing application lifecycle, offers, and major status changes
- `note`
  - Curated note lifecycle milestones only

Choose the narrowest stable domain that a user would recognize. Do not invent a new domain for one-off internal mechanics.

## Visibility rules

Show an event in `/activity` only if it is one of these:

- a major milestone
- a terminal outcome
- an explicit attention-needed state

Hide events that are mostly implementation noise, such as:

- step-by-step progress chatter
- section-level and item-level review states
- internal resets or status churn that do not change the user’s next action
- sub-approvals that are only meaningful to operations or compliance teams

## Writing a good title

A title should be short, scannable, and event-shaped.

Good patterns:

- `Application Submitted`
- `Changes Requested`
- `Onboarding Approved`
- `Offer Expired`

Avoid:

- implementation wording like `SECTION_REVIEWED_APPROVED`
- vague titles like `Status Updated`
- titles that duplicate low-level system mechanics instead of the user outcome

## Writing a good description

A description should be exactly one sentence and should answer:

- what happened
- whether the user needs to do anything

Good examples:

- `Your financing application was submitted and is now under review.`
- `We need updates to your application before it can continue.`
- `Your organization onboarding was approved and no further action is needed.`

Avoid descriptions that are:

- too detailed
- too technical
- redundant with the title
- so generic that they add no value, such as `An update occurred.`

## Adapter checklist

When adding a new user-facing activity:

1. Decide whether it belongs in the feed at all.
2. Assign the correct `domain`.
3. Add or update the adapter allowlist so only important events are returned.
4. Return a clear `title` and one-sentence `description` from the adapter presentation builder.
5. Include `references` for application-domain rows whenever the log has a stable application, contract, or invoice identifier.
6. Keep copy user-facing and outcome-oriented.
7. Add or update focused adapter tests for:
   - visibility allowlisting
   - `title`
   - `description`
   - `domain`
   - `references` when applicable
8. Update `docs/guides/activity-log-inventory.md` if the visible feed changes.

## Note domain rules

The `note` domain is now used for curated note lifecycle milestones only.

- shared note events should be reserved for major state changes that materially affect both issuer and investor portals
- issuer-only note events should cover origination, listing, and issuer repayment workflow milestones
- investor-only note events should cover the investor organization’s own commitment or return milestones
- when both repayment receipt and settlement payout exist in the lifecycle, prefer the investor-visible payout milestone instead of surfacing both
- do not surface raw `investor_balance_transactions` rows in `/activity`; those belong on `/transactions` and note-detail money views
- hide trustee, Shoraka, settlement-approval, and other operational steps unless they are the clearest user-facing milestone

## Rule of thumb

If a user would not miss the event after reading the timeline once, it probably does not belong in `/activity`.
