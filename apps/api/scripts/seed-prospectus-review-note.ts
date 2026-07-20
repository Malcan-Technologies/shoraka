#!/usr/bin/env tsx
/**
 * Dev-only idempotent seed: one unpublished draft Note for Prospectus Review product testing.
 *
 * Usage (from repo root):
 *   pnpm --filter @cashsouk/api seed-prospectus-review-note
 *   pnpm --filter @cashsouk/api seed:prospectus-review
 *
 * Stable reference: PROSPECTUS-DEMO-001
 * Does not create an approved review (lazy draft on GET /prospectus-review).
 * Safe to re-run: resets the Note to DRAFT and removes any prior review / publish state.
 *
 * Never run against production.
 */
import {
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
  NoteFundingStatus,
  NoteListingStatus,
  NoteServicingStatus,
  NoteStatus,
  OrganizationType,
  Prisma,
  PrismaClient,
  ProductStatus,
  UserRole,
} from "@prisma/client";
import {
  getAdminFinancialSummaryUserColumnYears,
  getFinancialYearPeriodEndIso,
  issuerUnauditedPlddForFyEndYear,
  type FinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { generateUniqueUserId } from "../src/lib/user-id-generator";
import { buildNoteIssuerSnapshot } from "../src/modules/notes/note-issuer-snapshot";
import { PROSPECTUS_REVIEW_REQUIRED_FROM } from "../src/modules/notes/prospectus-review/prospectus-review.service";

const prisma = new PrismaClient();

export const PROSPECTUS_DEMO_NOTE_REFERENCE = "PROSPECTUS-DEMO-001";
export const PROSPECTUS_DEMO_NOTE_ID = "seed_prospectus_demo_note_001";
export const PROSPECTUS_DEMO_APP_ID = "seed_prospectus_demo_app_001";
export const PROSPECTUS_DEMO_INVOICE_ID = "seed_prospectus_demo_invoice_001";
export const PROSPECTUS_DEMO_CONTRACT_ID = "seed_prospectus_demo_contract_001";
export const PROSPECTUS_DEMO_ORG_ID = "seed_prospectus_demo_issuer_org";
export const PROSPECTUS_DEMO_CTOS_REPORT_ID = "seed_prospectus_demo_ctos_report";
export const PROSPECTUS_DEMO_PRODUCT_ID = "seed_prospectus_demo_product";
export const PROSPECTUS_DEMO_OWNER_EMAIL = "seed_prospectus_demo_issuer@example.com";
export const PROSPECTUS_DEMO_OWNER_SUB = "seed_prospectus_demo_issuer_sub";

/** Fake local-only issuer — not a real company. */
const ISSUER_NAME = "Northbridge Demo Trading Sdn Bhd";
const ISSUER_REGISTRATION = "202699990001";
const BUSINESS_DESCRIPTION =
  "Supplies industrial components and scheduled maintenance services for mining and construction clients across Malaysia.";

const FINANCING_AMOUNT = 850_000;
const PROFIT_RATE = 9.5;
const PLATFORM_FEE = 1.5;
const SERVICE_FEE = 15;
const RISK_RATING = "BBB";

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Deterministic YoY ladder — index 0 oldest → index 2 newest. */
const DEMO_FINANCIAL_SERIES = [
  {
    turnover: 12_000_000,
    plnpbt: 1_100_000,
    plnpat: 900_000,
    bscatot: 4_000_000,
    bsfatot: 1_500_000,
    othass: 1_000_000,
    curlib: 2_000_000,
    bsslltd: 500_000,
    bsclstd: 200_000,
    bsclbank: 900_000,
    bsqpuc: 5_000_000,
    plnetdiv: 50_000,
    plyear: 200_000,
  },
  {
    turnover: 13_900_000,
    plnpbt: 1_300_000,
    plnpat: 1_100_000,
    bscatot: 4_200_000,
    bsfatot: 1_600_000,
    othass: 1_100_000,
    curlib: 2_100_000,
    bsslltd: 550_000,
    bsclstd: 250_000,
    bsclbank: 950_000,
    bsqpuc: 5_500_000,
    plnetdiv: 60_000,
    plyear: 220_000,
  },
  {
    turnover: 15_000_000,
    plnpbt: 1_400_000,
    plnpat: 1_200_000,
    bscatot: 4_500_000,
    bsfatot: 1_700_000,
    othass: 1_200_000,
    curlib: 2_200_000,
    bsslltd: 600_000,
    bsclstd: 300_000,
    bsclbank: 1_000_000,
    bsqpuc: 6_000_000,
    plnetdiv: 70_000,
    plyear: 240_000,
  },
] as const;

function demoFutureFinancialYearEndIso(ref: Date): string {
  // Same pattern as seed-application-helpers: FYE always strictly after seed-run "today".
  const fye = new Date(ref.getTime() + 400 * 24 * 60 * 60 * 1000);
  return isoDate(fye);
}

function demoQuestionnaire(ref: Date): FinancialStatementsQuestionnaire {
  return { financial_year_end: demoFutureFinancialYearEndIso(ref) };
}

/** Latest three calendar years ending at the newest SSM-expected year (or FYE year). */
function demoThreeYearSpan(ref: Date): {
  questionnaire: FinancialStatementsQuestionnaire;
  ssmYears: number[];
  spanYears: number[];
} {
  const questionnaire = demoQuestionnaire(ref);
  const ssmYears = getAdminFinancialSummaryUserColumnYears(questionnaire, ref);
  const newest =
    ssmYears.length > 0
      ? Math.max(...ssmYears)
      : Number(questionnaire.financial_year_end.slice(0, 4));
  const spanYears = [newest - 2, newest - 1, newest];
  return { questionnaire, ssmYears, spanYears };
}

function demoFinancialBlockForIndex(
  year: number,
  index: number,
  questionnaire: FinancialStatementsQuestionnaire
): Record<string, unknown> {
  const series =
    DEMO_FINANCIAL_SERIES[Math.min(Math.max(index, 0), DEMO_FINANCIAL_SERIES.length - 1)]!;
  return {
    ...series,
    pldd: issuerUnauditedPlddForFyEndYear(year, questionnaire),
  };
}

/**
 * Application financial_statements aligned with live SSM + Prospectus year rules.
 * FYE is always future relative to seed-run date; unaudited keys match SSM User Input years.
 */
export function buildProspectusDemoFinancialStatements(
  ref: Date = new Date()
): Record<string, unknown> {
  const { questionnaire, ssmYears, spanYears } = demoThreeYearSpan(ref);
  const unaudited_by_year: Record<string, Record<string, unknown>> = {};
  for (const year of ssmYears) {
    const index = spanYears.indexOf(year);
    unaudited_by_year[String(year)] = demoFinancialBlockForIndex(
      year,
      index >= 0 ? index : spanYears.length - 1,
      questionnaire
    );
  }
  return {
    questionnaire,
    unaudited_by_year,
  };
}

/**
 * Org CTOS financials_json for years in the three-year span that are not SSM User Input years.
 * Gives Prospectus Page 2 three columns when combined with unaudited SSM blocks.
 */
export function buildProspectusDemoCtosFinancials(ref: Date = new Date()): unknown[] {
  const { questionnaire, ssmYears, spanYears } = demoThreeYearSpan(ref);
  const ssmSet = new Set(ssmYears);
  return spanYears
    .map((year, index) => {
      if (ssmSet.has(year)) return null;
      const block = demoFinancialBlockForIndex(year, index, questionnaire);
      const pldd =
        getFinancialYearPeriodEndIso(questionnaire, year) ??
        issuerUnauditedPlddForFyEndYear(year, questionnaire);
      return {
        financial_year: year,
        dates: { pldd, bsdd: null },
        account: {
          turnover: block.turnover,
          plnpbt: block.plnpbt,
          plnpat: block.plnpat,
          bscatot: block.bscatot,
          bsfatot: block.bsfatot,
          othass: block.othass,
          curlib: block.curlib,
          bsslltd: block.bsslltd,
          bsclstd: block.bsclstd,
          bsclbank: block.bsclbank,
          bsqpuc: block.bsqpuc,
          plnetdiv: block.plnetdiv,
          plyear: block.plyear,
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}

/** Idempotent org CTOS snapshot used by Prospectus demo seeds (local only). */
export async function upsertProspectusDemoCtosReport(input: {
  prisma: PrismaClient;
  reportId: string;
  issuerOrganizationId: string;
  ref?: Date;
}): Promise<void> {
  const ref = input.ref ?? new Date();
  const financials_json = buildProspectusDemoCtosFinancials(ref) as Prisma.InputJsonValue;
  const stub = {} as Prisma.InputJsonValue;
  await input.prisma.ctosReport.upsert({
    where: { id: input.reportId },
    update: {
      issuer_organization_id: input.issuerOrganizationId,
      investor_organization_id: null,
      subject_ref: null,
      fetched_at: ref,
      financials_json,
      summary_json: stub,
      legal_json: stub,
      ccris_json: stub,
      company_json: stub,
      raw_xml: "<demo/>",
      report_html: null,
    },
    create: {
      id: input.reportId,
      issuer_organization_id: input.issuerOrganizationId,
      investor_organization_id: null,
      subject_ref: null,
      fetched_at: ref,
      financials_json,
      summary_json: stub,
      legal_json: stub,
      ccris_json: stub,
      company_json: stub,
      raw_xml: "<demo/>",
      report_html: null,
    },
  });
}

export function buildProspectusDemoBusinessDetails(): Record<string, unknown> {
  return {
    about_your_business: {
      what_does_company_do: BUSINESS_DESCRIPTION,
      main_customers: "Industrial and infrastructure buyers in Malaysia.",
      single_customer_over_50_revenue: false,
    },
    why_raising_funds: {
      financing_for: "Working capital to fulfil an approved receivable financing invoice.",
      how_funds_used: "Inventory, payroll, and delivery logistics for the financed invoice.",
      business_plan: "Maintain steady receivables turnover over the next 12 months.",
      risks_delay_repayment: "Delivery delays may shift cash collection timing.",
      backup_plan: "Maintain bank facilities and staged delivery schedules.",
      raising_on_other_p2p: false,
      platform_name: null,
      amount_raised: null,
      same_invoice_used: null,
      accounting_software: "Xero",
    },
    declaration_confirmed: true,
    isDeclarationConfirmed: true,
    guarantors: [],
  };
}

async function ensureAdminActor(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { roles: { has: UserRole.ADMIN } },
    select: { user_id: true, email: true },
  });
  if (!admin) {
    throw new Error(
      "No ADMIN user found. Run `pnpm --filter @cashsouk/api prisma:seed` or create-admin first."
    );
  }
  return admin.user_id;
}

async function ensureOwnerUser(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: PROSPECTUS_DEMO_OWNER_EMAIL },
    select: { user_id: true },
  });
  if (existing) {
    await prisma.user.update({
      where: { user_id: existing.user_id },
      data: { issuer_account: { set: [PROSPECTUS_DEMO_ORG_ID] } },
    });
    return existing.user_id;
  }
  const userId = await generateUniqueUserId();
  await prisma.user.create({
    data: {
      user_id: userId,
      email: PROSPECTUS_DEMO_OWNER_EMAIL,
      cognito_sub: PROSPECTUS_DEMO_OWNER_SUB,
      cognito_username: PROSPECTUS_DEMO_OWNER_EMAIL,
      roles: [UserRole.ISSUER],
      first_name: "Prospectus",
      last_name: "DemoIssuer",
      phone: null,
      investor_account: [],
      issuer_account: [PROSPECTUS_DEMO_ORG_ID],
    },
  });
  return userId;
}

