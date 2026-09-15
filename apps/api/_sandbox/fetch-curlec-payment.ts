#!/usr/bin/env tsx

import "dotenv/config";
import { createCurlecClient } from "../src/modules/payment/curlec-client";
import {
  extractBankCodeFromPayment,
  extractPayerNameFromPayment,
} from "../src/modules/payment/curlec-schemas";

async function main() {
  const paymentId = process.argv[2];
  if (!paymentId) {
    console.error("Usage: pnpm exec tsx _sandbox/fetch-curlec-payment.ts <pay_...>");
    process.exit(1);
  }

  const client = createCurlecClient();
  const payment = await client.fetchPayment(paymentId);

  console.log("--- Raw Curlec response ---");
  console.log(JSON.stringify(payment, null, 2));
  console.log("--- Extracted ---");
  console.log("payerName:", extractPayerNameFromPayment(payment));
  console.log("bankCode:", extractBankCodeFromPayment(payment));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
