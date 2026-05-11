#!/usr/bin/env tsx
/**
 * Fast issuer dashboard flow seed (idempotent).
 *
 * Seeds:
 * - One product for grouping
 * - One issuer organization + issuer user
 * - 3 applications: invoice_only, new_contract, existing_contract
 * - 2 linked contract applications share the same Contract row
 * - Invoices with correct contract_id linkage
 * - Notes (and NoteListing) for dashboard funding progress + Note no rendering
 *
 * Usage:
 *   pnpm -C apps/api tsx scripts/seed-issuer-dashboard-flow.ts
 *   (optional) set DATABASE_URL and ensure migrations exist
 */

import { PrismaClient, OrganizationType, UserRole, Prisma } from "@prisma/client";
import { generateUniqueUserId } from "../src/lib/user-id-generator";

const prisma = new PrismaClient();

// Fixed IDs so re-running the seed is predictable (and upsert-friendly).
const PRODUCT_ID = "seed_product_arfin_v1";
const ISSUER_ORG_ID = "seed_issuer_abc_supplier_org";
const CONTRACT_ID = "seed_contract_mining_rig_repair_12654";

const APP_INVOICE_ONLY_ID = "seed_app_invoice_only_a";
const APP_NEW_CONTRACT_ID = "seed_app_new_contract_b";
const APP_EXISTING_CONTRACT_ID = "seed_app_existing_contract_c";

const INV_1001_ID = "seed_invoice_1001";
const INV_1002_ID = "seed_invoice_1002";
const INV_1003_ID = "seed_invoice_1003";
const INV_2001_ID = "seed_invoice_2001";
const INV_2002_ID = "seed_invoice_2002";
const INV_3001_ID = "seed_invoice_3001";

const NOTE_0001_ID = "seed_note_0001";
const NOTE_0002_ID = "seed_note_0002";
const NOTE_0003_ID = "seed_note_0003";

const NOTE_REF_0001 = "NOTE-0001";
const NOTE_REF_0002 = "NOTE-0002";
const NOTE_REF_0003 = "NOTE-0003";

// Login target for manual testing.
const ISSUER_TEST_USER_EMAIL = "max.chng@malcan.io";
const ISSUER_TEST_USER_COGNITO_SUB = "seed_issuer_dashboard_user_sub_abc_supplier";

const issuerOrgName = "ABC Supplier Sdn Bhd";
const customerName = "Petronas Chemical Bhd";
const contractTitle = "Mining Rig Repair 12654";

// Fixed future dates (relative to the day you run this, but stable as strings).
// Dashboard uses ISO string parsing for display, so keep YYYY-MM-DD where possible.
const maturityDateStr = "2026-12-31";
const noteClosesAtStr = "2026-11-30";