async function ensureInfrastructure(ownerUserId: string) {
  await prisma.product.upsert({
    where: { id: PROSPECTUS_DEMO_PRODUCT_ID },
    update: {
      status: ProductStatus.ACTIVE,
      service_fee_rate_percent: money(SERVICE_FEE),
      marketplace_listing_duration_days: 14,
      workflow: [
        {
          id: "financing_type_1",
          name: "Financing Type",
          config: {
            name: "Account Receivable Financing",
            category: "invoice_financing",
            product_name: "Account Receivable Financing",
          },
        },
        { id: "invoice_details_1", name: "Invoice Details", config: { name: "Invoice Details" } },
      ],
    },
    create: {
      id: PROSPECTUS_DEMO_PRODUCT_ID,
      base_id: null,
      status: ProductStatus.ACTIVE,
      version: 1,
      service_fee_rate_percent: money(SERVICE_FEE),
      marketplace_listing_duration_days: 14,
      workflow: [
        {
          id: "financing_type_1",
          name: "Financing Type",
          config: {
            name: "Account Receivable Financing",
            category: "invoice_financing",
            product_name: "Account Receivable Financing",
          },
        },
        { id: "invoice_details_1", name: "Invoice Details", config: { name: "Invoice Details" } },
      ],
    },
  });

  await prisma.issuerOrganization.upsert({
    where: { id: PROSPECTUS_DEMO_ORG_ID },
    update: {
      owner_user_id: ownerUserId,
      name: ISSUER_NAME,
      type: OrganizationType.COMPANY,
      registration_number: ISSUER_REGISTRATION,
      country: "Malaysia",
      onboarding_status: "COMPLETED",
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: {
        basicInfo: { industry: "Industrial Manufacturing" },
      },
    },
    create: {
      id: PROSPECTUS_DEMO_ORG_ID,
      owner_user_id: ownerUserId,
      type: OrganizationType.COMPANY,
      name: ISSUER_NAME,
      registration_number: ISSUER_REGISTRATION,
      country: "Malaysia",
      onboarding_status: "COMPLETED",
      onboarded_at: new Date(),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: {
        basicInfo: { industry: "Industrial Manufacturing" },
      },
    },
  });

  await prisma.contract.upsert({
    where: { id: PROSPECTUS_DEMO_CONTRACT_ID },
    update: {
      issuer_organization_id: PROSPECTUS_DEMO_ORG_ID,
      status: ContractStatus.APPROVED,
      contract_details: {
        approved_facility: 2_000_000,
        facility_fee_rate_percent: 1,
        facility_fee_paid_amount: 0,
        financing: FINANCING_AMOUNT,
        value: FINANCING_AMOUNT,
      },
      customer_details: {
        name: "Demo Paymaster Trading Sdn Bhd",
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
      },
    },
    create: {
      id: PROSPECTUS_DEMO_CONTRACT_ID,
      issuer_organization_id: PROSPECTUS_DEMO_ORG_ID,
      status: ContractStatus.APPROVED,
      contract_details: {
        approved_facility: 2_000_000,
        facility_fee_rate_percent: 1,
        facility_fee_paid_amount: 0,
        financing: FINANCING_AMOUNT,
        value: FINANCING_AMOUNT,
      },
      customer_details: {
        name: "Demo Paymaster Trading Sdn Bhd",
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
      },
    },
  });
}

