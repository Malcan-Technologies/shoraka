# Issuer Offer Flow

Admin sends offers for Contract and Invoice. The issuer receives them, can accept or reject, and may see offers retracted.

For products configured with **offer acknowledgements** and/or **acceptance documents**, the issuer follows a phased flow (see [Offer acceptance & signing phases](../guides/application-flow/offer-acceptance-and-signing-phases.md)):

1. **Step 1** — Preview + checkbox per acknowledgement, upload acceptance docs, submit.
2. **Step 2** — Admin reviews on the **Acceptance** tab (offer status, acceptance docs, signing package progress; approve / request changes / reject).
3. **Step 3** — Signing package (configure signers → send → track). No upload step.

`offer_details.offer_acceptance.status` tracks the phase (Option A). Envelope create/send requires `APPROVED_FOR_SIGNING` (or later). Contract-linked invoices still Accept/Decline after the contract envelope is `COMPLETED`.

## Data Sources

- **GET /v1/applications?organizationId=...** — Lists applications with `contract` and `invoices` (used by dashboard).
- **GET /v1/applications/:id** — Single application with `contract` and `invoices` (used by detail/edit pages).

Both return full `contract` and `invoice` records including `status` and `offer_details`.

## Refresh Strategy (No SSE)

Issuer and admin review flows no longer use SSE stream endpoints. Freshness is now driven by:

- React Query invalidation after mutations
- `refetchOnWindowFocus: true`
- 15s polling (`refetchInterval`), disabled when tab is in background

Import and call the policy
```typescript
import { getReviewRefreshPolicy } from "@cashsouk/config";
```

Add to hook:
```typescript
const refreshPolicy = getReviewRefreshPolicy();
```

Spread it into `useQuery`
Example:
```typescript
import { getReviewRefreshPolicy } from "@cashsouk/config";
export function useContractDetail(id: string) {
  const refreshPolicy = getReviewRefreshPolicy();
  return useQuery({
    queryKey: ["contract", id],
    queryFn: () => fetchContract(id),
    enabled: !!id,
    ...refreshPolicy,
  });
}
```

## Offer State

An offer is considered "sent" when:

- `contract.status === "OFFER_SENT"` or `invoice.status === "OFFER_SENT"`
- `offer_details` exists and is non-null

Application-level status stays `UNDER_REVIEW` while offers are pending; offer state is derived from contract and invoice status only.

### Deriving offer status for UI

Uses the active phase deadline on `offer_acceptance` (`acceptance_expires_at` while in Step 1/admin review; `signing_expires_at` while approved for signing / signing in progress). See `apps/issuer/src/lib/offer-utils.ts`.

- **"Offer received"** — Show offer badge, enable "Review offer" / Accept–Reject when the active clock has not passed.
- **"Offer expired"** — Same label for past-deadline soft window (`OFFER_SENT` + clock past) and durable entity status `OFFER_EXPIRED`:
  - Card badge **Offer Expired**, Review CTA hidden, short note that a resent offer may appear
  - Full offer details remain available (download / read-only modal)
  - If the Review modal is already open, it becomes read-only (Close + download only; no accept/decline/continue)

Past deadline API actions return `400 OFFER_EXPIRED`. After the hourly job, entity status is `OFFER_EXPIRED` until admin Send Offer.
- **null** — No offer (retracted, not sent, or already responded).

## Offer Details Shape

**ContractOfferDetails** (from `packages/types`):

- `requested_facility`, `offered_facility` (numbers)
- `sent_at`, `responded_at`, `responded_by_user_id`, `version`
- `offer_acceptance` (when phased flow applies) including `acceptance_expires_at` / `signing_expires_at`

**InvoiceOfferDetails**:

- `requested_amount`, `offered_amount`
- `requested_ratio_percent`, `offered_ratio_percent`, `offered_profit_rate_percent`
- `platform_fee_rate_percent` (optional; percent of funded amount at disbursement, capped 0–3; included on invoice offer letter PDFs)
- `sent_at`, `responded_at`, `responded_by_user_id`, `version`
- `offer_acceptance` (when phased flow applies) including `acceptance_expires_at` / `signing_expires_at`

## External signing (all signers)

Signing packages are **always required** for offer types that need an envelope — there is no product-level enable/disable. Products store a **single** package under workflow key `signing_packages` (a `SigningTemplateConfig`). That package is used for:

- **Contract offers** (`new_contract` / `existing_contract`)
- **Invoice-only offers** (invoice with no `contract_id`)

**Contract-linked invoices** (invoice with `contract_id` set) never create an invoice envelope. After the **contract** package envelope is `COMPLETED`, the issuer Accept/Declines that invoice offer directly in Review offer (no signers, uploads, or signing steps). If the contract envelope is not yet complete, Accept is blocked with a short message; Decline remains available.

