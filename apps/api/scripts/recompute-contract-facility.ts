#!/usr/bin/env tsx
/**
 * Recompute revolving facility + lifetime snapshots on contracts.
 * Covers APPROVED, AMENDMENT_REQUESTED, and any facility with linked invoices.
 * Preserves negative legacy over-limit values. Does not change invoice/note statuses.
 *
 * Usage:
 *   pnpm --filter api recompute-contract-facility -- --dry-run
 *   pnpm --filter api recompute-contract-facility
 */

import "dotenv/config";
import {
  listContractsForCapacityRecompute,
  recomputeContractCapacitySnapshots,
} from "../src/lib/recompute-contract-facility";
import {
  loadContractCapacitySiblings,
  refreshContractFacilityValues,
} from "../src/lib/refresh-contract-facility";
import { prisma } from "../src/lib/prisma";

const dryRun = process.argv.includes("--dry-run");

function formatAmount(value: number): string {
  return value.toFixed(6);
}

async function main() {
  const report = await recomputeContractCapacitySnapshots({
    dryRun,
    listContracts: () => listContractsForCapacityRecompute(prisma),
    loadSiblings: (contractId) => loadContractCapacitySiblings(prisma, contractId),
    persist: (contractId) => refreshContractFacilityValues(contractId).then(() => undefined),
  });

  for (const row of report.rows) {
    const mode = report.dryRun ? "dry-run" : "update";
    console.log(
      `[${mode}] ${row.ref} status=${row.status} invoices=${row.invoiceCount}` +
        ` facility before utilized=${formatAmount(row.before.utilizedFacility)} pending=${formatAmount(row.before.pendingFacility)} available=${formatAmount(row.before.availableFacility)}` +
        ` after utilized=${formatAmount(row.after.utilizedFacility)} pending=${formatAmount(row.after.pendingFacility)} available=${formatAmount(row.after.availableFacility)}` +
        ` lifetime before used=${formatAmount(row.before.lifetimeUsed)} remaining=${formatAmount(row.before.lifetimeRemaining)}` +
        ` after used=${formatAmount(row.after.lifetimeUsed)} remaining=${formatAmount(row.after.lifetimeRemaining)}`
    );
  }

  if (report.overLimit.length > 0) {
    console.log("Over-limit contracts (preserved; statuses not rewritten):");
    for (const row of report.overLimit) {
      console.log(
        `  ${row.ref} id=${row.id} available=${formatAmount(row.availableFacility)} lifetime_remaining=${formatAmount(row.lifetimeRemaining)}`
      );
    }
  } else {
    console.log("No over-limit contracts in this run.");
  }

  console.log(
    `Done. ${report.scanned} contract(s) ${report.dryRun ? "would be" : "were"} recomputed.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
