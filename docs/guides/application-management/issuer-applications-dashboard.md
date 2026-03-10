# Issuer Applications Dashboard — User Flow Guide

This guide explains the Applications dashboard in the Issuer portal. It uses simple language and covers the file structure, user flow, and how to add new statuses.

---

## File Structure

```
apps/issuer/src/app/(application-management)/applications/
├── README.md              — overview of files and data flow
├── page.tsx               — main screen
├── status.ts              — status config + FILTER options + getCardStatus
├── use-applications-data.ts — fetch, prepare for display, hide archived, sort
└── data.ts                — mock data (USE_MOCK_DATA)
```

| File | What it does |
|------|--------------|
| **status.ts** | STATUS (label, color, sort order), FILTER_STATUSES (dropdown options), getCardStatus. Add/remove statuses here. |
| **use-applications-data.ts** | Fetches (mock or API), prepares each app for display (flatten, add cardStatus), hides archived, sorts. |
| **data.ts** | Mock data when USE_MOCK_DATA is true. |
| **page.tsx** | Renders cards, search, filter (Status/Customer/Date), pagination. Filter uses FILTER_STATUSES from status.ts. |

---

## How Data Flows (Step by Step)

**Step 1.** User opens the Applications page.

**Step 2.** `use-applications-data` runs. It either:
   - Loads mock data from `data.ts` (if `USE_MOCK_DATA` is true), or
   - Fetches from the API.

**Step 3.** Each API application goes through `prepareApplication` in use-applications-data. It flattens nested data, calls `getCardStatus`, extracts document keys and offer expiry.

**Step 4.** The page receives the list. For each card it uses STATUS from status.ts for badge label and color, and cardStatus for buttons.

---

## How to Add a New Status

Edit **status.ts** only:

1. Add to `STATUS` object:

```ts
pending_disbursement: { label: "Pending Disbursement", color: "border-blue-500/30 bg-blue-500/10 text-blue-700", sortOrder: 7 },
```

2. Add to `FILTER_STATUSES` if it should appear in the filter:

```ts
export const FILTER_STATUSES = [..., "pending_disbursement"] as const;
```

3. Add an `if` block in `getCardStatus`:

```ts
if (app === "PENDING_DISBURSEMENT") return { badgeKey: "pending_disbursement", displayLabel: "Pending Disbursement", showReviewOffer: false, showMakeAmendments: false };
```

4. (Optional) Add mock data in data.ts for testing.

---

## Status Flow Overview

Applications move through these statuses in order:

```
Draft, Submitted, Under Review, Action Required, Offer Received, Approved
                                                      (or Rejected)
```

---

## Status-by-Status Breakdown

### 1. Draft

**What the user sees:**
- Badge: **Draft** (Gray)
- Card shows "Application ID XXXXXXXX" and type (e.g. Contract financing, Invoice financing)
- If no financing structure yet: simple card with "This application is still being set up."
- If structure exists: full card with contract/invoice details

**Buttons:**
- **Edit Application** (via 3-dot menu)
- **Delete Draft** (via 3-dot menu)
- No Review Offer or Make Amendments

**User can:**
- Edit the application
- Delete the draft
- View details (expand invoice table if structure exists)

**User cannot:**
- Submit (submit is done from the edit flow)
- Review offers

---

### 2. Submitted

**What the user sees:**
- Badge: **Submitted** (Blue)
- Full application details
- Invoice table (if applicable)

**Buttons:**
- No Review Offer or Make Amendments

**User can:**
- View details

**User cannot:**
- Edit (must wait for review)
- Review offers

---

### 3. Under Review

**What the user sees:**
- Badge: **Under Review** (Indigo)
- Full application details
- Invoice table (if applicable)

**Buttons:**
- No Review Offer or Make Amendments

**User can:**
- View details

**User cannot:**
- Edit
- Review offers

---

### 4. Action Required

**What the user sees:**
- Badge: **Action Required** (Amber)
- Full application details
- Invoice table with amendment-requested rows

**Buttons:**
- **Make Amendments** (card-level and/or per-invoice)

**User can:**
- Click Make Amendments to go to the edit flow
- Address the requested changes

**User cannot:**
- Review new offers until amendments are submitted

---

### 5. Offer Received

**What the user sees:**
- Badge: **Offer Received** (Teal)
- Full application details
- Invoice table with offer rows
- **Offer valid until: DD Mon YYYY** under the Review button

**Buttons:**
- **Review Contract Financing Offer** (for contract offers) or **Review Offer** (for invoice-only offers)
- Per-invoice: **Review Offer** (when contract is approved)

**User can:**
- Review and accept/reject the offer

**User cannot:**
- Make amendments (unless amendment is requested)

**Offer expiry:**
- If the offer has expired, the badge shows **Offer expired** (Gray) and the Review button is hidden.
- The expiry date is shown under the Review button when the offer is still valid.