async function ensureApplicationAndInvoice() {
  const financingType = {
    product_id: PROSPECTUS_DEMO_PRODUCT_ID,
    product_name: "Account Receivable Financing",
    category: "invoice_financing",
  };
  const businessDetails = buildProspectusDemoBusinessDetails();
  const financialStatements = buildProspectusDemoFinancialStatements();
  const maturity = isoDate(addDays(new Date(), 120));

  await upsertProspectusDemoCtosReport({
    prisma,
    reportId: PROSPECTUS_DEMO_CTOS_REPORT_ID,
    issuerOrganizationId: PROSPECTUS_DEMO_ORG_ID,
  });

  await prisma.application.upsert({
    where: { id: PROSPECTUS_DEMO_APP_ID },
    update: {
      issuer_organization_id: PROSPECTUS_DEMO_ORG_ID,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      submitted_at: new Date(),
      financing_type: financingType as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: "existing_contract",
        existing_contract_id: PROSPECTUS_DEMO_CONTRACT_ID,
      } as Prisma.InputJsonValue,
      contract_id: PROSPECTUS_DEMO_CONTRACT_ID,
      company_details: {
        contact_person: {
          name: "Demo Contact",
          ic: "900101-14-0001",
          contact: "0123456789",
          position: "Finance Manager",
        },
        issuer_organization_id: PROSPECTUS_DEMO_ORG_ID,
      } as Prisma.InputJsonValue,
      business_details: businessDetails as Prisma.InputJsonValue,
      financial_statements: financialStatements as Prisma.InputJsonValue,
      supporting_documents: { categories: [] } as Prisma.InputJsonValue,
      declarations: { items: [] } as Prisma.InputJsonValue,
      review_and_submit: {} as Prisma.InputJsonValue,
    },
    create: {
      id: PROSPECTUS_DEMO_APP_ID,
      issuer_organization_id: PROSPECTUS_DEMO_ORG_ID,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      submitted_at: new Date(),
      financing_type: financingType as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: "existing_contract",
        existing_contract_id: PROSPECTUS_DEMO_CONTRACT_ID,
      } as Prisma.InputJsonValue,
      contract_id: PROSPECTUS_DEMO_CONTRACT_ID,
      company_details: {
        contact_person: {
          name: "Demo Contact",
          ic: "900101-14-0001",
          contact: "0123456789",
          position: "Finance Manager",
        },
        issuer_organization_id: PROSPECTUS_DEMO_ORG_ID,
      } as Prisma.InputJsonValue,
      business_details: businessDetails as Prisma.InputJsonValue,
      financial_statements: financialStatements as Prisma.InputJsonValue,
      supporting_documents: { categories: [] } as Prisma.InputJsonValue,
      declarations: { items: [] } as Prisma.InputJsonValue,
      review_and_submit: {} as Prisma.InputJsonValue,
    },
  });

  const invoiceDetails = {
    number: "INV-PROSPECTUS-DEMO-001",
    applied_financing: FINANCING_AMOUNT,
    maturity_date: maturity,
    due_date: maturity,
    value: FINANCING_AMOUNT,
    financing_ratio_percent: 80,
    invoice_value: FINANCING_AMOUNT,
  };
  const offerDetails = {
    offered_amount: FINANCING_AMOUNT,
    offered_profit_rate_percent: PROFIT_RATE,
    platform_fee_rate_percent: PLATFORM_FEE,
    risk_rating: RISK_RATING,
  };

  await prisma.invoice.upsert({
    where: { id: PROSPECTUS_DEMO_INVOICE_ID },
    update: {
      application_id: PROSPECTUS_DEMO_APP_ID,
      contract_id: PROSPECTUS_DEMO_CONTRACT_ID,
      status: InvoiceStatus.APPROVED,
      details: invoiceDetails as Prisma.InputJsonValue,
      offer_details: offerDetails as Prisma.InputJsonValue,
    },
    create: {
      id: PROSPECTUS_DEMO_INVOICE_ID,
      application_id: PROSPECTUS_DEMO_APP_ID,
      contract_id: PROSPECTUS_DEMO_CONTRACT_ID,
      status: InvoiceStatus.APPROVED,
      details: invoiceDetails as Prisma.InputJsonValue,
      offer_details: offerDetails as Prisma.InputJsonValue,
    },
  });

  return { maturity, invoiceDetails, offerDetails, businessDetails };
}

