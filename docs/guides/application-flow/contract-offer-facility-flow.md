# Contract offer & facility flow

Single source of truth for facility values across contract_details, offer_details, and contract status.

## Data model

| Location | Fields | Meaning |
|----------|--------|---------|
| `contract_details` | `financing`, `value`, `facility_applied`, `contract_value` | Issuer’s requested facility (various UI field names) |
| `contract_details` | `approved_facility`, `utilized_facility`, `available_facility`, `pending_facility`, `repaid_facility` | Revolving occupancy after the facility offer is accepted |
| `offer_details` | `requested_facility`, `offered_facility`, `sent_at`, `responded_at`, `offer_acceptance` | Offer lifecycle |

`approved_facility` is the credit ceiling. Repayment never increases it.

## Revolving occupancy

The facility is a revolving line. **Available** = approved − live utilized (may be negative if an over-limit invoice offer was accepted). Pending invoices are display-only and do not reduce available.

| Occupancy | Invoice / note state | Amount that counts |
|-----------|----------------------|--------------------|
| **Pending** | Invoice `SUBMITTED`, `OFFER_SENT`, or `AMENDMENT_REQUESTED` (pre-approval only) | Committed advance (`offered_amount`, else value × ratio) |
| **Live utilized** | Invoice `APPROVED`, note not released | Reserved at the committed advance while the note is still raising; **true-ups to `funded_amount`** once funding closes |
| **Repaid / released** | Linked note `REPAID` / servicing `SETTLED` | Funded principal (what was actually drawn). `FAILED_FUNDING` / `CANCELLED` release the line without counting as repaid |

### Funded vs target

Today the committed advance is the invoice offer (`offered_amount`), which becomes the note `target_amount`. That is the **maximum** for that draw, not outstanding principal.

Standard revolving practice (invoice facilities and RCFs): occupancy is **outstanding principal**. If investors fund RM 180k against a RM 200k target, the line is drawn RM 180k so the remaining RM 20k can be used again. CashSouk already charges the facility fee on `funded_amount` at funding close; utilization follows the same principal.

While funding is still open, the committed advance stays reserved so a second invoice cannot consume the same remaining capacity mid-raise. After close (`FUNDING` / `ACTIVE` / `ARREARS` / `DEFAULTED`, or `funding_status` `FUNDED`), occupancy true-ups to funded principal.

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
- `computeContractFacilitySnapshot(status, details, invoices)` – approved, utilized, pending, repaid, available.

## Status transitions

```
DRAFT → SUBMITTED (admin approves section)
SUBMITTED → OFFER_SENT (admin sends offer)
OFFER_SENT → APPROVED (issuer accepts)
OFFER_SENT → REJECTED (issuer rejects)
OFFER_SENT → SUBMITTED (admin retracts)
```

## Invoice offers (per invoice)

| Location | Fields | Meaning |
|----------|--------|---------|
| `invoice.details` | `applied_financing`, `financing_amount`, `value` + `financing_ratio_percent` | Requested financing for invoice |
| `invoice.offer_details` | `offered_amount`, `offered_ratio_percent`, `offered_profit_rate_percent` | CashSouk offer terms |

Helpers: `resolveRequestedInvoiceAmount`, `resolveOfferedAmount`, `resolveOfferedProfitRate` in `packages/config/offer-resolvers.ts` and `apps/api/src/lib/invoice-offer.ts`.

### Invoice flow (mirrors contract)

1. **Send offer (admin)** – Writes `offer_details`, sets invoice status `OFFER_SENT`. If `offered_amount` exceeds remaining available, admin sees a warning and can still send.
2. **Accept / Reject (issuer)** – Responds to offer.
3. **Retract offer (admin – reset item to PENDING)** – Clears `offer_details`, sets status `SUBMITTED`. Same pattern as contract: admin uses "Retract Offer" (or "Set to Pending" in item dropdown).
4. **Status transitions** – `SUBMITTED → OFFER_SENT → APPROVED | REJECTED`; `OFFER_SENT → SUBMITTED` (admin retracts).

Issuer invoice save also **warns** (does not block) when requested financing exceeds remaining capacity.

Occupancy SOT lives on `contract_details` (`utilized_facility`, `available_facility`, `pending_facility`, `repaid_facility`). Material utilized / available / repaid changes write `CONTRACT_FACILITY_OCCUPANCY_UPDATED` to `ApplicationAuditLog` only — and only for invoice accept, funding close, funding fail, and note repayment. Silent refresh (invoice create/update/delete/withdraw, offer send/retract, amendment, expiry, recompute) updates SOT without an occupancy audit row. There is no `NoteAuditLog` occupancy event.