---

### 6. Approved

**What the user sees:**
- Badge: **Approved** (Green)
- Full application details
- Invoice table (all invoices approved)

**Buttons:**
- No Review Offer or Make Amendments

**User can:**
- View details
- Proceed to next steps (e.g. disbursement) from other flows

---

### 7. Rejected

**What the user sees:**
- Badge: **Rejected** (Red)
- Full application details

**Buttons:**
- None

**User can:**
- View details

**User cannot:**
- Edit or resubmit (would require a new application)

---

## Status to Badge Text and Color Reference

| Status            | Badge Text       | Color  |
|-------------------|------------------|--------|
| Draft             | Draft            | Gray   |
| Submitted         | Submitted        | Blue   |
| Under Review      | Under Review     | Indigo |
| Action Required   | Action Required  | Amber  |
| Offer Received    | Offer Received   | Teal   |
| Offer expired     | Offer expired    | Gray   |
| Approved          | Approved         | Green  |
| Rejected          | Rejected         | Red    |

---

## Invoice Table Behavior

### Grayed-Out Invoices (Contract Applications)

For **Contract financing** applications, invoices are locked until the contract is approved.

**When ContractStatus ≠ APPROVED:**
- Gray overlay on the invoice table
- All invoice actions disabled (Review Offer, Make Amendments, document download)
- Helper message above the table: *"Invoices will be available after the contract offer is accepted."*
- Slight opacity reduction on the table
- Only the invoice section is blocked; the card header and contract summary stay interactive

**When ContractStatus = APPROVED:**
- Invoices become interactive
- Review Offer and Make Amendments appear per invoice status

**Invoice-only applications:**
- No contract; invoices are never locked by contract status.

---

## Document Download

Each invoice row has a **Document** column.

**Behavior:**
- Filename is shown as normal text (not a link)
- A download icon appears beside the filename
- Clicking the icon fetches a presigned URL and opens it (download or new tab, depending on server headers)
- Errors show a toast: "Could not get download link"

**When disabled (invoices locked):**
- No download icon
- Filename shown in muted gray
- Clicking does nothing

**Data source:** The document comes from the invoice `details.document` field (S3 key and file name).

---

## Offer Expiry

**Where it appears:**
- Under the card-level Review button (contract or invoice offer)
- Under each invoice row’s Review Offer button

**Format:** `Offer valid until: DD Mon YYYY` (e.g. 25 Mar 2026)

**Data source:** `offer_details.expires_at` from the contract or invoice.

**When expired:**
- Badge changes to "Offer expired"
- Review button is hidden
- User cannot accept the offer

---

## Button Wording

| Context              | Button Text                      |
|----------------------|----------------------------------|
| Contract offer       | Review Contract Financing Offer  |
| Invoice offer        | Review Offer                     |
| Amendment requested  | Make Amendments                  |

---

## Button Layout (Invoice Action Column)

- **Review Offer** and **Make Amendments** use a fixed minimum width (e.g. 140px) for consistent layout
- Offer expiry text appears **below** the button, centered
- Expiry text does not shift the button or break row alignment
- Three-dot action menu is aligned to the right of the button
- Buttons stay vertically aligned across rows

---

## Empty Invoice Table

When there are no invoices:
- The table header row is still shown (Invoice number, Maturity date, etc.)
- A single row displays: *"No invoices available"*
- Layout matches tables that have data

---

## Quick Cheat Sheet: Add a New Status

1. **lib/compute-application-card-status.ts** — Add an `if` block that returns `{ badgeKey, displayLabel, showReviewOffer, showMakeAmendments }`
2. **applications.config.ts** — Add to `STATUS_BADGE_COLORS`, `STATUS_BADGES`, and `STATUS_PRIORITY`
3. **page.tsx** — Add to `STATUS_FILTER_VALUES` and add a `DropdownMenuRadioItem` in the filter
4. **data.ts** (optional) — Add a mock application with your new status to test

---

## Conceptual Overview: How the Whole Thing Works

**Why different names?** The API and database use one set of names; we show the user a friendlier one. The config file links them. When you see two names for the same thing, the first is for code, the second is for display.

- badgeKey "sent" (code) maps to label "Offer Received" (what user sees)
- AMENDMENT_REQUESTED (API) becomes "Action Required" on screen
- badgeKey "accepted" (code) maps to "Approved" (label)

**Where do statuses come from?** Each application has three places: app, contract, invoices. A card shows one badge. `getCardStatus` in status.ts combines them and returns badgeKey + button flags.

**Which status wins?** When the app, contract, and invoices say different things, we use a fixed order. The most urgent one wins.

- Rejected first
- Then Action Required (when admin asked for changes)
- Then Offer Received (when there is an offer to review)
- Then Under Review, Submitted, Draft, Approved last

