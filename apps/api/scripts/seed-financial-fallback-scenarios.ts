#!/usr/bin/env tsx
/**
 * Dev-only seed: Admin historical financial-year fallback scenarios (CTOS vs Issuer vs Admin Input).
 *
 * Purpose:
 * - Create deterministic persisted financial statement JSON shapes on `application.financial_statements`
 * - Create matching `ctosReport.financials_json` rows for CTOS precedence
 * - Create minimal Prospectus Review notes in DRAFT so Admin UI can open the workflow
 *
 * Notes:
 * - Admin fallback eligibility depends on the shared FY-window logic (runtime `new Date()`).
 *   This seed focuses on source ownership + persistence + resolver consistency for the stored FY data.
 *
 * Usage:
 *   pnpm --filter @cashsouk/api seed:financial-fallback-scenarios
 *
 * Blocked in production.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import {
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
  NoteStatus,
  ProspectusReviewStatus,
  OrganizationType,
  ProductStatus,
  UserRole,
} from "@prisma/client";
import { AdminRole } from "@cashsouk/types";
import { createId } from "@paralleldrive/cuid2";
import fs from "fs";
import path from "path";
import { catalogueVersion, emptyProspectusReviewContent } from "../src/modules/notes/prospectus-review/prospectus-review-content";
import { buildNoteIssuerSnapshot } from "../src/modules/notes/note-issuer-snapshot";
import { ensureAdminRoleCatalog } from "../src/lib/auth/rbac";
import { generateUniqueUserId } from "../src/lib/user-id-generator";
import { parseCtosReportXml } from "../src/modules/ctos/parser";
import {
  buildNormalizedFinancialStatementYearSet,
  getEligibleAdminInputYears,
  getFinancialYearPeriodEndIso,
  getStepKeyFromStepId,
  isNoteProspectusPublished,
} from "@cashsouk/types";

const prisma = new PrismaClient();

type AdminStatementType = "AUDITED" | "NOT_AUDITED" | "MANAGEMENT_ACCOUNTS";

const PREFIX = "seed_ff";

// Reuse documented local dev credential email from `seed:prospectus-demo`.
const ADMIN_EMAIL = "demo.prospectus.admin@cashsouk.local";
const ADMIN_SUB = "seed_demo_prospectus_admin_sub";
const ISSUER_BASE_EMAIL = `${PREFIX}.issuer`;

const DEFAULT_FYE_MONTH_DAY_ISO = "09-02";

/**
 * Dev-only product/workflow used by this seed so the applications behave like
 * real financing apps (document upload steps + prospectus/admin flows).
 */
const QA_PRODUCT_ID = `${PREFIX}_product`;
const QA_PRODUCT_CODE = "financial-fallback-qa";
const QA_PRODUCT_NAME = "Financial Fallback QA Product";
// Keep this version in a variable so app.product_version is not hardcoded.
const QA_PRODUCT_VERSION = 1;

const QA_FINANCING_TYPE_CATEGORY = "invoice_financing";
const QA_FINANCING_TYPE_NAME = "Account Receivable Financing";

const QA_CONTRACT_DETAILS = {
  approved_facility: 2_000_000,
  financing: 1_000_000,
  value: 1_000_000,
  description: "Seed contract for Financial Fallback QA",
};

const QA_CUSTOMER_DETAILS = {
  name: "Seed Customer Co.",
  country: "MY",
  entity_type: "Private Limited Company (Sdn Bhd)",
  ssm_number: "123456789012",
  is_related_party: false,
};

const QA_INVOICE_DETAILS = {
  value: 1_000_000,
};

const QA_OFFER_DETAILS = {
  offered_profit_rate_percent: 10,
  platform_fee_rate_percent: 1.5,
  risk_rating: "C",
};

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function isoDate(yyyy: number, mmdd = DEFAULT_FYE_MONTH_DAY_ISO): string {
  return `${yyyy}-${mmdd}`;
}

function plddForFyEndYear(fyEndYear: number): string {
  return isoDate(fyEndYear);
}

function computeTotals(params: {
  fixed_assets: number;
  other_assets: number;
  current_assets: number;
  non_current_assets: number;
  current_liabilities: number;
  long_term_liabilities: number;
  non_current_liabilities: number;
}) {
  const totass = params.fixed_assets + params.other_assets + params.current_assets + params.non_current_assets;
  const totlib =
    params.current_liabilities + params.long_term_liabilities + params.non_current_liabilities;
  const networth = totass - totlib;
  return { totass, totlib, networth };
}

