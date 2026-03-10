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
2. **Prepare** — API returns nested objects (contract, invoices, offer_details). We flatten them, add cardStatus (badge, buttons), extract document keys and offer expiry. Done in use-applications-data via prepareApplication.
3. **Filter** — Archived apps are hidden
4. **Sort** — By status (rejected first, draft last), then by date
5. **Page** — Renders cards. Uses STATUS from status.ts for badge label/color. Filter dropdown uses FILTER_STATUSES.

## Filter

All filter config is in status.ts:

- **FILTER_STATUSES** — Which statuses appear in the Status dropdown. Add/remove here.
- **STATUS** — Label and color for each status. Page uses this for badge and filter option labels.

Filter logic (search, status filter, customer filter) lives in page.tsx. It filters the list before pagination.
