#!/usr/bin/env tsx
/**
 * Seed CashSouk master party profiles from stored CTOS/RegTank when the
 * initial regulatory structure has not been established yet.
 * Idempotent: seedMasterPartiesIfEmpty no-ops once that marker is set.
 * A manually added director/shareholder alone does not skip first establishment.
 *
 * Usage (from repo root):
 *   pnpm --filter @cashsouk/api exec tsx scripts/backfill-master-party-profiles.ts
 *
 * Dry run:
 *   DRY_RUN=1 pnpm --filter @cashsouk/api exec tsx scripts/backfill-master-party-profiles.ts
 */
import { OrganizationType, PrismaClient } from "@prisma/client";
import { seedMasterPartiesIfEmpty } from "../src/modules/organization-profile/service";

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === "1";

async function main(): Promise<void> {
  const [issuers, investors] = await Promise.all([
    prisma.issuerOrganization.findMany({
      where: { type: OrganizationType.COMPANY },
      select: { id: true, name: true },
    }),
    prisma.investorOrganization.findMany({
      where: { type: OrganizationType.COMPANY },
      select: { id: true, name: true },
    }),
  ]);

  let seeded = 0;
  for (const org of issuers) {
    if (dryRun) {
      console.log(`[dry-run] would seed issuer ${org.id} (${org.name ?? "unnamed"})`);
      seeded += 1;
      continue;
    }
    await seedMasterPartiesIfEmpty("issuer", org.id);
    seeded += 1;
  }
  for (const org of investors) {
    if (dryRun) {
      console.log(`[dry-run] would seed investor ${org.id} (${org.name ?? "unnamed"})`);
      seeded += 1;
      continue;
    }
    await seedMasterPartiesIfEmpty("investor", org.id);
    seeded += 1;
  }

  console.log(`${dryRun ? "Would process" : "Processed"} ${seeded} company organisations.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
