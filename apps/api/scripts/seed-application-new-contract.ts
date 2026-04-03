#!/usr/bin/env tsx
/**
 * Seed script: Creates a SUBMITTED application with new_contract structure,
 * a new Contract, and 3 invoices. Uses randomized but valid data.
 *
 * Usage: pnpm seed-application-new-contract [issuerOrgId] [productId]
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
  const [issuerOrgIdArg, productIdArg] = process.argv.slice(2);

  const issuerOrgId = issuerOrgIdArg ?? "cmknlimvf0003grp0hsbmc1dp";
  const productId = productIdArg ?? "cmnee7dzx00018hrvz33d48wb";

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

  const workflow = product.workflow as { id?: string }[] | null;
  const hasContractStep = Array.isArray(workflow) && workflow.some((s) => s.id?.includes?.("contract"));
  const hasInvoiceStep = Array.isArray(workflow) && workflow.some((s) => s.id?.includes?.("invoice"));
  if (!hasContractStep || !hasInvoiceStep) {
    console.warn("Product may not have contract_details or invoice_details steps. Proceeding anyway.");
  }

  const contractDetails = buildContractDetails() as Record<string, unknown>;
  const customerDetails = buildCustomerDetails();

  const contract = await prisma.contract.create({
    data: {
      issuer_organization_id: issuerOrg.id,
      status: "SUBMITTED",
      contract_details: contractDetails,
      customer_details: customerDetails,
    },
  });

  const invoiceInputs = generateInvoiceDetailsList(3);
  const application = await prisma.application.create({
    data: {
      issuer_organization_id: issuerOrg.id,
      product_version: product.version,
      status: "SUBMITTED",
      submitted_at: new Date(),
      last_completed_step: 9,
      financing_type: { product_id: product.id },
      financing_structure: { structure_type: "new_contract", existing_contract_id: null },
      contract_id: contract.id,
      company_details: buildCompanyDetails(issuerOrg.id),
      business_details: buildBusinessDetails(),
      financial_statements: buildFinancialStatements(),
      supporting_documents: buildSupportingDocuments(),
      declarations: buildDeclarations(),
      review_and_submit: buildReviewAndSubmit(),
    },
  });

  for (const input of invoiceInputs) {
    await prisma.invoice.create({
      data: {
        application_id: application.id,
        contract_id: contract.id,
        details: buildInvoiceDetails(input),
        status: "SUBMITTED",
      },
    });
  }

  console.log("\n✅ Application created (new contract + 3 invoices):");
  console.log(`   Application ID: ${application.id}`);
  console.log(`   Contract ID: ${contract.id}`);
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
