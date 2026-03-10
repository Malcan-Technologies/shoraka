# How to Test the Applications Dashboard (Mock Data)

This guide tells you how to test each scenario on the Applications dashboard. Use simple English.

## Turn on Mock Data

In `apps/issuer/src/app/(application-management)/applications/data.ts`:

```ts
export const USE_MOCK_DATA = true;
```

When `true`, the page uses fake data. When `false`, it fetches from the real API.

---

## What to Look For

When you open `/applications`, you see cards. Each card is one application.

| Scenario | What You Should See |
|----------|---------------------|
| Draft without structure | Generic draft card. Shows "Application ID X — Application". Status: Draft. Button: "Continue Application". No invoice table. |
| Draft invoice financing | Invoice financing card. Shows "Invoice financing". Status: Draft. Has invoices. Dropdown: Edit Application, Delete Draft. |
| Draft contract financing | Contract financing card. Shows contract title, customer, contract value. Status: Draft. |
| Under review | Card shows "Under Review" badge. |
| Pending approval | Card shows "Pending Approval" badge. |
| Pending amendment | Card shows "Action Required" badge. Button: "Make Amendment". |
| Contract offer received | Card shows "Offer Received" badge. Button: "Review Offer". |
| Invoice offer received | Card shows "Offer Received" badge. Invoice row has "Review Offer" button when contract is approved. |
| Offer expired | Card shows "Offer expired" badge. Buttons are disabled. |
| Offer accepted | Card shows "Accepted" badge. |
| Offer rejected | Card shows "Rejected" badge. |
| Retraction | No offer badge. No Review Offer button. |

---

## Rules to Check

1. **Generic draft card**  
   If status is Draft and there is no financing structure, you see a simple card with "Continue Application" only. No invoice table.

2. **Offer received**  
   When an offer is received, you see the badge and the "Review Offer" button.

3. **Offer expired**  
   When the offer is expired, you see the badge but the buttons are disabled.

4. **Contract not approved**  
   For invoice financing, you can only click "Review Offer" on an invoice when the contract is approved. If the contract is not approved, the button is disabled.

5. **Dropdown actions**  
   - Draft: "Edit Application" and "Delete Draft" (they do nothing now).  
   - Others: 3-dot menu hidden.

---

## Switch to Real API

1. Open `apps/issuer/src/app/(application-management)/applications/data.ts`.
2. Change `USE_MOCK_DATA` to `false`.
3. Restart the app. The page will fetch from `GET /v1/applications?organizationId=...`.

You can delete the mock data later by removing the `mockApplications` array and the mock branch in `use-applications-data.ts`.
