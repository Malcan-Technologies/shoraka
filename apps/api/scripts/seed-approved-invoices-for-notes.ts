#!/usr/bin/env tsx
/**
 * Dev-only seed: create approved invoices that the Admin Notes UI can convert into notes.
 *
 * Default (fresh) mode — each run creates NEW approved invoices with unique references:
 *   pnpm --filter @cashsouk/api seed-approved-invoices-for-notes
 *   pnpm --filter @cashsouk/api seed-approved-invoices-for-notes -- --count 5
 *
 * Fixed (deterministic upsert) mode — stable IDs/references for repeatable local setup:
 *   pnpm --filter @cashsouk/api seed-approved-invoices-for-notes -- --fixed
 *
 * Eligibility (matches NoteService.createFromInvoice / listSourceInvoicesForNotes):
 * - Invoice.status = APPROVED
 * - Application.status = COMPLETED
 * - No existing note.source_invoice_id for the invoice
 * - Positive offered/applied financing in details + offer_details
 */

import {
  Prisma,
  PrismaClient,
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
  OrganizationType,
  UserRole,
} from "@prisma/client";
import { generateUniqueUserId } from "../src/lib/user-id-generator";
import {
  resolveOfferedAmount,
  resolveRequestedInvoiceAmount,
} from "../src/lib/invoice-offer";
import { buildAboutYourBusinessCod } from "./seed-application-helpers";

const prisma = new PrismaClient();

const SEED_PREFIX = "SEED-INV-NOTE";
const SEED_ISSUER_ORG_ID = "seed_notes_issuer_org_a";
const SEED_PRODUCT_ID = "seed_notes_product_invoice_financing";
const SEED_CONTRACT_ID = "seed_notes_contract_a";
const SEED_APP_INVOICE_ONLY_ID = "seed_notes_app_invoice_only_a";
const SEED_APP_INVOICE_ONLY_B_ID = "seed_notes_app_invoice_only_b";
const SEED_APP_NEW_CONTRACT_ID = "seed_notes_app_new_contract_c";
const SEED_APP_NEW_CONTRACT_D_ID = "seed_notes_app_new_contract_d";
const SEED_APP_INVOICE_ONLY_E_ID = "seed_notes_app_invoice_only_e";
const SEED_OWNER_EMAIL = "seed_notes_issuer_owner@example.com";
const SEED_OWNER_COGNITO_SUB = "seed_notes_issuer_owner_sub_abc";

const FIXED_INVOICE_IDS = [
  "seed_notes_invoice_fee_1_no_fee",
  "seed_notes_invoice_fee_2_platform_fee_only",
  "seed_notes_invoice_fee_3_facility_fee_only",
  "seed_notes_invoice_fee_4_platform_and_facility",
  "seed_notes_invoice_fee_5_maturity_today",
] as const;

type SeedInvoiceSpec = {
  label: string;
  invoiceNumber: string;
  maturityDate: string;
  appliedFinancing: number;
  offeredAmount: number;
  offeredProfitRatePercent: number;
  platformFeeRatePercent: number;
  applicationId: string;
  contractId: string | null;
  fixedId?: string;
};

type CreatedInvoiceRow = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceAmount: number;
  offeredAmount: number;
  maturityDate: string;
  applicationId: string;
  contractId: string | null;
  issuerOrganizationId: string;
  issuerName: string;
  noteLinked: boolean;
  eligible: boolean;
  eligibilityIssues: string[];
};

function parseArgs() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  let fixed = false;
  let count = 3;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--fixed") {
      fixed = true;
      continue;
    }
    if (arg === "--count") {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("--count requires a positive integer, e.g. --count 5");
      }
      count = Number.parseInt(next, 10);
      i++;
      continue;
    }
    if (arg.startsWith("--count=")) {
      count = Number.parseInt(arg.slice("--count=".length), 10);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(count) || count < 1) {
    throw new Error("--count must be a positive integer");
  }

  return { fixed, count: Math.min(Math.max(count, 1), 20) };
}

function makeRunId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}

