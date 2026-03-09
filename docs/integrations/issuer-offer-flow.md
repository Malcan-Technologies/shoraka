# Issuer Offer Flow

Admin sends offers for Contract and Invoice. The issuer receives them, can accept or reject, and may see offers retracted.

## Data Sources

- **GET /v1/applications?organizationId=...** — Lists applications with `contract` and `invoices` (used by dashboard).
- **GET /v1/applications/:id** — Single application with `contract` and `invoices` (used by detail/edit pages).

Both return full `contract` and `invoice` records including `status` and `offer_details`.

## Offer State

An offer is considered "sent" when:

- `contract.status === "SENT"` or `invoice.status === "SENT"`
- `offer_details` exists and is non-null

### Deriving offer status for UI

```ts
function getOfferStatus(item: {
  status?: string;
  offer_details?: { expires_at?: string | null };
}): "Offer received" | "Offer expired" | null {
  if (item.status !== "SENT" || !item.offer_details) return null;

  const expiresAt = item.offer_details.expires_at;
  if (!expiresAt) return "Offer received";

  const isExpired = new Date(expiresAt) < new Date();
  return isExpired ? "Offer expired" : "Offer received";
}
```

- **"Offer received"** — Show offer badge, enable "Review offer" / Accept–Reject.
- **"Offer expired"** — Show badge, disable actions.
- **null** — No offer (retracted, not sent, or already responded).

## Offer Details Shape

**ContractOfferDetails** (from `packages/types`):

- `requested_facility`, `offered_facility` (numbers)
- `expires_at`, `sent_at`, `responded_at`, `responded_by_user_id`, `version`

**InvoiceOfferDetails**:

- `requested_amount`, `offered_amount`
- `requested_ratio_percent`, `offered_ratio_percent`, `offered_profit_rate_percent`
- `expires_at`, `sent_at`, `responded_at`, `responded_by_user_id`, `version`

## Issuer Accept/Reject API

Requires auth; user must be member or owner of the application’s issuer organization.

### Contract offer

- **POST /v1/applications/:id/offers/contracts/accept**
- **POST /v1/applications/:id/offers/contracts/reject**

### Invoice offer

- **POST /v1/applications/:id/offers/invoices/:invoiceId/accept**
- **POST /v1/applications/:id/offers/invoices/:invoiceId/reject**

### Errors

- `400 INVALID_STATE` — No pending offer, no contract/invoice, or no `offer_details`.
- `400 ALREADY_RESPONDED` — Already accepted or rejected.
- `400 OFFER_EXPIRED` — `expires_at` has passed.
- `403 FORBIDDEN` — User not in issuer org.

### Response

`{ success: true, data: Application }` with updated `contract` / `invoice`.

## Retraction

When admin uses "Set to Pending" (or "Retract Offer") while status is SENT:

- Contract section: `contract.offer_details` set to `null`, `contract.status` → `SUBMITTED`.
- Invoice item: `invoice.offer_details` set to `null`, `invoice.status` → `SUBMITTED`.
- Activity events: `CONTRACT_OFFER_RETRACTED`, `INVOICE_OFFER_RETRACTED`.

On retraction, `offer_details` disappears. Issuer logic using `getOfferStatus()` will treat this as no offer; badges and actions should hide without extra handling.

## API Client (packages/config)

```ts
// Contract
apiClient.acceptContractOffer(applicationId);
apiClient.rejectContractOffer(applicationId);

// Invoice
apiClient.acceptInvoiceOffer(applicationId, invoiceId);
apiClient.rejectInvoiceOffer(applicationId, invoiceId);
```
