#!/usr/bin/env tsx
/**
 * Backfill contracts.originating_application_id from earliest approved new_contract app.
 *
 * Usage:
 *   pnpm --filter api backfill-contract-originating-application -- --dry-run
 *   pnpm --filter api backfill-contract-originating-application
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { resolveContractOriginatingApplicationId } from "../src/lib/contract-originating-application";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { status: "APPROVED" },
    select: { id: true, originating_application_id: true },
  });

  let updated = 0;
  for (const contract of contracts) {
    if (contract.originating_application_id) continue;

    const originId = await resolveContractOriginatingApplicationId(
      prisma,
      contract.id,
      contract.originating_application_id
    );
    if (!originId) {
      console.log(`[skip] ${contract.id}: no originating new_contract application found`);
      continue;
    }

    console.log(`[${dryRun ? "dry-run" : "update"}] ${contract.id} -> ${originId}`);
    if (!dryRun) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { originating_application_id: originId },
      });
    }
    updated += 1;
  }

  console.log(`Done. ${updated} contract(s) ${dryRun ? "would be" : "were"} updated.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