async function resetNoteGraphIfNeeded() {
  const existingIds = new Set<string>();
  const byRef = await prisma.note.findUnique({
    where: { note_reference: PROSPECTUS_DEMO_NOTE_REFERENCE },
    select: { id: true },
  });
  if (byRef) existingIds.add(byRef.id);
  const byId = await prisma.note.findUnique({
    where: { id: PROSPECTUS_DEMO_NOTE_ID },
    select: { id: true },
  });
  if (byId) existingIds.add(byId.id);
  const byInvoice = await prisma.note.findUnique({
    where: { source_invoice_id: PROSPECTUS_DEMO_INVOICE_ID },
    select: { id: true },
  });
  if (byInvoice) existingIds.add(byInvoice.id);

  for (const noteId of existingIds) {
    await prisma.$transaction(async (tx) => {
      await tx.noteInvestment.deleteMany({ where: { note_id: noteId } });
      await tx.notePayment.deleteMany({ where: { note_id: noteId } });
      await tx.noteSettlement.deleteMany({ where: { note_id: noteId } });
      await tx.noteLedgerEntry.deleteMany({ where: { note_id: noteId } });
      await tx.noteProspectusReview.deleteMany({ where: { note_id: noteId } });
      await tx.noteListing.deleteMany({ where: { note_id: noteId } });
      await tx.notePaymentSchedule.deleteMany({ where: { note_id: noteId } });
      if (noteId !== PROSPECTUS_DEMO_NOTE_ID) {
        await tx.note.delete({ where: { id: noteId } });
      }
    });
  }
}

