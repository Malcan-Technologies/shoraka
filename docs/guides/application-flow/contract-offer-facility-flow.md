# Contract offer & facility flow

Single source of truth for facility values across contract_details, offer_details, and contract status.

## Data model

| Location           | Fields                                                                                                                                                       | Meaning                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `contract_details` | `financing`, `value`, `facility_applied`, `contract_value`                                                                                                   | Issuer’s requested facility (various UI field names)                                                   |
| `contract_details` | `approved_facility`, `utilized_facility`, `available_facility`, `pending_facility`, `repaid_facility`, `lifetime_cap`, `lifetime_used`, `lifetime_remaining`, `capacity_snapshot_version` | Dual-ledger snapshots after persist/refresh/recompute (`capacity_snapshot_version: 1`). Typed columns stay in sync; zeros are authoritative only when this marker is present. |
| `offer_details`    | `requested_facility`, `offered_facility`, `sent_at`, `responded_at`, `offer_acceptance`                                                                      | Offer lifecycle                                                                                        |

`approved_facility` is the credit ceiling. Repayment never increases it.

## Dual-ledger occupancy

Two independent caps:

- **Facility (revolving)** uses financing amounts. **Available** = approved − utilized − pending (may be negative; legacy over-limit is preserved). Pending reduces available but is stored separately from live utilized.
- **Lifetime** uses invoice **face** value. Cap is contract face value. Submitted onward counts, including settled/repaid. Draft does not count.

| Occupancy                   | Invoice / note state                                                                  | Amount that counts                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Pending (facility)**      | `SUBMITTED` or `AMENDMENT_REQUESTED`                                                  | Requested financing (`applied_financing` / `financing_amount`, else face × ratio; fallback offered)                    |
| **Pending (facility)**      | `OFFER_SENT`                                                                          | Offered financing (fallback requested)                                                                                 |
| **Live utilized**           | `APPROVED` + open marketplace (note not yet successfully closed)                      | Offered financing (fallback requested)                                                                                 |
| **Live utilized**           | Successful funding close                                                              | True-up to funded principal. A close with zero funded principal is routed to failed funding and releases both ledgers. |
| **Repaid (facility)**       | Linked note `REPAID` / servicing `SETTLED`                                            | Funded principal. Settlement **releases** facility occupancy.                                                          |
| **Released (both ledgers)** | Invoice `REJECTED`, `WITHDRAWN`, `OFFER_EXPIRED`; note `FAILED_FUNDING` / `CANCELLED` | Does not occupy facility or lifetime                                                                                   |
| **Lifetime used**           | `SUBMITTED` onward, including settled/repaid                                          | Invoice face value                                                                                                     |

Requested and approved facility must be strictly less than contract value. New/increased writes that deepen an over-limit are blocked by capacity errors; existing over-limit rows are not rewritten.

## Split origination

Newly created applications stamp `split_origination: true` on `financing_type`. Those `new_contract` applications are **facility-first**: invoices cannot be attached or submitted on the same application. After the facility is approved, issuers start a separate `existing_contract` application to finance one invoice. `invoice_only` stays standalone. Applications without the marker keep their historical combined facility-and-invoice layout.

### Funded vs target

Today the committed advance is the invoice offer (`offered_amount`), which becomes the note `target_amount`. That is the **maximum** for that draw, not outstanding principal.

Standard revolving practice (invoice facilities and RCFs): occupancy is **outstanding principal**. If investors fund RM 180k against a RM 200k target, the line is drawn RM 180k so the remaining RM 20k can be used again. On versioned utilisation offers, facility-fee **collection** is a frozen RM amount charged only on successful funding, not `funded_amount × rate`. Grandfathered (unversioned) closes cannot consume remaining that is still reserved by outstanding v1 collections. If remaining owed is unexpectedly below a frozen v1 amount, close funding fails instead of charging less. Occupancy still true-ups to funded principal.

While funding is still open, the committed advance stays reserved so a second invoice cannot consume the same remaining capacity mid-raise. After close (`FUNDING` / `ACTIVE` / `ARREARS` / `DEFAULTED`, or `funding_status` `FUNDED`), occupancy true-ups to funded principal.

Marketplace listings use the product `marketplace_listing_duration_days` (default **14 days**). If the listing expires below the minimum funding threshold, or funding is failed (including a zero-funded close), both ledgers release. Settlement / repayment frees revolving credit and keeps invoice face on lifetime.

### Labels (admin and issuer)

| Ledger                                 | Remaining label                         | Occupancy label                     |
| -------------------------------------- | --------------------------------------- | ----------------------------------- |
| Revolving facility (financing amounts) | Remaining credit / Left to draw         | Reserved (pending), Utilised (live) |
| Contract lifetime (invoice face)       | Remaining allocation / Left on contract | Used, including settled invoices    |

Pending **does** occupy remaining credit. Admins cannot send an over-limit offer.

## Flow

1. **Send offer (admin)**
   - Reads `requested_facility` from `contract_details` via `resolveRequestedFacility(cd)` (financing → value → facility_applied → contract_value).
   - Validates `offered_facility ≤ requested_facility`.
   - Writes `offer_details` with `requested_facility`, `offered_facility`, sets `status = OFFER_SENT`.

