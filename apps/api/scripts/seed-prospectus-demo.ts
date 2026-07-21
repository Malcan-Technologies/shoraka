#!/usr/bin/env tsx
/**
 * Dev-only, fast Prospectus workflow demo seed for local syncs.
 *
 * Creates:
 * - Admin (SUPER_ADMIN → notes.view / notes.manage / approve / publish)
 * - Investor user + organization (deposit ready)
 * - Issuer org + application/contract/invoice
 * - Unpublished Note DEMO-PROSPECTUS-001 (Prospectus DRAFT)
 * - One REPAID + one ACTIVE historical Note (track record)
 * - PRODUCT_TERMS + RISK_DISCLOSURE site documents
 *
 * Usage:
 *   pnpm --filter @cashsouk/api seed:prospectus-demo
 *
 * Idempotent. Safe to re-run. Blocked in production.
 * Does not modify prisma/seed.ts production seed behaviour.
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
  ProspectusReviewStatus,
  UserRole,
} from "@prisma/client";
import { AdminRole } from "@cashsouk/types";
import { generateUniqueUserId } from "../src/lib/user-id-generator";
import { ensureAdminRoleCatalog } from "../src/lib/auth/rbac";
import { buildNoteIssuerSnapshot } from "../src/modules/notes/note-issuer-snapshot";
import { PROSPECTUS_REVIEW_REQUIRED_FROM } from "../src/modules/notes/prospectus-review/prospectus-review.service";
import { catalogueVersion } from "../src/modules/notes/prospectus-review/prospectus-review-content";
import { buildCompleteProspectusReviewDraft } from "../src/modules/notes/prospectus-review/prospectus-review.demo-fixtures";
import {
  buildProspectusDemoBusinessDetails,
  buildProspectusDemoFinancialStatements,
  upsertProspectusDemoCtosReport,
} from "./seed-prospectus-review-note";

const prisma = new PrismaClient();

const NOTE_REFERENCE = "DEMO-PROSPECTUS-001";
const NOTE_ID = "seed_demo_prospectus_note_001";
const HIST_REPAID_ID = "seed_demo_prospectus_hist_repaid";
const HIST_ACTIVE_ID = "seed_demo_prospectus_hist_active";
const APP_ID = "seed_demo_prospectus_app_001";
const INVOICE_ID = "seed_demo_prospectus_invoice_001";
const CONTRACT_ID = "seed_demo_prospectus_contract_001";
const ISSUER_ORG_ID = "seed_demo_prospectus_issuer_org";
const ISSUER_CTOS_REPORT_ID = "seed_demo_prospectus_ctos_report";
const INVESTOR_ORG_ID = "seed_demo_prospectus_investor_org";
const PRODUCT_ID = "seed_demo_prospectus_product";
const REVIEW_ID = "seed_demo_prospectus_review_001";

const ADMIN_EMAIL = "demo.prospectus.admin@cashsouk.local";
const ADMIN_SUB = "seed_demo_prospectus_admin_sub";
const INVESTOR_EMAIL = "demo.prospectus.investor@cashsouk.local";
const INVESTOR_SUB = "seed_demo_prospectus_investor_sub";
const ISSUER_EMAIL = "demo.prospectus.issuer@cashsouk.local";
const ISSUER_SUB = "seed_demo_prospectus_issuer_sub";

const ISSUER_NAME = "Demo Prospectus Issuer Sdn Bhd";
const PAYMASTER_NAME = "Demo Paymaster Sdn. Bhd.";
/** Prospectus purpose_snapshot.financing_for — not used as About Invoice work description. */
const PURPOSE = "Working capital financing";
/** notes.contract_snapshot.contract_details.description — About Invoice Statement 1 token. */
const CONTRACT_WORK_DESCRIPTION = "civil engineering and infrastructure works";
const TARGET_AMOUNT = 100_000;
const PROFIT_RATE = 10;
const PLATFORM_FEE = 1.5;
const SERVICE_FEE = 15;
const RISK_RATING = "BBB";