**Invoice-only** offers each get their own envelope from the same product package. Different invoices on the same application may have active envelopes **in parallel** (uniqueness is per `contract_id` or per `invoice_id`, not per application). Active = `DRAFT` | `SENT` | `IN_PROGRESS`.

Every signer is an external party emailed an opaque link. For envelope paths, the issuer **Review offer** modal is the signing control centre: bind signers (name, email, IC), attach **acceptance documents** (e.g. Board Resolution), send the envelope, monitor progress, and re-notify.

**Product snapshot:** signing package documents and acceptance-document gates come from the application's frozen product version (`application.product_version` within the product `base_id` family), not the latest live catalog row. Acceptance documents are configured on the financing-type step as `acceptance_documents`. Void + recreate rebuilds from that same frozen workflow and does not pick up later product edits. Guarantor Agreement appears only when that frozen signing template includes it (no silent auto-inject). Legacy dual `{ contract, invoice }` under `signing_packages` and flat `signing_template` are migrated in-memory to a single package until the product is re-saved.

Signers complete the flow at `/signing/external/[token]`:

1. IC access code (directors: must match IC bound at send; guarantors: self-declare on the link)
2. Per-recipient MyKad eKYC when the role requires it
3. SigningCloud signing for assigned documents (API attaches `callUrl` from `API_PUBLIC_URL` or `API_URL`)
4. On browser return (`backUrl`): page calls `POST /v1/signing/external/:token/confirm-signed` → API syncs from SigningCloud **Get Document Detail**, then trusts the return for that recipient if Detail still shows them pending
5. On normal revisit of the signing link: page calls `POST /v1/signing/external/:token/sync-from-provider` (Detail sync without trust-return)
6. Issuer **Refresh** calls `POST /v1/signing/envelopes/:id/sync-from-provider` (same Detail sync) before refetching envelopes
7. SigningCloud webhook (when it arrives) runs the same Detail sync path (stores signed PDF when the document is complete)
8. Continue if more docs remain for that recipient; envelope COMPLETED / VOIDED / DECLINED / EXPIRED → closed package page

**Status source of truth:** our DB **assignment** statuses (not document status). Document stays `PENDING` until every required signer on that document is `SIGNED`. Updated from SigningCloud Detail (`signstate`: 0 pending / 1 signed / 2 rejected) on return, revisit, Refresh, and webhook. Webhook alone is not required for progress.

When the envelope completes, rollup + signed PDF storage trigger offer auto-accept (`contract` / `invoice` → `APPROVED`). Signed offer letters are stored on the envelope document (`signed_s3_key`) and downloaded via:

- Issuer: `GET /v1/applications/:id/offers/contracts/signed-letter` (or invoice variant)
- Admin: `GET /v1/admin/applications/:id/offers/contracts/signed-letter` (or invoice variant)

See **[SigningCloud eKYC Flow](./signingcloud-ekyc-flow.md)** for recipient eKYC sequence and API endpoints.

## Issuer Accept/Reject API

Requires auth; user must be member or owner of the application’s issuer organization.

### Contract offer

- **POST /v1/applications/:id/offers/contracts/accept**
- **POST /v1/applications/:id/offers/contracts/reject**

When SigningCloud is configured, contract accept goes through the signing envelope (auto-accept on `COMPLETED`). Non-production clients may pass `{ skipSigning: true }` to bypass for local QA.

### Invoice offer

- **POST /v1/applications/:id/offers/invoices/:invoiceId/accept**
- **POST /v1/applications/:id/offers/invoices/:invoiceId/reject**

| Invoice kind | Accept path |
|--------------|-------------|
| Invoice-only (`contract_id` null) | Signing envelope (same product package); auto-accept on `COMPLETED` |
| Contract-linked (`contract_id` set) | Direct Accept/Decline after contract envelope `COMPLETED`; no invoice envelope. Before that → `CONTRACT_SIGNING_INCOMPLETE` (or UI blocks Accept) |
| Creating an envelope for a contract-linked invoice | `400 CONTRACT_LINKED_INVOICE_NO_PACKAGE` |

Non-production `{ skipSigning: true }` bypass applies the same as contract.
### Errors

- `400 INVALID_STATE` — No pending offer, no contract/invoice, or no `offer_details`.
- `400 ALREADY_RESPONDED` — Already accepted or rejected.
- `400 OFFER_EXPIRED` — active phase deadline (`acceptance_expires_at` or `signing_expires_at`) has passed.
- `400 USE_SIGNING_FLOW` — SigningCloud configured; accept via envelope completion (or contract-linked direct accept when eligible).
- `400 CONTRACT_SIGNING_INCOMPLETE` — Contract-linked invoice accept before contract envelope `COMPLETED`.
- `403 FORBIDDEN` — User not in issuer org.

### Response

`{ success: true, data: Application }` with updated `contract` / `invoice`.

## Retraction

When admin uses "Set to Pending" (or "Retract Offer") while status is OFFER_SENT:

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
