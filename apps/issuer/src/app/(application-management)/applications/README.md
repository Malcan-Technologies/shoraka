# Applications Dashboard

List of financing applications. User sees cards with status badges, invoice tables, and actions.

## Files

| File | What it does |
|------|--------------|
| **page.tsx** | The screen. Renders cards, search, filter, pagination. |
| **status.ts** | Status config (label, color, sort order) and logic. Add/remove statuses here. Filter options come from here. |
| **use-applications-data.ts** | Fetches data (mock or API), prepares each app for display (flatten, add cardStatus), hides archived, sorts. |
| **data.ts** | Mock data when USE_MOCK_DATA is true. |

## Data flow

1. **Fetch** — use-applications-data calls API (or loads mock from data.ts)
2. **Prepare** — API returns nested objects (contract, invoices, offer_details). We flatten them, add cardStatus (badge, buttons), extract document keys. Done in use-applications-data via prepareApplication.
3. **Filter** — Archived apps are hidden
4. **Sort** — By status (rejected first, draft last), then by date
5. **Page** — Renders cards. Uses STATUS from status.ts for badge label/color. Filter dropdown uses FILTER_STATUSES.

## Filter

Issuer-focused filters answer: "Which applications need action? What type? When submitted?"

| Filter | Options | Purpose |
|--------|---------|---------|
| **Status** | All, Draft, Submitted, Under Review, Action Required, Offer Received, Approved, Rejected | Application status (card badge) |
| **Financing** | All, Contract financing, Invoice financing | Financing type |
| **Date** | Application created, Application submitted | Each: All time, Last 7/30/90 days. Created uses applicationDate; submitted uses submittedAt. |
| **Search** | Application ID, customer, invoice number | Text search |

Config in status.ts: FILTER_STATUSES, FINANCING_TYPES. Filter logic in page.tsx.
