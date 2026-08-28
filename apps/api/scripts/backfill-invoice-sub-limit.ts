#!/usr/bin/env tsx
/**
 * Set `invoice_details.sub_limit_per_invoice_rm` on an explicit product base + version.
 * Dry-run by default. Does not infer from max_invoice_value.
 *
 * Usage:
 *   pnpm --filter @cashsouk/api backfill-invoice-sub-limit -- --base-id <id> --version <n>
 *   pnpm --filter @cashsouk/api backfill-invoice-sub-limit -- --base-id <id> --version <n> --amount 1000000 --apply
 */

import "dotenv/config";
import { Prisma } from "@prisma/client";
import { getStepKeyFromStepId, parsePositiveRmAmount } from "@cashsouk/types";
import { prisma } from "../src/lib/prisma";

function readArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function main(): Promise<void> {
  const baseId = readArgValue("--base-id")?.trim();
  const versionRaw = readArgValue("--version")?.trim();
  const amountRaw = readArgValue("--amount")?.trim();
  const apply = process.argv.includes("--apply");

  if (!baseId || !versionRaw) {
    throw new Error("Required: --base-id <productBaseId> --version <n>");
  }
  const version = Number(versionRaw);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("--version must be a positive integer");
  }

  const product = await prisma.product.findFirst({
    where: {
      version,
      status: { not: "DELETED" },
      OR: [{ id: baseId }, { base_id: baseId }],
    },
    orderBy: { created_at: "desc" },
  });
  if (!product) {
    throw new Error(`No product found for base-id=${baseId} version=${version}`);
  }

  const workflow = Array.isArray(product.workflow) ? [...(product.workflow as unknown[])] : [];
  const invoiceIndex = workflow.findIndex((step) => {
    const sid = String((step as { id?: unknown })?.id ?? "");
    return getStepKeyFromStepId(sid) === "invoice_details";
  });
  if (invoiceIndex < 0) {
    throw new Error(`Product ${product.id} v${product.version} has no invoice_details step`);
  }

  const step = asRecord(workflow[invoiceIndex]) ?? {};
  const config = { ...(asRecord(step.config) ?? {}) };
  const current = config.sub_limit_per_invoice_rm;
  console.log(`Product ${product.id} v${product.version}`);
  console.log(`Current sub_limit_per_invoice_rm: ${current == null ? "(unset)" : String(current)}`);

  if (!amountRaw) {
    console.log("No --amount supplied. Dry-run inspection only.");
    return;
  }
  const amount = parsePositiveRmAmount(amountRaw);
  if (amount == null) {
    throw new Error("--amount must be a positive RM number (do not infer from max_invoice_value)");
  }

  config.sub_limit_per_invoice_rm = amount;
  workflow[invoiceIndex] = { ...step, config };

  if (!apply) {
    console.log(`Dry-run: would set sub_limit_per_invoice_rm=${amount}. Pass --apply to write.`);
    return;
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { workflow: workflow as Prisma.InputJsonValue },
  });
  console.log(`Updated sub_limit_per_invoice_rm=${amount} on ${product.id}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
