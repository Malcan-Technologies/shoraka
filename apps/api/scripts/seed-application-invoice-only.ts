#!/usr/bin/env tsx
/**
 * Seed script: Creates a SUBMITTED application with invoice_only structure
 * and 3 invoices (no contract). Uses randomized but valid data.
 *
 * Usage: pnpm seed-application-invoice-only [issuerOrgId] [productId]
 * Defaults: issuerOrgId=cmknlimvf0003grp0hsbmc1dp, productId=cmm1rrzct00029crp14sbuup9
 */

import { Prisma, PrismaClient } from "@prisma/client";
import {
  generateInvoiceDetailsList,
  buildInvoiceDetails,
  buildCompanyDetails,
  buildBusinessDetails,
  buildFinancialStatements,
  buildSupportingDocuments,
  buildDeclarations,
  buildReviewAndSubmit,
  buildCustomerDetails,
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

  const customerDetails = buildCustomerDetails() as Prisma.InputJsonValue;
  const contract = await prisma.contract.create({
    data: {
      issuer_organization_id: issuerOrg.id,
      status: "SUBMITTED",
      contract_details: Prisma.JsonNull,
      customer_details: customerDetails,
    },
  });

  const application = await prisma.application.create({
    data: {
      issuer_organization_id: issuerOrg.id,
      product_version: product.version,
      status: "SUBMITTED",
      submitted_at: new Date(),
      last_completed_step: 9,
      financing_type: { product_id: product.id } as Prisma.InputJsonValue,
      financing_structure: { structure_type: "invoice_only", existing_contract_id: null } as Prisma.InputJsonValue,
      contract_id: contract.id,
      company_details: buildCompanyDetails(issuerOrg.id) as Prisma.InputJsonValue,
      business_details: buildBusinessDetails() as Prisma.InputJsonValue,
      financial_statements: buildFinancialStatements() as Prisma.InputJsonValue,
      supporting_documents: buildSupportingDocuments() as Prisma.InputJsonValue,
      declarations: buildDeclarations() as Prisma.InputJsonValue,
      review_and_submit: buildReviewAndSubmit() as Prisma.InputJsonValue,
    },
  });

  const invoiceInputs = generateInvoiceDetailsList(3);
  for (const input of invoiceInputs) {
    await prisma.invoice.create({
      data: {
        application_id: application.id,
        contract_id: null,
        details: buildInvoiceDetails(input) as Prisma.InputJsonValue,
        status: "SUBMITTED",
      },
    });
  }

  console.log("\n✅ Application created (invoice only, 3 invoices):");
  console.log(`   Application ID: ${application.id}`);
  console.log(`   Contract ID: ${contract.id} (customer details + consent only)`);
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
