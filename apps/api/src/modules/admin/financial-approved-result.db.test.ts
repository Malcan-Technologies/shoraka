/**
 * SECTION: Financial approval stores the approved Financial Review result (local DB)
 * WHY: Status APPROVED and the result are one row write; the stored JSON must equal the returned
 * value exactly; every path that reopens Financial clears it; an Admin financial edit cannot land
 * once approval has built its result.
 *
 * Each run seeds its own issuer org, CTOS report, MARC assessment and application under a unique
 * `dbtest_fin_approved_` prefix and deletes exactly those rows in afterAll.
 */

// CTOS provider and people-list boundaries for the CTOS auto-reset path only. Every other
// module (Prisma, review services, resolvers) is real.
const mockPeopleList = jest.fn((): unknown[] => []);
jest.mock("../ctos/config", () => ({
  getCtosConfig: () => ({ companyCode: "c", accountNo: "a", userId: "u" }),
}));
jest.mock("../ctos/client", () => ({ callCtosSoap: jest.fn(async () => "<dbtest/>") }));
jest.mock("../ctos/parser", () => ({
  parseCtosReportXml: jest.fn(async () => ({
    raw_xml: "<dbtest/>",
    summary_json: {},
    company_json: null,
    person_json: null,
    legal_json: {},
    ccris_json: {},
    financials_json: [],
  })),
}));
jest.mock("../ctos/render-html", () => ({ renderCtosReportHtml: () => null }));
jest.mock("../organization-profile/service", () => ({
  ...jest.requireActual("../organization-profile/service"),
  observeExternalCtosParties: jest.fn(async () => undefined),
}));
jest.mock("../notification/director-shareholder-notifications", () => ({
  ...jest.requireActual("../notification/director-shareholder-notifications"),
  runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert: jest.fn(async () => undefined),
  runInvestorDirectorShareholderNotificationsAfterOrgCtosReportInsert: jest.fn(async () => undefined),
  shouldNotifyDirectorShareholderAfterAdminOrgCtosInsert: jest.fn(() => false),
}));
jest.mock("./build-people-list", () => ({
  ...jest.requireActual("./build-people-list"),
  buildAdminPeopleList: (...args: unknown[]) => mockPeopleList(...(args as [])),
}));

