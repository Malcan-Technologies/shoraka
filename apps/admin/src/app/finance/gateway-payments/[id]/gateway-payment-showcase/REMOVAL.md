# Remove Gateway Payment Showcase

TEMPORARY GATEWAY PAYMENT SHOWCASE — delete after UI review.

## Delete these paths

1. `apps/admin/src/app/finance/gateway-payments/[id]/gateway-payment-showcase/` (entire folder)
2. Showcase-specific tests under that folder (if any)

## Revert page wiring

In `apps/admin/src/app/finance/gateway-payments/[id]/page.tsx`:

- Remove the `TEMPORARY GATEWAY PAYMENT SHOWCASE` import block
- Remove `useSearchParams` showcase activation
- Remove showcase controls banner
- Restore always-on `useGatewayPayment(id)` and real mutation handlers
- Keep `gateway-payment-detail-model.ts` (production helpers) unless you prefer inlining again

## Keep

- `gateway-payment-detail-model.ts` — shared production visibility/metadata helpers
- All real payment/refund/wallet logic

## Activation that must disappear

`?gatewayPaymentShowcase=1` (dev/test only; already no-op in production)