2. **Accept offer (issuer)**
   - Reads `offered_facility` from `offer_details`.
   - Writes `contract_details.approved_facility = offered_facility`, `available_facility = approved - utilized`, sets `status = APPROVED`.

3. **Reject offer (issuer)**
   - Updates `offer_details.responded_at`, sets `status = REJECTED`.
   - `contract_details` unchanged (no approved facility).

4. **Retract offer (admin – reset section to PENDING)**
   - Clears `offer_details` when an offer was sent, sets `status = SUBMITTED`, then **recomputes occupancy** (`refreshContractFacilityValues`). Pending invoices stay in `pending_facility`; approved is 0 until a new offer is accepted.

5. **Refresh facility values** (`refreshContractFacilityValues` in `apps/api/src/lib/refresh-contract-facility.ts`)
   - **APPROVED** or **AMENDMENT_REQUESTED** with `approved_facility` already set: keep the ceiling (facility-level amendment must not wipe occupancy).
   - **All other statuses**: `approved_facility` = 0.
   - Recomputes live / pending / repaid occupancy from invoices and linked notes. Called on invoice offer send/retract, invoice accept, funding close / fail, and note repayment.

One-shot local recompute: `pnpm --filter api recompute-contract-facility`.

## Shared helpers

`apps/api/src/lib/contract-facility.ts`:

- `resolveRequestedFacility(cd)` – requested amount from `contract_details` (numeric or formatted strings).
- `resolveApprovedFacilityForRefresh(status, cd)` – approved amount for refresh (non-zero on APPROVED, or AMENDMENT_REQUESTED after accept).
- `resolveOfferedFacility(offer)` – offered amount from `offer_details`.
- `resolveInvoiceFacilityAmount(invoice)` – committed advance (`offered_amount`, else value × ratio).
- `resolveInvoiceOccupancyAmount(invoice)` – reserved commitment while raising; funded principal after close.
- `computeContractFacilitySnapshot(status, details, invoices)` – dual-ledger snapshot (facility + lifetime). Pending reduces available.

## Status transitions

```
DRAFT → SUBMITTED (admin approves section)
SUBMITTED → OFFER_SENT (admin sends offer)
OFFER_SENT → APPROVED (issuer accepts)
OFFER_SENT → REJECTED (issuer rejects)
OFFER_SENT → SUBMITTED (admin retracts)
```

## Invoice offers (per invoice)

| Location                | Fields                                                                       | Meaning                         |
| ----------------------- | ---------------------------------------------------------------------------- | ------------------------------- |
| `invoice.details`       | `applied_financing`, `financing_amount`, `value` + `financing_ratio_percent` | Requested financing for invoice |
| `invoice.offer_details` | `offered_amount`, `offered_ratio_percent`, `offered_profit_rate_percent`, `platform_fee_rate_percent`, `fee_schedule_version`, `facility_fee_collect_amount`, `additional_fees` | CashSouk offer terms; v1 freezes drawdown %, facility collection RM, and extra lines. Absence of `fee_schedule_version` on a previously sent offer is grandfather progressive facility fee; send writes v1 only for new offers, existing v1, or an explicit convert. |

Helpers: `resolveRequestedInvoiceAmount`, `resolveOfferedAmount`, `resolveOfferedProfitRate` in `packages/config/offer-resolvers.ts` and `apps/api/src/lib/invoice-offer.ts`.

### Invoice flow (mirrors contract)

1. **Send offer (admin)** – Locks the facility row, writes `offer_details`, sets invoice status `OFFER_SENT`, and hard-blocks over-limit writes with `FACILITY_CAPACITY_EXCEEDED` / `CONTRACT_LIFETIME_EXCEEDED`. Facility-linked offers are rejected with `FACILITY_DISABLED` while the contract is disabled. v1 `facility_fee_collect_amount` cannot exceed remaining facility fee after uncharged, unwaived, still-collectible pending (`OFFER_SENT`) and live (accepted / not-yet-closed) collections; declined, expired, withdrawn, failed-funding, waived, and already-charged items are excluded, and a resend does not double-count the current invoice. Resend after `OFFER_EXPIRED` re-reserves under the same lock.
2. **Accept / Reject (issuer)** – Responds to offer. Accept re-checks that the facility is enabled and that remaining facility fee still covers this invoice’s locked collection after sibling reservations. If remaining facility fee was waived, accept is allowed and close later collects RM 0. Rejection releases both ledgers. Disabled facilities also reject note create and publish.
3. **Retract offer (admin – reset item to PENDING)** – Clears `offer_details`, sets status `SUBMITTED`. Same pattern as contract: admin uses "Retract Offer" (or "Set to Pending" in item dropdown).
4. **Status transitions** – `SUBMITTED → OFFER_SENT → APPROVED | REJECTED`; `OFFER_SENT → SUBMITTED` (admin retracts).

Draft invoice create/save stays unreserved. Reserved amendment invoices are hard-revalidated atomically on amount changes.

Occupancy changes write `CONTRACT_FACILITY_OCCUPANCY_UPDATED` on `application_logs` (and `FACILITY_OCCUPANCY_UPDATED` on the note) when utilized / available / repaid change.