import { randomBytes } from "node:crypto";
import {
  ApplicationStatus,
  OrganizationType,
  Prisma,
  ReviewStepStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { fetchAndInsertCtosReport } from "../ctos/ctos-report-service";
import { ApplicationService } from "../applications/service";
import { AdminRepository } from "./repository";
import { AdminService } from "./service";
import {
  approveFinancialReviewWithResult,
  loadCurrentApprovedFinancialResult,
} from "./financial-approved-result";

jest.setTimeout(60_000);

const SUBMITTED_AT = new Date("2026-09-25T00:00:00.000Z");

/** 120 ÷ 530 × 100 = 22.641509433962266 before canonicalisation. */
const USER_BLOCK_2026 = {
  pldd: "2026-12-31",
  bsfatot: 100,
  othass: 50,
  bscatot: 400,
  bsclbank: 250,
  curlib: 300,
  bsslltd: 150,
  bsclstd: 50,
  turnover: 530,
  plnpbt: 150,
  plnpat: 120,
};

const FINANCIAL_STATEMENTS = {
  questionnaire: { financial_year_end: "2026-12-31" },
  unaudited_by_year: { "2026": USER_BLOCK_2026 },
  admin_input_by_year: {},
  admin_field_overrides: {},
};

const CTOS_FINANCIALS = [
  {
    financial_year: 2024,
    dates: { pldd: "2024-12-31", bsdd: null },
    account: { totass: 1000, totlib: 400, networth: 600, turnover: 700, plnpat: 77, plnpbt: 90 },
  },
  {
    financial_year: 2025,
    dates: { pldd: "2025-12-31", bsdd: null },
    account: { totass: 1100, totlib: 450, networth: 650, turnover: 710, plnpat: 71, plnpbt: 91 },
  },
];

type Graph = {
  applicationId: string;
  organizationId: string;
  ctosReportId: string;
};

const graphs: Graph[] = [];
let adminUserId: string;
const repository = new AdminRepository();
const applicationService = new ApplicationService();
const adminService = new AdminService();

async function seedGraph(label: string): Promise<Graph> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Financial approval DB test is blocked in production");
  }
  const prefix = `dbtest_fin_approved_${label}_${randomBytes(6).toString("hex")}`;
  const graph: Graph = {
    applicationId: `${prefix}_app`,
    organizationId: `${prefix}_org`,
    ctosReportId: `${prefix}_ctos`,
  };
  graphs.push(graph);
  await prisma.issuerOrganization.create({
    data: {
      id: graph.organizationId,
      owner_user_id: adminUserId,
      type: OrganizationType.COMPANY,
      name: "DB Test Financial Approval Sdn Bhd",
      registration_number: "202699990042",
      country: "Malaysia",
      onboarding_status: "COMPLETED",
      onboarded_at: SUBMITTED_AT,
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
    },
  });
  await prisma.issuerOrganizationMarcAssessment.create({
    data: {
      issuer_organization_id: graph.organizationId,
      credit_grade: "SME-3",
      credit_score: new Prisma.Decimal("72.50"),
      probability_of_default: new Prisma.Decimal("1.1300"),
      report_file_name: "dbtest-marc-report.pdf",
      report_s3_key: `marc-reports/${graph.organizationId}/dbtest.pdf`,
      report_date: SUBMITTED_AT,
      created_by_user_id: adminUserId,
    },
  });
  // Application-owned CTOS: fetched before first submission.
  await prisma.ctosReport.create({
    data: {
      id: graph.ctosReportId,
      issuer_organization_id: graph.organizationId,
      subject_ref: null,
      fetched_at: new Date(SUBMITTED_AT.getTime() - 60_000),
      financials_json: CTOS_FINANCIALS as unknown as Prisma.InputJsonValue,
      summary_json: {},
      legal_json: {},
      ccris_json: {},
      company_json: {},
      raw_xml: "<dbtest/>",
    },
  });
  await prisma.application.create({
    data: {
      id: graph.applicationId,
      issuer_organization_id: graph.organizationId,
      product_version: 1,
      status: ApplicationStatus.UNDER_REVIEW,
      last_completed_step: 9,
      submitted_at: SUBMITTED_AT,
      financial_statements: FINANCIAL_STATEMENTS as unknown as Prisma.InputJsonValue,
    },
  });
  return graph;
}

async function cleanupGraph(graph: Graph): Promise<void> {
  // Application logs have no FK to the application; reviews and remarks cascade.
  await prisma.applicationLog.deleteMany({ where: { application_id: graph.applicationId } });
  await prisma.application.deleteMany({ where: { id: graph.applicationId } });
  await prisma.ctosReport.deleteMany({ where: { issuer_organization_id: graph.organizationId } });
  await prisma.issuerOrganizationFinancialStatement.deleteMany({
    where: { issuer_organization_id: graph.organizationId },
  });
  await prisma.issuerOrganizationMarcAssessment.deleteMany({
    where: { issuer_organization_id: graph.organizationId },
  });
  await prisma.issuerOrganization.deleteMany({ where: { id: graph.organizationId } });
}

function approve(graph: Graph) {
  return prisma.$transaction((tx) =>
    approveFinancialReviewWithResult(tx, {
      applicationId: graph.applicationId,
      reviewerUserId: adminUserId,
    })
  );
}

function readReviewRow(graph: Graph, section: "financial" | "company_details" = "financial") {
  return prisma.applicationReview.findUnique({
    where: { application_id_section: { application_id: graph.applicationId, section } },
    select: { status: true, reviewer_user_id: true, reviewed_at: true, approved_snapshot: true },
  });
}

/** True only when the column is SQL NULL (not JSON null). */
async function snapshotIsSqlNull(graph: Graph): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ is_null: boolean }[]>`
    SELECT approved_snapshot IS NULL AS is_null
    FROM application_reviews
    WHERE application_id = ${graph.applicationId} AND section::text = 'financial'
  `;
  return rows[0]?.is_null === true;
}

function editPlnpat(graph: Graph, value: number) {
  return applicationService.upsertAdminFinancialField({
    applicationId: graph.applicationId,
    userId: adminUserId,
    financialYear: 2026,
    fieldKey: "plnpat",
    columnKind: "unaudited",
    value,
  });
}

