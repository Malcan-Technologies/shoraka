import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveAdminFinancialReviewColumns } from "@cashsouk/types";
import { buildApplicationRevisionSnapshot } from "./revision-snapshot";
import { loadApplicationOwnedCtosFinancialReport } from "./application-owned-ctos";

const SUBMITTED_AT = new Date("2026-03-01T00:00:00.000Z");

function ctosRow(year: number, turnover: number, tradeReceivables?: number) {
  return {
    financial_year: year,
    dates: { pldd: `${year}-12-31`, bsdd: null },
    account: {
      turnover,
      ...(tradeReceivables == null ? {} : { tradeReceivables }),
    },
  };
}

function applicationAFinancials() {
  return {
    questionnaire: { financial_year_end: "2026-12-31" },
    unaudited_by_year: {
      "2026": { turnover: 10, pldd: "2026-12-31" },
    },
    admin_input_by_year: {
      "2025": { turnover: 100, tradeReceivables: 100, pldd: "2025-12-31", statementType: "AUDITED" },
    },
    admin_field_overrides: {
      "2024": {
        tradeReceivables: {
          value: 20,
          baseSource: "ctos",
          action: "add_missing_ctos_field",
          updated_by_user_id: "admin",
          updated_at: "2026-02-01T00:00:00.000Z",
        },
      },
      "2026": {
        turnover: {
          value: 12,
          baseSource: "user_input",
          action: "edit_user_input",
          updated_by_user_id: "admin",
          updated_at: "2026-02-02T00:00:00.000Z",
        },
      },
    },
  };
}

describe("application-owned CTOS financials", () => {
  it("uses the latest report at or before first submission, not a later pull", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: "ctos-at-submit",
      fetched_at: new Date("2026-02-01T00:00:00.000Z"),
      financials_json: [ctosRow(2024, 100)],
    });
    const owned = await loadApplicationOwnedCtosFinancialReport({
      issuerOrganizationId: "org-1",
      submittedAt: SUBMITTED_AT,
      db: { ctosReport: { findFirst } } as never,
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          issuer_organization_id: "org-1",
          subject_ref: null,
          fetched_at: { lte: SUBMITTED_AT },
        }),
        orderBy: { fetched_at: "desc" },
      })
    );
    expect(owned?.id).toBe("ctos-at-submit");
    expect(owned?.financialsJson).toEqual([ctosRow(2024, 100)]);
  });

  it("returns no CTOS when the first report arrives after submission", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const owned = await loadApplicationOwnedCtosFinancialReport({
      issuerOrganizationId: "org-1",
      submittedAt: SUBMITTED_AT,
      db: { ctosReport: { findFirst } } as never,
    });
    expect(owned).toBeNull();
  });

  it("keeps the latest report for a draft that has not been submitted", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: "ctos-latest",
      fetched_at: new Date("2026-09-01T00:00:00.000Z"),
      financials_json: [ctosRow(2025, 999)],
    });
    const owned = await loadApplicationOwnedCtosFinancialReport({
      issuerOrganizationId: "org-1",
      submittedAt: null,
      db: { ctosReport: { findFirst } } as never,
    });
    expect(findFirst.mock.calls[0][0].where.fetched_at).toBeUndefined();
    expect(owned?.financialsJson).toEqual([ctosRow(2025, 999)]);
  });
});