function buildStoredFinancialBlock(input: {
  fyEndYear: number;
  statementType?: AdminStatementType;
  // Core
  bsfatot: number;
  othass: number;
  bscatot: number;
  bsclbank: number;
  curlib: number;
  bsslltd: number;
  bsclstd: number;
  bsqpuc: number;
  // ComRep equity lines (cashsouk raw keys; CTOS provides the corresponding ENQWS fields).
  equity_share_premium: number;
  equity_accumulated_profit: number;
  equity_minority: number;
  cashAndBank: number;
  tradeReceivables: number;
  tradePayables: number;
  turnover: number;
  grossProfit: number;
  ebitda: number;
  plnpbt: number;
  plnpat: number;
  plnetdiv: number;
  plyear: number;
  operatingCashFlow: number;
  freeCashFlow: number;
  // Extra issuer raw (optional for some computations but used by derived metrics)
  costOfSales: number;
  annualDebtService: number;
  netOperatingIncome: number;
  // ComRep (required-vs-optional semantics are handled by production validation; seed includes all to be safe)
  curlib_borrowing: number;
  curlib_non_borrowing: number;
  ncl_loan: number;
  ncl_non_loan: number;
  interest_cost: number;
  operating_cost: number;
  admin_cost: number;
  other_cost: number;
  pl_minority: number;
}): Record<string, unknown> {
  const { totass, totlib, networth } = computeTotals({
    fixed_assets: input.bsfatot,
    other_assets: input.othass,
    current_assets: input.bscatot,
    non_current_assets: input.bsclbank,
    current_liabilities: input.curlib,
    long_term_liabilities: input.bsslltd,
    non_current_liabilities: input.bsclstd,
  });

  const block: Record<string, unknown> = {
    pldd: plddForFyEndYear(input.fyEndYear),

    // Core balance-sheet money keys
    bsfatot: input.bsfatot,
    othass: input.othass,
    bscatot: input.bscatot,
    bsclbank: input.bsclbank,
    cashAndBank: input.cashAndBank,
    curlib: input.curlib,
    bsslltd: input.bsslltd,
    bsclstd: input.bsclstd,
    bsqpuc: input.bsqpuc,
    equity_share_premium: input.equity_share_premium,
    equity_accumulated_profit: input.equity_accumulated_profit,
    equity_minority: input.equity_minority,

    // Core derived totals used by some UI formulas and preview deltas
    totass,
    totlib,
    networth,

    // Core P&L money keys
    tradeReceivables: input.tradeReceivables,
    tradePayables: input.tradePayables,
    turnover: input.turnover,
    grossProfit: input.grossProfit,
    ebitda: input.ebitda,
    plnpbt: input.plnpbt,
    plnpat: input.plnpat,
    plnetdiv: input.plnetdiv,
    plyear: input.plyear,
    operatingCashFlow: input.operatingCashFlow,
    freeCashFlow: input.freeCashFlow,

    // Extra issuer raw keys
    costOfSales: input.costOfSales,
    annualDebtService: input.annualDebtService,
    netOperatingIncome: input.netOperatingIncome,

    // ComRep-required keys
    curlib_borrowing: input.curlib_borrowing,
    curlib_non_borrowing: input.curlib_non_borrowing,
    ncl_loan: input.ncl_loan,
    ncl_non_loan: input.ncl_non_loan,
    interest_cost: input.interest_cost,
    operating_cost: input.operating_cost,
    admin_cost: input.admin_cost,
    other_cost: input.other_cost,
    pl_minority: input.pl_minority,
  };

  if (input.statementType) {
    block.statementType = input.statementType;
  }

  return block;
}

function buildCtosAccount(input: {
  fyEndYear: number;
  base: Omit<Parameters<typeof buildStoredFinancialBlock>[0], "fyEndYear" | "statementType">;
}) {
  // Stage 4A converts CTOS `account` keys via `ctosFinancialRowToFsFields`.
  // Provide the same canonical fields that Stage 4A derivations consume.
  const stored = buildStoredFinancialBlock({ fyEndYear: input.fyEndYear, ...input.base });
  // CTOS parser adds `pldd` via `dates.pldd`, so keep `account` numeric keys only.
  const { pldd, ...account } = stored as Record<string, unknown> & { pldd: string };
  return account;
}

function buildCtosRow(fyEndYear: number, account: Record<string, unknown>) {
  return {
    financial_year: fyEndYear,
    dates: { pldd: plddForFyEndYear(fyEndYear), bsdd: null },
    account,
  };
}

type ScenarioKey =
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15";

type ScenarioSpec = {
  key: ScenarioKey;
  name: string;
  applicationStatus: ApplicationStatus;
  questionnaireFyeYear: number;
  ctosYears: number[];
  issuerYears: number[];
  adminInput?: Array<{
    year: number;
    statementType: AdminStatementType;
  }>;
  // Use different values for easy visual distinction.
  valueVariant: 1 | 2 | 3;
};

function scenarioSpecs(): ScenarioSpec[] {
  // FYs are calendar years. Seed uses consistent month/day for pldd: `${fy}-09-02`.
  // The shared FY-window eligibility is runtime-dependent; this seed focuses on source precedence and persistence.
  return [
    {
      key: "01",
      name: "SEED FS 01 - Full CTOS History",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2025,
      ctosYears: [2023, 2024, 2025],
      issuerYears: [2026],
      valueVariant: 1,
    },
    {
      key: "02",
      name: "SEED FS 02 - Missing FY2025",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2025,
      // Missing historical FY2025 for Admin fallback.
      ctosYears: [2023, 2024],
      issuerYears: [2026],
      valueVariant: 1,
    },
    {
      key: "03",
      name: "SEED FS 03 - Historical Gap",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2024,
      // Missing historical FY2024 for Admin fallback.
      ctosYears: [2023, 2025],
      issuerYears: [2026],
      valueVariant: 1,
    },
    {
      key: "04",
      name: "SEED FS 04 - No CTOS History",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2026,
      ctosYears: [],
      issuerYears: [2026],
      valueVariant: 1,
    },
    {
      key: "05",
      name: "SEED FS 05 - New Company",
      applicationStatus: ApplicationStatus.DRAFT,
      questionnaireFyeYear: 2026,
      ctosYears: [],
      issuerYears: [2026],
      valueVariant: 1,
    },
    {
      key: "06",
      name: "SEED FS 06 - Long CTOS History",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2025,
      ctosYears: [2019, 2020, 2021, 2022, 2023, 2024, 2025],
      issuerYears: [2026],
      valueVariant: 2,
    },
    {
      key: "07",
      name: "SEED FS 07 - Older Missing Gap",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2023,
      ctosYears: [2022, 2024, 2025],
      issuerYears: [2026],
      valueVariant: 2,
    },
    {
      key: "08",
      name: "SEED FS 08 - Draft With CTOS",
      applicationStatus: ApplicationStatus.DRAFT,
      questionnaireFyeYear: 2025,
      ctosYears: [2024, 2025],
      issuerYears: [2026],
      valueVariant: 2,
    },
    {
      key: "09",
      name: "SEED FS 09 - Locked Review",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2025,
      ctosYears: [2023, 2024],
      issuerYears: [2026],
      valueVariant: 2,
    },
    {
      key: "10",
      name: "SEED FS 10 - Existing Admin Input",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2025,
      ctosYears: [2023, 2024],
      issuerYears: [2026],
      adminInput: [{ year: 2025, statementType: "AUDITED" }],
      valueVariant: 3,
    },
    {
      key: "11",
      name: "SEED FS 11 - CTOS Supersedes Admin",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2025,
      ctosYears: [2023, 2024, 2025],
      issuerYears: [2026],
      adminInput: [{ year: 2025, statementType: "AUDITED" }],
      valueVariant: 3,
    },
    {
      key: "12",
      name: "SEED FS 12 - Issuer Supersedes Admin",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2025,
      ctosYears: [2023, 2024],
      issuerYears: [2025, 2026],
      adminInput: [{ year: 2025, statementType: "AUDITED" }],
      valueVariant: 3,
    },
    {
      key: "13",
      name: "SEED FS 13 - CTOS Partial Fields",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2025,
      ctosYears: [2023, 2024, 2025],
      issuerYears: [2026],
      valueVariant: 1,
    },
    {
      key: "14",
      name: "SEED FS 14 - Two Issuer FYs",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2027,
      ctosYears: [2023, 2024, 2025],
      issuerYears: [2025, 2026],
      valueVariant: 2,
    },
    {
      key: "15",
      name: "SEED FS 15 - One Issuer FY",
      applicationStatus: ApplicationStatus.COMPLETED,
      questionnaireFyeYear: 2026,
      ctosYears: [2023, 2024, 2025],
      issuerYears: [2026],
      valueVariant: 2,
    },
  ];
}