function toDate(yyyyMmDd: string): Date {
  // Interpret as UTC midnight for stable parsing.
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

function buildInvoiceDetails(args: {
  number: string;
  valueRm: number;
  financingRatioPercent: number;
  maturityDate: string;
}) {
  const { number, valueRm, financingRatioPercent, maturityDate } = args;
  const fileName = `invoice-${number}.pdf`;
  const s3Key = `applications/seed/invoices/${fileName}`;

  return {
    number,
    value: valueRm,
    financing_ratio_percent: financingRatioPercent,
    maturity_date: maturityDate,
    due_date: maturityDate,
    document: {
      file_name: fileName,
      s3_key: s3Key,
      file_size: 12345,
    },
  };
}

function buildContractDetails() {
  return {
    title: contractTitle,
    // Used by IssuerDashboardService for approved facility.
    approved_facility: 50000,
    // Kept as fallback; when notes exist, the dashboard uses notes-derived utilization.
    utilized_facility: 10000,
    available_facility: 40000,
    start_date: "2026-01-15",
    end_date: "2026-07-15",
  };
}

function buildContractCustomerDetails() {
  return {
    name: customerName,
    country: "MY",
    entity_type: "Private Limited Company (Sdn Bhd)",
  };
}

function buildIssuerSnapshot() {
  return {
    id: ISSUER_ORG_ID,
    name: issuerOrgName,
    type: "COMPANY",
  };
}

async function ensureIssuerTestUser(issuerOrgId: string) {
  // Seed.ts already creates an admin with this email; we update it to also be an ISSUER role
  // so the issuer dashboard routes are accessible when DISABLE_AUTH is enabled.
  let user = await prisma.user.findUnique({ where: { email: ISSUER_TEST_USER_EMAIL } });

  if (!user) {
    const userId = await generateUniqueUserId();
    user = await prisma.user.create({
      data: {
        user_id: userId,
        email: ISSUER_TEST_USER_EMAIL,
        cognito_sub: ISSUER_TEST_USER_COGNITO_SUB,
        cognito_username: ISSUER_TEST_USER_EMAIL,
        roles: [UserRole.ADMIN, UserRole.ISSUER],
        issuer_account: [issuerOrgId],
        investor_account: [],
        first_name: "Issuer",
        last_name: "Dashboard",
        phone: null,
      },
    });
    return user;
  }

  const needsCognitoSubUpdate = user.cognito_sub !== ISSUER_TEST_USER_COGNITO_SUB;
  const cognitoSubAvailable = !(await prisma.user.findUnique({ where: { cognito_sub: ISSUER_TEST_USER_COGNITO_SUB } }));

  await prisma.user.update({
    where: { user_id: user.user_id },
    data: {
      roles: { set: Array.from(new Set([...(user.roles ?? []), UserRole.ADMIN, UserRole.ISSUER])) },
      issuer_account: user.issuer_account?.length ? user.issuer_account : [issuerOrgId],
      // Only change cognito_sub if it's safe (it must be globally unique).
      ...(needsCognitoSubUpdate && cognitoSubAvailable
        ? { cognito_sub: ISSUER_TEST_USER_COGNITO_SUB }
        : {}),
    },
  });

  return prisma.user.findUnique({ where: { user_id: user.user_id } });
}

async function main() {
  const maturityDate = toDate(maturityDateStr);
  const noteClosesAt = toDate(noteClosesAtStr);

  // 1) User + organization
  const user = await ensureIssuerTestUser(ISSUER_ORG_ID);

  const issuerOrg = await prisma.issuerOrganization.upsert({
    where: { id: ISSUER_ORG_ID },
    create: {
      id: ISSUER_ORG_ID,
      owner_user_id: user.user_id,
      type: OrganizationType.COMPANY,
      name: issuerOrgName,
      registration_number: "202401054321",
      onboarding_status: "COMPLETED",
      onboarded_at: new Date("2026-04-01T00:00:00.000Z"),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      admin_approved_at: new Date("2026-04-01T00:00:00.000Z"),
    },
    update: {
      owner_user_id: user.user_id,
      type: OrganizationType.COMPANY,
      name: issuerOrgName,
      onboarding_status: "COMPLETED",
      onboarded_at: new Date("2026-04-01T00:00:00.000Z"),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      admin_approved_at: new Date("2026-04-01T00:00:00.000Z"),
    },
  });

  // 2) Product (for dashboard grouping)
  await prisma.product.upsert({
    where: { id: PRODUCT_ID },
    create: {
      id: PRODUCT_ID,
      version: 1,
      status: "ACTIVE",
      workflow: [
        {
          id: "financing_type_1",
          name: "Financing Type",
          config: {
            name: "Account Receivable Financing",
            category: "invoice_financing",
          },
        },
        { id: "financing_structure_1", name: "Financing Structure", config: { name: "Financing Structure" } },
        { id: "contract_details_1", name: "Contract Details", config: { name: "Contract Details" } },
        { id: "invoice_details_1", name: "Invoice Details", config: { name: "Invoice Details" } },
      ],
    },
    update: {
      version: 1,
      status: "ACTIVE",
      workflow: [
        {
          id: "financing_type_1",
          name: "Financing Type",
          config: {
            name: "Account Receivable Financing",
            category: "invoice_financing",
          },
        },
        { id: "financing_structure_1", name: "Financing Structure", config: { name: "Financing Structure" } },
        { id: "contract_details_1", name: "Contract Details", config: { name: "Contract Details" } },
        { id: "invoice_details_1", name: "Invoice Details", config: { name: "Invoice Details" } },
      ],
    },
  });

  // 3) Contract
  await prisma.contract.upsert({
    where: { id: CONTRACT_ID },
    create: {
      id: CONTRACT_ID,
      issuer_organization_id: issuerOrg.id,
      status: "APPROVED",
      contract_details: buildContractDetails(),
      customer_details: buildContractCustomerDetails(),
    },
    update: {
      issuer_organization_id: issuerOrg.id,
      status: "APPROVED",
      contract_details: buildContractDetails(),
      customer_details: buildContractCustomerDetails(),
    },
  });

  // 4) Applications
  const financingTypeJson = { product_id: PRODUCT_ID };

  // Invoice-only: no contract_id, so it should not appear in Contract Financing cards.
  await prisma.application.upsert({
    where: { id: APP_INVOICE_ONLY_ID },
    create: {
      id: APP_INVOICE_ONLY_ID,
      issuer_organization_id: issuerOrg.id,
      product_version: 1,
      status: "SUBMITTED",
      last_completed_step: 9,
      financing_type: financingTypeJson,
      financing_structure: { structure_type: "invoice_only", existing_contract_id: null },
      contract_id: null,
    },
    update: {
      issuer_organization_id: issuerOrg.id,
      product_version: 1,
      status: "SUBMITTED",
      last_completed_step: 9,
      financing_type: financingTypeJson,
      financing_structure: { structure_type: "invoice_only", existing_contract_id: null },
      contract_id: null,
    },
  });

  // New contract
  await prisma.application.upsert({
    where: { id: APP_NEW_CONTRACT_ID },
    create: {
      id: APP_NEW_CONTRACT_ID,
      issuer_organization_id: issuerOrg.id,
      product_version: 1,
      status: "SUBMITTED",
      submitted_at: new Date("2026-05-10T00:00:00.000Z"),
      last_completed_step: 9,
      financing_type: financingTypeJson,
      financing_structure: { structure_type: "new_contract", existing_contract_id: null },
      contract_id: CONTRACT_ID,
    },
    update: {
      issuer_organization_id: issuerOrg.id,
      product_version: 1,
      status: "SUBMITTED",
      submitted_at: new Date("2026-05-10T00:00:00.000Z"),
      last_completed_step: 9,
      financing_type: financingTypeJson,
      financing_structure: { structure_type: "new_contract", existing_contract_id: null },
      contract_id: CONTRACT_ID,
    },
  });

  // Existing contract
  await prisma.application.upsert({
    where: { id: APP_EXISTING_CONTRACT_ID },
    create: {
      id: APP_EXISTING_CONTRACT_ID,
      issuer_organization_id: issuerOrg.id,
      product_version: 1,
      status: "SUBMITTED",
      submitted_at: new Date("2026-05-10T00:00:00.000Z"),
      last_completed_step: 9,
      financing_type: financingTypeJson,
      financing_structure: { structure_type: "existing_contract", existing_contract_id: CONTRACT_ID },
      contract_id: CONTRACT_ID,
    },
    update: {
      issuer_organization_id: issuerOrg.id,
      product_version: 1,
      status: "SUBMITTED",
      submitted_at: new Date("2026-05-10T00:00:00.000Z"),
      last_completed_step: 9,
      financing_type: financingTypeJson,
      financing_structure: { structure_type: "existing_contract", existing_contract_id: CONTRACT_ID },
      contract_id: CONTRACT_ID,
    },
  });

  // 5) Invoices (contract_id drives "main Invoice Financing" filtering)
  // Ratio helper:
  const ratioFor = (financing: number, value: number) => (financing / value) * 100;

  const invDetails1001 = buildInvoiceDetails({
    number: "INV-1001",
    valueRm: 10000,
    financingRatioPercent: ratioFor(8000, 10000),
    maturityDate: maturityDateStr,
  });
  const invDetails1002 = buildInvoiceDetails({
    number: "INV-1002",
    valueRm: 20000,
    financingRatioPercent: ratioFor(15000, 20000),
    maturityDate: maturityDateStr,
  });
  const invDetails1003 = buildInvoiceDetails({
    number: "INV-1003",
    valueRm: 30000,
    financingRatioPercent: ratioFor(20000, 30000),
    maturityDate: maturityDateStr,
  });

  const invDetails2001 = buildInvoiceDetails({
    number: "INV-2001",
    valueRm: 15000,
    financingRatioPercent: ratioFor(10000, 15000),
    maturityDate: maturityDateStr,
  });
  const invDetails2002 = buildInvoiceDetails({
    number: "INV-2002",
    valueRm: 12000,
    financingRatioPercent: ratioFor(8000, 12000),
    maturityDate: maturityDateStr,
  });

  const invDetails3001 = buildInvoiceDetails({
    number: "INV-3001",
    valueRm: 15000,
    financingRatioPercent: ratioFor(10000, 15000),
    maturityDate: maturityDateStr,
  });

  // Application A: invoice-only => contract_id null
  await prisma.invoice.upsert({
    where: { id: INV_1001_ID },
    create: {
      id: INV_1001_ID,
      application_id: APP_INVOICE_ONLY_ID,
      contract_id: null,
      details: invDetails1001,
      status: "SUBMITTED",
    },
    update: {
      application_id: APP_INVOICE_ONLY_ID,
      contract_id: null,
      details: invDetails1001,
      status: "SUBMITTED",
    },
  });

  await prisma.invoice.upsert({
    where: { id: INV_1002_ID },
    create: {
      id: INV_1002_ID,
      application_id: APP_INVOICE_ONLY_ID,
      contract_id: null,
      details: invDetails1002,
      status: "SUBMITTED",
    },
    update: {
      application_id: APP_INVOICE_ONLY_ID,
      contract_id: null,
      details: invDetails1002,
      status: "SUBMITTED",
    },
  });

  await prisma.invoice.upsert({
    where: { id: INV_1003_ID },
    create: {
      id: INV_1003_ID,
      application_id: APP_INVOICE_ONLY_ID,
      contract_id: null,
      details: invDetails1003,
      status: "SUBMITTED",
    },
    update: {
      application_id: APP_INVOICE_ONLY_ID,
      contract_id: null,
      details: invDetails1003,
      status: "SUBMITTED",
    },
  });

  // Application B: new contract => contract_id linked
  await prisma.invoice.upsert({
    where: { id: INV_2001_ID },
    create: {
      id: INV_2001_ID,
      application_id: APP_NEW_CONTRACT_ID,
      contract_id: CONTRACT_ID,
      details: invDetails2001,
      status: "SUBMITTED",
    },
    update: {
      application_id: APP_NEW_CONTRACT_ID,
      contract_id: CONTRACT_ID,
      details: invDetails2001,
      status: "SUBMITTED",
    },
  });

  await prisma.invoice.upsert({
    where: { id: INV_2002_ID },
    create: {
      id: INV_2002_ID,
      application_id: APP_NEW_CONTRACT_ID,
      contract_id: CONTRACT_ID,
      details: invDetails2002,
      status: "SUBMITTED",
    },
    update: {
      application_id: APP_NEW_CONTRACT_ID,
      contract_id: CONTRACT_ID,
      details: invDetails2002,
      status: "SUBMITTED",
    },
  });

  // Application C: existing contract => contract_id linked
  await prisma.invoice.upsert({
    where: { id: INV_3001_ID },
    create: {
      id: INV_3001_ID,
      application_id: APP_EXISTING_CONTRACT_ID,
      contract_id: CONTRACT_ID,
      details: invDetails3001,
      status: "SUBMITTED",
    },
    update: {
      application_id: APP_EXISTING_CONTRACT_ID,
      contract_id: CONTRACT_ID,
      details: invDetails3001,
      status: "SUBMITTED",
    },
  });

  // 6) Notes + NoteListing
  // Main dashboard expects:
  // - INV-1001 has NOTE-0001 => shows progress 50%
  // - INV-1002/1003 have no notes => Note no "-"
  // - INV-2001 has NOTE-0002 => contract detail shows ref + 80% funded
  // - INV-2002 has NOTE-0003 as ACTIVE => helps test activeNotesCount + utilization derived from notes

  const noteOpensAt = new Date("2026-05-12T00:00:00.000Z");

  await prisma.note.upsert({
    where: { note_reference: NOTE_REF_0001 },
    create: {
      id: NOTE_0001_ID,
      source_application_id: APP_INVOICE_ONLY_ID,
      source_contract_id: null,
      source_invoice_id: INV_1001_ID,
      issuer_organization_id: issuerOrg.id,
      title: "Seed note for INV-1001",
      note_reference: NOTE_REF_0001,
      product_snapshot: { product_id: PRODUCT_ID },
      issuer_snapshot: buildIssuerSnapshot(),
      paymaster_snapshot: { name: customerName },
      contract_snapshot: Prisma.JsonNull,
      invoice_snapshot: Prisma.JsonNull,
      requested_amount: 8000,
      target_amount: 8000,
      funded_amount: 4000,
      minimum_funding_percent: 80,
      profit_rate_percent: null,
      status: "PUBLISHED",
      listing_status: "PUBLISHED",
      funding_status: "OPEN",
      servicing_status: "NOT_STARTED",
      maturity_date: maturityDate,
    },
    update: {
      source_application_id: APP_INVOICE_ONLY_ID,
      source_contract_id: null,
      source_invoice_id: INV_1001_ID,
      issuer_organization_id: issuerOrg.id,
      title: "Seed note for INV-1001",
      product_snapshot: { product_id: PRODUCT_ID },
      issuer_snapshot: buildIssuerSnapshot(),
      paymaster_snapshot: { name: customerName },
      contract_snapshot: Prisma.JsonNull,
      invoice_snapshot: Prisma.JsonNull,
      requested_amount: 8000,
      target_amount: 8000,
      funded_amount: 4000,
      minimum_funding_percent: 80,
      profit_rate_percent: null,
      status: "PUBLISHED",
      listing_status: "PUBLISHED",
      funding_status: "OPEN",
      servicing_status: "NOT_STARTED",
      maturity_date: maturityDate,
    },
  });

  await prisma.noteListing.upsert({
    where: { note_id: NOTE_0001_ID },
    create: {
      note_id: NOTE_0001_ID,
      status: "PUBLISHED",
      opens_at: noteOpensAt,
      closes_at: noteClosesAt,
    },
    update: {
      status: "PUBLISHED",
      opens_at: noteOpensAt,
      closes_at: noteClosesAt,
    },
  });

  await prisma.note.upsert({
    where: { note_reference: NOTE_REF_0002 },
    create: {
      id: NOTE_0002_ID,
      source_application_id: APP_NEW_CONTRACT_ID,
      source_contract_id: CONTRACT_ID,
      source_invoice_id: INV_2001_ID,
      issuer_organization_id: issuerOrg.id,
      title: "Seed note for INV-2001",
      note_reference: NOTE_REF_0002,
      product_snapshot: { product_id: PRODUCT_ID },
      issuer_snapshot: buildIssuerSnapshot(),
      paymaster_snapshot: { name: customerName },
      contract_snapshot: { id: CONTRACT_ID },
      invoice_snapshot: Prisma.JsonNull,
      requested_amount: 10000,
      target_amount: 10000,
      funded_amount: 8000,
      minimum_funding_percent: 80,
      profit_rate_percent: null,
      status: "FUNDING",
      listing_status: "CLOSED",
      funding_status: "FUNDED",
      servicing_status: "NOT_STARTED",
      maturity_date: maturityDate,
    },
    update: {
      source_application_id: APP_NEW_CONTRACT_ID,
      source_contract_id: CONTRACT_ID,
      source_invoice_id: INV_2001_ID,
      issuer_organization_id: issuerOrg.id,
      title: "Seed note for INV-2001",
      product_snapshot: { product_id: PRODUCT_ID },
      issuer_snapshot: buildIssuerSnapshot(),
      paymaster_snapshot: { name: customerName },
      contract_snapshot: { id: CONTRACT_ID },
      invoice_snapshot: Prisma.JsonNull,
      requested_amount: 10000,
      target_amount: 10000,
      funded_amount: 8000,
      minimum_funding_percent: 80,
      profit_rate_percent: null,
      status: "FUNDING",
      listing_status: "CLOSED",
      funding_status: "FUNDED",
      servicing_status: "NOT_STARTED",
      maturity_date: maturityDate,
    },
  });

  await prisma.noteListing.upsert({
    where: { note_id: NOTE_0002_ID },
    create: {
      note_id: NOTE_0002_ID,
      status: "CLOSED",
      opens_at: noteOpensAt,
      closes_at: noteClosesAt,
    },
    update: {
      status: "CLOSED",
      opens_at: noteOpensAt,
      closes_at: noteClosesAt,
    },
  });

  await prisma.note.upsert({
    where: { note_reference: NOTE_REF_0003 },
    create: {
      id: NOTE_0003_ID,
      source_application_id: APP_NEW_CONTRACT_ID,
      source_contract_id: CONTRACT_ID,
      source_invoice_id: INV_2002_ID,
      issuer_organization_id: issuerOrg.id,
      title: "Seed active note for INV-2002",
      note_reference: NOTE_REF_0003,
      product_snapshot: { product_id: PRODUCT_ID },
      issuer_snapshot: buildIssuerSnapshot(),
      paymaster_snapshot: { name: customerName },
      contract_snapshot: { id: CONTRACT_ID },
      invoice_snapshot: Prisma.JsonNull,
      requested_amount: 2000,
      target_amount: 2000,
      funded_amount: 2000,
      minimum_funding_percent: 80,
      profit_rate_percent: null,
      status: "ACTIVE",
      listing_status: "CLOSED",
      funding_status: "FUNDED",
      servicing_status: "CURRENT",
      maturity_date: maturityDate,
    },
    update: {
      source_application_id: APP_NEW_CONTRACT_ID,
      source_contract_id: CONTRACT_ID,
      source_invoice_id: INV_2002_ID,
      issuer_organization_id: issuerOrg.id,
      title: "Seed active note for INV-2002",
      product_snapshot: { product_id: PRODUCT_ID },
      issuer_snapshot: buildIssuerSnapshot(),
      paymaster_snapshot: { name: customerName },
      contract_snapshot: { id: CONTRACT_ID },
      invoice_snapshot: Prisma.JsonNull,
      requested_amount: 2000,
      target_amount: 2000,
      funded_amount: 2000,
      minimum_funding_percent: 80,
      profit_rate_percent: null,
      status: "ACTIVE",
      listing_status: "CLOSED",
      funding_status: "FUNDED",
      servicing_status: "CURRENT",
      maturity_date: maturityDate,
    },
  });

  await prisma.noteListing.upsert({
    where: { note_id: NOTE_0003_ID },
    create: {
      note_id: NOTE_0003_ID,
      status: "CLOSED",
      opens_at: noteOpensAt,
      closes_at: noteClosesAt,
    },
    update: {
      status: "CLOSED",
      opens_at: noteOpensAt,
      closes_at: noteClosesAt,
    },
  });

  console.log("\n✅ Seeded issuer dashboard flow scenario");
  console.log(`   Product ID: ${PRODUCT_ID}`);
  console.log(`   Issuer Org ID: ${issuerOrg.id}`);
  console.log(`   Contract ID: ${CONTRACT_ID}`);
  console.log(`   Applications: ${APP_INVOICE_ONLY_ID}, ${APP_NEW_CONTRACT_ID}, ${APP_EXISTING_CONTRACT_ID}`);
  console.log(`   Invoices: INV-1001/2/3, INV-2001/2002, INV-3001`);
  console.log(`   Notes: ${NOTE_REF_0001}, ${NOTE_REF_0002}, ${NOTE_REF_0003}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