function profitMargin2026(result: { years: Array<{ year: number; kind: string; calculated_values: { profit_margin: number | null } }> }) {
  return result.years.find((year) => year.year === 2026 && year.kind === "unaudited")
    ?.calculated_values.profit_margin;
}

async function expectCleared(graph: Graph): Promise<void> {
  await expect(loadCurrentApprovedFinancialResult(prisma, graph.applicationId)).resolves.toBeNull();
  await expect(snapshotIsSqlNull(graph)).resolves.toBe(true);
}

beforeAll(async () => {
  const admin = await prisma.user.findFirst({
    where: { roles: { has: UserRole.ADMIN } },
    select: { user_id: true },
  });
  if (!admin) {
    throw new Error("No ADMIN user found. Run `pnpm --filter @cashsouk/api prisma:seed` first.");
  }
  adminUserId = admin.user_id;
});

afterAll(async () => {
  for (const graph of graphs) await cleanupGraph(graph);
});

beforeEach(() => {
  mockPeopleList.mockImplementation(() => []);
});

describe("Financial approval stores the approved result (local DB)", () => {
  it("writes APPROVED and a snapshot that deep-equals the returned result after storage", async () => {
    const graph = await seedGraph("store");
    const result = await approve(graph);

    const row = await readReviewRow(graph);
    expect(row?.status).toBe(ReviewStepStatus.APPROVED);
    expect(row?.reviewer_user_id).toBe(adminUserId);
    expect(row?.reviewed_at?.toISOString()).toBe(result.approved_at);
    expect(row?.approved_snapshot).toEqual(result);
    // The 17-digit ratio is stored as its 15-digit canonical form and reads back identically.
    expect(profitMargin2026(result)).toBe(22.6415094339623);
    expect(profitMargin2026(row!.approved_snapshot as never)).toBe(22.6415094339623);
    expect(result.reference_date).toBe(SUBMITTED_AT.toISOString());
    expect(result.ctos_report).toEqual({
      report_id: graph.ctosReportId,
      fetched_at: new Date(SUBMITTED_AT.getTime() - 60_000).toISOString(),
    });
    await expect(loadCurrentApprovedFinancialResult(prisma, graph.applicationId)).resolves.toEqual(
      result
    );
  });

  it("AdminService.approveReviewSection stores the result for Financial only", async () => {
    const graph = await seedGraph("service");
    await adminService.approveReviewSection(graph.applicationId, "financial", adminUserId);
    const financial = await readReviewRow(graph);
    expect(financial?.status).toBe(ReviewStepStatus.APPROVED);
    const current = await loadCurrentApprovedFinancialResult(prisma, graph.applicationId);
    expect(current).not.toBeNull();
    expect(financial?.approved_snapshot).toEqual(current);

    await adminService.approveReviewSection(graph.applicationId, "company_details", adminUserId);
    const company = await readReviewRow(graph, "company_details");
    expect(company?.status).toBe(ReviewStepStatus.APPROVED);
    expect(company?.approved_snapshot).toBeNull();
  });

  it("refuses an Admin financial edit after approval", async () => {
    const graph = await seedGraph("edit_locked");
    await approve(graph);
    await expect(editPlnpat(graph, 130)).rejects.toMatchObject({
      statusCode: 409,
      code: "FINANCIAL_REVIEW_LOCKED",
    });
  });

  it("a Financial approval that is refused by the repository writes nothing", async () => {
    const graph = await seedGraph("repo_refuses");
    await expect(
      repository.updateSectionReviewStatus(
        graph.applicationId,
        "financial",
        ReviewStepStatus.APPROVED,
        adminUserId
      )
    ).rejects.toThrow(/approveFinancialReviewWithResult/);
    await expect(readReviewRow(graph)).resolves.toBeNull();
  });
});

