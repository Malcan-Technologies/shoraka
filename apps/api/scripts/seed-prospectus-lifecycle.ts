#!/usr/bin/env tsx
/**
 * Dev/UAT-only idempotent seed: Prospectus lifecycle scenarios.
 *
 * Usage:
 *   pnpm --filter @cashsouk/api seed:prospectus-lifecycle
 *
 * Covers Note-only → Draft → Ready → Approve → Edit → Re-approve → Publish → Invest,
 * plus financial-year display variants.
 *
 * Prefer real ProspectusReviewService / NoteService for approve, publish, invest.
 * Base Application/Invoice/Note rows use stable Prisma upserts (same pattern as
 * seed-prospectus-demo) so references stay deterministic.
 *
 * Blocked in production. Never invents pdf_generation_status=READY without a real PDF.
 */
import {
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
  NoteFundingStatus,
  NoteInvestmentStatus,
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
import { ProspectusReviewService } from "../src/modules/notes/prospectus-review/prospectus-review.service";
import { NoteService } from "../src/modules/notes/service";
import {
  assertNotProductionSeed,
  buildLifecycleProspectusDraft,
} from "./lib/prospectus-lifecycle-drafts";
import {
  buildLifecycleFinancialBundle,
  ctosJson,
  type LifecycleFinancialVariant,
} from "./lib/prospectus-lifecycle-financials";

const prisma = new PrismaClient();
const prospectusReviewService = new ProspectusReviewService();
const noteService = new NoteService();

const PREFIX = "seed_prospectus_lc";
const INVESTOR_ORG_ID = `${PREFIX}_investor_org`;
const PRODUCT_ID = `${PREFIX}_product`;
const ADMIN_EMAIL = "lifecycle.prospectus.admin@cashsouk.local";
const ADMIN_SUB = `${PREFIX}_admin_sub`;
const INVESTOR_EMAIL = "lifecycle.prospectus.investor@cashsouk.local";
const INVESTOR_SUB = `${PREFIX}_investor_sub`;
const ISSUER_EMAIL = "lifecycle.prospectus.issuer@cashsouk.local";
const ISSUER_SUB = `${PREFIX}_issuer_sub`;
const PAYMASTER_NAME = "Lifecycle Seed Paymaster Sdn. Bhd.";
const TARGET_AMOUNT = 100_000;
const PROFIT_RATE = 12;
const PLATFORM_FEE = 1.5;
const SERVICE_FEE = 15;
const RISK_RATING = "B";

type ScenarioKey =
  | "01_note_only"
  | "02_empty_draft"
  | "03_partial_draft"
  | "04_ready_approve"
  | "05_approved"
  | "06_edited"
  | "07_reapproved"
  | "08_published"
  | "09_invested"
  | "fy_one"
  | "fy_two"
  | "fy_three"
  | "fy_gapped";

const SCENARIOS: Record<
  ScenarioKey,
  {
    label: string;
    reference: string;
    financial: LifecycleFinancialVariant;
  }
> = {
  "01_note_only": {
    label: "Prospectus 01 — Note only",
    reference: "SEED-PROSPECTUS-01-NOTE-ONLY",
    financial: "three_years",
  },
  "02_empty_draft": {
    label: "Prospectus 02 — Empty draft",
    reference: "SEED-PROSPECTUS-02-EMPTY-DRAFT",
    financial: "three_years",
  },
  "03_partial_draft": {
    label: "Prospectus 03 — Partial draft",
    reference: "SEED-PROSPECTUS-03-PARTIAL-DRAFT",
    financial: "three_years",
  },
  "04_ready_approve": {
    label: "Prospectus 04 — Ready to approve",
    reference: "SEED-PROSPECTUS-04-READY-APPROVE",
    financial: "three_years",
  },
  "05_approved": {
    label: "Prospectus 05 — Approved, awaiting publish",
    reference: "SEED-PROSPECTUS-05-APPROVED",
    financial: "three_years",
  },
  "06_edited": {
    label: "Prospectus 06 — Edited after approval",
    reference: "SEED-PROSPECTUS-06-EDITED",
    financial: "three_years",
  },
  "07_reapproved": {
    label: "Prospectus 07 — Re-approved, two versions",
    reference: "SEED-PROSPECTUS-07-REAPPROVED",
    financial: "three_years",
  },
  "08_published": {
    label: "Prospectus 08 — Published marketplace Note",
    reference: "SEED-PROSPECTUS-08-PUBLISHED",
    financial: "three_years",
  },
  "09_invested": {
    label: "Prospectus 09 — Published with investment",
    reference: "SEED-PROSPECTUS-09-INVESTED",
    financial: "three_years",
  },
  fy_one: {
    label: "Prospectus FY — One real year",
    reference: "SEED-PROSPECTUS-FY-ONE",
    financial: "one_year",
  },
  fy_two: {
    label: "Prospectus FY — Two real years",
    reference: "SEED-PROSPECTUS-FY-TWO",
    financial: "two_years",
  },
  fy_three: {
    label: "Prospectus FY — Three real years",
    reference: "SEED-PROSPECTUS-FY-THREE",
    financial: "three_years",
  },
  fy_gapped: {
    label: "Prospectus FY — Gapped years",
    reference: "SEED-PROSPECTUS-FY-GAPPED",
    financial: "gapped_years",
  },
};

function ids(key: ScenarioKey) {
  const slug = key.replace(/_/g, "");
  return {
    noteId: `${PREFIX}_${slug}_note`,
    appId: `${PREFIX}_${slug}_app`,
    invoiceId: `${PREFIX}_${slug}_invoice`,
    ctosId: `${PREFIX}_${slug}_ctos`,
    issuerOrgId: `${PREFIX}_${slug}_issuer`,
    contractId: `${PREFIX}_${slug}_contract`,
  };
}

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function adminActor(userId: string) {
  return { userId, role: UserRole.ADMIN, portal: "ADMIN" as const };
}

function investorActor(userId: string) {
  return { userId, role: UserRole.INVESTOR, portal: "INVESTOR" as const };
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
      first_name: input.firstName,
      last_name: input.lastName,
      roles: input.roles,
      investor_account: input.investorOrgIds ?? [],
      issuer_account: input.issuerOrgIds ?? [],
    },
  });
  return userId;
}

