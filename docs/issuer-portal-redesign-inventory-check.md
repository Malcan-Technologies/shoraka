# Issuer Portal redesign — §6 inventory check

**Date:** 2026-08-03  
**Source:** [issuer-portal-redesign-plan.md](./issuer-portal-redesign-plan.md) §6 (118 actions)

## Result

**All 118 inventory rows mapped; no gaps found.**

Spot-checked blockers called out in Stage F:

| Check | Status |
|---|---|
| List → detail Offer tab (no modal on applications list) | OK — slim card links to `/applications/[id]?tab=offer`; live path is `OfferReviewPanel` inline |
| Withdraw / delete confirms | OK — `ConfirmDialog` on list + detail |
| Financing Review Offer → application Offer tab | OK — `financingOfferHref()` |
| Redirects in `next.config` | OK — `/?tab=activity` → `/activity`; `/notes`, `/notes/:id`, `/applications/edit/:id` → `/applications/[id]/edit` |
| Members tab on Organisation (`/profile`) | OK |
| Sidebar: Organisation, My account; Activity is a Work item | OK — Work: Dashboard / Activity / Applications / Financing; Settings: Organisation / My account / Help |
| Signing return | OK — `/signing/return` confirms via `/v1/signing/return/:id/confirm` (no `?signing=complete`) |
| Invoice detail page with content | OK — `/financing/invoices/[id]` |
| Draft saved indicator on wizard footer | OK — `StickyFormFooter` + “Draft saved” on edit wizard |

## Intentional deferred / naming notes (not missing actions)

- **Activity uses `ListToolbar` + shared `Pagination` + `StatusBadge`** on `/activity`. Dashboard shows a five-row preview that links to `/activity`. `/?tab=activity` redirects to `/activity`.
- **List search/filters** use shared `@cashsouk/ui` `ListToolbar` + `ListToolbarFilterTrigger` (funnel icon, count badge, `Search: …` chip) across issuer, investor, landing, and admin list pages.
- **“Portfolio” in the plan is shipped as “Financing”** at `/financing` (and `/financing/contracts|invoices|notes/[id]`). Nav label and routes use Financing; actions map 1:1 to plan destinations under that name.
- **Application Invoices tab still uses `ScrollableInvoiceTable`** rather than shared `DataTable` (rows 25–35). Column set, tooltips, row actions, and withdraw confirms are preserved.

## Static clarity (chrome)

- Sidebar nav label is **Organisation** (not “Profile”).
- **Portfolio** does not appear as a user-facing nav label.
- Residual “Profile” copy exists outside chrome (Organisation page tab name, accept-invitation “Go to Profile”, name-entry “Complete Your Profile”) — optional follow-up, not inventory blockers.