function valuesForYear(fy: number, variant: 1 | 2 | 3) {
  // Keep values realistic and consistent across tables.
  const base = fy === 2023 ? 1 : fy === 2024 ? 1.2 : fy === 2025 ? 1.3 : fy === 2026 ? 1.38 : 0.9;
  const vMul = variant === 1 ? 1 : variant === 2 ? 1.08 : 1.18;
  const turnover = Math.round(7_800_000 * base * vMul);
  const plnpat = Math.round(420_000 * base * vMul);
  const plnpbt = Math.round(plnpat * 1.25);
  const plyear = Math.round(220_000 * base * vMul);
  const plnetdiv = Math.round(65_000 * base * vMul);

  const bscatot = Math.round(2_400_000 * base * vMul);
  const bsfatot = Math.round(1_900_000 * base * vMul);
  const othass = Math.round(700_000 * base * vMul);
  const bsclbank = Math.round(600_000 * base * vMul);
  const curlib = Math.round(1_500_000 * base * vMul);
  const bsslltd = Math.round(900_000 * base * vMul);
  const bsclstd = Math.round(700_000 * base * vMul);
  const bsqpuc = Math.round(350_000 * base * vMul);

  const tradeReceivables = Math.round(1_050_000 * base * vMul);
  const tradePayables = Math.round(520_000 * base * vMul);
  const cashAndBank = Math.round(520_000 * base * vMul);

  const curlib_borrowing = Math.round(1_050_000 * base * vMul);
  const curlib_non_borrowing = Math.max(0, curlib - curlib_borrowing);
  const ncl_loan = Math.round(420_000 * base * vMul);
  const ncl_non_loan = Math.max(0, bsslltd + bsclstd - ncl_loan);

  const interest_cost = Math.round(180_000 * base * vMul);
  const ebitda = Math.round(plnpbt + interest_cost + 120_000 * base * vMul);

  const grossProfit = Math.round(2_100_000 * base * vMul);
  const costOfSales = Math.max(1, turnover - grossProfit);

  const operating_cost = Math.round(900_000 * base * vMul);
  const admin_cost = Math.round(280_000 * base * vMul);
  const other_cost = Math.round(120_000 * base * vMul);
  const netOperatingIncome = Math.round(1_000_000 * base * vMul);

  const annualDebtService = Math.round(310_000 * base * vMul);

  const operatingCashFlow = Math.round(1_400_000 * base * vMul);
  const freeCashFlow = Math.round(1_100_000 * base * vMul);

  const interest_cost_safe = Math.max(1, interest_cost);
  const pl_minority = Math.max(0, Math.round(50_000 * base * vMul));

  // ComRep equity lines shown/editable in issuer “Additional Financial Details”.
  // These do not drive the CTOS calculated metrics; they are used for raw display/provenance.
  const equity_share_premium = Math.round(900_000 * base * vMul);
  const equity_accumulated_profit = Math.round(1_300_000 * base * vMul);
  const equity_minority = Math.round(250_000 * base * vMul);

  const p: Parameters<typeof buildStoredFinancialBlock>[0] = {
    fyEndYear: fy,
    bsfatot,
    othass,
    bscatot,
    bsclbank,
    curlib,
    bsslltd,
    bsclstd,
    bsqpuc,
    equity_share_premium,
    equity_accumulated_profit,
    equity_minority,
    cashAndBank,
    tradeReceivables,
    tradePayables,
    turnover,
    grossProfit,
    ebitda,
    plnpbt,
    plnpat,
    plnetdiv,
    plyear,
    operatingCashFlow,
    freeCashFlow,
    costOfSales,
    annualDebtService,
    netOperatingIncome,
    curlib_borrowing,
    curlib_non_borrowing,
    ncl_loan,
    ncl_non_loan,
    interest_cost: interest_cost_safe,
    operating_cost,
    admin_cost,
    other_cost,
    pl_minority,
  };

  return p;
}

async function ensureUser(input: {
  email: string;
  cognitoSub: string;
  roles: UserRole[];
  firstName: string;
  lastName: string;
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
      investor_account: [],
      issuer_account: input.issuerOrgIds ?? [],
    },
  });
  return userId;
}

async function ensureAdmin(adminUserId: string) {
  await ensureAdminRoleCatalog(prisma);
  const role = await prisma.adminRoleConfig.findUnique({
    where: { key: AdminRole.SUPER_ADMIN },
  });
  if (!role) throw new Error("SUPER_ADMIN role catalog missing after ensureAdminRoleCatalog");

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
}

