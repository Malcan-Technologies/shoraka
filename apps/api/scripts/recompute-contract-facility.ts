#!/usr/bin/env tsx
/**
 * Recompute revolving facility occupancy on all APPROVED contracts.
 *
 * Usage:
 *   pnpm --filter api recompute-contract-facility -- --dry-run
 *   pnpm --filter api recompute-contract-facility
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { refreshContractFacilityValues } from "../src/lib/refresh-contract-facility";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      display_reference: true,
      contract_details: true,
    },
  });

  let updated = 0;
  for (const contract of contracts) {
    const before = (contract.contract_details ?? {}) as Record<string, unknown>;
    console.log(
      `[${dryRun ? "dry-run" : "update"}] ${contract.display_reference ?? contract.id} utilized=${String(before.utilized_facility ?? "—")} available=${String(before.available_facility ?? "—")}`
    );
    if (!dryRun) {
      await refreshContractFacilityValues(contract.id);
    }
    updated += 1;
  }

  console.log(`Done. ${updated} contract(s) ${dryRun ? "would be" : "were"} recomputed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
