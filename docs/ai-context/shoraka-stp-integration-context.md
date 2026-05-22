# Shoraka STP Integration Context

## Audience
Developers and future AI assistants who need a full technical understanding of the Shoraka STP integration.

## Business reason (why this integration exists)
Cashsouk needs evidence that Islamic financing proceeds via a Shariah-compliant commodity trade (Tawarruq / buy-and-sell) before an issuer disbursement is marked completed.

Shoraka STP provides the commodity trade process and returns a Shoraka certificate PDF. Cashsouk stores that PDF in S3 and uses `certificate_s3_key` as the proof required to allow the “Mark Disbursed” step.

### Amount mapping (important)
- `order_amount` / `murabaha_amount` represent the **amount Cashsouk wants evidenced** through the Shariah-compliant process.
- Current mapping uses **`WithdrawalInstruction.metadata.grossFundedAmount`** (not net issuer disbursement).
- Platform and facility fees are Cashsouk-side deductions and are **not deducted before sending to Shoraka**.

## Scope
- Applies only to `ISSUER_DISBURSEMENT` withdrawals.
- Shoraka STP happens **before** “Mark Disbursed”.
- **Mark Disbursed is blocked** until `shoraka_trade_orders.certificate_s3_key` exists.

## Current flow

### Manual admin-driven flow (Phase 1/2)
1. Submit Shoraka order
2. Query Shoraka status
3. Fetch certificate (only when provider status is `Completed`)
4. Upload certificate PDF bytes to S3, store `certificate_s3_key` and SHA256 fingerprint
5. Admin marks disbursement completed (only allowed when certificate exists)

### Callback flow (Phase 2/3)
1. Shoraka sends a webhook callback with the provider status
2. Backend verifies signature and updates `shoraka_trade_orders.status`
3. Admin UI displays callback timestamps and indicates next action
4. Admin still fetches certificate manually (no auto-fetch yet in Phase 2/3)

## Key endpoints (Cashsouk API)

### Admin-facing endpoints
1. `GET  /v1/admin/withdrawals/:id/shoraka`
   - Returns the current Shoraka state used by the Admin UI.
2. `POST /v1/admin/withdrawals/:id/shoraka/submit-order`
   - Submits a manual Shoraka order.
3. `POST /v1/admin/withdrawals/:id/shoraka/query-status`
   - Queries Shoraka `orderstatus` and updates backend status.
4. `POST /v1/admin/withdrawals/:id/shoraka/fetch-certificate`
   - Downloads Shoraka certificate PDF and uploads to S3.
5. `POST /v1/admin/withdrawals/:id/mark-completed`
   - Backend guard prevents completion for `ISSUER_DISBURSEMENT` without `certificate_s3_key`.

### Webhook endpoint (callback)
6. `POST /v1/webhooks/shoraka-stp/callback`
   - Shoraka provider notifies Cashsouk when order status changes.
   - Response body must be plain text `OK`.

## Shoraka external endpoints (provider API)
- `submitorder`
- `orderstatus`
- `certificate`
- callback -> `POST /v1/webhooks/shoraka-stp/callback`

Transport details:
- `submitorder`, `orderstatus`, `certificate` use `application/x-www-form-urlencoded` POST bodies.
- `certificate` returns raw PDF bytes with `Content-Type: application/pdf`.
- Callback uses `application/json` payload.
- Callback response body must be exactly `OK`.

## Environment variables
Do not commit real values.
Only placeholders are expected in docs:
- `SHORAKA_BASE_URL`
- `SHORAKA_API_ID`
- `SHORAKA_SECRET_KEY`

Security rules:
- Never log `SHORAKA_SECRET_KEY`.
- Never log the full signature source string (it contains the secret).

## Signature formats (raw provider string rules)

### submitorder
Signature source:
```
SECRET_KEY;API_ID;product_type;commodity_type;ownership;value_date;order_currency;order_amount;murabaha_amount;tenor;tenor_other;tenor_other_unit;order_type
```

### orderstatus / certificate
Signature source:
```
SECRET_KEY;API_ID;order_id
```

### callback
Signature source:
```
SECRET_KEY;API_ID;order_id;status;bank_name;ownership_name;commodity_type;unit;volume;product_type;value_date;cancel_date;order_type;order_currency;order_amount;murabaha_amount;tenor;tenor_other;tenor_other_unit
```

Null handling:
- Optional fields may be `null` in callback payload.
- Current implementation treats `null` as empty string in the signature source string.
- Confirm if Shoraka expects a different null representation; tests currently enforce “null => empty string”.

Raw string values:
- Use the exact string values from the callback body where possible (no formatting changes).

## Amount mapping
Source:
- `WithdrawalInstruction.metadata.grossFundedAmount`

Current send-to-provider mapping:
- `order_amount = grossFundedAmount formatted to 2 decimals`
- `murabaha_amount = grossFundedAmount formatted to 2 decimals`
- Do not use `netIssuerDisbursement`
- Do not deduct platform/facility fees before sending to Shoraka

Example:
- `grossFundedAmount = 130000.00`
- `platformFeeAmount = 3900.00`
- `facilityFeeCharged = 1300.00`
- `netIssuerDisbursement = 124800.00`

Send to Shoraka:
- `order_amount = 130000.00`
- `murabaha_amount = 130000.00`

## Ownership mapping
Ownership (submitorder) is resolved from:
1. `withdrawal.metadata.issuerOrganizationName`
2. `issuerOrganization.name` via `withdrawal.issuer_organization_id`
3. fallback: `Unknown Issuer`