async function upsertIssuerOrg(params: {
  orgId: string;
  ownerUserId: string;
  name: string;
  registrationNumber?: string;
}) {
  await prisma.issuerOrganization.upsert({
    where: { id: params.orgId },
    update: {
      owner_user_id: params.ownerUserId,
      name: params.name,
      type: OrganizationType.COMPANY,
      registration_number:
        params.registrationNumber ?? `2026${params.orgId.slice(-8).padStart(8, "0")}`,
      country: "Malaysia",
      onboarding_status: "COMPLETED" as any,
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: {
        basicInfo: { industry: "Trading" },
        aboutYourBusiness: {
          whatDoesCompanyDo: "Wholesale trade and distribution for Malaysian retailers.",
          mainCustomers: "Large enterprises in oil & gas, mining, and infrastructure.",
          singleCustomerOver50Revenue: false,
        },
      } as Prisma.InputJsonValue,
    },
    create: {
      id: params.orgId,
      owner_user_id: params.ownerUserId,
      type: OrganizationType.COMPANY,
      name: params.name,
      registration_number:
        params.registrationNumber ?? `2026${params.orgId.slice(-8).padStart(8, "0")}`,
      country: "Malaysia",
      onboarding_status: "COMPLETED" as any,
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      corporate_onboarding_data: {
        basicInfo: { industry: "Trading" },
        aboutYourBusiness: {
          whatDoesCompanyDo: "Wholesale trade and distribution for Malaysian retailers.",
          mainCustomers: "Large enterprises in oil & gas, mining, and infrastructure.",
          singleCustomerOver50Revenue: false,
        },
      } as Prisma.InputJsonValue,
    },
  });
}

async function upsertFinancialFallbackQaProduct(): Promise<{
  productId: string;
  productVersion: number;
  workflow: unknown[];
}> {
  const product = await prisma.product.upsert({
    where: { id: QA_PRODUCT_ID },
    update: {
      status: ProductStatus.ACTIVE,
      product_code: QA_PRODUCT_CODE,
      version: QA_PRODUCT_VERSION,
      service_fee_rate_percent: money(15),
      marketplace_listing_duration_days: 14,
      workflow: [
        {
          id: "financing_type_1",
          name: "Financing Type",
          config: {
            name: QA_FINANCING_TYPE_NAME,
            category: QA_FINANCING_TYPE_CATEGORY,
            product_name: QA_FINANCING_TYPE_NAME,
          },
        },
        { id: "financing_structure_1", name: "Financing Structure", config: { name: "Financing Structure" } },
        { id: "contract_details_1", name: "Facility Details", config: { name: "Facility Details" } },
        { id: "invoice_details_1", name: "Invoice Details", config: { name: "Invoice Details" } },
        { id: "financial_statements_1", name: "Financial Statements", config: { name: "Financial Statements" } },
        {
          id: "supporting_documents_1",
          name: "Supporting Documents",
          config: { name: "Supporting Documents" },
        },
        { id: "declarations_1", name: "Declarations", config: { name: "Declarations" } },
        { id: "review_and_submit_1", name: "Review & Submit", config: { name: "Review & Submit" } },
      ],
    },
    create: {
      id: QA_PRODUCT_ID,
      product_code: QA_PRODUCT_CODE,
      base_id: null,
      status: ProductStatus.ACTIVE,
      version: QA_PRODUCT_VERSION,
      service_fee_rate_percent: money(15),
      marketplace_listing_duration_days: 14,
      workflow: [
        {
          id: "financing_type_1",
          name: "Financing Type",
          config: {
            name: QA_FINANCING_TYPE_NAME,
            category: QA_FINANCING_TYPE_CATEGORY,
            product_name: QA_FINANCING_TYPE_NAME,
          },
        },
        { id: "financing_structure_1", name: "Financing Structure", config: { name: "Financing Structure" } },
        { id: "contract_details_1", name: "Facility Details", config: { name: "Facility Details" } },
        { id: "invoice_details_1", name: "Invoice Details", config: { name: "Invoice Details" } },
        { id: "financial_statements_1", name: "Financial Statements", config: { name: "Financial Statements" } },
        {
          id: "supporting_documents_1",
          name: "Supporting Documents",
          config: { name: "Supporting Documents" },
        },
        { id: "declarations_1", name: "Declarations", config: { name: "Declarations" } },
        { id: "review_and_submit_1", name: "Review & Submit", config: { name: "Review & Submit" } },
      ],
    },
  });

  return {
    productId: product.id,
    productVersion: product.version,
    workflow: (product.workflow as unknown[]) ?? [],
  };
}