async function ensureSharedActors() {
  await ensureAdminRoleCatalog(prisma);
  const adminUserId = await ensureUser({
    email: ADMIN_EMAIL,
    cognitoSub: ADMIN_SUB,
    roles: [UserRole.ADMIN],
    firstName: "Lifecycle",
    lastName: "Admin",
  });
  const role = await prisma.adminRoleConfig.findUnique({
    where: { key: AdminRole.SUPER_ADMIN },
  });
  if (!role) {
    throw new Error("SUPER_ADMIN role catalog missing after ensureAdminRoleCatalog");
  }
  await prisma.admin.upsert({
    where: { user_id: adminUserId },
    create: {
      user_id: adminUserId,
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

  const issuerUserId = await ensureUser({
    email: ISSUER_EMAIL,
    cognitoSub: ISSUER_SUB,
    roles: [UserRole.ISSUER],
    firstName: "Lifecycle",
    lastName: "Issuer",
  });

  const investorUserId = await ensureUser({
    email: INVESTOR_EMAIL,
    cognitoSub: INVESTOR_SUB,
    roles: [UserRole.INVESTOR],
    firstName: "Lifecycle",
    lastName: "Investor",
    investorOrgIds: [INVESTOR_ORG_ID],
  });

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

  await prisma.investorOrganization.upsert({
    where: { id: INVESTOR_ORG_ID },
    update: {
      owner_user_id: investorUserId,
      type: OrganizationType.PERSONAL,
      deposit_received: true,
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      first_name: "Lifecycle",
      last_name: "Investor",
    },
    create: {
      id: INVESTOR_ORG_ID,
      owner_user_id: investorUserId,
      type: OrganizationType.PERSONAL,
      name: "Lifecycle Prospectus Investor",
      first_name: "Lifecycle",
      last_name: "Investor",
      country: "Malaysia",
      onboarding_status: "COMPLETED",
      onboarded_at: new Date(),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      deposit_received: true,
    },
  });

  await prisma.investorBalance.upsert({
    where: { investor_organization_id: INVESTOR_ORG_ID },
    update: { available_amount: money(500_000) },
    create: {
      investor_organization_id: INVESTOR_ORG_ID,
      available_amount: money(500_000),
    },
  });

  return { adminUserId, issuerUserId, investorUserId };
}

async function wipeNoteProspectusState(noteId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.noteInvestment.deleteMany({ where: { note_id: noteId } });
    await tx.noteProspectusPublication.deleteMany({ where: { note_id: noteId } });
    await tx.noteProspectusReview.deleteMany({ where: { note_id: noteId } });
    await tx.noteListing.deleteMany({ where: { note_id: noteId } });
    await tx.notePaymentSchedule.deleteMany({ where: { note_id: noteId } });
    await tx.noteEvent.deleteMany({ where: { note_id: noteId } });
  });
}

async function upsertBaseNote(input: {
  key: ScenarioKey;
  issuerUserId: string;
  financial: LifecycleFinancialVariant;
}): Promise<{ noteId: string; realYears: number[] }> {
  const meta = SCENARIOS[input.key];
  const { noteId, appId, invoiceId, ctosId, issuerOrgId, contractId } = ids(input.key);
  const ref = new Date();
  const bundle = buildLifecycleFinancialBundle(input.financial, ref);
  const maturity = isoDate(addDays(ref, 120));
  const issuerName = `Lifecycle Issuer ${meta.reference}`;
  const businessDetails = {
    about_your_business: {
      what_does_company_do: "Lifecycle seed issuer for Prospectus UAT.",
      main_customers: "Infrastructure buyers.",
      single_customer_over_50_revenue: false,
    },
    why_raising_funds: {
      financing_for: "civil engineering and infrastructure works",
      how_funds_used: "Working capital for financed invoice.",
      business_plan: "Maintain receivables turnover.",
      risks_delay_repayment: "Delivery delays.",
      backup_plan: "Bank facilities.",
      raising_on_other_p2p: false,
      declaration_confirmed: true,
    },
    declaration_confirmed: true,
    isDeclarationConfirmed: true,
    guarantors: [],
  };

  await prisma.issuerOrganization.upsert({
    where: { id: issuerOrgId },
    update: {
      owner_user_id: input.issuerUserId,
      name: issuerName,
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: {
        basicInfo: { industry: "Construction" },
        aboutYourBusiness: {
          whatDoesCompanyDo: "Lifecycle seed issuer for Prospectus UAT.",
          mainCustomers: "Infrastructure buyers.",
          singleCustomerOver50Revenue: false,
          accountingSoftware: "Xero",
        },
      },
    },
    create: {
      id: issuerOrgId,
      owner_user_id: input.issuerUserId,
      type: OrganizationType.COMPANY,
      name: issuerName,
      registration_number: `2026${String(Object.keys(SCENARIOS).indexOf(input.key) + 1).padStart(8, "0")}`,
      country: "Malaysia",
      onboarding_status: "COMPLETED",
      onboarded_at: new Date(),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: {
        basicInfo: { industry: "Construction" },
        aboutYourBusiness: {
          whatDoesCompanyDo: "Lifecycle seed issuer for Prospectus UAT.",
          mainCustomers: "Infrastructure buyers.",
          singleCustomerOver50Revenue: false,
          accountingSoftware: "Xero",
        },
      },
    },
  });

  await prisma.user.update({
    where: { user_id: input.issuerUserId },
    data: {
      issuer_account: {
        set: [...new Set([...(await prisma.user.findUniqueOrThrow({
          where: { user_id: input.issuerUserId },
          select: { issuer_account: true },
        })).issuer_account, issuerOrgId])],
      },
    },
  });

  await prisma.contract.upsert({
    where: { id: contractId },
    update: {
      issuer_organization_id: issuerOrgId,
      status: ContractStatus.APPROVED,
      contract_details: {
        approved_facility: 500_000,
        financing: TARGET_AMOUNT,
        value: TARGET_AMOUNT,
        description: "civil engineering and infrastructure works",
      },
      customer_details: {
        name: PAYMASTER_NAME,
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
      },
    },
    create: {
      id: contractId,
      issuer_organization_id: issuerOrgId,
      status: ContractStatus.APPROVED,
      contract_details: {
        approved_facility: 500_000,
        financing: TARGET_AMOUNT,
        value: TARGET_AMOUNT,
        description: "civil engineering and infrastructure works",
      },
      customer_details: {
        name: PAYMASTER_NAME,
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
      },
    },
  });

  // Per-scenario CTOS so FY variants do not overwrite each other (findFirst by org).
  await prisma.ctosReport.upsert({
    where: { id: ctosId },
    update: {
      issuer_organization_id: issuerOrgId,
      financials_json: ctosJson(bundle.ctosFinancials),
      fetched_at: ref,
      raw_xml: "<lifecycle-seed/>",
      summary_json: {},
      legal_json: {},
      ccris_json: {},
      company_json: {},
    },
    create: {
      id: ctosId,
      issuer_organization_id: issuerOrgId,
      financials_json: ctosJson(bundle.ctosFinancials),
      summary_json: {},
      legal_json: {},
      ccris_json: {},
      company_json: {},
      fetched_at: ref,
      raw_xml: "<lifecycle-seed/>",
    },
  });

  const offerDetails = {
    requested_amount: TARGET_AMOUNT,
    offered_amount: TARGET_AMOUNT,
    offered_ratio_percent: 80,
    offered_profit_rate_percent: PROFIT_RATE,
    platform_fee_rate_percent: PLATFORM_FEE,
    risk_rating: RISK_RATING,
    version: 1,
    sent_at: ref.toISOString(),
  };
  const invoiceDetails = {
    number: `INV-${meta.reference}`,
    value: TARGET_AMOUNT,
    invoice_value: TARGET_AMOUNT,
    applied_financing: TARGET_AMOUNT,
    financing_ratio_percent: 80,
    maturity_date: maturity,
    due_date: maturity,
  };

  await prisma.application.upsert({
    where: { id: appId },
    update: {
      issuer_organization_id: issuerOrgId,
      contract_id: contractId,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      financing_type: {
        product_id: PRODUCT_ID,
        product_name: "Account Receivable Financing",
        category: "invoice_financing",
      },
      business_details: businessDetails,
      financial_statements: bundle.financialStatements as Prisma.InputJsonValue,
    },
    create: {
      id: appId,
      issuer_organization_id: issuerOrgId,
      contract_id: contractId,
      product_version: 1,
      status: ApplicationStatus.COMPLETED,
      financing_type: {
        product_id: PRODUCT_ID,
        product_name: "Account Receivable Financing",
        category: "invoice_financing",
      },
      business_details: businessDetails,
      financial_statements: bundle.financialStatements as Prisma.InputJsonValue,
    },
  });

  await prisma.invoice.upsert({
    where: { id: invoiceId },
    update: {
      application_id: appId,
      contract_id: contractId,
      status: InvoiceStatus.APPROVED,
      details: invoiceDetails,
      offer_details: offerDetails,
    },
    create: {
      id: invoiceId,
      application_id: appId,
      contract_id: contractId,
      status: InvoiceStatus.APPROVED,
      details: invoiceDetails,
      offer_details: offerDetails,
    },
  });

  await wipeNoteProspectusState(noteId);

  const org = await prisma.issuerOrganization.findUniqueOrThrow({
    where: { id: issuerOrgId },
  });
  const issuerSnapshot = {
    ...buildNoteIssuerSnapshot({
      organization: org,
      businessDetails,
    }),
    entity_type: "Private Limited Company (Sdn Bhd)",
  };

  const createdAt =
    Date.now() >= PROSPECTUS_REVIEW_REQUIRED_FROM.getTime()
      ? new Date()
      : new Date(PROSPECTUS_REVIEW_REQUIRED_FROM.getTime() + 60_000);

  const noteData = {
    source_application_id: appId,
    source_contract_id: contractId,
    source_invoice_id: invoiceId,
    issuer_organization_id: issuerOrgId,
    status: NoteStatus.DRAFT,
    listing_status: NoteListingStatus.NOT_LISTED,
    funding_status: NoteFundingStatus.NOT_OPEN,
    servicing_status: NoteServicingStatus.NOT_STARTED,
    title: meta.label,
    note_reference: meta.reference,
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
    purpose_snapshot: {
      financing_for: "civil engineering and infrastructure works",
    } as Prisma.InputJsonValue,
    contract_snapshot: {
      id: contractId,
      status: ContractStatus.APPROVED,
      contract_details: {
        approved_facility: 500_000,
        financing: TARGET_AMOUNT,
        value: TARGET_AMOUNT,
        description: "civil engineering and infrastructure works",
      },
      customer_details: {
        name: PAYMASTER_NAME,
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
      },
    } as Prisma.InputJsonValue,
    invoice_snapshot: {
      id: invoiceId,
      status: InvoiceStatus.APPROVED,
      details: invoiceDetails,
      offer_details: offerDetails,
    } as Prisma.InputJsonValue,
    requested_amount: money(TARGET_AMOUNT),
    target_amount: money(TARGET_AMOUNT),
    funded_amount: money(0),
    profit_rate_percent: money(PROFIT_RATE),
    platform_fee_rate_percent: money(PLATFORM_FEE),
    service_fee_rate_percent: money(SERVICE_FEE),
    maturity_date: new Date(`${maturity}T00:00:00.000Z`),
    published_at: null,
    prospectus_snapshot: Prisma.DbNull,
    created_at: createdAt,
  };

  await prisma.note.upsert({
    where: { id: noteId },
    update: noteData,
    create: { id: noteId, ...noteData },
  });

  await prisma.notePaymentSchedule.deleteMany({ where: { note_id: noteId } });
  const principal = TARGET_AMOUNT;
  const profit = (principal * PROFIT_RATE) / 100;
  await prisma.notePaymentSchedule.create({
    data: {
      note_id: noteId,
      sequence: 1,
      due_date: new Date(`${maturity}T00:00:00.000Z`),
      expected_principal: money(principal),
      expected_profit: money(profit),
      expected_total: money(principal + profit),
    },
  });

  return { noteId, realYears: bundle.realYears };
}

async function saveDraft(
  noteId: string,
  adminUserId: string,
  mode: "empty" | "partial" | "complete",
  realYears: number[]
) {
  await prospectusReviewService.getOrCreateReview(noteId, adminActor(adminUserId));
  if (mode === "empty") return;
  const draft = buildLifecycleProspectusDraft({ mode, realYears });
  await prospectusReviewService.saveDraft(
    noteId,
    { draftContent: draft },
    adminActor(adminUserId)
  );
}

async function approveNote(noteId: string, adminUserId: string, realYears: number[]) {
  const draft = buildLifecycleProspectusDraft({ mode: "complete", realYears });
  await prospectusReviewService.approve(noteId, adminActor(adminUserId), {
    draftContent: draft,
  });
}

async function editAfterApprove(noteId: string, adminUserId: string, realYears: number[]) {
  const draft = buildLifecycleProspectusDraft({ mode: "complete", realYears });
  draft.page2.issuerProfile = { companySize: "Large" };
  await prospectusReviewService.saveDraft(
    noteId,
    { draftContent: draft },
    adminActor(adminUserId)
  );
}

async function publishNote(noteId: string, adminUserId: string) {
  await noteService.publish(noteId, adminActor(adminUserId));
}

async function investNote(noteId: string, investorUserId: string) {
  // Idempotent: delete prior seed investments then recreate via service.
  await prisma.noteInvestment.deleteMany({
    where: {
      note_id: noteId,
      investor_organization_id: INVESTOR_ORG_ID,
    },
  });
  // Restore capacity if a prior seed invest reduced funded_amount.
  await prisma.note.update({
    where: { id: noteId },
    data: {
      funded_amount: money(0),
      funding_status: NoteFundingStatus.OPEN,
    },
  });
  await prisma.investorBalance.upsert({
    where: { investor_organization_id: INVESTOR_ORG_ID },
    update: { available_amount: money(500_000) },
    create: {
      investor_organization_id: INVESTOR_ORG_ID,
      available_amount: money(500_000),
    },
  });

  await noteService.createInvestment(
    noteId,
    {
      amount: 10_000,
      investorOrganizationId: INVESTOR_ORG_ID,
      prospectusAcknowledged: true,
    },
    investorActor(investorUserId)
  );
}

type ScenarioResult = {
  key: ScenarioKey;
  reference: string;
  noteId: string;
  reviewStatus: string;
  publications: number;
  published: boolean;
  pdfReady: boolean;
  listing: boolean;
  investments: number;
  error?: string;
};

async function verifyScenario(key: ScenarioKey): Promise<ScenarioResult> {
  const meta = SCENARIOS[key];
  const { noteId } = ids(key);
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    include: {
      prospectus_review: true,
      prospectus_publications: true,
      listing: true,
      investments: true,
    },
  });
  if (!note) {
    return {
      key,
      reference: meta.reference,
      noteId,
      reviewStatus: "missing",
      publications: 0,
      published: false,
      pdfReady: false,
      listing: false,
      investments: 0,
      error: "Note missing",
    };
  }
  const pubs = note.prospectus_publications;
  const approvedPub =
    pubs.find((p) => p.id === note.prospectus_review?.approved_publication_id) ??
    pubs[0];
  return {
    key,
    reference: meta.reference,
    noteId,
    reviewStatus: note.prospectus_review?.status ?? "none",
    publications: pubs.length,
    published: Boolean(
      note.status === NoteStatus.PUBLISHED &&
        pubs.some((p) => p.published_at != null)
    ),
    pdfReady: Boolean(
      approvedPub?.pdf_generation_status === "READY" && approvedPub.pdf_storage_key
    ),
    listing: Boolean(note.listing && note.listing.status === NoteListingStatus.PUBLISHED),
    investments: note.investments.filter(
      (i) => i.status !== NoteInvestmentStatus.RELEASED
    ).length,
  };
}

