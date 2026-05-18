#!/usr/bin/env tsx
/**
 * Dev helper: creates inactive products (with visible names in the admin sidebar)
 * and SUBMITTED applications so the Applications nav shows Active vs Inactive sections.
 *
 * Usage (from repo root or apps/api):
 *   pnpm --filter api seed-inactive-product-apps
 *   cd apps/api && pnpm seed-inactive-product-apps
 *
 * Requires an issuer organization (run `pnpm --filter api prisma:seed` if needed).
 */

import { PrismaClient, ProductStatus } from "@prisma/client";

const prisma = new PrismaClient();

function buildWorkflow(displayName: string) {
  return [
    {
      id: "financing_type_1",
      name: "Financing Type",
      config: { name: displayName, type: { name: displayName } },
    },
    { id: "financing_structure_1", name: "Financing Structure" },
    { id: "contract_details_1", name: "Contract Details" },
    { id: "invoice_details_1", name: "Invoice Details" },
    { id: "company_details_1", name: "Company Details" },
    { id: "business_details_1", name: "Business & Guarantor Details" },
    { id: "supporting_documents_1", name: "Supporting Documents" },
    { id: "declarations_1", name: "Declarations" },
  ];
}

async function main() {
  const issuerOrg = await prisma.issuerOrganization.findFirst({
    orderBy: { created_at: "asc" },
  });
  if (!issuerOrg) {
    console.error("No issuer organization found. Seed the database first (pnpm --filter api prisma:seed).");
    process.exit(1);
  }

  const labels = ["Dev Inactive Product A", "Dev Inactive Product B"] as const;

  for (const label of labels) {
    const product = await prisma.product.create({
      data: {
        version: 1,
        status: ProductStatus.INACTIVE,
        workflow: buildWorkflow(label),
      },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { base_id: product.id },
    });

    await prisma.application.create({
      data: {
        issuer_organization_id: issuerOrg.id,
        product_version: product.version,
        status: "SUBMITTED",
        submitted_at: new Date(),
        last_completed_step: 1,
        financing_type: {
          product_id: product.id,
          product_name: label,
        },
      },
    });

    console.log(`✅ Inactive product + application: ${label} (${product.id})`);
  }

  console.log(`\nIssuer org: ${issuerOrg.name} (${issuerOrg.id})\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
