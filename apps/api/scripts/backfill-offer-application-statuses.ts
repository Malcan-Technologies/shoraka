#!/usr/bin/env tsx
/**
 * Backfill application.status for phased offer-acceptance apps (Phase 6).
 *
 * Usage:
 *   pnpm --filter api backfill-offer-application-statuses -- --dry-run
 *   pnpm --filter api backfill-offer-application-statuses
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ProductRepository } from "../src/modules/products/repository";
import {
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
  workflowUsesOfferAcceptanceFlow,
} from "@cashsouk/types";
import {
  CONTRACT_OFFER_CEREMONY_APPLICATION_STATUSES,
  extractPrimaryOfferAcceptanceStatus,
  isExistingContractFinancing,
  resolveApplicationStatusFromOfferAcceptancePhase,
  resolveInvoiceCentricApplicationStatus,
} from "../src/modules/applications/offer-application-status";
import { computeApplicationStatus } from "../src/modules/applications/lifecycle";

const productRepository = new ProductRepository();
const dryRun = process.argv.includes("--dry-run");

type AppRow = Awaited<ReturnType<typeof loadCandidateApplications>>[number];

async function loadCandidateApplications() {
  return prisma.application.findMany({
    where: {
      status: {
        notIn: [
          ApplicationStatus.DRAFT,
          ApplicationStatus.WITHDRAWN,
          ApplicationStatus.REJECTED,
          ApplicationStatus.ARCHIVED,
        ],
      },
    },
    select: {
      id: true,
      status: true,
      product_version: true,
      financing_type: true,
      financing_structure: true,
      contract: {
        select: { status: true, offer_details: true },
      },
      invoices: {
        select: { status: true, contract_id: true, offer_details: true },
      },
    },
  });
}

async function loadWorkflow(app: AppRow): Promise<unknown[] | null> {
  const productId = (app.financing_type as { product_id?: string } | null)?.product_id;
  if (!productId) return null;
  const product =
    app.product_version != null
      ? await productRepository.findByBaseAndVersion(productId, app.product_version)
      : await productRepository.findById(productId);
  if (!product) return null;
  return (product.workflow as unknown[]) ?? [];
}

function computeExistingContractTargetStatus(app: AppRow): ApplicationStatus | null {
  const structure = app.financing_structure as { structure_type?: string } | null;
  if (!isExistingContractFinancing(structure)) return null;

  const ceremonyStatus = CONTRACT_OFFER_CEREMONY_APPLICATION_STATUSES as ApplicationStatus[];
  if (!ceremonyStatus.includes(app.status as ApplicationStatus)) {
    return null;
  }

  const invoiceStatuses = app.invoices.map((inv) => inv.status);
  return resolveInvoiceCentricApplicationStatus({
    invoiceStatuses,
    // Conservative: without review rows, treat as locked unless all offers are out.
    isInvoiceTabUnlocked: invoiceStatuses.some((status) =>
      ["OFFER_SENT", "APPROVED", "WITHDRAWN", "REJECTED"].includes(status)
    ),
    isInvoiceOnly: false,
  });
}

function computeTargetStatus(app: AppRow): ApplicationStatus | null {
  const structure = app.financing_structure as { structure_type?: string } | null;
  const isInvoiceOnly = structure?.structure_type === "invoice_only";
  const offerAcceptanceStatus = extractPrimaryOfferAcceptanceStatus({
    financing_structure: structure ?? undefined,
    contract: app.contract ?? undefined,
    invoices: app.invoices,
  });

  const contract = app.contract
    ? { status: app.contract.status as ContractStatus }
    : null;
  const invoices = app.invoices.map((inv) => ({
    status: inv.status as InvoiceStatus,
  }));

  if (!offerAcceptanceStatus) {
    if (app.status === ApplicationStatus.CONTRACT_ACCEPTED && contract?.status === ContractStatus.APPROVED) {
      const base = ApplicationStatus.CONTRACT_SIGNED;
      return computeApplicationStatus(contract, invoices, base, { isInvoiceOnly });
    }
    return null;
  }

  const entityApproved =
    (!isInvoiceOnly && app.contract?.status === ContractStatus.APPROVED) ||
    (isInvoiceOnly &&
      app.invoices.some((inv) => !inv.contract_id && inv.status === InvoiceStatus.APPROVED));

  let base = resolveApplicationStatusFromOfferAcceptancePhase(
    isInvoiceOnly,
    offerAcceptanceStatus,
    { entityApproved }
  );
  if (!base) return null;

  if (
    app.status === ApplicationStatus.CONTRACT_ACCEPTED &&
    entityApproved &&
    (base === ApplicationStatus.CONTRACT_ACCEPTED || base === ApplicationStatus.INVOICE_ACCEPTED)
  ) {
    base = isInvoiceOnly ? ApplicationStatus.INVOICE_SIGNED : ApplicationStatus.CONTRACT_SIGNED;
  }

  return computeApplicationStatus(contract, invoices, base, { isInvoiceOnly });
}

async function main() {
  const apps = await loadCandidateApplications();
  const changes: Array<{ id: string; from: string; to: string }> = [];
  let skipped = 0;

  for (const app of apps) {
    const existingContractTarget = computeExistingContractTargetStatus(app);
    if (existingContractTarget) {
      if (existingContractTarget !== app.status) {
        changes.push({ id: app.id, from: app.status, to: existingContractTarget });
        if (!dryRun) {
          await prisma.application.update({
            where: { id: app.id },
            data: { status: existingContractTarget },
          });
        }
      } else {
        skipped += 1;
      }
      continue;
    }

    const workflow = await loadWorkflow(app);
    if (!workflow || !workflowUsesOfferAcceptanceFlow(workflow)) {
      skipped += 1;
      continue;
    }

    const target = computeTargetStatus(app);
    if (!target || target === app.status) {
      skipped += 1;
      continue;
    }

    changes.push({ id: app.id, from: app.status, to: target });
    if (!dryRun) {
      await prisma.application.update({
        where: { id: app.id },
        data: { status: target },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        scanned: apps.length,
        skipped,
        updated: changes.length,
        changes: changes.slice(0, 50),
        ...(changes.length > 50 ? { truncated: changes.length - 50 } : {}),
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
