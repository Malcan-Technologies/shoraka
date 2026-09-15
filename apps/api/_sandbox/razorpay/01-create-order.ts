#!/usr/bin/env tsx
/**
 * M0 spike — Step 1: create a Curlec order
 *
 * Run from apps/api:
 *   npx tsx _sandbox/razorpay/01-create-order.ts
 *
 * Requires CURLEC_KEY_ID + CURLEC_KEY_SECRET in apps/api/.env
 * Docs: https://curlec.com/docs/api/orders/create/
 */

import "dotenv/config";
import { curlecRequest } from "./lib/curlec-request";

// ============ CONFIG — edit per run ============
const CONFIG = {
  /** Amount in sen (10000 = RM 100.00) */
  amount: 10_000,
  currency: "MYR",
  receipt: `m0-spike-${Date.now()}`,
  notes: {
    purpose: "M0_spike",
    expected_name: "John Doe",
  },
  partial_payment: false,
  first_payment_min_amount: 0,
};

interface CreateOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

async function main(): Promise<void> {
  const order = await curlecRequest<CreateOrderResponse>(
    "POST",
    "/v1/orders",
    { label: "create-order", saveAs: "01-order.json" },
    {
      amount: CONFIG.amount,
      currency: CONFIG.currency,
      receipt: CONFIG.receipt,
      notes: CONFIG.notes,
      partial_payment: CONFIG.partial_payment,
      first_payment_min_amount: CONFIG.first_payment_min_amount,
    }
  );

  console.log("\n--- Next step ---");
  console.log(`order_id: ${order.id}`);
  console.log("Complete FPX in checkout (02-checkout.html), then run 03-fetch-payment.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// === create-order — request ===
// POST https://api.razorpay.com/v1/orders
// {
//   "amount": 10000,
//   "currency": "MYR",
//   "receipt": "m0-spike-1782030582731",
//   "notes": {
//     "purpose": "M0_spike",
//     "expected_name": "John Doe"
//   },
//   "partial_payment": false,
//   "first_payment_min_amount": 0
// }

// === create-order — response (200) ===
// {
//   "amount": 10000,
//   "amount_due": 10000,
//   "amount_paid": 0,
//   "attempts": 0,
//   "created_at": 1782030583,
//   "currency": "MYR",@
//   "entity": "order",
//   "id": "order_T4DQxzVLkVDGlZ",
//   "notes": {
//     "expected_name": "John Doe",
//     "purpose": "M0_spike"
//   },
//   "offer_id": null,
//   "receipt": "m0-spike-1782030582731",
//   "status": "created"
// }
