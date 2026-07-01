#!/usr/bin/env tsx
/**
 * Backfill legal_name_on_id for existing personal investor orgs from stored
 * RegTank webhook OCR payloads, falling back to first/middle/last.
 *
 * Usage (from repo root):
 *   pnpm --filter @cashsouk/api exec tsx scripts/backfill-legal-name-on-id.ts
 *
 * Dry run (no writes):
 *   DRY_RUN=1 pnpm --filter @cashsouk/api exec tsx scripts/backfill-legal-name-on-id.ts
 */
import { OrganizationType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === "1";

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "" || value === "null") {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed || null;
}

function extractOcrLegalName(ocrResults: Record<string, unknown>): string | null {
  const directName = normalizeValue(ocrResults.name ?? ocrResults.fullName);
  if (directName) {
    return directName;
  }

  const parts = [
    normalizeValue(ocrResults.firstName),
    normalizeValue(ocrResults.middleName),
    normalizeValue(ocrResults.lastName),
  ].filter(Boolean) as string[];

  return parts.length > 0 ? parts.join(" ") : null;
}

function extractLegalNameFromWebhooks(webhookPayloads: unknown): string | null {
  if (!Array.isArray(webhookPayloads)) {
    return null;
  }

  for (const payload of webhookPayloads) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      continue;
    }
    const ocrResults = (payload as Record<string, unknown>).ocrResults;
    if (!ocrResults || typeof ocrResults !== "object" || Array.isArray(ocrResults)) {
      continue;
    }
    const legalName = extractOcrLegalName(ocrResults as Record<string, unknown>);
    if (legalName) {
      return legalName;
    }
  }

  return null;
}

function fallbackFromOrgNames(org: {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
}): string | null {
  const parts = [org.first_name, org.middle_name, org.last_name]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

async function main(): Promise<void> {
  const orgs = await prisma.investorOrganization.findMany({
    where: {
      type: OrganizationType.PERSONAL,
      legal_name_on_id: null,
    },
    select: {
      id: true,
      first_name: true,
      middle_name: true,
      last_name: true,
      regtank_onboarding: {
        select: { webhook_payloads: true },
        take: 1,
        orderBy: { created_at: "desc" },
      },
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const org of orgs) {
    const fromOcr = extractLegalNameFromWebhooks(
      org.regtank_onboarding[0]?.webhook_payloads ?? null
    );
    const legalName = fromOcr ?? fallbackFromOrgNames(org);

    if (!legalName) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${org.id} -> ${legalName}`);
    } else {
      await prisma.investorOrganization.update({
        where: { id: org.id },
        data: { legal_name_on_id: legalName },
      });
    }
    updated += 1;
  }

  console.log("");
  console.log(`Processed ${orgs.length} org(s).`);
  console.log(`  updated: ${updated}`);
  console.log(`  skipped (no name source): ${skipped}`);
  if (dryRun) {
    console.log("Dry run — no rows written.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