const SITE_DOC_PRODUCT = "seed_demo_prospectus_product_terms";
const SITE_DOC_RISK = "seed_demo_prospectus_risk_disclosure";

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function ensureUser(input: {
  email: string;
  cognitoSub: string;
  roles: UserRole[];
  firstName: string;
  lastName: string;
  investorOrgIds?: string[];
  issuerOrgIds?: string[];
}): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { user_id: true },
  });
  if (existing) {
    await prisma.user.update({
      where: { user_id: existing.user_id },
      data: {
        roles: { set: input.roles },
        cognito_sub: input.cognitoSub,
        cognito_username: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
        investor_account: { set: input.investorOrgIds ?? [] },
        issuer_account: { set: input.issuerOrgIds ?? [] },
      },
    });
    return existing.user_id;
  }
  const userId = await generateUniqueUserId();
  await prisma.user.create({
    data: {
      user_id: userId,
      email: input.email,
      cognito_sub: input.cognitoSub,
      cognito_username: input.email,
      roles: input.roles,
      first_name: input.firstName,
      last_name: input.lastName,
      investor_account: input.investorOrgIds ?? [],
      issuer_account: input.issuerOrgIds ?? [],
    },
  });
  return userId;
}

async function ensureAdmin(userId: string) {
  await ensureAdminRoleCatalog(prisma);
  const role = await prisma.adminRoleConfig.findUnique({
    where: { key: AdminRole.SUPER_ADMIN },
  });
  if (!role) {
    throw new Error("SUPER_ADMIN role catalog missing after ensureAdminRoleCatalog");
  }
  await prisma.admin.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      role_id: role.id,
      role_description: AdminRole.SUPER_ADMIN,
      status: "ACTIVE",
    },
    update: {
      role_id: role.id,
      role_description: AdminRole.SUPER_ADMIN,
      status: "ACTIVE",
    },
  });
}

async function ensureInvestorOrg(ownerUserId: string) {
  await prisma.investorOrganization.upsert({
    where: { id: INVESTOR_ORG_ID },
    update: {
      owner_user_id: ownerUserId,
      type: OrganizationType.PERSONAL,
      name: "Demo Prospectus Investor",
      first_name: "Demo",
      last_name: "Investor",
      onboarding_status: "COMPLETED",
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      deposit_received: true,
      country: "Malaysia",
    },
    create: {
      id: INVESTOR_ORG_ID,
      owner_user_id: ownerUserId,
      type: OrganizationType.PERSONAL,
      name: "Demo Prospectus Investor",
      first_name: "Demo",
      last_name: "Investor",
      onboarding_status: "COMPLETED",
      onboarded_at: new Date(),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      deposit_received: true,
      country: "Malaysia",
    },
  });
  await prisma.investorBalance.upsert({
    where: { investor_organization_id: INVESTOR_ORG_ID },
    update: { available_amount: money(250_000) },
    create: {
      investor_organization_id: INVESTOR_ORG_ID,
      available_amount: money(250_000),
    },
  });
}

async function ensureIssuerAndProduct(ownerUserId: string) {
  await prisma.product.upsert({
    where: { id: PRODUCT_ID },
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
      ],
    },
    create: {
      id: PRODUCT_ID,
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
      ],
    },
  });

  await prisma.issuerOrganization.upsert({
    where: { id: ISSUER_ORG_ID },
    update: {
      owner_user_id: ownerUserId,
      name: ISSUER_NAME,
      type: OrganizationType.COMPANY,
      registration_number: "202688880001",
      country: "Malaysia",
      onboarding_status: "COMPLETED",
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: { basicInfo: { industry: "Trading" } },
    },
    create: {
      id: ISSUER_ORG_ID,
      owner_user_id: ownerUserId,
      type: OrganizationType.COMPANY,
      name: ISSUER_NAME,
      registration_number: "202688880001",
      country: "Malaysia",
      onboarding_status: "COMPLETED",
      onboarded_at: new Date(),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: { basicInfo: { industry: "Trading" } },
    },
  });

  await prisma.contract.upsert({
    where: { id: CONTRACT_ID },
    update: {
      issuer_organization_id: ISSUER_ORG_ID,
      status: ContractStatus.APPROVED,
      contract_details: {
        approved_facility: 500_000,
        financing: TARGET_AMOUNT,
        value: TARGET_AMOUNT,
        description: CONTRACT_WORK_DESCRIPTION,
      },
      customer_details: {
        name: PAYMASTER_NAME,
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
      },
    },
    create: {
      id: CONTRACT_ID,
      issuer_organization_id: ISSUER_ORG_ID,
      status: ContractStatus.APPROVED,
      contract_details: {
        approved_facility: 500_000,
        financing: TARGET_AMOUNT,
        value: TARGET_AMOUNT,
        description: CONTRACT_WORK_DESCRIPTION,
      },
      customer_details: {
        name: PAYMASTER_NAME,
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
      },
    },
  });
}