describe("old application financial summary isolation", () => {
  const ref = new Date("2026-09-25T00:00:00.000Z");
  const financialStatements = applicationAFinancials();
  const ctosAtSubmit = [ctosRow(2024, 100)];
  const ctosAfterApplicationB = [ctosRow(2024, 500, 60), ctosRow(2025, 999, 60)];

  function turnover(ctosFinancials: unknown, year: number, kind: "ctos" | "admin_input" | "unaudited") {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials,
      ref,
      ctosFetchState: Array.isArray(ctosFinancials) && ctosFinancials.length > 0 ? "has_data" : "not_pulled",
    });
    return columns.find((column) => column.year === year && column.kind === kind)?.fields.turnover?.value ?? null;
  }

  it("A: later CTOS FY2025 does not replace Application A Admin Input 100", () => {
    expect(turnover(ctosAtSubmit, 2025, "admin_input")).toBe(100);
    expect(turnover(ctosAtSubmit, 2025, "ctos")).toBeNull();
    expect(turnover(ctosAfterApplicationB, 2025, "ctos")).toBe(999);
    expect(turnover(ctosAtSubmit, 2025, "admin_input")).not.toBe(999);
  });

  it("B: later Admin Input on another application is not an input to Application A", () => {
    expect(turnover(ctosAtSubmit, 2025, "admin_input")).toBe(100);
    const otherApplication = {
      ...financialStatements,
      admin_input_by_year: {
        "2025": { turnover: 50, pldd: "2025-12-31" },
      },
    };
    const other = resolveAdminFinancialReviewColumns({
      financialStatements: otherApplication,
      ctosFinancials: ctosAtSubmit,
      ref,
      ctosFetchState: "has_data",
    });
    expect(other.find((column) => column.year === 2025 && column.kind === "admin_input")?.fields.turnover?.value).toBe(
      50
    );
    expect(turnover(ctosAtSubmit, 2025, "admin_input")).toBe(100);
  });

  it("C: Application A keeps reviewed User Input 12 when another application later stores 50", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials: ctosAtSubmit,
      ref,
      ctosFetchState: "has_data",
    });
    expect(columns.find((column) => column.year === 2026 && column.kind === "unaudited")?.fields.turnover?.value).toBe(
      12
    );
  });

  it("D: Application A keeps CTOS revenue 100 and its own gap-fill 20", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials: ctosAtSubmit,
      ref,
      ctosFetchState: "has_data",
    });
    const fy2024 = columns.find((column) => column.year === 2024 && column.kind === "ctos");
    expect(fy2024?.fields.turnover?.value).toBe(100);
    expect(fy2024?.fields.tradeReceivables?.value).toBe(20);

    const later = resolveAdminFinancialReviewColumns({
      financialStatements: {
        questionnaire: { financial_year_end: "2026-12-31" },
        unaudited_by_year: {},
        admin_input_by_year: {},
        admin_field_overrides: {},
      },
      ctosFinancials: ctosAfterApplicationB,
      ref,
      ctosFetchState: "has_data",
    });
    const later2024 = later.find((column) => column.year === 2024 && column.kind === "ctos");
    expect(later2024?.fields.turnover?.value).toBe(500);
    expect(later2024?.fields.tradeReceivables?.value).toBe(60);
  });

  it("E: a new application submitted after the new CTOS report can use that report", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: "ctos-b",
      fetched_at: new Date("2026-08-01T00:00:00.000Z"),
      financials_json: ctosAfterApplicationB,
    });
    const owned = await loadApplicationOwnedCtosFinancialReport({
      issuerOrganizationId: "org-1",
      submittedAt: new Date("2026-09-01T00:00:00.000Z"),
      db: { ctosReport: { findFirst } } as never,
    });
    expect(owned?.financialsJson).toEqual(ctosAfterApplicationB);
  });

  it("F: a revision snapshot keeps the financial JSON from the moment it was built", () => {
    const financialStatements = applicationAFinancials();
    const snapshot = buildApplicationRevisionSnapshot({
      financing_type: null,
      product_version: 1,
      financing_structure: null,
      company_details: null,
      business_details: null,
      financial_statements: financialStatements,
      supporting_documents: null,
      declarations: null,
      review_and_submit: null,
      last_completed_step: 4,
      contract_id: null,
      contract: null,
      invoices: [],
      issuer_organization: null,
    }) as { application: { financial_statements: typeof financialStatements } };
    const stored = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    financialStatements.admin_input_by_year["2025"].turnover = 50;
    expect(stored.application.financial_statements.admin_input_by_year["2025"].turnover).toBe(100);
  });

  it("I: amendment reopen reads saved application financials and does not rerun prefill", () => {
    const step = readFileSync(
      join(__dirname, "../../../../issuer/src/app/(application-flow)/applications/steps/financial-statements-step.tsx"),
      "utf8"
    );
    const savedBranch = step.indexOf("if (isV2FinancialSaved(saved))");
    const prefillBranch = step.indexOf("No financial_statements on the app yet");
    expect(savedBranch).toBeGreaterThan(-1);
    expect(prefillBranch).toBeGreaterThan(savedBranch);
    expect(step).toContain("preserveStoredYears");
    expect(step).not.toContain("effectiveFinancialHistoryEntries");
  });
});

describe("application review and prospectus read boundaries", () => {
  it("Admin application detail binds submitted financial CTOS to the owned report", () => {
    const admin = readFileSync(join(__dirname, "../admin/service.ts"), "utf8");
    expect(admin).toContain("loadApplicationOwnedCtosFinancialReport");
    const review = readFileSync(
      join(
        __dirname,
        "../../../../admin/src/components/application-financial-review-content.tsx"
      ),
      "utf8"
    );
    expect(review).toContain("app.financial_statements");
    expect(review).toContain("latest_organization_ctos_financials_json");
    expect(review).not.toContain("effectiveFinancialHistoryEntries");
  });

  it("published Prospectus loaders do not read live CTOS", () => {
    const pageTwo = readFileSync(join(__dirname, "../notes/prospectus/prospectus-page-two-prisma.ts"), "utf8");
    const pageThree = readFileSync(join(__dirname, "../notes/prospectus/prospectus-page-three-prisma.ts"), "utf8");
    expect(pageTwo).toContain("if (published)");
    expect(pageTwo).toContain("liveCtosFinancials: null");
    expect(pageThree).toContain("liveCtosFinancials: null");
    expect(pageTwo).toContain("loadApplicationOwnedCtosFinancialReport");
    expect(pageThree).toContain("loadApplicationOwnedCtosFinancialReport");
  });
});
