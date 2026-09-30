import { buildNoteFinancialSnapshot } from "./note-financial-snapshot";
import { parseNoteFinancialSnapshot } from "./note-financial-snapshot.types";

const financialStatements = {
  questionnaire: { last_closing_date: "2025-12-31", is_submitted_to_ssm: true },
  unaudited_by_year: { "2025": { pl_revenue: "1200000" } },
  admin_input_by_year: { "2024": { pl_revenue: "900000" } },
  admin_field_overrides: { "2025": { pl_revenue: { value: "1250000" } } },
};

function buildDb(overrides: {
  application?: Record<string, unknown> | null;
  financialReview?: Record<string, unknown> | null;
  ctosReport?: Record<string, unknown> | null;
} = {}) {
  const application =
    overrides.application === undefined
      ? {
          id: "app-1",
          issuer_organization_id: "org-1",
          submitted_at: new Date("2026-05-01T02:00:00.000Z"),
          review_cycle: 2,
          financial_statements: financialStatements,
        }
      : overrides.application;
  const financialReview =
    overrides.financialReview === undefined
      ? {
          status: "APPROVED",
          reviewed_at: new Date("2026-05-10T03:00:00.000Z"),
          reviewer_user_id: "admin-1",
        }
      : overrides.financialReview;
  const ctosReport =
    overrides.ctosReport === undefined
      ? {
          id: "ctos-1",
          fetched_at: new Date("2026-04-20T01:00:00.000Z"),
          financials_json: [{ financial_year: 2024, pl_revenue: 880000 }],
        }
      : overrides.ctosReport;
  return {
    application: { findUnique: jest.fn().mockResolvedValue(application) },
    applicationReview: { findUnique: jest.fn().mockResolvedValue(financialReview) },
    ctosReport: { findFirst: jest.fn().mockResolvedValue(ctosReport) },
  };
}

const capturedAt = new Date("2026-06-01T08:00:00.000Z");

describe("buildNoteFinancialSnapshot", () => {
  it("copies reviewed financial inputs, the owned CTOS report and traceability fields", async () => {
    const db = buildDb();

    const snapshot = await buildNoteFinancialSnapshot({
      db: db as never,
      applicationId: "app-1",
      capturedAt,
    });

    expect(parseNoteFinancialSnapshot(snapshot)).toEqual(snapshot);
    expect(snapshot).toEqual({
      version: 1,
      captured_at: "2026-06-01T08:00:00.000Z",
      reference_date: "2026-05-01T02:00:00.000Z",
      financial_statements: financialStatements,
      ctos: {
        report_id: "ctos-1",
        fetched_at: "2026-04-20T01:00:00.000Z",
        financials: [{ financial_year: 2024, pl_revenue: 880000 }],
      },
      source: {
        application_id: "app-1",
        review_cycle: 2,
        application_submitted_at: "2026-05-01T02:00:00.000Z",
        financial_review: {
          status: "APPROVED",
          reviewed_at: "2026-05-10T03:00:00.000Z",
          reviewer_user_id: "admin-1",
        },
      },
    });
    expect(db.applicationReview.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { application_id_section: { application_id: "app-1", section: "financial" } },
      })
    );
    expect(db.ctosReport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          issuer_organization_id: "org-1",
          subject_ref: null,
          fetched_at: { lte: new Date("2026-05-01T02:00:00.000Z") },
        },
      })
    );
  });

  it("stores ctos null when the application owns no CTOS report", async () => {
    const db = buildDb({ ctosReport: null });

    const snapshot = await buildNoteFinancialSnapshot({
      db: db as never,
      applicationId: "app-1",
      capturedAt,
    });

    expect(snapshot.ctos).toBeNull();
    expect(parseNoteFinancialSnapshot(snapshot)?.ctos).toBeNull();
  });

  it("uses captured_at as reference_date when the application has no submitted_at", async () => {
    const db = buildDb({
      application: {
        id: "app-1",
        issuer_organization_id: "org-1",
        submitted_at: null,
        review_cycle: 1,
        financial_statements: null,
      },
    });

    const snapshot = await buildNoteFinancialSnapshot({
      db: db as never,
      applicationId: "app-1",
      capturedAt,
    });

    expect(snapshot.reference_date).toBe(snapshot.captured_at);
    expect(snapshot.source.application_submitted_at).toBeNull();
    expect(snapshot.financial_statements).toBeNull();
  });

  it("stores null financial review fields when no Financial review row exists", async () => {
    const db = buildDb({ financialReview: null });

    const snapshot = await buildNoteFinancialSnapshot({
      db: db as never,
      applicationId: "app-1",
      capturedAt,
    });

    expect(snapshot.source.financial_review).toEqual({
      status: null,
      reviewed_at: null,
      reviewer_user_id: null,
    });
  });

  it("fails when the application does not exist", async () => {
    const db = buildDb({ application: null });

    await expect(
      buildNoteFinancialSnapshot({ db: db as never, applicationId: "missing", capturedAt })
    ).rejects.toMatchObject({ statusCode: 404, code: "APPLICATION_NOT_FOUND" });
    expect(db.ctosReport.findFirst).not.toHaveBeenCalled();
  });
});