async function upsertQaContractAndInvoice(params: {
  contractId: string;
  invoiceId: string;
  issuerOrgId: string;
  applicationId: string;
  maturityIso: string;
  now: Date;
}): Promise<{
  contractSnapshot: Prisma.InputJsonValue;
  invoiceSnapshot: Prisma.InputJsonValue;
}> {
  const startIso = isoDateOnly(addDays(params.now, -90));
  const endIso = isoDateOnly(addDays(params.now, 180));
  const contractDetails = {
    title: "Supply Agreement",
    description: "Seed contract for Financial Fallback QA",
    number: `CON-FFQA-${params.issuerOrgId.slice(-6)}`,
    value: QA_CONTRACT_DETAILS.value,
    start_date: startIso,
    end_date: endIso,
    approved_facility: QA_CONTRACT_DETAILS.approved_facility,
    financing: QA_CONTRACT_DETAILS.financing,
  };

  await prisma.contract.upsert({
    where: { id: params.contractId },
    update: {
      issuer_organization_id: params.issuerOrgId,
      status: ContractStatus.APPROVED,
      contract_details: contractDetails as Prisma.InputJsonValue,
      customer_details: QA_CUSTOMER_DETAILS as Prisma.InputJsonValue,
    },
    create: {
      id: params.contractId,
      issuer_organization_id: params.issuerOrgId,
      status: ContractStatus.APPROVED,
      contract_details: contractDetails as Prisma.InputJsonValue,
      customer_details: QA_CUSTOMER_DETAILS as Prisma.InputJsonValue,
    },
  });

  const invoiceDetails = {
    value: QA_INVOICE_DETAILS.value,
    maturity_date: params.maturityIso,
  };
  const offerDetails = {
    ...QA_OFFER_DETAILS,
    offered_profit_rate_percent: QA_OFFER_DETAILS.offered_profit_rate_percent,
  };

  await prisma.invoice.upsert({
    where: { id: params.invoiceId },
    update: {
      application_id: params.applicationId,
      contract_id: params.contractId,
      status: InvoiceStatus.APPROVED,
      details: invoiceDetails as Prisma.InputJsonValue,
      offer_details: offerDetails as Prisma.InputJsonValue,
    },
    create: {
      id: params.invoiceId,
      application_id: params.applicationId,
      contract_id: params.contractId,
      status: InvoiceStatus.APPROVED,
      details: invoiceDetails as Prisma.InputJsonValue,
      offer_details: offerDetails as Prisma.InputJsonValue,
    },
  });

  return {
    contractSnapshot: {
      id: params.contractId,
      status: ContractStatus.APPROVED,
      contract_details: contractDetails,
      customer_details: QA_CUSTOMER_DETAILS,
    } as Prisma.InputJsonValue,
    invoiceSnapshot: {
      id: params.invoiceId,
      status: InvoiceStatus.APPROVED,
      details: invoiceDetails,
      offer_details: offerDetails,
    } as Prisma.InputJsonValue,
  };
}

async function upsertApplicationWithFinancials(params: {
  applicationId: string;
  issuerOrgId: string;
  status: ApplicationStatus;
  productId: string;
  productVersion: number;
  contractId: string;
  questionnaireFyeYear: number;
  ctosYears: number[];
  issuerYears: number[];
  adminInput?: Array<{ year: number; statementType: AdminStatementType }>;
  actorUserId: string;
  valueVariant: 1 | 2 | 3;
}) {
  const financialStatements: Prisma.InputJsonValue = (() => {
    const questionnaire = { financial_year_end: isoDate(params.questionnaireFyeYear) };

    const unaudited_by_year: Record<string, Record<string, unknown>> = {};
    for (const year of params.issuerYears) {
      const v = valuesForYear(year, params.valueVariant);
      unaudited_by_year[String(year)] = buildStoredFinancialBlock({ ...v, fyEndYear: year });
    }

    const admin_input_by_year: Record<string, Record<string, unknown>> = {};
    for (const ai of params.adminInput ?? []) {
      const v = valuesForYear(ai.year, params.valueVariant);
      const block = buildStoredFinancialBlock({
        ...v,
        fyEndYear: ai.year,
        statementType: ai.statementType,
      });
      admin_input_by_year[String(ai.year)] = {
        ...block,
        updated_by_user_id: params.actorUserId,
        updated_at: new Date().toISOString(),
      };
    }

    return {
      questionnaire,
      unaudited_by_year,
      admin_input_by_year,
    } as Prisma.InputJsonValue;
  })();

  await prisma.application.upsert({
    where: { id: params.applicationId },
    update: {
      issuer_organization_id: params.issuerOrgId,
      status: params.status,
      product_version: params.productVersion,
      financing_type: { product_id: params.productId } as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: "existing_contract",
        existing_contract_id: params.contractId,
      } as Prisma.InputJsonValue,
      contract_id: params.contractId,
      financial_statements: financialStatements,
      supporting_documents: { categories: [] } as Prisma.InputJsonValue,
      declarations: { items: [] } as Prisma.InputJsonValue,
      review_and_submit: {} as Prisma.InputJsonValue,
      last_completed_step: params.status === ApplicationStatus.DRAFT ? 0 : 9,
    },
    create: {
      id: params.applicationId,
      issuer_organization_id: params.issuerOrgId,
      product_version: params.productVersion,
      status: params.status,
      last_completed_step: params.status === ApplicationStatus.DRAFT ? 0 : 9,
      financing_type: { product_id: params.productId } as Prisma.InputJsonValue,
      financing_structure: {
        structure_type: "existing_contract",
        existing_contract_id: params.contractId,
      } as Prisma.InputJsonValue,
      contract_id: params.contractId,
      review_and_submit: {} as Prisma.InputJsonValue,
      financial_statements: financialStatements,
      supporting_documents: { categories: [] } as Prisma.InputJsonValue,
      declarations: { items: [] } as Prisma.InputJsonValue,
      display_reference: `${PREFIX}-${params.applicationId}`,
    },
  });
}

async function upsertCtosReport(params: {
  ctosReportId: string;
  issuerOrgId: string;
  fyYears: number[];
  actorNow: Date;
  valueVariant: 1 | 2 | 3;
  partialForFy?: number; // Simulate partial CTOS rows (omit some non-critical fields)
  ctosFixtureRowsByFy?: Record<number, unknown>;
}) {
  const rows = params.fyYears.map((fy) => {
    const fixtureRow = params.ctosFixtureRowsByFy?.[fy];
    if (fixtureRow) return fixtureRow as any;

    const v = valuesForYear(fy, params.valueVariant);
    const base = { ...v } as any;
    if (params.partialForFy === fy) {
      // Remove some optional fields while keeping required ones present.
      delete base.cashAndBank;
      delete base.tradePayables;
      delete base.costOfSales;
    }

    const account = buildCtosAccount({
      fyEndYear: fy,
      base: base,
    });

    return buildCtosRow(fy, account);
  });

  await prisma.ctosReport.upsert({
    where: { id: params.ctosReportId },
    update: {
      issuer_organization_id: params.issuerOrgId,
      investor_organization_id: null,
      subject_ref: null,
      fetched_at: params.actorNow,
      financials_json: rows as Prisma.InputJsonValue,
      summary_json: {} as Prisma.InputJsonValue,
      legal_json: {} as Prisma.InputJsonValue,
      ccris_json: {} as Prisma.InputJsonValue,
      company_json: {} as Prisma.InputJsonValue,
      raw_xml: "<demo/>",
      report_html: null,
    },
    create: {
      id: params.ctosReportId,
      issuer_organization_id: params.issuerOrgId,
      investor_organization_id: null,
      subject_ref: null,
      fetched_at: params.actorNow,
      financials_json: rows as Prisma.InputJsonValue,
      summary_json: {} as Prisma.InputJsonValue,
      legal_json: {} as Prisma.InputJsonValue,
      ccris_json: {} as Prisma.InputJsonValue,
      company_json: {} as Prisma.InputJsonValue,
      raw_xml: "<demo/>",
      report_html: null,
    },
  });
}

