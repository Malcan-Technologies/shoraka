#!/usr/bin/env tsx
/**
 * Dev-only seed: create approved invoices that the Admin Notes UI can convert into notes.
 *
 * Eligibility rules:
 * - Admin "source invoices" endpoint only includes invoices where `Invoice.status = APPROVED`.
 * - Note creation from invoice hard-blocks unless `invoice.status === InvoiceStatus.APPROVED`.
 *
 * This script creates:
 * - IssuerOrganization (+ owner User)
 * - Product (minimal workflow so product category parsing works)
 * - Contract (APPROVED)
 * - Application (COMPLETED)
 * - 2-3 Invoices (APPROVED) with positive amounts in `offer_details`/`details`
 *
 * It is idempotent via deterministic IDs and upsert.
 */

import { Prisma, PrismaClient, ApplicationStatus, ContractStatus, InvoiceStatus, OrganizationType, UserRole } from "@prisma/client";
import { generateUniqueUserId } from "../src/lib/user-id-generator";

const prisma = new PrismaClient();

const SEED_ISSUER_ORG_ID = "seed_notes_issuer_org_a";
const SEED_PRODUCT_ID = "seed_notes_product_invoice_financing";
const SEED_CONTRACT_ID = "seed_notes_contract_a";

const SEED_APP_INVOICE_ONLY_ID = "seed_notes_app_invoice_only_a";
const SEED_APP_NEW_CONTRACT_ID = "seed_notes_app_new_contract_b";

const SEED_OWNER_EMAIL = "seed_notes_issuer_owner@example.com";
const SEED_OWNER_COGNITO_SUB = "seed_notes_issuer_owner_sub_abc";

const SEED_INVOICE_1_ID = "seed_notes_invoice_fee_1_no_fee";
const SEED_INVOICE_2_ID = "seed_notes_invoice_fee_2_platform_fee_only";
const SEED_INVOICE_3_ID = "seed_notes_invoice_fee_3_facility_fee_only";
const SEED_INVOICE_4_ID = "seed_notes_invoice_fee_4_platform_and_facility";
const SEED_INVOICE_5_ID = "seed_notes_invoice_maturity_today";

function maturityDateStr(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Note conversion expects YYYY-MM-DD string (it parses as date).
  return d.toISOString().slice(0, 10);
}

function maturityDateTodayLocalStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildInvoiceDetails(args: { number: string; appliedFinancing: number; maturityDate: string }) {
  const { number, appliedFinancing, maturityDate } = args;
  // NoteService uses `details.applied_financing` (first) and `details.maturity_date` (string) for maturity.
  return {
    number,
    applied_financing: appliedFinancing,
    maturity_date: maturityDate,
    due_date: maturityDate,
    // Extra fields are harmless but help with any other UI that expects common names.
    value: appliedFinancing,
    financing_ratio_percent: 80,
    invoice_value: appliedFinancing,
  } satisfies Record<string, unknown>;
}

function buildInvoiceOfferDetails(args: { offeredAmount: number; offeredProfitRatePercent: number; platformFeeRatePercent: number }) {
  const { offeredAmount, offeredProfitRatePercent, platformFeeRatePercent } = args;
  // NoteService uses:
  // - offer_details.offered_amount
  // - offer_details.offered_profit_rate_percent
  // - offer_details.platform_fee_rate_percent
  return {
    offered_amount: offeredAmount,
    offered_profit_rate_percent: offeredProfitRatePercent,
    platform_fee_rate_percent: platformFeeRatePercent,
  } satisfies Record<string, unknown>;
}

async function ensureOwnerUser() {
  const existing = await prisma.user.findUnique({
    where: { email: SEED_OWNER_EMAIL },
    select: { user_id: true },
  });

  if (existing) return existing.user_id;

  const userId = await generateUniqueUserId();
  const user = await prisma.user.create({
    data: {
      user_id: userId,
      email: SEED_OWNER_EMAIL,
      cognito_sub: SEED_OWNER_COGNITO_SUB,
      cognito_username: SEED_OWNER_EMAIL,
      roles: [UserRole.ISSUER],
      first_name: "Seed",
      last_name: "IssuerOwner",
      phone: null,
      investor_account: [],
      issuer_account: [SEED_ISSUER_ORG_ID],
    },
    select: { user_id: true },
  });

  return user.user_id;
}

