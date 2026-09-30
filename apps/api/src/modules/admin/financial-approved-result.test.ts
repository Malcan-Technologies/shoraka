/**
 * SECTION: Approved Financial Review result (unit)
 * WHY: Financial approval stores exactly the shared resolver's result plus approval metadata;
 * only an APPROVED row's snapshot is ever current; the repository never writes Financial APPROVED
 * without a result and clears the snapshot whenever a section leaves APPROVED.
 */

const mockLoadCtosReport = jest.fn();
const mockUpsert = jest.fn();

jest.mock("../applications/application-owned-ctos", () => ({
  loadApplicationOwnedCtosFinancialReport: (...args: unknown[]) => mockLoadCtosReport(...args),
}));
// The real resolver, observed so the inputs the module passes can be asserted.
jest.mock("@cashsouk/types", () => {
  const actual = jest.requireActual("@cashsouk/types");
  return {
    ...actual,
    resolveFinancialReviewResult: jest.fn(actual.resolveFinancialReviewResult),
  };
});
jest.mock("../../lib/prisma", () => ({
  prisma: {
    applicationReview: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

import { Prisma, ReviewStepStatus } from "@prisma/client";
import {
  APPROVED_FINANCIAL_RESULT_VERSION,
  parseApprovedFinancialResult,
  resolveFinancialReviewResult,
} from "@cashsouk/types";
import { canonicalizeJsonNumbers } from "../../lib/canonical-json-numbers";
import {
  approveFinancialReviewWithResult,
  buildApprovedFinancialResult,
  loadCurrentApprovedFinancialResult,
} from "./financial-approved-result";
import { AdminRepository } from "./repository";

const SUBMITTED_AT = new Date("2026-09-25T00:00:00.000Z");
const APPROVED_AT = new Date("2026-09-30T08:00:00.000Z");
const CTOS_FETCHED_AT = new Date("2026-09-20T00:00:00.000Z");

/** 120 ÷ 530 × 100 = 22.641509433962266 (17 significant digits). */
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
    account: { totass: 1000, totlib: 400, networth: 600, turnover: 700, plnpat: 70, plnpbt: 90 },
  },
  {
    financial_year: 2025,
    dates: { pldd: "2025-12-31", bsdd: null },
    account: { totass: 1100, totlib: 450, networth: 650, turnover: 710, plnpat: 71, plnpbt: 91 },
  },
];

type ApplicationRow = {
  id: string;
  issuer_organization_id: string;
  submitted_at: Date | null;
  review_cycle: number;
  financial_statements: unknown;
};

function application(overrides: Partial<ApplicationRow> = {}): ApplicationRow {
  return {
    id: "app-1",
    issuer_organization_id: "org-1",
    submitted_at: SUBMITTED_AT,
    review_cycle: 2,
    financial_statements: FINANCIAL_STATEMENTS,
    ...overrides,
  };
}

function dbWith(row: ApplicationRow | null) {
  const findUnique = jest.fn().mockResolvedValue(row);
  return { db: { application: { findUnique } } as any, findUnique };
}

function ctosReport(financialsJson: unknown = CTOS_FINANCIALS) {
  return { id: "ctos-1", fetchedAt: CTOS_FETCHED_AT, financialsJson };
}

function build(db: unknown, reviewerUserId: string | null = "admin-1") {
  return buildApprovedFinancialResult({
    db: db as any,
    applicationId: "app-1",
    approvedAt: APPROVED_AT,
    reviewerUserId,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("buildApprovedFinancialResult", () => {
  it("equals the canonical shared resolver result plus approval metadata", async () => {
    mockLoadCtosReport.mockResolvedValue(ctosReport());
    const { db, findUnique } = dbWith(application());

    const result = await build(db);

    const expected = canonicalizeJsonNumbers({
      ...resolveFinancialReviewResult({
        financialStatements: FINANCIAL_STATEMENTS,
        ctosFinancials: CTOS_FINANCIALS,
        referenceDate: SUBMITTED_AT,
        ctosFetchState: "has_data",
      }),
      version: APPROVED_FINANCIAL_RESULT_VERSION,
      application_id: "app-1",
      review_cycle: 2,
      approved_at: APPROVED_AT.toISOString(),
      reviewer_user_id: "admin-1",
      ctos_report: { report_id: "ctos-1", fetched_at: CTOS_FETCHED_AT.toISOString() },
    });
    expect(result).toEqual(expected);
    expect(parseApprovedFinancialResult(result)).toEqual(result);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "app-1" },
      select: {
        id: true,
        issuer_organization_id: true,
        submitted_at: true,
        review_cycle: true,
        financial_statements: true,
      },
    });
    expect(mockLoadCtosReport).toHaveBeenCalledWith({
      issuerOrganizationId: "org-1",
      submittedAt: SUBMITTED_AT,
      db,
    });
  });

  it("carries reviewed values, per-field sources, calculated values and selected years", async () => {
    mockLoadCtosReport.mockResolvedValue(ctosReport());
    const { db } = dbWith(application());

    const result = await build(db);

    expect(result.reference_date).toBe(SUBMITTED_AT.toISOString());
    const userYear = result.years.find((year) => year.year === 2026 && year.kind === "unaudited");
    expect(userYear).toBeDefined();
    expect(userYear!.effective_raw_values.plnpat).toBe(120);
    expect(userYear!.source_trace.fields.plnpat?.source).toBeDefined();
    // Stored with 15 significant digits so it survives the Json column unchanged.
    expect(userYear!.calculated_values.profit_margin).toBe(22.6415094339623);
    expect(result.years.some((year) => year.selected)).toBe(true);
    expect(result.years.some((year) => year.kind === "ctos")).toBe(true);
  });

  it("uses submitted_at as the reference date and falls back to approvedAt only when null", async () => {
    mockLoadCtosReport.mockResolvedValue(null);
    const submitted = await build(dbWith(application()).db);
    expect(submitted.reference_date).toBe(SUBMITTED_AT.toISOString());

    const draft = await build(dbWith(application({ submitted_at: null })).db);
    expect(draft.reference_date).toBe(APPROVED_AT.toISOString());
  });

  it.each([
    ["not_pulled", null],
    ["no_records", ctosReport([])],
    ["no_records", ctosReport(null)],
    ["no_records", ctosReport({ unexpected: true })],
    ["has_data", ctosReport()],
  ] as const)("derives ctosFetchState %s", async (state, report) => {
    mockLoadCtosReport.mockResolvedValue(report);
    const result = await build(dbWith(application()).db);
    expect(resolveFinancialReviewResult).toHaveBeenCalledWith({
      financialStatements: FINANCIAL_STATEMENTS,
      ctosFinancials: report?.financialsJson ?? null,
      referenceDate: SUBMITTED_AT,
      ctosFetchState: state,
    });
    const expected = resolveFinancialReviewResult({
      financialStatements: FINANCIAL_STATEMENTS,
      ctosFinancials: report?.financialsJson ?? null,
      referenceDate: SUBMITTED_AT,
      ctosFetchState: state,
    });
    expect(result.years).toEqual(canonicalizeJsonNumbers(expected.years));
    expect(result.source_footer).toBe(expected.source_footer);
    expect(result.ops_warning).toBe(expected.ops_warning);
  });

  it("records the CTOS report metadata, or null when no report exists", async () => {
    mockLoadCtosReport.mockResolvedValue(ctosReport());
    const withCtos = await build(dbWith(application()).db, null);
    expect(withCtos.ctos_report).toEqual({
      report_id: "ctos-1",
      fetched_at: CTOS_FETCHED_AT.toISOString(),
    });
    expect(withCtos.reviewer_user_id).toBeNull();

    mockLoadCtosReport.mockResolvedValue(null);
    const withoutCtos = await build(dbWith(application()).db);
    expect(withoutCtos.ctos_report).toBeNull();
  });

  it("throws 404 APPLICATION_NOT_FOUND when the application is missing", async () => {
    await expect(build(dbWith(null).db)).rejects.toMatchObject({
      statusCode: 404,
      code: "APPLICATION_NOT_FOUND",
    });
    expect(mockLoadCtosReport).not.toHaveBeenCalled();
  });
});

describe("approveFinancialReviewWithResult", () => {
  it("locks the application, then writes APPROVED and the result in one upsert", async () => {
    mockLoadCtosReport.mockResolvedValue(ctosReport());
    const queryRaw = jest.fn().mockResolvedValue([{ id: "app-1" }]);
    const findUnique = jest.fn().mockResolvedValue(application());
    const upsert = jest.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: queryRaw,
      application: { findUnique },
      applicationReview: { upsert },
    } as any;

    const result = await approveFinancialReviewWithResult(tx, {
      applicationId: "app-1",
      reviewerUserId: "admin-1",
      approvedAt: APPROVED_AT,
    });

    const sql = (queryRaw.mock.calls[0]![0] as string[]).join("?");
    expect(sql).toBe("SELECT id FROM applications WHERE id = ? FOR UPDATE");
    expect(queryRaw.mock.calls[0]![1]).toBe("app-1");
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findUnique.mock.invocationCallOrder[0]!
    );
    expect(mockLoadCtosReport.mock.calls[0]![0].db).toBe(tx);
    expect(upsert).toHaveBeenCalledTimes(1);
    const written = {
      status: ReviewStepStatus.APPROVED,
      reviewer_user_id: "admin-1",
      reviewed_at: APPROVED_AT,
      approved_snapshot: result,
    };
    expect(upsert).toHaveBeenCalledWith({
      where: { application_id_section: { application_id: "app-1", section: "financial" } },
      create: { application_id: "app-1", section: "financial", ...written },
      update: written,
    });
    // The stored object is exactly the returned one.
    expect(upsert.mock.calls[0]![0].update.approved_snapshot).toBe(result);
  });

  it("writes nothing when the result cannot be built", async () => {
    const upsert = jest.fn();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      application: { findUnique: jest.fn().mockResolvedValue(null) },
      applicationReview: { upsert },
    } as any;
    await expect(
      approveFinancialReviewWithResult(tx, { applicationId: "app-1", reviewerUserId: "admin-1" })
    ).rejects.toMatchObject({ code: "APPLICATION_NOT_FOUND" });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("loadCurrentApprovedFinancialResult", () => {
  async function validResult() {
    mockLoadCtosReport.mockResolvedValue(ctosReport());
    return build(dbWith(application()).db);
  }

  function dbWithReview(row: { status: string; approved_snapshot: unknown } | null) {
    const findUnique = jest.fn().mockResolvedValue(row);
    return { db: { applicationReview: { findUnique } } as any, findUnique };
  }

  it("returns the result for an APPROVED row with a valid snapshot", async () => {
    const stored = await validResult();
    const { db, findUnique } = dbWithReview({ status: "APPROVED", approved_snapshot: stored });
    await expect(loadCurrentApprovedFinancialResult(db, "app-1")).resolves.toEqual(stored);
    expect(findUnique).toHaveBeenCalledWith({
      where: { application_id_section: { application_id: "app-1", section: "financial" } },
      select: { status: true, approved_snapshot: true },
    });
  });

  it("returns null for an APPROVED row without a snapshot (approved before this release)", async () => {
    const { db } = dbWithReview({ status: "APPROVED", approved_snapshot: null });
    await expect(loadCurrentApprovedFinancialResult(db, "app-1")).resolves.toBeNull();
  });

  it("returns null for an APPROVED row with a malformed snapshot", async () => {
    const stored = await validResult();
    const { db } = dbWithReview({
      status: "APPROVED",
      approved_snapshot: { ...stored, version: 99 },
    });
    await expect(loadCurrentApprovedFinancialResult(db, "app-1")).resolves.toBeNull();
  });

  it.each(["PENDING", "REJECTED", "AMENDMENT_REQUESTED"])(
    "returns null for a %s row that still holds a snapshot",
    async (status) => {
      const stored = await validResult();
      const { db } = dbWithReview({ status, approved_snapshot: stored });
      await expect(loadCurrentApprovedFinancialResult(db, "app-1")).resolves.toBeNull();
    }
  );

  it("returns null when there is no Financial row", async () => {
    const { db } = dbWithReview(null);
    await expect(loadCurrentApprovedFinancialResult(db, "app-1")).resolves.toBeNull();
  });
});

describe("AdminRepository review status writes and the approved snapshot", () => {
  const repository = new AdminRepository();

  it("refuses to write Financial APPROVED without a result", async () => {
    await expect(
      repository.updateSectionReviewStatus(
        "app-1",
        "financial",
        ReviewStepStatus.APPROVED,
        "admin-1"
      )
    ).rejects.toThrow(/approveFinancialReviewWithResult/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it.each([
    ReviewStepStatus.REJECTED,
    ReviewStepStatus.AMENDMENT_REQUESTED,
    ReviewStepStatus.PENDING,
  ])("clears the snapshot when writing %s", async (status) => {
    await repository.updateSectionReviewStatus("app-1", "financial", status, "admin-1");
    const args = mockUpsert.mock.calls[0]![0];
    expect(args.create.approved_snapshot).toBe(Prisma.DbNull);
    expect(args.update.approved_snapshot).toBe(Prisma.DbNull);
    expect(args.update.status).toBe(status);
  });

  it("does not touch the snapshot when approving a non-financial section", async () => {
    await repository.updateSectionReviewStatus(
      "app-1",
      "company_details",
      ReviewStepStatus.APPROVED,
      "admin-1"
    );
    const args = mockUpsert.mock.calls[0]![0];
    expect(args.create).not.toHaveProperty("approved_snapshot");
    expect(args.update).not.toHaveProperty("approved_snapshot");
  });

  it("clears the snapshot when resetting a section to PENDING", async () => {
    await repository.resetSectionReviewToPending("app-1", "financial");
    const args = mockUpsert.mock.calls[0]![0];
    expect(args.update).toEqual({
      status: ReviewStepStatus.PENDING,
      reviewer_user_id: null,
      reviewed_at: null,
      approved_snapshot: Prisma.DbNull,
    });
    expect(args.create.approved_snapshot).toBe(Prisma.DbNull);
  });
});
