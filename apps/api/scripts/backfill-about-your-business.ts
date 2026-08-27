#!/usr/bin/env tsx
/**
 * Copy About Your Business answers from the latest application onto the issuer
 * company profile when the profile fields are still empty.
 *
 * Usage (from repo root):
 *   pnpm --filter @cashsouk/api exec tsx scripts/backfill-about-your-business.ts
 *
 * Dry run (no writes):
 *   DRY_RUN=1 pnpm --filter @cashsouk/api exec tsx scripts/backfill-about-your-business.ts
 */
import {
  isAboutYourBusinessPresent,
  parseAboutYourBusinessFromBusinessDetails,
  parseAboutYourBusinessFromCorporateData,
  serializeAboutYourBusiness,
} from "@cashsouk/types";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === "1";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function main(): Promise<void> {
  const orgs = await prisma.issuerOrganization.findMany({
    where: { type: "COMPANY" },
    select: { id: true, corporate_onboarding_data: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const org of orgs) {
    const existing = parseAboutYourBusinessFromCorporateData(org.corporate_onboarding_data);
    if (isAboutYourBusinessPresent(existing)) {
      skipped += 1;
      continue;
    }

    const latestApp = await prisma.application.findFirst({
      where: { issuer_organization_id: org.id },
      orderBy: { updated_at: "desc" },
      select: { business_details: true },
    });
    const fromApp = parseAboutYourBusinessFromBusinessDetails(latestApp?.business_details);
    if (!isAboutYourBusinessPresent(fromApp)) {
      skipped += 1;
      continue;
    }

    const nextCod = {
      ...asRecord(org.corporate_onboarding_data),
      aboutYourBusiness: serializeAboutYourBusiness(fromApp),
    };

    updated += 1;
    if (dryRun) {
      console.log(`Would update ${org.id}`);
      continue;
    }

    await prisma.issuerOrganization.update({
      where: { id: org.id },
      data: { corporate_onboarding_data: nextCod as Prisma.InputJsonValue },
    });
  }

  console.log(
    `${dryRun ? "Dry run — " : ""}updated ${updated} issuer organisations, skipped ${skipped}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
