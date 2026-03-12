# Contract offer & facility flow

Single source of truth for facility values across contract_details, offer_details, and contract status.

## Data model

| Location | Fields | Meaning |
|----------|--------|---------|
| `contract_details` | `financing`, `value`, `facility_applied`, `contract_value` | Issuer’s requested facility (various UI field names) |
| `contract_details` | `approved_facility`, `utilized_facility`, `available_facility` | Capacity after offer is accepted |
| `offer_details` | `requested_facility`, `offered_facility`, `expires_at`, `sent_at`, `responded_at` | Offer lifecycle |

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
   - Clears `offer_details`, sets `approved_facility` / `utilized_facility` / `available_facility` to 0, sets `status = SUBMITTED`.

5. **Refresh facility values** (`refreshContractFacilityValues`)  
   - **APPROVED** with `approved_facility` set: keep it (from issuer-accepted offer).  
   - **All other statuses**: `approved_facility` = 0.  
   - Recomputes `utilized_facility` from approved invoices and `available_facility = approved - utilized`.

## Shared helpers

`apps/api/src/lib/contract-facility.ts`:

- `resolveRequestedFacility(cd)` – requested amount from `contract_details`.
- `resolveApprovedFacilityForRefresh(status, cd)` – approved amount for refresh (non-zero only when APPROVED and issuer accepted).
- `resolveOfferedFacility(offer)` – offered amount from `offer_details`.

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

1. **Send offer (admin)** – Writes `offer_details`, sets invoice status `OFFER_SENT`.
2. **Accept / Reject (issuer)** – Responds to offer.
3. **Retract offer (admin – reset item to PENDING)** – Clears `offer_details`, sets status `SUBMITTED`. Same pattern as contract: admin uses "Retract Offer" (or "Set to Pending" in item dropdown).
4. **Status transitions** – `SUBMITTED → OFFER_SENT → APPROVED | REJECTED`; `OFFER_SENT → SUBMITTED` (admin retracts).