async function ensureApplicationAndInvoice() {
  const maturity = isoDate(addDays(new Date(), 120));
  const financingType = {
    product_id: PRODUCT_ID,
    product_name: "Account Receivable Financing",
    category: "invoice_financing",
  };
  const businessDetails = {
    ...buildProspectusDemoBusinessDetails(),
    why_raising_funds: {
      ...((buildProspectusDemoBusinessDetails().why_raising_funds as Record<string, unknown>) ??
        {}),
      financing_for: PURPOSE,
    },
  };
  const financialStatements = buildProspectusDemoFinancialStatements();

  await upsertProspectusDemoCtosReport({
    prisma,
    reportId: ISSUER_CTOS_REPORT_ID,
    issuerOrganizationId: ISSUER_ORG_ID,
  });

  await prisma.application.upsert({
    where: { id: APP_ID },
    update: {
      issuer_organization_id: ISSUER_ORG_ID,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      submitted_at: new Date(),
      financing_type: financingType as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: "existing_contract",
        existing_contract_id: CONTRACT_ID,
      } as Prisma.InputJsonValue,
      contract_id: CONTRACT_ID,
      company_details: {
        contact_person: {
          name: "Demo Contact",
          ic: "900101-14-0002",
          contact: "0123456789",
          position: "Finance Manager",
        },
        issuer_organization_id: ISSUER_ORG_ID,
      } as Prisma.InputJsonValue,
      business_details: businessDetails as Prisma.InputJsonValue,
      financial_statements: financialStatements as Prisma.InputJsonValue,
    },
    create: {
      id: APP_ID,
      issuer_organization_id: ISSUER_ORG_ID,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      last_completed_step: 9,
      submitted_at: new Date(),
      financing_type: financingType as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: "existing_contract",
        existing_contract_id: CONTRACT_ID,
      } as Prisma.InputJsonValue,
      contract_id: CONTRACT_ID,
      company_details: {
        contact_person: {
          name: "Demo Contact",
          ic: "900101-14-0002",
          contact: "0123456789",
          position: "Finance Manager",
        },
        issuer_organization_id: ISSUER_ORG_ID,
      } as Prisma.InputJsonValue,
      business_details: businessDetails as Prisma.InputJsonValue,
      financial_statements: financialStatements as Prisma.InputJsonValue,
      supporting_documents: { categories: [] } as Prisma.InputJsonValue,
      declarations: { items: [] } as Prisma.InputJsonValue,
      review_and_submit: {} as Prisma.InputJsonValue,
    },
  });

  const invoiceDetails = {
    number: "INV-DEMO-PROSPECTUS-001",
    applied_financing: TARGET_AMOUNT,
    maturity_date: maturity,
    due_date: maturity,
    value: TARGET_AMOUNT,
    financing_ratio_percent: 80,
    invoice_value: TARGET_AMOUNT,
  };
  const offerDetails = {
    offered_amount: TARGET_AMOUNT,
    offered_profit_rate_percent: PROFIT_RATE,
    platform_fee_rate_percent: PLATFORM_FEE,
    risk_rating: RISK_RATING,
  };

  await prisma.invoice.upsert({
    where: { id: INVOICE_ID },
    update: {
      application_id: APP_ID,
      contract_id: CONTRACT_ID,
      status: InvoiceStatus.APPROVED,
      details: invoiceDetails as Prisma.InputJsonValue,
      offer_details: offerDetails as Prisma.InputJsonValue,
    },
    create: {
      id: INVOICE_ID,
      application_id: APP_ID,
      contract_id: CONTRACT_ID,
      status: InvoiceStatus.APPROVED,
      details: invoiceDetails as Prisma.InputJsonValue,
      offer_details: offerDetails as Prisma.InputJsonValue,
    },
  });

  return { maturity, invoiceDetails, offerDetails, businessDetails };
}