async function upsertDraftNote(
  actorUserId: string,
  args: {
    maturity: string;
    invoiceDetails: Record<string, unknown>;
    offerDetails: Record<string, unknown>;
    businessDetails: Record<string, unknown>;
  }
) {
  const org = await prisma.issuerOrganization.findUniqueOrThrow({
    where: { id: PROSPECTUS_DEMO_ORG_ID },
  });
  const issuerSnapshot = {
    ...buildNoteIssuerSnapshot({
      organization: org,
      businessDetails: args.businessDetails,
    }),
    entity_type: "Private Limited Company (Sdn Bhd)",
  };

  const now = new Date();
  // Ensure created_at falls under prospectus-review rollout (named cutoff).
  const createdAt =
    now.getTime() >= PROSPECTUS_REVIEW_REQUIRED_FROM.getTime()
      ? now
      : new Date(PROSPECTUS_REVIEW_REQUIRED_FROM.getTime() + 60_000);
  const opensAt = now;
  const closesAt = addDays(now, 14);
  const maturityDate = new Date(`${args.maturity}T00:00:00.000Z`);

  const noteData = {
    id: PROSPECTUS_DEMO_NOTE_ID,
    source_application_id: PROSPECTUS_DEMO_APP_ID,
    source_contract_id: PROSPECTUS_DEMO_CONTRACT_ID,
    source_invoice_id: PROSPECTUS_DEMO_INVOICE_ID,
    issuer_organization_id: PROSPECTUS_DEMO_ORG_ID,
    status: NoteStatus.DRAFT,
    listing_status: NoteListingStatus.DRAFT,
    funding_status: NoteFundingStatus.NOT_OPEN,
    servicing_status: NoteServicingStatus.NOT_STARTED,
    funded_amount: money(0),
    published_at: null,
    funding_closed_at: null,
    activated_at: null,
    repaid_at: null,
    prospectus_snapshot: Prisma.DbNull,
    title: `Prospectus Review Demo — ${PROSPECTUS_DEMO_NOTE_REFERENCE}`,
    note_reference: PROSPECTUS_DEMO_NOTE_REFERENCE,
    issuer_snapshot: issuerSnapshot as Prisma.InputJsonValue,
    paymaster_snapshot: {
      name: "Demo Paymaster Trading Sdn Bhd",
      country: "MY",
      entity_type: "Private Limited Company (Sdn Bhd)",
    } as Prisma.InputJsonValue,
    product_snapshot: {
      product_id: PROSPECTUS_DEMO_PRODUCT_ID,
      product_name: "Account Receivable Financing",
      category: "invoice_financing",
      name: "Account Receivable Financing",
    } as Prisma.InputJsonValue,
    purpose_snapshot: {
      financing_for: "Working capital to fulfil an approved receivable financing invoice.",
    } as Prisma.InputJsonValue,
    contract_snapshot: {
      id: PROSPECTUS_DEMO_CONTRACT_ID,
      status: ContractStatus.APPROVED,
      contract_details: {
        approved_facility: 2_000_000,
        financing: FINANCING_AMOUNT,
        value: FINANCING_AMOUNT,
      },
      customer_details: {
        name: "Demo Paymaster Trading Sdn Bhd",
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
      },
    } as Prisma.InputJsonValue,
    invoice_snapshot: {
      id: PROSPECTUS_DEMO_INVOICE_ID,
      status: InvoiceStatus.APPROVED,
      details: args.invoiceDetails,
      offer_details: args.offerDetails,
    } as Prisma.InputJsonValue,
    requested_amount: money(FINANCING_AMOUNT),
    target_amount: money(FINANCING_AMOUNT),
    profit_rate_percent: money(PROFIT_RATE),
    platform_fee_rate_percent: money(PLATFORM_FEE),
    service_fee_rate_percent: money(SERVICE_FEE),
    maturity_date: maturityDate,
    created_at: createdAt,
  };

  await prisma.note.upsert({
    where: { id: PROSPECTUS_DEMO_NOTE_ID },
    update: {
      ...noteData,
      updated_at: now,
    },
    create: noteData,
  });

  // If a note already existed under the same reference with a different id, keep reference unique.
  await prisma.note.updateMany({
    where: {
      note_reference: PROSPECTUS_DEMO_NOTE_REFERENCE,
      NOT: { id: PROSPECTUS_DEMO_NOTE_ID },
    },
    data: { note_reference: `${PROSPECTUS_DEMO_NOTE_REFERENCE}-OLD` },
  });

  await prisma.noteListing.upsert({
    where: { note_id: PROSPECTUS_DEMO_NOTE_ID },
    update: {
      status: NoteListingStatus.DRAFT,
      opens_at: opensAt,
      closes_at: closesAt,
      published_at: null,
      unpublished_at: null,
      visibility: "INVESTOR_MARKETPLACE",
      summary: "Local prospectus-review demo listing (unpublished).",
    },
    create: {
      note_id: PROSPECTUS_DEMO_NOTE_ID,
      status: NoteListingStatus.DRAFT,
      opens_at: opensAt,
      closes_at: closesAt,
      visibility: "INVESTOR_MARKETPLACE",
      summary: "Local prospectus-review demo listing (unpublished).",
    },
  });

  await prisma.notePaymentSchedule.deleteMany({ where: { note_id: PROSPECTUS_DEMO_NOTE_ID } });
  const profit = FINANCING_AMOUNT * (PROFIT_RATE / 100);
  await prisma.notePaymentSchedule.create({
    data: {
      note_id: PROSPECTUS_DEMO_NOTE_ID,
      sequence: 1,
      due_date: maturityDate,
      expected_principal: money(FINANCING_AMOUNT),
      expected_profit: money(profit),
      expected_total: money(FINANCING_AMOUNT + profit),
    },
  });

  await prisma.noteEvent.create({
    data: {
      note_id: PROSPECTUS_DEMO_NOTE_ID,
      event_type: "PROSPECTUS_DEMO_SEED",
      actor_user_id: actorUserId,
      actor_role: UserRole.ADMIN,
      portal: "ADMIN",
      metadata: { reference: PROSPECTUS_DEMO_NOTE_REFERENCE, reset: true },
    },
  });
}

