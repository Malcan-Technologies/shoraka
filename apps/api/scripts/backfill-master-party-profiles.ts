#!/usr/bin/env tsx
/**
 * Seed CashSouk master party profiles for company organisations that have none.
 * Idempotent: orgs that already have MASTER_ACTIVE rows are skipped.
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
    const existing = await prisma.organizationPartyProfile.count({
      where: { issuer_organization_id: org.id, membership_status: "MASTER_ACTIVE" },
    });
    if (existing > 0) continue;
    if (dryRun) {
      console.log(`[dry-run] would seed issuer ${org.id} (${org.name ?? "unnamed"})`);
      seeded += 1;
      continue;
    }
    await seedMasterPartiesIfEmpty("issuer", org.id);
    seeded += 1;
  }
  for (const org of investors) {
    const existing = await prisma.organizationPartyProfile.count({
      where: { investor_organization_id: org.id, membership_status: "MASTER_ACTIVE" },
    });
    if (existing > 0) continue;
    if (dryRun) {
      console.log(`[dry-run] would seed investor ${org.id} (${org.name ?? "unnamed"})`);
      seeded += 1;
      continue;
    }
    await seedMasterPartiesIfEmpty("investor", org.id);
    seeded += 1;
  }

  console.log(`${dryRun ? "Would process" : "Processed"} ${seeded} company organisations with empty master lists.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