async function resetDemoNotes() {
  const ids = [NOTE_ID, HIST_REPAID_ID, HIST_ACTIVE_ID];
  const byRef = await prisma.note.findUnique({
    where: { note_reference: NOTE_REFERENCE },
    select: { id: true },
  });
  if (byRef && !ids.includes(byRef.id)) ids.push(byRef.id);

  for (const noteId of ids) {
    const exists = await prisma.note.findUnique({ where: { id: noteId }, select: { id: true } });
    if (!exists) continue;
    await prisma.$transaction(async (tx) => {
      await tx.noteInvestment.deleteMany({ where: { note_id: noteId } });
      await tx.notePayment.deleteMany({ where: { note_id: noteId } });
      await tx.noteSettlement.deleteMany({ where: { note_id: noteId } });
      await tx.noteLedgerEntry.deleteMany({ where: { note_id: noteId } });
      await tx.noteProspectusPublication.deleteMany({ where: { note_id: noteId } });
      await tx.noteProspectusReview.deleteMany({ where: { note_id: noteId } });
      await tx.noteListing.deleteMany({ where: { note_id: noteId } });
      await tx.notePaymentSchedule.deleteMany({ where: { note_id: noteId } });
      await tx.noteEvent.deleteMany({ where: { note_id: noteId } });
      if (!ids.slice(0, 3).includes(noteId)) {
        await tx.note.delete({ where: { id: noteId } });
      }
    });
  }
}

