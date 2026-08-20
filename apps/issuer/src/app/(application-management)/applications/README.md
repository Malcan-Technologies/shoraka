# Applications Dashboard

List of financing applications. Actionable items sit in a taller-card carousel at the top; search and filters apply only to the slim list below.

## Files

| File | What it does |
|------|--------------|
| **page.tsx** | The screen. Renders attention carousel, slim cards, search, filter, pagination. Dev-only Debug Panel for skeleton/mock testing. |
| **application-list-search.ts** | Client-side list search: display refs, short ids, customer, invoice numbers. |
| **status.ts** | Status config (label, color, sort order) and logic. Add/remove statuses here. Filter options come from here. |
| **use-applications-data.ts** | Fetches from API. Accepts debug overrides (skeleton, mock) for dev testing. Prepares each app for display. |
| **dev/mockApplications.ts** | Mock generator for Debug Panel. Generates NormalizedApplication cards with varied lifecycle states. |
| **components/application-card-model.ts** | Headline amount, sub-status, and primary action logic shared by slim and attention cards. |
| **components/application-card-menu.tsx** | Overflow menu (view, withdraw, delete draft, view signed offer). |
| **components/application-attention-card.tsx** | Taller card for the needs-attention carousel. |

## Data flow

1. **Fetch** — use-applications-data calls API (or uses debug mock when Debug Panel injects mock data)
2. **Prepare** — API returns nested objects (contract, invoices, offer_details). We flatten them, add cardStatus (badge, buttons), extract document keys. Done in use-applications-data via prepareApplication.
3. **Filter** — Archived apps are hidden
4. **Sort** — By status (rejected first, draft last), then by date
5. **Page** — Renders cards. Uses STATUS from status.ts for badge label/color. Filter dropdown uses FILTER_STATUSES.

Card headline amounts follow the current stage: invoice or facility offer when one is outstanding, approved facility once the line is in force, otherwise requested financing. Contract value is not used.

## Filter

Issuer-focused filters answer: "Which applications need action? What type? When submitted?"

| Filter | Options | Purpose |
|--------|---------|---------|
| **Status** | All, Draft, Submitted, Under Review, Action Required, Offer Received, Approved, Rejected | Application status (card badge) |
| **Financing** | All, Facility financing, Invoice financing | Financing type |
| **Date** | Application created, Application submitted | Each: All time, Last 7/30/90 days. Created uses applicationDate; submitted uses submittedAt. |
| **Customer** | All, or customer name | Filter by customer. |
| **Search** | Reference (`APP-ARF-…` / short id), customer, invoice number or `INV-ARF-…` | Client-side text search. Hyphens optional. |

Config in status.ts: FILTER_STATUSES, FINANCING_TYPES. Search matching in application-list-search.ts; other filter logic in page.tsx.
