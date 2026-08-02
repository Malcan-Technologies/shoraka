/**
 * Local/dev only. Removes known prospectus seed SiteDocument demo rows.
 * Does NOT run automatically. Do not use against production.
 *
 * Usage (from apps/api):
 *   pnpm exec tsx scripts/cleanup-local-prospectus-site-document-seeds.ts
 */
import { PrismaClient } from "@prisma/client";

const DEMO_TITLES = [
  "Lifecycle Seed Risk Disclosure",
  "Lifecycle Seed Product Terms",
  "Risk Disclosure Statement (Demo)",
  "Product Terms (Demo)",
] as const;

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run demo SiteDocument cleanup in production");
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.siteDocument.findMany({
      where: { title: { in: [...DEMO_TITLES] } },
      select: { id: true, title: true, type: true, s3_key: true },
    });

    console.log(`Found ${existing.length} matching local demo SiteDocument row(s):`);
    for (const row of existing) {
      console.log(`- ${row.title} (${row.type}) id=${row.id}`);
    }

    if (existing.length === 0) {
      return;
    }

    const result = await prisma.siteDocument.deleteMany({
      where: { title: { in: [...DEMO_TITLES] } },
    });
    console.log(`Deleted ${result.count} row(s). S3 objects were not deleted.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