async function upsertProspectusReviewNote(params: {
  noteId: string;
  noteReference: string;
  applicationId: string;
  issuerOrgId: string;
  issuerOrgName: string;
  issuerRegistrationNumber: string;
  productId: string;
  productName: string;
  productCategory: string;
  contractId: string;
  invoiceId: string;
  contractSnapshot: Prisma.InputJsonValue;
  invoiceSnapshot: Prisma.InputJsonValue;
  actorUserId: string;
  locked?: boolean;
  reviewStatusOverride?: ProspectusReviewStatus;
}) {
  const noteTitle = `Prospectus Review - ${params.issuerOrgName}`;

  const maturityDateOnly = (params.invoiceSnapshot as any)?.details?.maturity_date as
    | string
    | undefined
    | null;
  const maturityDate =
    typeof maturityDateOnly === "string" && /^\d{4}-\d{2}-\d{2}$/.test(maturityDateOnly)
      ? new Date(`${maturityDateOnly}T00:00:00.000Z`)
      : null;

  const issuerSnapshot = buildNoteIssuerSnapshot({
    organization: {
      id: params.issuerOrgId,
      name: params.issuerOrgName,
      type: OrganizationType.COMPANY,
      registration_number: params.issuerRegistrationNumber,
      country: "Malaysia",
      country_of_incorporation: "Malaysia",
      corporate_onboarding_data: {
        basicInfo: { industry: "Trading" },
        aboutYourBusiness: {
          whatDoesCompanyDo: "Wholesale trade and distribution for Malaysian retailers.",
          mainCustomers: "Large enterprises in oil & gas, mining, and infrastructure.",
        },
      } as Prisma.InputJsonValue,
    },
    businessDetails: null,
  });

  // Minimal Note fields. The Admin financial comparison tables are driven from live
  // application + CTOS, so we keep snapshots nullable/minimal.
  const noteData: any = {
    id: params.noteId,
    source_application_id: params.applicationId,
    source_contract_id: params.contractId,
    source_invoice_id: params.invoiceId,
    issuer_organization_id: params.issuerOrgId,
    status: params.locked ? NoteStatus.PUBLISHED : NoteStatus.DRAFT,
    listing_status: "NOT_LISTED" as any,
    funding_status: "NOT_OPEN" as any,
    servicing_status: "NOT_STARTED" as any,
    title: noteTitle,
    note_reference: params.noteReference,
    requested_amount: money(100_000),
    target_amount: money(100_000),
    funded_amount: money(0),
    profit_rate_percent: money(10),
    platform_fee_rate_percent: money(1.5),
    service_fee_rate_percent: money(15),
    arrears_threshold_days: 14,
    paymaster_id: null,
    paymaster_snapshot: {
      name: QA_CUSTOMER_DETAILS.name,
      country: QA_CUSTOMER_DETAILS.country,
      entity_type: QA_CUSTOMER_DETAILS.entity_type,
    } as Prisma.InputJsonValue,
    issuer_snapshot: issuerSnapshot as unknown as Prisma.InputJsonValue,
    prospectus_snapshot: null,
    published_at: params.locked ? new Date() : null,
    maturity_date: maturityDate,
    contract_snapshot: params.contractSnapshot,
    invoice_snapshot: params.invoiceSnapshot,
    product_snapshot: {
      product_id: params.productId,
      product_name: params.productName,
      category: params.productCategory,
      name: params.productName,
    } as Prisma.InputJsonValue,
    purpose_snapshot: {
      financing_for: "Working capital financing",
    } as Prisma.InputJsonValue,
  };

  await prisma.note.upsert({
    where: { id: params.noteId },
    update: noteData as any,
    create: noteData,
  });

  await prisma.noteProspectusReview.upsert({
    where: { note_id: params.noteId },
    update: {
      status:
        params.reviewStatusOverride ??
        (params.locked ? ProspectusReviewStatus.PUBLISHED : ProspectusReviewStatus.DRAFT),
      option_catalogue_version: catalogueVersion(),
      draft_content: emptyProspectusReviewContent() as unknown as Prisma.InputJsonValue,
      updated_by_user_id: params.actorUserId,
    },
    create: {
      note_id: params.noteId,
      status:
        params.reviewStatusOverride ??
        (params.locked ? ProspectusReviewStatus.PUBLISHED : ProspectusReviewStatus.DRAFT),
      option_catalogue_version: catalogueVersion(),
      draft_content: emptyProspectusReviewContent() as unknown as Prisma.InputJsonValue,
      content_version: 1,
      created_by_user_id: params.actorUserId,
      updated_by_user_id: params.actorUserId,
    },
  });
}