async function runScenario(
  key: ScenarioKey,
  adminUserId: string,
  issuerUserId: string,
  investorUserId: string,
  options: { skipApprove: boolean }
): Promise<ScenarioResult> {
  const meta = SCENARIOS[key];
  const { noteId, realYears } = await upsertBaseNote({
    key,
    issuerUserId,
    financial: meta.financial,
  });

  try {
    switch (key) {
      case "01_note_only":
        break;
      case "02_empty_draft":
        await prospectusReviewService.getOrCreateReview(noteId, adminActor(adminUserId));
        break;
      case "03_partial_draft":
        await saveDraft(noteId, adminUserId, "partial", realYears);
        break;
      case "04_ready_approve":
      case "fy_one":
      case "fy_two":
      case "fy_three":
      case "fy_gapped":
        await saveDraft(noteId, adminUserId, "complete", realYears);
        break;
      case "05_approved":
        await saveDraft(noteId, adminUserId, "complete", realYears);
        if (options.skipApprove) throw new Error("SKIP_APPROVE");
        await approveNote(noteId, adminUserId, realYears);
        break;
      case "06_edited":
        await saveDraft(noteId, adminUserId, "complete", realYears);
        if (options.skipApprove) throw new Error("SKIP_APPROVE");
        await approveNote(noteId, adminUserId, realYears);
        await editAfterApprove(noteId, adminUserId, realYears);
        break;
      case "07_reapproved":
        await saveDraft(noteId, adminUserId, "complete", realYears);
        if (options.skipApprove) throw new Error("SKIP_APPROVE");
        await approveNote(noteId, adminUserId, realYears);
        await editAfterApprove(noteId, adminUserId, realYears);
        await approveNote(noteId, adminUserId, realYears);
        break;
      case "08_published":
        await saveDraft(noteId, adminUserId, "complete", realYears);
        if (options.skipApprove) throw new Error("SKIP_APPROVE");
        await approveNote(noteId, adminUserId, realYears);
        await publishNote(noteId, adminUserId);
        break;
      case "09_invested":
        await saveDraft(noteId, adminUserId, "complete", realYears);
        if (options.skipApprove) throw new Error("SKIP_APPROVE");
        await approveNote(noteId, adminUserId, realYears);
        // Two publications: approve → edit → re-approve → publish → invest pins current.
        await editAfterApprove(noteId, adminUserId, realYears);
        await approveNote(noteId, adminUserId, realYears);
        await publishNote(noteId, adminUserId);
        await investNote(noteId, investorUserId);
        break;
      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const chromiumMissing =
      /libnspr4|shared libraries|browserType\.launch|Chromium runtime unavailable/i.test(
        message
      );
    const pdfOrStorage =
      chromiumMissing ||
      /S3|PDF|pdf|exactly 3 pages|HeadObject|PutObject/i.test(message);
    if (message === "SKIP_APPROVE" || pdfOrStorage) {
      const result = await verifyScenario(key);
      return {
        ...result,
        error:
          message === "SKIP_APPROVE"
            ? "Skipped approve/publish (SEED_PROSPECTUS_SKIP_APPROVE=1). Complete draft left for UI Approve."
            : chromiumMissing
              ? "Approve/PDF skipped: Playwright Chromium libs unavailable in this environment. Complete draft left — Approve via Admin UI or Docker API image."
              : message.split("\n")[0]!.slice(0, 200),
      };
    }
    throw error;
  }

  return verifyScenario(key);
}

function printTable(rows: ScenarioResult[]) {
  console.log(
    "\n| Scenario | Reference | Review | Pubs | Published | PDF | Listing | Invest |"
  );
  console.log("|---|---|---|---:|---|---|---|---:|");
  for (const row of rows) {
    console.log(
      `| ${row.key} | ${row.reference} | ${row.reviewStatus} | ${row.publications} | ${
        row.published ? "Yes" : "No"
      } | ${row.pdfReady ? "Yes" : "No"} | ${row.listing ? "Yes" : "No"} | ${
        row.investments
      }${row.error ? ` | ERR: ${row.error}` : ""} |`
    );
  }
  console.log("");
}

export async function seedProspectusLifecycle(): Promise<ScenarioResult[]> {
  assertNotProductionSeed();
  const skipApprove =
    process.env.SEED_PROSPECTUS_SKIP_APPROVE === "1" ||
    process.env.SEED_PROSPECTUS_SKIP_APPROVE === "true";

  const { adminUserId, issuerUserId, investorUserId } = await ensureSharedActors();
  const order = Object.keys(SCENARIOS) as ScenarioKey[];
  const results: ScenarioResult[] = [];

  for (const key of order) {
    process.stdout.write(`Seeding ${key}...\n`);
    const result = await runScenario(key, adminUserId, issuerUserId, investorUserId, {
      skipApprove,
    });
    results.push(result);
    if (result.error) {
      console.warn(`  ⚠ ${key}: ${result.error}`);
    } else {
      console.log(
        `  ✓ ${result.reference} review=${result.reviewStatus} pubs=${result.publications}`
      );
    }
  }

  printTable(results);
  console.log("Admin login email:", ADMIN_EMAIL);
  console.log("Investor login email:", INVESTOR_EMAIL);
  console.log(
    "Most useful manual UI note: SEED-PROSPECTUS-04-READY-APPROVE (complete draft, click Approve yourself)."
  );
  return results;
}

const isDirectRun =
  process.argv[1]?.includes("seed-prospectus-lifecycle") ||
  process.argv[1]?.includes("seed:prospectus-lifecycle");

if (isDirectRun) {
  seedProspectusLifecycle()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
