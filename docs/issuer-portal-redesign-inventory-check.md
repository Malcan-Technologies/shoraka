# Issuer Portal redesign — §6 inventory check

**Date:** 2026-08-03  
**Source:** [issuer-portal-redesign-plan.md](./issuer-portal-redesign-plan.md) §6 (118 actions)

## Result

**All 118 inventory rows mapped; no gaps found.**

Spot-checked blockers called out in Stage F:

| Check | Status |
|---|---|
| List → detail Offer tab (no modal on applications list) | OK — slim card links to `/applications/[id]?tab=offer`; list does not host `ReviewOfferModal` |
| Withdraw / delete confirms | OK — `ConfirmDialog` on list + detail |
| Financing Review Offer → application Offer tab | OK — `financingOfferHref()` |
| Redirects in `next.config` | OK — `/activity`, `/notes`, `/notes/:id`, `/applications/edit/:id` |
| Members tab on Organisation (`/profile`) | OK |
| Sidebar: Organisation, My account; no Activity/Notes top-level | OK — Work: Dashboard / Applications / Financing; Settings: Organisation / My account / Help |
| Signing return on list + detail | OK — `?signing=complete` handlers on both |
| Invoice detail page with content | OK — `/financing/invoices/[id]` |
| Draft saved indicator on wizard footer | OK — `StickyFormFooter` + “Draft saved” on edit wizard |

## Intentional deferred / naming notes (not missing actions)

- **Activity still uses `ActivityToolbar`** (rows 79–84) instead of `ListToolbar` / `DataTable` / shared `Pagination`. Behaviour (search, domain filters, date range, clear/reload, paginated rows) is preserved on Dashboard → Activity tab (`/?tab=activity`).
- **“Portfolio” in the plan is shipped as “Financing”** at `/financing` (and `/financing/contracts|invoices|notes/[id]`). Nav label and routes use Financing; actions map 1:1 to plan destinations under that name.
- **Application Invoices tab still uses `ScrollableInvoiceTable`** rather than shared `DataTable` (rows 25–35). Column set, tooltips, row actions, and withdraw confirms are preserved.
- **Unused modal wrappers remain** (`ReviewOfferModal.tsx`, `components/review-offer-modal.tsx`) but are not wired from list/financing flows; live path is Offer tab + `OfferReviewPanel`.

## Static clarity (chrome)

- Sidebar nav label is **Organisation** (not “Profile”).
- **Portfolio** does not appear as a user-facing nav label.
- Residual “Profile” copy exists outside chrome (Organisation page tab name, accept-invitation “Go to Profile”, name-entry “Complete Your Profile”) — optional follow-up, not inventory blockers.
