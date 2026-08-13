#!/usr/bin/env tsx
/**
 * Assign product_code values to existing Product families using explicit mappings.
 *
 * Usage:
 *   pnpm --filter api backfill-product-codes -- --dry-run --mapping-file ./product-code-mapping.txt
 *   pnpm --filter api backfill-product-codes -- --family-id <baseId> --code ARF
 *   pnpm --filter api backfill-product-codes -- --mapping "familyId1=ARF,familyId2=RCF"
 *
 * Mapping file format (one per line):
 *   effectiveFamilyId=ARF
 *   effectiveFamilyId:RCF
 *   effectiveFamilyId ARF
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import {
  applyProductCodeBackfill,
  auditProductFamilies,
  parseProductCodeMappingInput,
} from "../src/modules/products/product-family";

function readArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function buildMappingFromArgs(): Map<string, string> {
  const mapping = new Map<string, string>();
  const mappingFile = readArgValue("--mapping-file");
  const inlineMapping = readArgValue("--mapping");
  const familyId = readArgValue("--family-id");
  const code = readArgValue("--code");

  if (mappingFile) {
    const content = readFileSync(mappingFile, "utf8");
    for (const [key, value] of parseProductCodeMappingInput(content).entries()) {
      mapping.set(key, value);
    }
  }

  if (inlineMapping) {
    for (const pair of inlineMapping.split(",")) {
      const [key, value] = pair.split("=").map((part) => part.trim());
      if (!key || !value) {
        throw new Error(`Invalid --mapping pair: ${pair}`);
      }
      mapping.set(key, value.toUpperCase());
    }
  }

  if (familyId && code) {
    mapping.set(familyId, code.toUpperCase());
  }

  return mapping;
}

function printFamilyAudit() {
  console.log("\nCurrent product families:");
  return auditProductFamilies(prisma).then((families) => {
    for (const family of families) {
      console.log(`\nFamily ${family.familyId}`);
      console.log(`  Code: ${family.productCode ?? "(missing)"}`);
      console.log(`  Missing: ${family.codeMissing}`);
      console.log(`  References allocated: ${family.referencesAllocated} (${family.allocationCount})`);
      for (const version of family.versions) {
        console.log(
          `  - v${version.version} [${version.status}] ${version.name} (${version.id}) code=${version.productCode ?? "null"}`
        );
      }
    }
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const mapping = buildMappingFromArgs();

  await printFamilyAudit();

  if (mapping.size === 0) {
    console.error(
      "\nNo mappings provided. Use --mapping-file, --mapping, or --family-id with --code."
    );
    process.exit(1);
  }

  const result = await applyProductCodeBackfill(prisma, mapping, dryRun);

  console.log(`\nBackfill plan (${dryRun ? "dry-run" : "apply"}):`);
  for (const row of result.rows) {
    console.log(
      `  [${row.action.toUpperCase()}] family=${row.familyId} ${row.currentCode ?? "null"} -> ${row.targetCode || "(none)"}${row.reason ? ` (${row.reason})` : ""}`
    );
    for (const version of row.versions) {
      console.log(`    v${version.version} ${version.name} (${version.id})`);
    }
  }

  if (result.unmappedFamilies.length > 0) {
    console.log("\nUnmapped families with missing code:");
    for (const family of result.unmappedFamilies) {
      console.log(`  - ${family.familyId} (${family.versions.map((v) => v.name).join(", ")})`);
    }
  }

  if (result.errors.length > 0) {
    console.error("\nErrors:");
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("\nSummary:");
  console.log(`  Applied: ${result.applied}`);
  console.log(`  Skipped: ${result.skipped}`);
  console.log(`  Unmapped missing-code families: ${result.unmappedFamilies.length}`);

  if (!dryRun) {
    console.log("\nPost-backfill audit:");
    await printFamilyAudit();
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
