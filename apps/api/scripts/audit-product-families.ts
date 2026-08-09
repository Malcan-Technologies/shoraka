#!/usr/bin/env tsx
/**
 * Audit Product families for product_code rollout.
 *
 * Usage:
 *   pnpm --filter api audit-product-families
 *   pnpm --filter api audit-product-families -- --json
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { auditProductFamilies } from "../src/modules/products/product-family";

async function main() {
  const asJson = process.argv.includes("--json");
  const families = await auditProductFamilies(prisma);

  if (asJson) {
    console.log(JSON.stringify(families, null, 2));
    return;
  }

  console.log(`Product families: ${families.length}`);
  for (const family of families) {
    console.log(`\nFamily ${family.familyId}`);
    console.log(`  Code: ${family.productCode ?? "(missing)"}`);
    console.log(`  Missing code: ${family.codeMissing}`);
    console.log(`  Invalid code: ${family.codeInvalid}`);
    console.log(
      `  References allocated: ${family.referencesAllocated} (count=${family.allocationCount})`
    );
    for (const version of family.versions) {
      console.log(
        `  - v${version.version} [${version.status}] ${version.name} (${version.id}) code=${version.productCode ?? "null"}`
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
