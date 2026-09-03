#!/usr/bin/env tsx
/**
 * Rewrite stored product workflow Offer Letter signing documents to Facility Agreement.
 * Future envelopes pick up the new TEMPLATE document; existing envelopes are not modified.
 *
 * Usage:
 *   pnpm --filter @cashsouk/api migrate-signing-offer-letter-to-fa -- --dry-run
 *   pnpm --filter @cashsouk/api migrate-signing-offer-letter-to-fa
 */

import "dotenv/config";
import { rewriteOfferLetterSigningDocumentsToFacilityAgreement } from "@cashsouk/types";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const dryRun = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const products = await prisma.product.findMany({
    select: { id: true, version: true, workflow: true },
    orderBy: [{ base_id: "asc" }, { version: "asc" }],
  });

  let changedCount = 0;
  for (const product of products) {
    const { workflow, changed } = rewriteOfferLetterSigningDocumentsToFacilityAgreement(
      product.workflow
    );
    if (!changed) continue;
    changedCount += 1;
    if (dryRun) {
      console.log(`dry-run: would update product ${product.id} v${product.version}`);
      continue;
    }
    await prisma.product.update({
      where: { id: product.id },
      data: { workflow: workflow as Prisma.InputJsonValue },
    });
    console.log(`updated product ${product.id} v${product.version}`);
  }

  console.log(
    `${dryRun ? "dry-run: " : ""}${changedCount} of ${products.length} product rows would be rewritten.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
