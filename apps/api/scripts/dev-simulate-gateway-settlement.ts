#!/usr/bin/env tsx
/**
 * DEV-ONLY: Simulate a Curlec settlement so gateway reconciliation can be tested
 * without live keys. Curlec test mode never settles payments to a bank account,
 * so the real recon report is always empty (0 scanned). This script feeds canned
 * "settled" recon lines — built from your real COMPLETED gateway payments — into
 * the actual reconciliation job so you can watch rows get stamped and exceptions
 * get created on the admin Reconciliation page.
 *
 * IMPORTANT: This is a throwaway testing tool. See the removal checklist in
 * docs/integrations/payment-gateway-curlec-recon-testing.md before going live.
 *
 * It refuses to run when NODE_ENV=production. It writes to whatever DATABASE_URL
 * points at (stamps settled_at / gateway_fee_amount on matched payments and
 * upserts a gateway_recon_runs row) — only run it against a dev database.
 *
 * Usage:
 *   pnpm --filter @cashsouk/api dev-simulate-gateway-settlement
 *
 * Optional env vars:
 *   SIM_RUN_DATE=YYYY-MM-DD   Recon run date label (default: yesterday MYT)
 *   SIM_LIMIT=25              Max real payments to mark as settled (default: 25)
 *   SIM_FEE_SEN=100           Fake gateway fee per payment in sen (default: 100 = RM1.00)
 *   SIM_INJECT_ORPHAN=true    Add a fake settled payment with no internal row (default: true)
 *   SIM_INJECT_MISMATCH=true  Add a wrong-amount line for one real payment (default: true)
 */

import "dotenv/config";
import { GatewayPaymentStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  getReconRunDetail,
} from "../src/modules/payment/recon-service";
import {
  getYesterdayMytDateOnly,
  runGatewaySettlementReconJob,
  type ReconItemsFetcher,
} from "../src/lib/jobs/gateway-settlement-recon";
import { myrDecimalToSen } from "../src/modules/payment/money";
import type { CurlecSettlementReconItem } from "../src/modules/payment/curlec-schemas";

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.toLowerCase() === "true" || raw === "1";
}

function parseRunDate(): Date {
  const raw = process.env.SIM_RUN_DATE;
  if (!raw) return getYesterdayMytDateOnly();
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("SIM_RUN_DATE must be YYYY-MM-DD");
  }
  return new Date(Date.UTC(year, month - 1, day));
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the settlement simulator with NODE_ENV=production.");
  }

  const runDate = parseRunDate();
  const limit = Number(process.env.SIM_LIMIT ?? "25");
  const feeSen = Number(process.env.SIM_FEE_SEN ?? "100");
  const injectOrphan = boolEnv("SIM_INJECT_ORPHAN", true);
  const injectMismatch = boolEnv("SIM_INJECT_MISMATCH", true);

  // Real payments that Curlec would eventually settle in production.
  const payments = await prisma.gatewayPayment.findMany({
    where: {
      status: GatewayPaymentStatus.COMPLETED,
      curlec_payment_id: { not: null },
    },
    orderBy: { created_at: "desc" },
    take: limit,
  });

  if (payments.length === 0) {
    console.warn(
      "\nNo COMPLETED gateway payments with a curlec_payment_id were found.\n" +
        "Complete at least one FPX test payment (deposit or fee) first, then re-run.\n"
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // Build a matched (correct amount) settled line for each real payment.
  const items: CurlecSettlementReconItem[] = payments.map((payment, index) => ({
    entity_type: "payment",
    amount: myrDecimalToSen(payment.amount),
    fee: feeSen,
    tax: 0,
    settled: true,
    settlement_id: `sim_setl_${runDate.toISOString().slice(0, 10)}`,
    payment_id: payment.curlec_payment_id!,
    order_id: payment.curlec_order_id,
    created_at: nowSec - index,
  }));

  // A settled payment with no internal record → ORPHAN_CURLEC_PAYMENT exception.
  if (injectOrphan) {
    items.push({
      entity_type: "payment",
      amount: 15000,
      fee: feeSen,
      tax: 0,
      settled: true,
      settlement_id: `sim_setl_${runDate.toISOString().slice(0, 10)}`,
      payment_id: `sim_pay_orphan_${nowSec}`,
      created_at: nowSec,
    });
  }

  // A wrong amount for a real payment → AMOUNT_MISMATCH exception.
  // Uses the second payment so it does not clash with its own matched line above.
  if (injectMismatch && payments.length >= 2) {
    const target = payments[1];
    // Replace this payment's matched line with a mismatched one.
    const targetIndex = items.findIndex(
      (item) => item.payment_id === target.curlec_payment_id
    );
    if (targetIndex >= 0) {
      items[targetIndex] = {
        ...items[targetIndex],
        amount: myrDecimalToSen(target.amount) + 1000, // RM10 off
        settlement_id: `sim_setl_mismatch_${nowSec}`,
      };
    }
  }

  const fetchReconItems: ReconItemsFetcher = async () => items;

  console.log("\nSimulating Curlec settlement recon:");
  console.log("  Run date (MYT):", runDate.toISOString().slice(0, 10));
  console.log("  Real payments fed:", payments.length);
  console.log("  Inject orphan:", injectOrphan);
  console.log("  Inject mismatch:", injectMismatch && payments.length >= 2);
  console.log("  Total canned lines:", items.length);

  const result = await runGatewaySettlementReconJob(
    { runDate, triggeredBy: "DEV_SIMULATOR" },
    prisma,
    fetchReconItems
  );

  const detail = await getReconRunDetail(result.runId, prisma);

  console.log("\nRecon run result:");
  console.log("  Status:", detail.status);
  console.log("  Scanned:", detail.settlementsScanned);
  console.log("  Matched:", detail.paymentsMatched);
  console.log("  Stamped:", detail.paymentsStamped);
  console.log("  Exceptions:", detail.exceptionsCount);

  if (detail.exceptions.length > 0) {
    console.log("\nExceptions:");
    for (const exception of detail.exceptions) {
      console.log(
        `  - ${exception.type} | curlec=${exception.curlecPaymentId ?? "-"} | ` +
          `expected=${exception.expectedAmount ?? "-"} actual=${exception.actualAmount ?? "-"}`
      );
    }
  }

  console.log("\nOpen Admin → Finance → Reconciliation to see this run.\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
