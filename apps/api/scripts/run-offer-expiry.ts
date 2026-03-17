#!/usr/bin/env tsx
/**
 * Run the offer expiry job once. Use for testing or manual execution.
 *
 * Withdraws contract and invoice offers where offer_details.expires_at < now.
 * Requires DATABASE_URL. Optionally set OFFER_EXPIRY_CRON_USER_ID for activity logs.
 *
 * Usage: pnpm run-offer-expiry
 */

import "dotenv/config";
import { runOfferExpiryJob } from "../src/lib/jobs/offer-expiry";

async function main() {
  const result = await runOfferExpiryJob();

  console.log("\nOffer expiry job result:");
  console.log("  Contracts withdrawn:", result.contractsWithdrawn.length, result.contractsWithdrawn);
  console.log("  Invoices withdrawn:", result.invoicesWithdrawn.length, result.invoicesWithdrawn);
  console.log("  Applications updated:", result.applicationsUpdated.length, result.applicationsUpdated);
  console.log("  System user ID:", result.systemUserId ?? "(none - logs skipped)");
  if (result.error) {
    console.error("  Error:", result.error);
    process.exit(1);
  }
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
