#!/usr/bin/env tsx
/**
 * Seed script: Creates a SUBMITTED application with invoice_only structure
 * and 3 invoices (no contract). Uses randomized but valid data.
 *
 * Usage: pnpm seed-application-invoice-only [issuerOrgId] [productId]
 * Defaults: issuerOrgId=cmknlimvf0003grp0hsbmc1dp, productId=cmm1rrzct00029crp14sbuup9
 */

import { PrismaClient } from "@prisma/client";
import {
  generateInvoiceDetailsList,
  buildInvoiceDetails,
  buildCompanyDetails,
  buildBusinessDetails,
  buildFinancialStatements,
  buildSupportingDocuments,
  buildDeclarations,
  buildReviewAndSubmit,
} from "./seed-application-helpers";

const prisma = new PrismaClient();

async function main() {
  const [issuerOrgIdArg, productIdArg] = process.argv.slice(2);

  const issuerOrgId = issuerOrgIdArg ?? "cmknlimvf0003grp0hsbmc1dp";
  const productId = productIdArg ?? "cmm1rrzct00029crp14sbuup9";

  const issuerOrg = await prisma.issuerOrganization.findUnique({ where: { id: issuerOrgId } });
  if (!issuerOrg) {
    console.error(`Issuer organization not found: ${issuerOrgId}. Pass issuerOrgId as first arg or use valid ID.`);
    process.exit(1);
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    console.error(`Product not found: ${productId}. Pass productId as second arg or use valid ID.`);
    process.exit(1);
  }

  const application = await prisma.application.create({
    data: {
      issuer_organization_id: issuerOrg.id,
      product_version: product.version,
      status: "SUBMITTED",
      submitted_at: new Date(),
      last_completed_step: 9,
      financing_type: { product_id: product.id },
      financing_structure: { structure_type: "invoice_only", existing_contract_id: null },
      company_details: buildCompanyDetails(issuerOrg.id),
      business_details: buildBusinessDetails(),
      financial_statements: buildFinancialStatements(),
      supporting_documents: buildSupportingDocuments(),
      declarations: buildDeclarations(),
      review_and_submit: buildReviewAndSubmit(),
    },
  });

  const invoiceInputs = generateInvoiceDetailsList(3);
  for (const input of invoiceInputs) {
    await prisma.invoice.create({
      data: {
        application_id: application.id,
        contract_id: null,
        details: buildInvoiceDetails(input),
        status: "SUBMITTED",
      },
    });
  }

  console.log("\n✅ Application created (invoice only, 3 invoices):");
  console.log(`   Application ID: ${application.id}`);
  console.log(`   Issuer Org: ${issuerOrg.name}`);
  console.log(`   Product: ${product.id}`);
  console.log(`   Status: SUBMITTED`);
  console.log("");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
