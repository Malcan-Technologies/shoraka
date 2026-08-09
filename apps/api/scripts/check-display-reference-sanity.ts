#!/usr/bin/env tsx
/**
 * Read-only sanity report for canonical display reference allocations.
 *
 * Usage:
 *   pnpm --filter api check-display-reference-sanity
 *   pnpm --filter api check-display-reference-sanity -- --json
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { checkDisplayReferenceSanity } from "../src/lib/display-reference/reference-sanity";

async function main() {
  const asJson = process.argv.includes("--json");
  const report = await checkDisplayReferenceSanity(prisma);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Display reference sanity: ${report.ok ? "OK" : "ISSUES FOUND"}`);
    console.log(
      `Allocations=${report.totals.allocations}; duplicateAllocations=${report.totals.duplicateAllocations}; issues=${report.totals.issues}`
    );
    console.log("\nBy module:");
    for (const moduleSummary of report.byModule) {
      console.log(
        `  ${moduleSummary.moduleCode}: allocations=${moduleSummary.allocationCount}, issues=${moduleSummary.issueCount}`
      );
    }
    if (report.issues.length > 0) {
      console.log("\nIssues:");
      for (const issue of report.issues) {
        console.log(
          `  [${issue.severity}] ${issue.code}: ${issue.message}${issue.entityType ? ` (${issue.entityType}:${issue.entityId})` : ""}`
        );
      }
    }
  }

  if (!report.ok) {
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