describe("Every path out of Financial APPROVED clears the result (local DB)", () => {
  it.each([
    ["reject", ReviewStepStatus.REJECTED],
    ["request amendment", ReviewStepStatus.AMENDMENT_REQUESTED],
    ["amendment withdrawn back to pending", ReviewStepStatus.PENDING],
  ] as const)("%s", async (_label, status) => {
    const graph = await seedGraph(`reopen_${status.toLowerCase()}`);
    await approve(graph);
    await repository.updateSectionReviewStatus(graph.applicationId, "financial", status, adminUserId);
    expect((await readReviewRow(graph))?.status).toBe(status);
    await expectCleared(graph);
  });

  it("reset to pending", async () => {
    const graph = await seedGraph("reopen_reset");
    await approve(graph);
    await repository.resetSectionReviewToPending(graph.applicationId, "financial");
    expect((await readReviewRow(graph))?.status).toBe(ReviewStepStatus.PENDING);
    await expectCleared(graph);
  });

  it("CTOS auto-reset when a new CTOS pull leaves AML pending", async () => {
    const graph = await seedGraph("reopen_ctos");
    await approve(graph);
    mockPeopleList.mockImplementation(() => [
      {
        matchKey: "ic:dbtest",
        name: "DB Test Pending Director",
        entityType: "INDIVIDUAL",
        roles: ["DIRECTOR"],
        sharePercentage: null,
        screening: { status: "PENDING" },
      },
    ]);
    await fetchAndInsertCtosReport(graph.organizationId);
    expect((await readReviewRow(graph))?.status).toBe(ReviewStepStatus.PENDING);
    await expectCleared(graph);
  });

  it("edit after reopening, then approve again → a new result reflecting the edit", async () => {
    const graph = await seedGraph("reapprove");
    const first = await approve(graph);
    await repository.resetSectionReviewToPending(graph.applicationId, "financial");

    await editPlnpat(graph, 130);
    const second = await approve(graph);

    expect(profitMargin2026(first)).toBe(22.6415094339623);
    // 130 ÷ 530 × 100 = 24.528301886792452 → 15 significant digits.
    expect(profitMargin2026(second)).toBe(24.5283018867925);
    const row = await readReviewRow(graph);
    expect(row?.approved_snapshot).toEqual(second);
    expect(second.approved_at >= first.approved_at).toBe(true);
  });
});

describe("Edit vs approval race (local DB, two connections)", () => {
  /** Wait until another backend is blocked on a row lock of this application. */
  async function waitForLockWaiter(graph: Graph): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const rows = await prisma.$queryRaw<{ waiting: bigint }[]>`
        SELECT count(*) AS waiting
        FROM pg_stat_activity
        WHERE wait_event_type = 'Lock'
          AND query LIKE '%FROM applications%FOR UPDATE%'
          AND datname = current_database()
      `;
      if (Number(rows[0]?.waiting ?? 0) > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`No edit transaction waited on application ${graph.applicationId}`);
  }

  it("an edit that passed the early check is refused once approval commits", async () => {
    const graph = await seedGraph("race");
    let releaseApproval!: () => void;
    const approvalHeld = new Promise<void>((resolve) => {
      releaseApproval = resolve;
    });

    // Connection 1: approval holds the application lock with APPROVED + result written.
    const approval = prisma.$transaction(
      async (tx) => {
        const result = await approveFinancialReviewWithResult(tx, {
          applicationId: graph.applicationId,
          reviewerUserId: adminUserId,
        });
        await approvalHeld;
        return result;
      },
      { timeout: 20_000 }
    );

    // Connection 2: the edit's early check still sees Financial PENDING (uncommitted approval),
    // then blocks on the application lock inside its write transaction.
    const edit = editPlnpat(graph, 999).then(
      () => null,
      (error: unknown) => error
    );
    try {
      await waitForLockWaiter(graph);
    } finally {
      // Always release, so a failing run cannot leave the application row locked.
      releaseApproval();
    }

    const approved = await approval;
    const editError = await edit;
    expect(editError).toMatchObject({ statusCode: 409, code: "FINANCIAL_REVIEW_LOCKED" });

    const application = await prisma.application.findUniqueOrThrow({
      where: { id: graph.applicationId },
      select: { financial_statements: true },
    });
    expect(application.financial_statements).toEqual(FINANCIAL_STATEMENTS);
    await expect(loadCurrentApprovedFinancialResult(prisma, graph.applicationId)).resolves.toEqual(
      approved
    );
  });
});