Important:
- Do not use `note_id` as ownership.

## DB design

### Table: `shoraka_trade_orders`
One row per `ISSUER_DISBURSEMENT` withdrawal instruction.

Fields (relevant):
- `id`
- `withdrawal_instruction_id` (unique)
- `note_id`
- `provider_order_id`
- `status`
- `idempotency_key`
- `submit_request_payload`
- `submit_response_payload`
- `status_response_payload`
- `callback_payload`
- `callback_received_at`
- `submitted_at`
- `status_last_checked_at`
- `certificate_s3_key`
- `certificate_file_sha256`
- `provider_certificate_id` (optional)
- `certificate_uploaded_at`
- `created_at`
- `updated_at`

Design notes:
- `status_last_checked_at` records manual `query-status` times.
- `callback_received_at` records provider callback times.
- UI compares timestamps to show “Updated by callback” vs “Updated by status query”.
- `certificate_s3_key` is the required proof for “Mark Disbursed”.

## S3 storage
Certificate S3 key format:
```
shoraka-certificates/{withdrawalInstructionId}/{providerOrderId}-{timestamp}.pdf
```

Stored also:
- `certificate_file_sha256`: SHA256 fingerprint of the stored PDF bytes.

## Status behavior (provider -> UI)
Provider statuses:
- `Active`
- `Completed`
- `Cancelled`
- `Pending Sell`
- `Take Delivery`

UI/backend meanings:
- `Active` -> Matching in progress; query again later
- `Pending Sell` -> Pending sell; query again later / ops if stuck
- `Completed` -> Fetch certificate
- `Cancelled` -> manual review required
- `Take Delivery` -> manual review required
- `Unknown` -> manual review required

Callback only updates `status`.
Certificate fetch and disbursement completion remain manual/guarded.

## Operational cutoff
Submit-order cutoff window:
- Malaysia time: block submission between `23:30` and `00:29` MYT.
- Reason from STP team:
  - Orders submitted after `11:30 PM` may not be matched and may stay `Active` until cancelled.

Current enforcement:
- Backend rejects submit-order in this window with `SHORAKA_CUTOFF_WINDOW`.
- UI disables submit-order in this window.
- Query-status / fetch-certificate / callbacks are not blocked.

## orderDate vs valueDate
Current behavior/display:
- `orderDate` is the trade/order submission date to Shoraka.
- `valueDate` is intended disbursement date on Cashsouk side.

STP team guidance:
- Both should be the same date.

Not enforced as a hard rule yet:
- Same-day validation is pending Shariah advisor confirmation.

## Mark Disbursed guard (important for compliance)
Backend endpoint:
`POST /v1/admin/withdrawals/:id/mark-completed`

Rule:
- If `withdrawal_type === ISSUER_DISBURSEMENT`:
  - require linked `shoraka_trade_orders` row exists
  - require `certificate_s3_key` exists
- Otherwise:
  - no block

Error:
- `code: SHORAKA_CERTIFICATE_REQUIRED`
- `message: Shoraka certificate must be fetched before marking issuer disbursement as completed.`

## Mock example: end-to-end objects (illustrative)

### 1) WithdrawalInstruction before Shoraka
```json
{
  "id": "withdrawal-123",
  "withdrawal_type": "ISSUER_DISBURSEMENT",
  "note_id": "NOTE-ABC",
  "status": "SUBMITTED_TO_TRUSTEE",
  "metadata": {
    "grossFundedAmount": 130000.0,
    "issuerOrganizationName": "Issuer A"
  }
}
```

### 2) ShorakaTradeOrder after submit-order
```json
{
  "withdrawal_instruction_id": "withdrawal-123",
  "provider_order_id": "provider-order-999",
  "status": "Active",
  "submitted_at": "2026-05-21T15:15:00Z",
  "certificate_s3_key": null,
  "callback_received_at": null,
  "status_last_checked_at": null
}
```

### 3) After manual query-status => Completed
```json
{
  "provider_order_id": "provider-order-999",
  "status": "Completed",
  "status_last_checked_at": "2026-05-21T18:14:00Z"
}
```

### 4) After callback => Completed
```json
{
  "provider_order_id": "provider-order-999",
  "status": "Completed",
  "callback_received_at": "2026-05-21T18:30:00Z"
}
```

### 5) After fetch-certificate => certificate stored in S3
```json
{
  "provider_order_id": "provider-order-999",
  "status": "Completed",
  "certificate_s3_key": "shoraka-certificates/withdrawal-123/provider-order-999-<timestamp>.pdf",
  "certificate_file_sha256": "<sha256>"
}
```

### 6) After mark disbursed
```json
{
  "withdrawal_id": "withdrawal-123",
  "withdrawal_status": "COMPLETED",
  "ledger_updated": true
}
```

## Open questions / future improvements (not required now)
- Should we auto-fetch certificate after callback when provider status becomes `Completed`?
- Confirm exact null-string handling rules for signature generation (current code uses null => empty string).
- Should we strictly validate that orderDate == valueDate before allowing certificate fetch or disbursement completion?
- Provider cancellation flow: if Shoraka supports a cancel endpoint, should we integrate it?
- Fees/invoicing: do we need to create a fee invoice workflow for Shoraka back-office processes?

## Not implemented (by design for now)
Auto-fetch certificate after callback.
Automatic “Mark Disbursed” after callback.
Hard same-day disbursement validation.
Any ledger/disbursement posting changes besides enforcing certificate requirement.