async function main() {
  // If notes already exist for these invoices, we don't re-seed them (so the UI stays consistent).
  const seededInvoiceIds = [SEED_INVOICE_1_ID, SEED_INVOICE_2_ID, SEED_INVOICE_3_ID, SEED_INVOICE_4_ID, SEED_INVOICE_5_ID];
  const existingNotes = await prisma.note.findMany({
    where: { source_invoice_id: { in: seededInvoiceIds } },
    select: { source_invoice_id: true },
  });
  const noteSourceInvoiceIds = new Set(existingNotes.map((n) => n.source_invoice_id).filter(Boolean) as string[]);

  const ownerUserId = await ensureOwnerUser();

  // Product: minimal workflow with `financing_type_*` config so note creation can infer product category.
  await prisma.product.upsert({
    where: { id: SEED_PRODUCT_ID },
    update: {
      workflow: [
        {
          id: "financing_type_1",
          name: "Financing Type",
          config: { name: "Account Receivable Financing", category: "invoice_financing" },
        },
        { id: "financing_structure_1", name: "Financing Structure", config: { name: "Financing Structure" } },
        { id: "contract_details_1", name: "Contract Details", config: { name: "Contract Details" } },
        { id: "invoice_details_1", name: "Invoice Details", config: { name: "Invoice Details" } },
      ],
    },
    create: {
      id: SEED_PRODUCT_ID,
      base_id: null,
      workflow: [
        {
          id: "financing_type_1",
          name: "Financing Type",
          config: { name: "Account Receivable Financing", category: "invoice_financing" },
        },
        { id: "financing_structure_1", name: "Financing Structure", config: { name: "Financing Structure" } },
        { id: "contract_details_1", name: "Contract Details", config: { name: "Contract Details" } },
        { id: "invoice_details_1", name: "Invoice Details", config: { name: "Invoice Details" } },
      ],
      status: "ACTIVE",
      version: 1,
      service_fee_rate_percent: new Prisma.Decimal(15),
    },
  });

  const issuerOrgName = "Seed Notes Issuer Org";

  await prisma.issuerOrganization.upsert({
    where: { id: SEED_ISSUER_ORG_ID },
    update: {
      owner_user_id: ownerUserId,
      name: issuerOrgName,
      type: OrganizationType.COMPANY,
      onboarding_status: "COMPLETED",
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: {
        basicInfo: { industry: "Mining" },
      },
    },
    create: {
      id: SEED_ISSUER_ORG_ID,
      owner_user_id: ownerUserId,
      type: OrganizationType.COMPANY,
      name: issuerOrgName,
      registration_number: "202401011111",
      onboarding_status: "COMPLETED",
      onboarded_at: new Date(),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: {
        basicInfo: { industry: "Mining" },
      },
    },
  });

  await prisma.contract.upsert({
    where: { id: SEED_CONTRACT_ID },
    update: {
      issuer_organization_id: SEED_ISSUER_ORG_ID,
      status: ContractStatus.APPROVED,
      contract_details: {
        // Used by computeProgressiveFacilityFee() during note close funding:
        // - approved_facility => facility cap
        // - facility_fee_rate_percent => fee rate
        // - facility_fee_paid_amount => amount already charged (seed starts at 0)
        approved_facility: 100_000,
        facility_fee_rate_percent: 1.5, // 1.5% => when funded_amount=100_000, facility_fee_charged=1_500
        facility_fee_paid_amount: 0,

        // Extra fields used as fallbacks in some UI/resolvers.
        financing: 10_000,
        value: 10_000,
      },
      customer_details: {
        name: "Seed Customer (Paymaster)",
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
      },
    },
    create: {
      id: SEED_CONTRACT_ID,
      issuer_organization_id: SEED_ISSUER_ORG_ID,
      status: ContractStatus.APPROVED,
      contract_details: {
        approved_facility: 100_000,
        facility_fee_rate_percent: 1.5,
        facility_fee_paid_amount: 0,
        financing: 10_000,
        value: 10_000,
      },
      customer_details: {
        name: "Seed Customer (Paymaster)",
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
      },
    },
  });

  const applicationFinancingType = {
    product_id: SEED_PRODUCT_ID,
    product_name: "Account Receivable Financing",
    category: "invoice_financing",
  } satisfies Record<string, unknown>;

  await prisma.application.upsert({
    where: { id: SEED_APP_INVOICE_ONLY_ID },
    update: {
      issuer_organization_id: SEED_ISSUER_ORG_ID,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      financing_type: applicationFinancingType as Prisma.InputJsonValue,
      financing_structure: { structure_type: "invoice_only", existing_contract_id: null } as Prisma.InputJsonValue,
      contract_id: null,
    },
    create: {
      id: SEED_APP_INVOICE_ONLY_ID,
      issuer_organization_id: SEED_ISSUER_ORG_ID,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      submitted_at: new Date(),
      financing_type: applicationFinancingType as Prisma.InputJsonValue,
      financing_structure: { structure_type: "invoice_only", existing_contract_id: null } as Prisma.InputJsonValue,
      contract_id: null,
      company_details: Prisma.JsonNull,
      business_details: Prisma.JsonNull,
      financial_statements: Prisma.JsonNull,
      supporting_documents: Prisma.JsonNull,
      declarations: Prisma.JsonNull,
      review_and_submit: Prisma.JsonNull,
    },
  });

  await prisma.application.upsert({
    where: { id: SEED_APP_NEW_CONTRACT_ID },
    update: {
      issuer_organization_id: SEED_ISSUER_ORG_ID,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      financing_type: applicationFinancingType as Prisma.InputJsonValue,
      financing_structure: { structure_type: "new_contract", existing_contract_id: null } as Prisma.InputJsonValue,
      contract_id: SEED_CONTRACT_ID,
    },
    create: {
      id: SEED_APP_NEW_CONTRACT_ID,
      issuer_organization_id: SEED_ISSUER_ORG_ID,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      submitted_at: new Date(),
      financing_type: applicationFinancingType as Prisma.InputJsonValue,
      financing_structure: { structure_type: "new_contract", existing_contract_id: null } as Prisma.InputJsonValue,
      contract_id: SEED_CONTRACT_ID,
      company_details: Prisma.JsonNull,
      business_details: Prisma.JsonNull,
      financial_statements: Prisma.JsonNull,
      supporting_documents: Prisma.JsonNull,
      declarations: Prisma.JsonNull,
      review_and_submit: Prisma.JsonNull,
    },
  });

  const invoicesToSeed = [
    {
      // Case 1: No fee / zero fee (platform=0, facility=0 because contract_id is null)
      id: SEED_INVOICE_1_ID,
      applicationId: SEED_APP_INVOICE_ONLY_ID,
      contractId: null,
      invoiceNumber: "INV-SEED-NOTES-001",
      maturityDate: maturityDateStr(120),
      appliedFinancing: 100_000,
      offeredAmount: 100_000,
      offeredProfitRatePercent: 8,
      platformFeeRatePercent: 0,
    },
    {
      // Case 2: Platform Fee only (platform fee computed from note.platform_fee_rate_percent)
      id: SEED_INVOICE_2_ID,
      applicationId: SEED_APP_INVOICE_ONLY_ID,
      contractId: null,
      invoiceNumber: "INV-SEED-NOTES-002",
      maturityDate: maturityDateStr(150),
      appliedFinancing: 100_000,
      offeredAmount: 100_000,
      offeredProfitRatePercent: 8,
      platformFeeRatePercent: 1, // platformFeeAmount ~= 100_000 * 1% = 1_000
    },
    {
      // Case 3: Facility Fee only (facility fee computed from contract.contract_details facility_fee_rate_percent)
      id: SEED_INVOICE_3_ID,
      applicationId: SEED_APP_NEW_CONTRACT_ID,
      contractId: SEED_CONTRACT_ID,
      invoiceNumber: "INV-SEED-NOTES-003",
      maturityDate: maturityDateStr(180),
      appliedFinancing: 100_000,
      offeredAmount: 100_000,
      offeredProfitRatePercent: 8,
      platformFeeRatePercent: 0,
    },
    {
      // Case 4: Platform Fee + Facility Fee
      id: SEED_INVOICE_4_ID,
      applicationId: SEED_APP_NEW_CONTRACT_ID,
      contractId: SEED_CONTRACT_ID,
      invoiceNumber: "INV-SEED-NOTES-004",
      maturityDate: maturityDateStr(210),
      appliedFinancing: 100_000,
      offeredAmount: 100_000,
      offeredProfitRatePercent: 8,
      platformFeeRatePercent: 1, // platformFeeAmount ~= 1_000
    },
    {
      // Approved Invoice - Maturity Today
      id: SEED_INVOICE_5_ID,
      applicationId: SEED_APP_INVOICE_ONLY_ID,
      contractId: null,
      invoiceNumber: "INV-SEED-NOTES-005",
      maturityDate: maturityDateTodayLocalStr(),
      appliedFinancing: 100_000,
      offeredAmount: 100_000,
      offeredProfitRatePercent: 8,
      // Explicitly zero so trustee-letter fee rows are not shown for this case.
      platformFeeRatePercent: 0,
    },
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const inv of invoicesToSeed) {
    if (noteSourceInvoiceIds.has(inv.id)) {
      skippedCount++;
      continue;
    }

    await prisma.invoice.upsert({
      where: { id: inv.id },
      update: {
        application_id: inv.applicationId,
        contract_id: inv.contractId,
        status: InvoiceStatus.APPROVED,
        details: buildInvoiceDetails({ number: inv.invoiceNumber, appliedFinancing: inv.appliedFinancing, maturityDate: inv.maturityDate }) as Prisma.InputJsonValue,
        offer_details: buildInvoiceOfferDetails({
          offeredAmount: inv.offeredAmount,
          offeredProfitRatePercent: inv.offeredProfitRatePercent,
          platformFeeRatePercent: inv.platformFeeRatePercent,
        }) as Prisma.InputJsonValue,
      },
      create: {
        id: inv.id,
        application_id: inv.applicationId,
        contract_id: inv.contractId,
        status: InvoiceStatus.APPROVED,
        details: buildInvoiceDetails({ number: inv.invoiceNumber, appliedFinancing: inv.appliedFinancing, maturityDate: inv.maturityDate }) as Prisma.InputJsonValue,
        offer_details: buildInvoiceOfferDetails({
          offeredAmount: inv.offeredAmount,
          offeredProfitRatePercent: inv.offeredProfitRatePercent,
          platformFeeRatePercent: inv.platformFeeRatePercent,
        }) as Prisma.InputJsonValue,
      },
    });

    createdCount++;
  }

  console.log("✅ Seeded approved invoices for note creation");
  console.log(`   Invoices seeded: ${createdCount}`);
  console.log(`   Invoices skipped (notes already exist): ${skippedCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

