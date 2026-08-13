#!/usr/bin/env tsx
/**
 * Report whether product-scoped canonical reference generation is operationally ready.
 *
 * Usage:
 *   pnpm --filter api check-product-code-readiness
 *   pnpm --filter api check-product-code-readiness -- --json
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { checkProductCodeReadiness } from "../src/modules/products/product-family";

async function main() {
  const asJson = process.argv.includes("--json");
  const report = await checkProductCodeReadiness(prisma);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Product code readiness: ${report.ready ? "READY" : "NOT READY"}`);
    console.log(
      `Families: ${report.summary.readyFamilies}/${report.summary.totalFamilies} ready; blocked=${report.summary.blockedFamilies}; missing=${report.summary.missingCodeFamilies}; invalid=${report.summary.invalidCodeFamilies}`
    );
    for (const family of report.families) {
      const status = family.ready ? "READY" : "BLOCKED";
      console.log(
        `\n[${status}] family=${family.familyId} code=${family.productCode ?? "(missing)"} activeApps=${family.hasActiveApplications}`
      );
      console.log(`  Names: ${family.names.join(", ")}`);
      if (family.blockers.length > 0) {
        console.log(`  Blockers: ${family.blockers.join(", ")}`);
      }
    }
  }

  if (!report.ready) {
    process.exitCode = 1;
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
