#!/usr/bin/env tsx
/**
 * M0 spike — Step 3: fetch payment and inspect for payer name (H1)
 *
 * Run from apps/api:
 *   npx tsx _sandbox/razorpay/03-fetch-payment.ts pay_xxxxxxxx
 *   npx tsx _sandbox/razorpay/03-fetch-payment.ts pay_xxxxxxxx order_xxxxxxxx
 *
 * Docs: https://curlec.com/docs/api/payments/fetch-with-id/
 */

import "dotenv/config";
import { curlecRequest, printNameLikeFields } from "./lib/curlec-request";

const paymentId = process.argv[2]?.trim();
const orderId = process.argv[3]?.trim();

if (!paymentId) {
  console.error("Usage: npx tsx _sandbox/razorpay/03-fetch-payment.ts <payment_id> [order_id]");
  process.exit(1);
}

interface PaymentResponse {
  id: string;
  status: string;
  method: string;
  amount: number;
  order_id: string | null;
  bank?: string | null;
  acquirer_data?: Record<string, unknown>;
}

async function main(): Promise<void> {
  const payment = await curlecRequest<PaymentResponse>("GET", `/v1/payments/${paymentId}`, {
    label: "fetch-payment",
    saveAs: "03-payment.json",
  });

  console.log("\n=== H1 summary ===");
  console.log(`  payment_id: ${payment.id}`);
  console.log(`  status:     ${payment.status}`);
  console.log(`  method:     ${payment.method}`);
  console.log(`  bank:       ${payment.bank ?? "(none)"}`);
  console.log(`  order_id:   ${payment.order_id ?? "(none)"}`);

  console.log("\n=== name-like fields (inspect for AML payer name) ===");
  printNameLikeFields(payment);

  const resolvedOrderId = orderId ?? payment.order_id;
  if (resolvedOrderId) {
    const orderPayments = await curlecRequest<{ items: PaymentResponse[] }>(
      "GET",
      `/v1/orders/${resolvedOrderId}/payments`,
      { label: "fetch-order-payments", saveAs: "03-order-payments.json" }
    );

    console.log("\n=== name-like fields (order payments list) ===");
    printNameLikeFields(orderPayments);
  }

  console.log("\n--- H1 decision ---");
  console.log(
    "If no bank account holder name appears above (only bank code / auth refs), H1 → NAME_CHECK_PENDING path."
  );
  console.log("Save output/*.json into your M0 findings doc.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