Example: app says SUBMITTED, one invoice says AMENDMENT_REQUESTED. We show "Action Required" because it comes before SUBMITTED. Another: app UNDER_REVIEW, contract SENT, invoices DRAFT. We show "Offer Received" because SENT beats the rest.

**Many invoices?** If you have 3 invoices with different statuses, we pick the one that wins by the same order. [SENT, DRAFT, APPROVED] becomes SENT. Then we compare that with the app and contract status.

**Order on the page.** `STATUS[key].sortOrder` in status.ts controls list order. Lower number = higher up. Same status: sort by date (newest first).

**Full priority table (list sort order)** — from `status.ts`:

| badgeKey           | Priority | Label           |
|--------------------|----------|-----------------|
| rejected           | 1        | Rejected        |
| pending_amendment  | 2        | Action Required |
| sent               | 3        | Offer Received  |
| under_review       | 4        | Under Review    |
| submitted          | 5        | Submitted       |
| resubmitted        | 6        | Resubmitted     |
| draft              | 7        | Draft           |
| accepted           | 8        | Approved        |
| archived           | 10       | Archived        |

`offer_expired` is a display variant of `sent` (same sort position). Archived apps are hidden from the list. Unknown badgeKeys get priority 999 (bottom).

**Status resolution order (which wins when combining app + contract + invoices)** — from `getCardStatus` in status.ts:

1. Rejected (app or contract)
2. Action Required (contract or any invoice AMENDMENT_REQUESTED)
3. Offer Received (contract or aggregated invoice SENT)
4. Under Review (app UNDER_REVIEW)
5. Submitted (app SUBMITTED)
6. Resubmitted (app RESUBMITTED)
7. Draft (app DRAFT)
8. Approved (app APPROVED)
9. Archived (app ARCHIVED)
10. Default: Draft

**Invoice aggregation order** (when multiple invoices have different statuses):

1. REJECTED
2. AMENDMENT_REQUESTED
3. SENT
4. SUBMITTED
5. DRAFT
6. APPROVED

**Special rules.**

- Contract rejected = whole app rejected. Invoice rejected only = app not rejected.
- Contract financing: invoices grayed out until contract is approved.
- Offer expired = we show "Offer expired" and hide the Review button.

**Full example.** API sends: app UNDER_REVIEW, contract SENT, invoices DRAFT, SENT, APPROVED. We aggregate invoices to SENT. We check: Rejected? No. Action Required? No. SENT? Yes. We return badgeKey "sent". The page looks up "sent" and gets "Offer Received" (teal). It renders that badge and the Review button. The card appears above Draft or Approved (priority 3).

---

## All Scenarios (Input to Output)

Each row: App status, Contract status, Invoice statuses. Result: badge shown and buttons.

**Scenario 1**  
App: REJECTED, Contract: any, Invoices: any  
Result: Badge Rejected. Buttons: none.

**Scenario 2**  
App: any, Contract: REJECTED, Invoices: any  
Result: Badge Rejected. Buttons: none.

**Scenario 3**  
App: SUBMITTED, Contract: any, Invoices: [AMENDMENT_REQUESTED]  
Result: Badge Action Required. Buttons: Make Amendments.

**Scenario 4**  
App: any, Contract: AMENDMENT_REQUESTED, Invoices: any  
Result: Badge Action Required. Buttons: Make Amendments.

**Scenario 5**  
App: UNDER_REVIEW, Contract: SENT, Invoices: [DRAFT, SENT, APPROVED]  
Result: Badge Offer Received. Buttons: Review Offer.

**Scenario 6**  
App: UNDER_REVIEW, Contract: SENT, Invoices: [DRAFT]  
Result: Badge Offer Received. Buttons: Review Offer.

**Scenario 7**  
App: UNDER_REVIEW, Contract: none, Invoices: [SENT]  
Result: Badge Offer Received. Buttons: Review Offer.

**Scenario 8**  
App: UNDER_REVIEW, Contract: any, Invoices: any  
Result: Badge Under Review. Buttons: none.

**Scenario 9**  
App: SUBMITTED, Contract: any, Invoices: [DRAFT, SUBMITTED]  
Result: Badge Submitted. Buttons: none.

**Scenario 10**  
App: DRAFT, Contract: any, Invoices: any  
Result: Badge Draft. Buttons: none.

**Scenario 11**  
App: APPROVED, Contract: any, Invoices: any  
Result: Badge Approved. Buttons: none.

**Scenario 12**  
App: ARCHIVED, Contract: any, Invoices: any  
Result: Badge Archived. App is hidden from the list.

**Scenario 13**  
App: UNDER_REVIEW, Contract: SENT, Invoices: [DRAFT] and offer expired  
Result: Badge Offer expired. Buttons: none (Review hidden).