function maturityDateStr(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
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
  return {
    number,
    applied_financing: appliedFinancing,
    maturity_date: maturityDate,
    due_date: maturityDate,
    value: appliedFinancing,
    financing_ratio_percent: 80,
    invoice_value: appliedFinancing,
  } satisfies Record<string, unknown>;
}

function buildInvoiceOfferDetails(args: {
  offeredAmount: number;
  offeredProfitRatePercent: number;
  platformFeeRatePercent: number;
}) {
  const { offeredAmount, offeredProfitRatePercent, platformFeeRatePercent } = args;
  return {
    offered_amount: offeredAmount,
    offered_profit_rate_percent: offeredProfitRatePercent,
    platform_fee_rate_percent: platformFeeRatePercent,
    risk_rating: "C",
  } satisfies Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatRm(amount: number) {
  return `RM ${amount.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
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

async function ensureSharedSeedInfrastructure(ownerUserId: string) {
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
        { id: "contract_details_1", name: "Facility Details", config: { name: "Facility Details" } },
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
        { id: "contract_details_1", name: "Facility Details", config: { name: "Facility Details" } },
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
        aboutYourBusiness: buildAboutYourBusinessCod(),
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
        aboutYourBusiness: buildAboutYourBusinessCod(),
      },
    },
  });

  return { issuerOrgId: SEED_ISSUER_ORG_ID, issuerOrgName };
}

async function ensureFixedContractAndApplications() {
  await prisma.contract.upsert({
    where: { id: SEED_CONTRACT_ID },
    update: {
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

  const upsertCompletedApp = async (
    id: string,
    structureType: "invoice_only" | "new_contract",
    contractId: string | null
  ) => {
    await prisma.application.upsert({
      where: { id },
      update: {
        issuer_organization_id: SEED_ISSUER_ORG_ID,
        product_version: 1,
        status: ApplicationStatus.COMPLETED,
        last_completed_step: 9,
        financing_type: applicationFinancingType as Prisma.InputJsonValue,
        financing_structure: {
          structure_type: structureType,
          existing_contract_id: null,
        } as Prisma.InputJsonValue,
        contract_id: contractId,
      },
      create: {
        id,
        issuer_organization_id: SEED_ISSUER_ORG_ID,
        product_version: 1,
        status: ApplicationStatus.COMPLETED,
        last_completed_step: 9,
        submitted_at: new Date(),
        financing_type: applicationFinancingType as Prisma.InputJsonValue,
        financing_structure: {
          structure_type: structureType,
          existing_contract_id: null,
        } as Prisma.InputJsonValue,
        contract_id: contractId,
        company_details: Prisma.JsonNull,
        business_details: Prisma.JsonNull,
        financial_statements: Prisma.JsonNull,
        supporting_documents: Prisma.JsonNull,
        declarations: Prisma.JsonNull,
        review_and_submit: Prisma.JsonNull,
      },
    });
  };

  await upsertCompletedApp(SEED_APP_INVOICE_ONLY_ID, "invoice_only", null);
  await upsertCompletedApp(SEED_APP_INVOICE_ONLY_B_ID, "invoice_only", null);
  await upsertCompletedApp(SEED_APP_INVOICE_ONLY_E_ID, "invoice_only", null);
  await upsertCompletedApp(SEED_APP_NEW_CONTRACT_ID, "new_contract", SEED_CONTRACT_ID);
  await upsertCompletedApp(SEED_APP_NEW_CONTRACT_D_ID, "new_contract", SEED_CONTRACT_ID);
}

function buildFreshInvoiceSpecs(runId: string, count: number): SeedInvoiceSpec[] {
  const specs: SeedInvoiceSpec[] = [
    {
      label: "normal",
      invoiceNumber: `${SEED_PREFIX}-${runId}-001`,
      maturityDate: maturityDateStr(120),
      appliedFinancing: 80_000,
      offeredAmount: 80_000,
      offeredProfitRatePercent: 8,
      platformFeeRatePercent: 0,
      applicationId: "",
      contractId: null,
    },
    {
      label: "larger amount",
      invoiceNumber: `${SEED_PREFIX}-${runId}-002`,
      maturityDate: maturityDateStr(150),
      appliedFinancing: 150_000,
      offeredAmount: 150_000,
      offeredProfitRatePercent: 8,
      platformFeeRatePercent: 1,
      applicationId: "",
      contractId: null,
    },
    {
      label: "later maturity",
      invoiceNumber: `${SEED_PREFIX}-${runId}-003`,
      maturityDate: maturityDateStr(270),
      appliedFinancing: 100_000,
      offeredAmount: 100_000,
      offeredProfitRatePercent: 8,
      platformFeeRatePercent: 0,
      applicationId: "",
      contractId: null,
    },
  ];

  for (let i = specs.length; i < count; i++) {
    const seq = String(i + 1).padStart(3, "0");
    specs.push({
      label: `extra ${i + 1}`,
      invoiceNumber: `${SEED_PREFIX}-${runId}-${seq}`,
      maturityDate: maturityDateStr(90 + i * 30),
      appliedFinancing: 60_000 + i * 10_000,
      offeredAmount: 60_000 + i * 10_000,
      offeredProfitRatePercent: 8,
      platformFeeRatePercent: i % 2,
      applicationId: "",
      contractId: null,
    });
  }

  return specs.slice(0, count);
}

function buildFixedInvoiceSpecs(): SeedInvoiceSpec[] {
  return [
    {
      label: "no fee",
      fixedId: FIXED_INVOICE_IDS[0],
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
      label: "platform fee only",
      fixedId: FIXED_INVOICE_IDS[1],
      applicationId: SEED_APP_INVOICE_ONLY_B_ID,
      contractId: null,
      invoiceNumber: "INV-SEED-NOTES-002",
      maturityDate: maturityDateStr(150),
      appliedFinancing: 100_000,
      offeredAmount: 100_000,
      offeredProfitRatePercent: 8,
      platformFeeRatePercent: 1,
    },
    {
      label: "facility fee only",
      fixedId: FIXED_INVOICE_IDS[2],
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
      label: "platform + facility fee",
      fixedId: FIXED_INVOICE_IDS[3],
      applicationId: SEED_APP_NEW_CONTRACT_D_ID,
      contractId: SEED_CONTRACT_ID,
      invoiceNumber: "INV-SEED-NOTES-004",
      maturityDate: maturityDateStr(210),
      appliedFinancing: 100_000,
      offeredAmount: 100_000,
      offeredProfitRatePercent: 8,
      platformFeeRatePercent: 1,
    },
    {
      label: "maturity today",
      fixedId: FIXED_INVOICE_IDS[4],
      applicationId: SEED_APP_INVOICE_ONLY_E_ID,
      contractId: null,
      invoiceNumber: "INV-SEED-NOTES-005",
      maturityDate: maturityDateTodayLocalStr(),
      appliedFinancing: 100_000,
      offeredAmount: 100_000,
      offeredProfitRatePercent: 8,
      platformFeeRatePercent: 0,
    },
  ];
}

async function createInvoiceFromSpec(spec: SeedInvoiceSpec) {
  const details = buildInvoiceDetails({
    number: spec.invoiceNumber,
    appliedFinancing: spec.appliedFinancing,
    maturityDate: spec.maturityDate,
  });
  const offerDetails = buildInvoiceOfferDetails({
    offeredAmount: spec.offeredAmount,
    offeredProfitRatePercent: spec.offeredProfitRatePercent,
    platformFeeRatePercent: spec.platformFeeRatePercent,
  });

  if (spec.fixedId) {
    return prisma.invoice.upsert({
      where: { id: spec.fixedId },
      update: {
        application_id: spec.applicationId,
        contract_id: spec.contractId,
        status: InvoiceStatus.APPROVED,
        details: details as Prisma.InputJsonValue,
        offer_details: offerDetails as Prisma.InputJsonValue,
      },
      create: {
        id: spec.fixedId,
        application_id: spec.applicationId,
        contract_id: spec.contractId,
        status: InvoiceStatus.APPROVED,
        details: details as Prisma.InputJsonValue,
        offer_details: offerDetails as Prisma.InputJsonValue,
      },
    });
  }

  return prisma.invoice.create({
    data: {
      application_id: spec.applicationId,
      contract_id: spec.contractId,
      status: InvoiceStatus.APPROVED,
      details: details as Prisma.InputJsonValue,
      offer_details: offerDetails as Prisma.InputJsonValue,
    },
  });
}

async function createFreshApplication(runId: string) {
  const applicationFinancingType = {
    product_id: SEED_PRODUCT_ID,
    product_name: "Account Receivable Financing",
    category: "invoice_financing",
  } satisfies Record<string, unknown>;

  return prisma.application.create({
    data: {
      issuer_organization_id: SEED_ISSUER_ORG_ID,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      submitted_at: new Date(),
      financing_type: applicationFinancingType as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: "invoice_only",
        existing_contract_id: null,
        seed_run_id: runId,
      } as Prisma.InputJsonValue,
      contract_id: null,
      company_details: Prisma.JsonNull,
      business_details: Prisma.JsonNull,
      financial_statements: Prisma.JsonNull,
      supporting_documents: Prisma.JsonNull,
      declarations: Prisma.JsonNull,
      review_and_submit: Prisma.JsonNull,
    },
    select: { id: true },
  });
}

async function verifyInvoices(invoiceIds: string[]): Promise<CreatedInvoiceRow[]> {
  if (invoiceIds.length === 0) return [];

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds } },
    include: {
      application: {
        include: {
          issuer_organization: true,
          contract: true,
        },
      },
      contract: true,
    },
  });

  const notes = await prisma.note.findMany({
    where: { source_invoice_id: { in: invoiceIds } },
    select: { id: true, source_invoice_id: true, note_reference: true },
  });
  const notesByInvoiceId = new Map(
    notes.map((note) => [note.source_invoice_id, note] as const)
  );

  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  return invoiceIds.flatMap((invoiceId) => {
    const invoice = invoiceById.get(invoiceId);
    if (!invoice) return [];
    const details = asRecord(invoice.details) ?? {};
    const offer = asRecord(invoice.offer_details) ?? {};
    const invoiceAmount = resolveRequestedInvoiceAmount(details);
    const offeredAmount = resolveOfferedAmount(offer);
    const linkedNote = notesByInvoiceId.get(invoice.id) ?? null;
    const eligibilityIssues: string[] = [];

    if (invoice.status !== InvoiceStatus.APPROVED) {
      eligibilityIssues.push(`invoice status is ${invoice.status}, expected APPROVED`);
    }
    if (invoice.application.status !== ApplicationStatus.COMPLETED) {
      eligibilityIssues.push(
        `application status is ${invoice.application.status}, expected COMPLETED`
      );
    }
    if (linkedNote) {
      eligibilityIssues.push(`already linked to note ${linkedNote.note_reference ?? linkedNote.id}`);
    }
    if (invoiceAmount <= 0) {
      eligibilityIssues.push("invoice amount could not be resolved from details");
    }
    if (offeredAmount <= 0) {
      eligibilityIssues.push("offered amount missing in offer_details");
    }
    if (typeof details.maturity_date !== "string" || details.maturity_date.trim() === "") {
      eligibilityIssues.push("maturity_date missing in invoice details");
    }
    if (!invoice.application.issuer_organization?.name) {
      eligibilityIssues.push("issuer organization name missing");
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber:
        typeof details.number === "string" ? details.number : invoice.id.slice(-8),
      invoiceAmount,
      offeredAmount,
      maturityDate:
        typeof details.maturity_date === "string" ? details.maturity_date : "—",
      applicationId: invoice.application_id,
      contractId: invoice.contract_id ?? invoice.application.contract_id,
      issuerOrganizationId: invoice.application.issuer_organization_id,
      issuerName: invoice.application.issuer_organization.name ?? "—",
      noteLinked: linkedNote != null,
      eligible: eligibilityIssues.length === 0,
      eligibilityIssues,
    };
  });
}

function printSummary(args: {
  mode: "fresh" | "fixed";
  runId?: string;
  issuerOrgId: string;
  issuerOrgName: string;
  rows: CreatedInvoiceRow[];
}) {
  const { mode, runId, issuerOrgId, issuerOrgName, rows } = args;

  console.log("");
  console.log("Created approved invoices for note creation:");
  console.log(`Mode: ${mode}${runId ? ` (run ${runId})` : ""}`);
  console.log(`Issuer organization: ${issuerOrgName} (${issuerOrgId})`);
  console.log("");

  rows.forEach((row, index) => {
    const statusLabel = row.eligible ? "eligible" : "NOT ELIGIBLE";
    console.log(
      `${index + 1}. ${row.invoiceNumber} — ${formatRm(row.offeredAmount)} — APPROVED — noteLinked=${row.noteLinked} — ${statusLabel}`
    );
    console.log(`   invoiceId: ${row.invoiceId}`);
    console.log(`   applicationId: ${row.applicationId}`);
    if (row.contractId) console.log(`   contractId: ${row.contractId}`);
    console.log(`   maturityDate: ${row.maturityDate}`);
    if (!row.eligible) {
      for (const issue of row.eligibilityIssues) {
        console.warn(`   ⚠ ${issue}`);
      }
    }
  });

  const searchKeyword = mode === "fresh" && runId ? `${SEED_PREFIX}-${runId}` : SEED_PREFIX;
  console.log("");
  console.log("Search in Admin → Notes → Create from invoice using:");
  console.log(`  ${searchKeyword}`);
  console.log("");
  console.log(
    `Summary: ${rows.length} invoice(s); ${rows.filter((r) => r.eligible).length} eligible; ${rows.filter((r) => r.noteLinked).length} already linked to notes`
  );
}

async function seedFreshMode(count: number) {
  const runId = makeRunId();
  const ownerUserId = await ensureOwnerUser();
  const { issuerOrgId, issuerOrgName } = await ensureSharedSeedInfrastructure(ownerUserId);

  const specs = buildFreshInvoiceSpecs(runId, count);

  const createdIds: string[] = [];
  for (const spec of specs) {
    const application = await createFreshApplication(`${runId}-${spec.invoiceNumber}`);
    const invoice = await createInvoiceFromSpec({ ...spec, applicationId: application.id });
    createdIds.push(invoice.id);
  }

  const rows = await verifyInvoices(createdIds);
  printSummary({ mode: "fresh", runId, issuerOrgId, issuerOrgName, rows });

  const ineligible = rows.filter((row) => !row.eligible);
  if (ineligible.length > 0) {
    console.warn(`⚠ ${ineligible.length} seeded invoice(s) failed eligibility checks.`);
  } else {
    console.log("✅ All seeded invoices passed eligibility checks.");
  }

  return { runId, createdIds, rows };
}

async function seedFixedMode() {
  const ownerUserId = await ensureOwnerUser();
  const { issuerOrgId, issuerOrgName } = await ensureSharedSeedInfrastructure(ownerUserId);
  await ensureFixedContractAndApplications();

  const specs = buildFixedInvoiceSpecs();
  const createdIds: string[] = [];

  for (const spec of specs) {
    const invoice = await createInvoiceFromSpec(spec);
    createdIds.push(invoice.id);
  }

  const rows = await verifyInvoices(createdIds);
  printSummary({ mode: "fixed", issuerOrgId, issuerOrgName, rows });

  const linked = rows.filter((row) => row.noteLinked);
  if (linked.length > 0) {
    console.warn(
      `⚠ ${linked.length} fixed seed invoice(s) already have notes and will not appear as ready invoices in Admin.`
    );
    console.warn("   Run without --fixed to create fresh invoices, or use a different invoice.");
  }

  const ineligible = rows.filter((row) => !row.eligible);
  if (ineligible.length > 0) {
    console.warn(`⚠ ${ineligible.length} fixed seed invoice(s) failed eligibility checks.`);
  } else if (linked.length === 0) {
    console.log("✅ All fixed seed invoices passed eligibility checks.");
  }

  return { createdIds, rows };
}

async function main() {
  const { fixed, count } = parseArgs();

  if (fixed) {
    await seedFixedMode();
    return;
  }

  await seedFreshMode(count);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