async function ensureAdminAndIssuerUsers(params: { issuerOrgNames: string[] }) {
  await prisma.$transaction(async (tx) => {
    // no-op: keep Prisma client warm
    void tx;
  });

  const adminUserId = await ensureAdminUser();

  const issuerUserEmail = `${ISSUER_BASE_EMAIL}@seed.local`;
  const issuerUserId = await ensureUser({
    email: issuerUserEmail,
    cognitoSub: `${PREFIX}_issuer_sub`,
    roles: [UserRole.ISSUER],
    firstName: "Seed",
    lastName: "Issuer",
    issuerOrgIds: [],
  });

  const issuerOrgIds: string[] = params.issuerOrgNames.map((_n, idx) => `${PREFIX}_issuer_org_${idx + 1}`);
  // Attach later after orgs are created.
  return { adminUserId, issuerUserId, issuerOrgIds };

  async function ensureAdminUser() {
    const adminId = await ensureUser({
      email: ADMIN_EMAIL,
      cognitoSub: ADMIN_SUB,
      roles: [UserRole.ADMIN],
      firstName: "Financial",
      lastName: "Fallback Admin",
      issuerOrgIds: [],
    });
    await ensureAdmin(adminId);
    return adminId;
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:financial-fallback-scenarios is blocked in production");
  }

  const qaProduct = await upsertFinancialFallbackQaProduct();
  console.log(`\n=== SEED PRODUCT: ${QA_PRODUCT_NAME} ===`);
  console.log(`Product ID: ${qaProduct.productId}`);
  console.log(`Product version: ${qaProduct.productVersion}`);
  const hasFinancialStatementsStep = qaProduct.workflow.some(
    (s: any) => getStepKeyFromStepId(String(s?.id ?? "")) === "financial_statements"
  );
  console.log(`Financial Statements step in workflow: ${hasFinancialStatementsStep ? "YES" : "NO"}`);

  const scenarios = scenarioSpecs();

  // Use the real CTOS fixture XML so CTOS-backed years are shaped exactly like the live parser expects.
  // This is critical for finished metric fields like `return_on_equity` and the ComRep raw mappings
  // (bsqres/bsqupro/bsqmint/plminin -> equity_share_premium/equity_accumulated_profit/equity_minority/pl_minority).
  const fixtureXmlPath = path.join(
    __dirname,
    "../ctos-test/output/2026-09-07T05-14-25-245Z_company_200501525124.xml"
  );
  const fixtureXml = fs.readFileSync(fixtureXmlPath, "utf8");
  const fixtureParsed = await parseCtosReportXml(fixtureXml);
  const fixtureRowsByFy: Record<number, unknown> = Object.fromEntries(
    (fixtureParsed.financials_json ?? [])
      .filter((r) => r?.financial_year != null && Number.isFinite(r.financial_year))
      .map((r) => [r.financial_year as number, r])
  );
  const fixtureCompany = fixtureParsed.company_json;
  const fixtureCompanyName = fixtureCompany?.name ?? null;
  const fixtureRegistrationNumber = fixtureCompany?.ic_lcno ?? fixtureCompany?.brn_ssm ?? null;
  if (!fixtureCompanyName || !fixtureRegistrationNumber) {
    throw new Error("CTOS fixture company identity is missing (name and/or registration number)");
  }

  const actorUserId = await (async () => {
    const adminUserId = await ensureUser({
      email: ADMIN_EMAIL,
      cognitoSub: ADMIN_SUB,
      roles: [UserRole.ADMIN],
      firstName: "Financial",
      lastName: "Fallback Admin",
      issuerOrgIds: [],
    });
    await ensureAdmin(adminUserId);
    return adminUserId;
  })();

  const issuerUserId = await ensureUser({
    email: `${ISSUER_BASE_EMAIL}@seed.local`,
    cognitoSub: `${PREFIX}_issuer_sub`,
    roles: [UserRole.ISSUER],
    firstName: "Seed",
    lastName: "Issuer",
    issuerOrgIds: [],
  });

  const scenarioIds = new Map<
    string,
    {
      issuerOrgId: string;
      applicationId: string;
      noteId: string;
      ctosReportId: string;
      contractId: string;
      invoiceId: string;
    }
  >();
  for (const s of scenarios) {
    scenarioIds.set(s.key, {
      issuerOrgId: createId(),
      applicationId: createId(),
      noteId: createId(),
      ctosReportId: createId(),
      contractId: createId(),
      invoiceId: createId(),
    });
  }

  const issuerOrgIds = scenarios.map((s) => scenarioIds.get(s.key)!.issuerOrgId);
  await prisma.user.update({
    where: { user_id: issuerUserId },
    data: {
      issuer_account: { set: issuerOrgIds },
    },
  });

  const now = new Date();

  for (const s of scenarios) {
    const ids = scenarioIds.get(s.key)!;
    const issuerOrgId = ids.issuerOrgId;
    const applicationId = ids.applicationId;
    const noteId = ids.noteId;
    const noteReference = `${s.name.replace(/\s+/g, "-").toUpperCase().slice(0, 40)}-${s.key}`;
    const ctosReportId = ids.ctosReportId;
    const contractId = ids.contractId;
    const invoiceId = ids.invoiceId;
    const maturityIso = isoDateOnly(addDays(now, 120));

    const isFixtureScenario = s.key === "02";
    const issuerOrgName = isFixtureScenario ? fixtureCompanyName : s.name;
    const issuerRegistrationNumber = isFixtureScenario
      ? fixtureRegistrationNumber
      : `2026-${issuerOrgId.slice(-6)}`;

    await upsertIssuerOrg({
      orgId: issuerOrgId,
      ownerUserId: issuerUserId,
      name: issuerOrgName,
      registrationNumber: isFixtureScenario ? fixtureRegistrationNumber : undefined,
    });

    const { contractSnapshot, invoiceSnapshot } = await upsertQaContractAndInvoice({
      contractId,
      invoiceId,
      issuerOrgId,
      applicationId,
      maturityIso,
      now,
    });

    await upsertApplicationWithFinancials({
      applicationId,
      issuerOrgId,
      status: s.applicationStatus,
      productId: qaProduct.productId,
      productVersion: qaProduct.productVersion,
      contractId,
      questionnaireFyeYear: s.questionnaireFyeYear,
      ctosYears: s.ctosYears,
      issuerYears: s.issuerYears,
      adminInput: s.adminInput,
      actorUserId,
      valueVariant: s.valueVariant,
    });

    const partialForFy = s.key === "13" ? 2025 : undefined;
    await upsertCtosReport({
      ctosReportId,
      issuerOrgId,
      fyYears: s.ctosYears,
      actorNow: now,
      valueVariant: s.valueVariant,
      partialForFy,
      ctosFixtureRowsByFy: s.key === "02" ? fixtureRowsByFy : undefined,
    });

    await upsertProspectusReviewNote({
      noteId,
      noteReference,
      applicationId,
      issuerOrgId,
      issuerOrgName,
      issuerRegistrationNumber,
      productId: qaProduct.productId,
      productName: QA_PRODUCT_NAME,
      productCategory: QA_FINANCING_TYPE_CATEGORY,
      contractId,
      invoiceId,
      contractSnapshot,
      invoiceSnapshot,
      actorUserId,
      locked: false,
      reviewStatusOverride: s.key === "09" ? ProspectusReviewStatus.APPROVED : undefined,
    });

    // QA summary: use the same resolver helpers production uses for Stage 4A year resolution + eligibility.
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        financial_statements: true,
        issuer_organization_id: true,
        product_version: true,
        financing_type: true,
        financing_structure: true,
        contract_id: true,
      },
    });
    const ctos = await prisma.ctosReport.findUnique({
      where: { id: ctosReportId },
      select: { financials_json: true },
    });
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, status: true, published_at: true },
    });

    if (!app || !ctos || !note) throw new Error(`QA summary: missing DB rows for seed ${s.key}`);

    const questionnaire = ((app.financial_statements as any)?.questionnaire ?? null) as any;
    const financialYearEndIso = questionnaire?.financial_year_end ?? null;

    // Audit CTOS FY realism (period end should not be in the future unless intentionally malformed).
    if (Array.isArray(ctos.financials_json)) {
      for (const row of ctos.financials_json as any[]) {
        const fy = row?.financial_year;
        if (!Number.isFinite(fy)) continue;
        const periodEndIso = getFinancialYearPeriodEndIso(questionnaire, fy);
        if (typeof periodEndIso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(periodEndIso)) continue;
        const nowIso = now.toISOString().slice(0, 10);
        if (periodEndIso > nowIso) {
          // eslint-disable-next-line no-console
          console.warn(
            `[seed QA warning] ${s.name}: CTOS FY${fy} periodEnd=${periodEndIso} is after runtime today=${nowIso} (check scenario intent).`
          );
        }
      }
    }

    const resolved = buildNormalizedFinancialStatementYearSet({
      financialStatements: app.financial_statements,
      ctosFinancials: ctos.financials_json,
      ref: now,
    });
    const eligibleAdmin = getEligibleAdminInputYears({
      financialStatements: app.financial_statements,
      ctosFinancials: ctos.financials_json,
      ref: now,
    });

    const issuerFYs = Object.keys(((app.financial_statements as any)?.unaudited_by_year ?? {}) as any);
    const adminFYs = Object.keys(((app.financial_statements as any)?.admin_input_by_year ?? {}) as any);
    const ctosPersistedYears = Array.isArray(ctos.financials_json)
      ? Array.from(
          new Set((ctos.financials_json as any[]).map((r) => r?.financial_year).filter((y) => Number.isFinite(y)))
        ).sort((a, b) => a - b)
      : [];

    const resolvedSummary = resolved
      .map((r) => `${r.year} -> ${r.recordSource}${r.statementType ? ` (${r.statementType})` : ""}`)
      .join(", ");

    const eligibleSorted = [...eligibleAdmin].sort((a, b) => a - b);
    const locked = isNoteProspectusPublished({
      status: note.status,
      publishedAt: note.published_at,
    });

    // eslint-disable-next-line no-console
    console.log(`\n=== SEED QA: ${s.name} ===`);
    // eslint-disable-next-line no-console
    console.log(`Application: ${app.id}`);
    // eslint-disable-next-line no-console
    console.log(`Company/Issuer: ${s.name}`);
    // eslint-disable-next-line no-console
    console.log(`Application status: ${app.status}`);
    // eslint-disable-next-line no-console
    console.log(`financial_year_end: ${financialYearEndIso}`);
    // eslint-disable-next-line no-console
    console.log(
      `financing_type: ${
        (app.financing_type as any)?.product_id ?? "(null/unknown)"
      }, product_version: ${app.product_version ?? "(null)"}`
    );
    // eslint-disable-next-line no-console
    console.log(`contract_id: ${app.contract_id ?? "(null)"}`);
    // eslint-disable-next-line no-console
    console.log(`CTOS FYs persisted: ${ctosPersistedYears.join(", ") || "(none)"}`);
    // eslint-disable-next-line no-console
    console.log(`Issuer FYs persisted: ${issuerFYs.sort().join(", ") || "(none)"}`);
    // eslint-disable-next-line no-console
    console.log(`Admin FYs persisted: ${adminFYs.sort().join(", ") || "(none)"}`);
    // eslint-disable-next-line no-console
    console.log(`Resolved FYs + recordSource: ${resolvedSummary || "(none)"}`);
    // eslint-disable-next-line no-console
    console.log(`Eligible Admin fallback FYs (getEligibleAdminInputYears): ${eligibleSorted.join(", ") || "(none)"}`);
    // eslint-disable-next-line no-console
    console.log(`Expected UI '+ Add Financial Statement' FYs: ${eligibleSorted.join(", ") || "(none)"}`);
    // eslint-disable-next-line no-console
    console.log(`Prospectus review editable: ${locked ? "NO (locked/published)" : "YES (unpublished)"}`);
  }

  // eslint-disable-next-line no-console
  console.log(`Seed complete: ${scenarios.length} financial fallback scenarios created.`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