export async function seedProspectusReviewNote() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed-prospectus-review-note is blocked in production");
  }

  const actorUserId = await ensureAdminActor();
  const ownerUserId = await ensureOwnerUser();
  await ensureInfrastructure(ownerUserId);
  const appInvoice = await ensureApplicationAndInvoice();
  await resetNoteGraphIfNeeded();
  await upsertDraftNote(actorUserId, appInvoice);

  const note = await prisma.note.findUniqueOrThrow({
    where: { id: PROSPECTUS_DEMO_NOTE_ID },
    include: {
      listing: true,
      prospectus_review: true,
    },
  });

  return {
    noteId: note.id,
    noteReference: note.note_reference,
    noteStatus: note.status,
    listingStatus: note.listing?.status ?? null,
    closesAt: note.listing?.closes_at?.toISOString() ?? null,
    reviewStatus: note.prospectus_review?.status ?? null,
    financialYears: ["2022", "2023", "2024"],
    adminRoute: `/notes/${note.id}`,
    prospectusRoute: `/notes/${note.id}/prospectus`,
    adminAccountHint: "Use the local SUPER_ADMIN Cognito user from prisma seed (email not printed here).",
    requiresProspectusReview: note.created_at.getTime() >= PROSPECTUS_REVIEW_REQUIRED_FROM.getTime(),
  };
}

async function main() {
  const result = await seedProspectusReviewNote();
  console.log("\nProspectus Review demo Note seeded (local only).\n");
  console.log(JSON.stringify(result, null, 2));
  console.log("\nNext:");
  console.log("  1. Start API + admin (`pnpm --filter @cashsouk/api dev`, `pnpm --filter @cashsouk/admin dev`)");
  console.log(`  2. Open admin${result.prospectusRoute}`);
  console.log("  3. Or run: pnpm --filter @cashsouk/api prospectus-review:product-e2e\n");
}

const isDirectRun = process.argv[1]?.includes("seed-prospectus-review-note");
if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