async function upsertHistoricalNotes(issuerSnapshot: Record<string, unknown>) {
  const now = new Date();
  const shared = {
    source_application_id: APP_ID,
    source_contract_id: CONTRACT_ID,
    issuer_organization_id: ISSUER_ORG_ID,
    issuer_snapshot: issuerSnapshot as Prisma.InputJsonValue,
    paymaster_snapshot: {
      name: PAYMASTER_NAME,
      country: "MY",
      entity_type: "Private Limited Company (Sdn Bhd)",
    } as Prisma.InputJsonValue,
    product_snapshot: {
      product_id: PRODUCT_ID,
      product_name: "Account Receivable Financing",
      category: "invoice_financing",
    } as Prisma.InputJsonValue,
    purpose_snapshot: { financing_for: PURPOSE } as Prisma.InputJsonValue,
    requested_amount: money(80_000),
    target_amount: money(80_000),
    funded_amount: money(80_000),
    profit_rate_percent: money(9),
    platform_fee_rate_percent: money(PLATFORM_FEE),
    service_fee_rate_percent: money(SERVICE_FEE),
    listing_status: NoteListingStatus.CLOSED,
    funding_status: NoteFundingStatus.FUNDED,
  };

  await prisma.note.upsert({
    where: { id: HIST_REPAID_ID },
    update: {
      ...shared,
      title: "Demo Prospectus Historical — Repaid",
      note_reference: "DEMO-PROSPECTUS-HIST-REPAID",
      status: NoteStatus.REPAID,
      servicing_status: NoteServicingStatus.SETTLED,
      maturity_date: addDays(now, -30),
      published_at: addDays(now, -150),
      activated_at: addDays(now, -140),
      repaid_at: addDays(now, -35),
      prospectus_snapshot: Prisma.DbNull,
      source_invoice_id: null,
    },
    create: {
      id: HIST_REPAID_ID,
      ...shared,
      title: "Demo Prospectus Historical — Repaid",
      note_reference: "DEMO-PROSPECTUS-HIST-REPAID",
      status: NoteStatus.REPAID,
      servicing_status: NoteServicingStatus.SETTLED,
      maturity_date: addDays(now, -30),
      published_at: addDays(now, -150),
      activated_at: addDays(now, -140),
      repaid_at: addDays(now, -35),
    },
  });

  await prisma.note.upsert({
    where: { id: HIST_ACTIVE_ID },
    update: {
      ...shared,
      title: "Demo Prospectus Historical — Active",
      note_reference: "DEMO-PROSPECTUS-HIST-ACTIVE",
      status: NoteStatus.ACTIVE,
      servicing_status: NoteServicingStatus.CURRENT,
      maturity_date: addDays(now, 60),
      published_at: addDays(now, -40),
      activated_at: addDays(now, -30),
      repaid_at: null,
      prospectus_snapshot: Prisma.DbNull,
      source_invoice_id: null,
    },
    create: {
      id: HIST_ACTIVE_ID,
      ...shared,
      title: "Demo Prospectus Historical — Active",
      note_reference: "DEMO-PROSPECTUS-HIST-ACTIVE",
      status: NoteStatus.ACTIVE,
      servicing_status: NoteServicingStatus.CURRENT,
      maturity_date: addDays(now, 60),
      published_at: addDays(now, -40),
      activated_at: addDays(now, -30),
    },
  });

  for (const histId of [HIST_REPAID_ID, HIST_ACTIVE_ID]) {
    const opensAt = addDays(now, histId === HIST_REPAID_ID ? -150 : -40);
    await prisma.noteListing.upsert({
      where: { note_id: histId },
      update: {
        status: NoteListingStatus.CLOSED,
        opens_at: opensAt,
        closes_at: addDays(opensAt, 14),
        published_at: opensAt,
      },
      create: {
        note_id: histId,
        status: NoteListingStatus.CLOSED,
        opens_at: opensAt,
        closes_at: addDays(opensAt, 14),
        published_at: opensAt,
        visibility: "INVESTOR_MARKETPLACE",
        summary: "Historical demo note for Prospectus track record.",
      },
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
    where: { id: ISSUER_ORG_ID },
  });
  const issuerSnapshot = {
    ...buildNoteIssuerSnapshot({
      organization: org,
      businessDetails: args.businessDetails,
    }),
    entity_type: "Private Limited Company (Sdn Bhd)",
  };

  const now = new Date();
  const createdAt =
    now.getTime() >= PROSPECTUS_REVIEW_REQUIRED_FROM.getTime()
      ? now
      : new Date(PROSPECTUS_REVIEW_REQUIRED_FROM.getTime() + 60_000);
  const opensAt = now;
  const closesAt = addDays(now, 14);
  const maturityDate = new Date(`${args.maturity}T00:00:00.000Z`);

  const noteData = {
    id: NOTE_ID,
    source_application_id: APP_ID,
    source_contract_id: CONTRACT_ID,
    source_invoice_id: INVOICE_ID,
    issuer_organization_id: ISSUER_ORG_ID,
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
    title: `Prospectus Demo — ${NOTE_REFERENCE}`,
    note_reference: NOTE_REFERENCE,
    issuer_snapshot: issuerSnapshot as Prisma.InputJsonValue,
    paymaster_snapshot: {
      name: PAYMASTER_NAME,
      country: "MY",
      entity_type: "Private Limited Company (Sdn Bhd)",
    } as Prisma.InputJsonValue,
    product_snapshot: {
      product_id: PRODUCT_ID,
      product_name: "Account Receivable Financing",
      category: "invoice_financing",
      name: "Account Receivable Financing",
    } as Prisma.InputJsonValue,
    purpose_snapshot: { financing_for: PURPOSE } as Prisma.InputJsonValue,
    contract_snapshot: {
      id: CONTRACT_ID,
      status: ContractStatus.APPROVED,
      contract_details: {
        approved_facility: 500_000,
        financing: TARGET_AMOUNT,
        value: TARGET_AMOUNT,
        description: CONTRACT_WORK_DESCRIPTION,
      },
      customer_details: {
        name: PAYMASTER_NAME,
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
      },
    } as Prisma.InputJsonValue,
    invoice_snapshot: {
      id: INVOICE_ID,
      status: InvoiceStatus.APPROVED,
      details: args.invoiceDetails,
      offer_details: args.offerDetails,
    } as Prisma.InputJsonValue,
    requested_amount: money(TARGET_AMOUNT),
    target_amount: money(TARGET_AMOUNT),
    profit_rate_percent: money(PROFIT_RATE),
    platform_fee_rate_percent: money(PLATFORM_FEE),
    service_fee_rate_percent: money(SERVICE_FEE),
    maturity_date: maturityDate,
    created_at: createdAt,
  };

  await prisma.note.upsert({
    where: { id: NOTE_ID },
    update: { ...noteData, updated_at: now },
    create: noteData,
  });

  await prisma.noteListing.upsert({
    where: { note_id: NOTE_ID },
    update: {
      status: NoteListingStatus.DRAFT,
      opens_at: opensAt,
      closes_at: closesAt,
      published_at: null,
      unpublished_at: null,
      visibility: "INVESTOR_MARKETPLACE",
      summary: "Dev sync Prospectus demo listing (unpublished).",
    },
    create: {
      note_id: NOTE_ID,
      status: NoteListingStatus.DRAFT,
      opens_at: opensAt,
      closes_at: closesAt,
      visibility: "INVESTOR_MARKETPLACE",
      summary: "Dev sync Prospectus demo listing (unpublished).",
    },
  });

  await prisma.notePaymentSchedule.deleteMany({ where: { note_id: NOTE_ID } });
  const profit = TARGET_AMOUNT * (PROFIT_RATE / 100);
  await prisma.notePaymentSchedule.create({
    data: {
      note_id: NOTE_ID,
      sequence: 1,
      due_date: maturityDate,
      expected_principal: money(TARGET_AMOUNT),
      expected_profit: money(profit),
      expected_total: money(TARGET_AMOUNT + profit),
    },
  });

  // Explicit DRAFT review — complete officer content for local Prospectus demos.
  const draft = buildCompleteProspectusReviewDraft();
  const incomeYears = Object.keys(
    (financialStatements as { unaudited_by_year?: Record<string, unknown> }).unaudited_by_year ??
      {}
  ).sort();
  const ctosYears = (await prisma.ctosReport.findFirst({
    where: { issuer_organization_id: ISSUER_ORG_ID, subject_ref: null },
    select: { financials_json: true },
    orderBy: { fetched_at: "desc" },
  }))?.financials_json;
  const allIncomeYears = new Set<string>(incomeYears);
  if (Array.isArray(ctosYears)) {
    for (const row of ctosYears) {
      const year =
        typeof row === "object" && row && "financial_year" in row
          ? Number((row as { financial_year?: unknown }).financial_year)
          : NaN;
      if (Number.isFinite(year)) allIncomeYears.add(String(year));
    }
  }
  const incomeLadder = [
    { grossProfit: 2_100_000, ebitda: 1_600_000, ebit: 1_450_000 },
    { grossProfit: 2_400_000, ebitda: 1_850_000, ebit: 1_700_000 },
    { grossProfit: 2_800_000, ebitda: 2_100_000, ebit: 1_950_000 },
  ] as const;
  const sortedIncomeYears = [...allIncomeYears].sort();
  draft.page3.manualFinancialInputs = {
    years: Object.fromEntries(
      sortedIncomeYears.map((year, index) => [
        year,
        {
          ...(draft.page3.manualFinancialInputs?.years?.[year] ?? {}),
          ...incomeLadder[Math.min(index, incomeLadder.length - 1)]!,
        },
      ])
    ),
  };
  await prisma.noteProspectusReview.upsert({
    where: { note_id: NOTE_ID },
    update: {
      status: ProspectusReviewStatus.DRAFT,
      content_version: 1,
      option_catalogue_version: catalogueVersion(),
      draft_content: draft as unknown as Prisma.InputJsonValue,
      approved_content: Prisma.DbNull,
      approved_snapshot: Prisma.DbNull,
      approved_publication_id: null,
      render_fingerprint: null,
      approved_by_user_id: null,
      approved_at: null,
      updated_by_user_id: actorUserId,
    },
    create: {
      id: REVIEW_ID,
      note_id: NOTE_ID,
      status: ProspectusReviewStatus.DRAFT,
      content_version: 1,
      option_catalogue_version: catalogueVersion(),
      draft_content: draft as unknown as Prisma.InputJsonValue,
      created_by_user_id: actorUserId,
      updated_by_user_id: actorUserId,
    },
  });

  await upsertHistoricalNotes(issuerSnapshot);

  await prisma.noteEvent.create({
    data: {
      note_id: NOTE_ID,
      event_type: "PROSPECTUS_DEMO_SEED",
      actor_user_id: actorUserId,
      actor_role: UserRole.ADMIN,
      portal: "ADMIN",
      metadata: { reference: NOTE_REFERENCE, workflow: "DRAFT" },
    },
  });
}

async function ensureSiteDocuments(adminUserId: string) {
  const docs = [
    {
      id: SITE_DOC_PRODUCT,
      type: "PRODUCT_TERMS" as const,
      title: "Product Terms (Demo)",
      file_name: "product-terms-demo.pdf",
      s3_key: `seed/demo-prospectus/product-terms-v1.pdf`,
    },
    {
      id: SITE_DOC_RISK,
      type: "RISK_DISCLOSURE" as const,
      title: "Risk Disclosure Statement (Demo)",
      file_name: "risk-disclosure-demo.pdf",
      s3_key: `seed/demo-prospectus/risk-disclosure-v1.pdf`,
    },
  ];

  for (const doc of docs) {
    await prisma.siteDocument.upsert({
      where: { id: doc.id },
      update: {
        type: doc.type,
        title: doc.title,
        description: "Local Prospectus demo document (placeholder file key).",
        file_name: doc.file_name,
        s3_key: doc.s3_key,
        content_type: "application/pdf",
        file_size: 1024,
        version: 1,
        is_active: true,
        show_in_account: true,
        uploaded_by: adminUserId,
      },
      create: {
        id: doc.id,
        type: doc.type,
        title: doc.title,
        description: "Local Prospectus demo document (placeholder file key).",
        file_name: doc.file_name,
        s3_key: doc.s3_key,
        content_type: "application/pdf",
        file_size: 1024,
        version: 1,
        is_active: true,
        show_in_account: true,
        uploaded_by: adminUserId,
      },
    });
  }
}

export async function seedProspectusDemo() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:prospectus-demo is blocked in production");
  }

  const adminUserId = await ensureUser({
    email: ADMIN_EMAIL,
    cognitoSub: ADMIN_SUB,
    roles: [UserRole.ADMIN],
    firstName: "Demo",
    lastName: "ProspectusAdmin",
  });
  await ensureAdmin(adminUserId);

  const investorUserId = await ensureUser({
    email: INVESTOR_EMAIL,
    cognitoSub: INVESTOR_SUB,
    roles: [UserRole.INVESTOR],
    firstName: "Demo",
    lastName: "ProspectusInvestor",
    investorOrgIds: [INVESTOR_ORG_ID],
  });
  await ensureInvestorOrg(investorUserId);

  const issuerUserId = await ensureUser({
    email: ISSUER_EMAIL,
    cognitoSub: ISSUER_SUB,
    roles: [UserRole.ISSUER],
    firstName: "Demo",
    lastName: "ProspectusIssuer",
    issuerOrgIds: [ISSUER_ORG_ID],
  });
  await ensureIssuerAndProduct(issuerUserId);

  const appInvoice = await ensureApplicationAndInvoice();
  await resetDemoNotes();
  await upsertDraftNote(adminUserId, appInvoice);
  await ensureSiteDocuments(adminUserId);

  const note = await prisma.note.findUniqueOrThrow({
    where: { id: NOTE_ID },
    include: { listing: true, prospectus_review: true },
  });
  const publicationCount = await prisma.noteProspectusPublication.count({
    where: { note_id: NOTE_ID },
  });

  const { getPortalBaseUrl } = await import("../src/lib/http/url-utils");
  const adminUrl = getPortalBaseUrl("admin");
  const investorUrl = getPortalBaseUrl("investor");

  return {
    adminEmail: ADMIN_EMAIL,
    investorEmail: INVESTOR_EMAIL,
    issuerEmail: ISSUER_EMAIL,
    developmentPasswords:
      "Not created by this seed (Cognito-managed). Use an existing Cognito user, create-admin, or DISABLE_AUTH=true for local API bypass.",
    noteId: note.id,
    noteReference: note.note_reference,
    noteStatus: note.status,
    prospectusStatus: note.prospectus_review?.status ?? "DRAFT",
    expectedInitialStatus: "Draft",
    publicationRows: publicationCount,
    hasPublishedSnapshot: note.prospectus_snapshot != null,
    adminNoteDetailUrl: `${adminUrl}/notes/${note.id}`,
    adminProspectusUrl: `${adminUrl}/notes/${note.id}/prospectus`,
    investorMarketplaceUrl: `${investorUrl}/marketplace`,
    command: "pnpm --filter @cashsouk/api seed:prospectus-demo",
  };
}

async function main() {
  const result = await seedProspectusDemo();
  console.log("\n=== Prospectus workflow demo seed (local only) ===\n");
  console.log(`Admin login email:     ${result.adminEmail}`);
  console.log(`Investor login email:  ${result.investorEmail}`);
  console.log(`Passwords:             ${result.developmentPasswords}`);
  console.log(`Note ID:               ${result.noteId}`);
  console.log(`Note reference:        ${result.noteReference}`);
  console.log(`Admin Note Detail URL: ${result.adminNoteDetailUrl}`);
  console.log(`Admin Prospectus URL:  ${result.adminProspectusUrl}`);
  console.log(`Investor Marketplace:  ${result.investorMarketplaceUrl}`);
  console.log(`Expected status:       ${result.expectedInitialStatus}`);
  console.log(`Prospectus DB status:  ${result.prospectusStatus}`);
  console.log(`Publication rows:      ${result.publicationRows}`);
  console.log(`Published snapshot:    ${result.hasPublishedSnapshot}`);
  console.log(`\nCommand:\n  ${result.command}\n`);
}

const isDirectRun =
  process.argv[1]?.includes("seed-prospectus-demo") ||
  process.argv[1]?.includes("seed:prospectus-demo");

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
