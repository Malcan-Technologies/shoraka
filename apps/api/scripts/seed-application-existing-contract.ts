#!/usr/bin/env tsx
/**
 * Seed script: Creates a SUBMITTED application with existing_contract structure,
 * linking to an APPROVED contract, with 3 invoices. Uses randomized but valid data.
 *
 * Usage: pnpm seed-application-existing-contract [issuerOrgId] [productId] [contractId]
 * - contractId optional: if omitted, creates a new APPROVED contract first.
 * - If contractId provided, it must exist, belong to issuerOrg, and have status APPROVED.
 *
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
  buildContractDetails,
  buildCustomerDetails,
} from "./seed-application-helpers";

const prisma = new PrismaClient();

async function main() {
  const [issuerOrgIdArg, productIdArg, contractIdArg] = process.argv.slice(2);

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

  let contractId: string;

  if (contractIdArg) {
    const existing = await prisma.contract.findFirst({
      where: {
        id: contractIdArg,
        issuer_organization_id: issuerOrg.id,
        status: "APPROVED",
      },
    });
    if (!existing) {
      console.error(
        `Contract ${contractIdArg} not found, or not APPROVED, or does not belong to issuer org. ` +
          `Use an APPROVED contract ID or omit to create one.`
      );
      process.exit(1);
    }
    contractId = existing.id;
    console.log(`Using existing APPROVED contract: ${contractId}`);
  } else {
    const contractDetails = buildContractDetails() as Record<string, unknown>;
    const customerDetails = buildCustomerDetails();
    const contract = await prisma.contract.create({
      data: {
        issuer_organization_id: issuerOrg.id,
        status: "APPROVED",
        contract_details: contractDetails,
        customer_details: customerDetails,
      },
    });
    contractId = contract.id;
    console.log(`Created new APPROVED contract: ${contractId}`);
  }

  const application = await prisma.application.create({
    data: {
      issuer_organization_id: issuerOrg.id,
      product_version: product.version,
      status: "SUBMITTED",
      submitted_at: new Date(),
      last_completed_step: 9,
      financing_type: { product_id: product.id },
      financing_structure: { structure_type: "existing_contract", existing_contract_id: contractId },
      contract_id: contractId,
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
        contract_id: contractId,
        details: buildInvoiceDetails(input),
        status: "SUBMITTED",
      },
    });
  }

  console.log("\n✅ Application created (existing contract + 3 invoices):");
  console.log(`   Application ID: ${application.id}`);
  console.log(`   Contract ID: ${contractId}`);
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
