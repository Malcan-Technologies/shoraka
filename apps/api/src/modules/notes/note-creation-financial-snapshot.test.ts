/**
 * Note creation copies the application's current APPROVED Financial Review result onto
 * Note.financial_snapshot. It never resolves or reads live financial data, and the approved-result
 * requirement is the only condition added on top of the existing Note eligibility rules.
 */

const mockNoteRepository = {
  findBySource: jest.fn(),
};

const mockTx: any = {
  $queryRaw: jest.fn(async () => []),
  contract: { findUnique: jest.fn() },
  note: {
    create: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  notePaymentSchedule: { create: jest.fn() },
  noteEvent: { create: jest.fn() },
  displayReferenceAllocation: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  application: { findUnique: jest.fn(), findFirst: jest.fn() },
  ctosReport: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
};

const mockPrisma: any = {
  product: { findUnique: jest.fn() },
  paymaster: { findUnique: jest.fn() },
  invoice: { findUnique: jest.fn() },
  note: { findMany: jest.fn() },
  application: { findUnique: jest.fn(), findFirst: jest.fn() },
  applicationReview: { findUnique: jest.fn() },
  ctosReport: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(async (cb: any) => cb(mockTx)),
};

jest.mock("../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

jest.mock("./repository", () => ({
  noteRepository: mockNoteRepository,
  noteInclude: {},
}));

jest.mock("@cashsouk/types", () => ({
  ...jest.requireActual("@cashsouk/types"),
  resolveFinancialReviewResult: jest.fn(() => {
    throw new Error("Note creation must not resolve the Financial Review result");
  }),
}));

jest.mock("../admin/financial-approved-result", () => {
  const actual = jest.requireActual("../admin/financial-approved-result");
  return {
    ...actual,
    loadCurrentApprovedFinancialResult: jest.fn(actual.loadCurrentApprovedFinancialResult),
  };
});

jest.mock("./mapper", () => ({
  mapLedgerEntry: jest.fn(),
  mapMarketplaceNoteDetail: jest.fn(),
  mapNoteListItem: jest.fn(),
  mapWithdrawalInstruction: jest.fn(),
  resolveIssuerResidualPayoutListStatus: jest.fn(),
  resolveProductNameFromWorkflow: jest.fn(() => null),
  mapNoteDetail: jest.fn((note: { id: string; note_reference: string | null }) => ({
    id: note.id,
    noteReference: note.note_reference,
  })),
}));

import { readFileSync } from "node:fs";
import path from "node:path";
import { ApplicationStatus, InvoiceStatus, NoteStatus, ReviewStepStatus } from "@prisma/client";
import { resolveFinancialReviewResult, type ApprovedFinancialResult } from "@cashsouk/types";
import { loadCurrentApprovedFinancialResult } from "../admin/financial-approved-result";
import {
  buildNoteFinancialSnapshot,
  parseNoteFinancialSnapshot,
} from "./note-financial-snapshot.types";
import { NoteService } from "./service";

const mockLoadApproved = loadCurrentApprovedFinancialResult as jest.MockedFunction<
  typeof loadCurrentApprovedFinancialResult
>;
const mockResolve = resolveFinancialReviewResult as jest.MockedFunction<
  typeof resolveFinancialReviewResult
>;

function approvedResult(): ApprovedFinancialResult {
  return {
    version: 1,
    application_id: "app_1",
    review_cycle: 2,
    approved_at: "2026-08-01T03:04:05.678Z",
    reviewer_user_id: "admin_1",
    ctos_report: { report_id: "ctos_1", fetched_at: "2026-07-15T00:00:00.000Z" },
    reference_date: "2026-07-01T00:00:00.000Z",
    years: [
      {
        year: 2025,
        kind: "ctos",
        record_source: "ctos_audited",
        statement_type: "AUDITED",
        financial_year_end_iso: "2025-12-31",
        reviewed_column: true,
        selected: true,
        effective_raw_values: {
          turnover: 1234567.891234,
          plnpbt: "98765.4321",
          fixass: null,
        },
        source_trace: {
          fields: {
            turnover: { source: "ctos", edited_by_admin: false },
            plnpbt: { source: "admin_input", edited_by_admin: true },
            fixass: {
              source: "ctos",
              edited_by_admin: false,
              unavailable_reason: "not_provided_by_ctos",
            },
          },
          inputs: {
            user_input: null,
            admin_input: { plnpbt: "98765.4321" },
            ctos: { turnover: 1234567.891234 },
            admin_overrides: null,
          },
        },
        calculated_values: {
          totass: 2345678.123456789,
          totlib: 1111111.111111111,
          networth: 1234567.012345678,
          ebit: 104321.98765432101,
          turnover_growth: 12.345678901234567,
          profit_margin: 8.000000000000002,
          return_on_equity: 7.999999999999998,
          currat: 1.3333333333333333,
          quickRatio: 0.6666666666666666,
          workcap: 345678.90123456,
          roa: 4.2105263157894735,
          assetTurnover: 0.5263157894736842,
          gear: 0.9000000000000001,
          netDebtEquity: -0.14285714285714285,
          interestCoverage: 11.11111111111111,
          receivablesDays: 45.62962962962963,
          payablesDays: 30.416666666666668,
          dscr: null,
        },
      },
    ],
    source_footer: "Source: CTOS audited 2025",
    missing_ssm_unaudited_years: [2024],
    ops_warning: null,
  };
}

function application(overrides: Record<string, unknown> = {}) {
  return {
    id: "app_1",
    status: ApplicationStatus.INVOICES_SENT,
    issuer_organization_id: "org_1",
    contract_id: "con_1",
    product_version: 2,
    financing_type: { product_id: "prod_1", product_code: "ARF" },
    financing_structure: null,
    business_details: null,
    issuer_organization: {
      id: "org_1",
      name: "Issuer Co",
      type: "COMPANY",
      registration_number: "123",
      country: "MY",
      corporate_onboarding_data: null,
    },
    contract: null,
    ...overrides,
  };
}

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv_1",
    application_id: "app_1",
    contract_id: "con_1",
    details: { number: "INV-556728", value: 12500, maturity_date: "2026-12-10" },
    offer_details: {
      offered_amount: 10000,
      offered_profit_rate_percent: 10,
      financing_tenure_days: 90,
    },
    status: InvoiceStatus.APPROVED,
    ...overrides,
  };
}

const sourceContract = {
  id: "con_1",
  status: "APPROVED",
  contract_details: { financing: 10000 },
  offer_details: null,
  customer_details: null,
};

const actor = { userId: "admin_1", role: "ADMIN", portal: "ADMIN" } as any;

function createFromInvoiceSource(overrides: Record<string, unknown> = {}) {
  return (new NoteService() as any).createFromInvoiceSource({
    application: application(),
    invoice: invoice(),
    sourceContract,
    actor,
    ...overrides,
  });
}

function mockApprovedReviewRow(result: unknown) {
  mockPrisma.applicationReview.findUnique.mockResolvedValue({
    status: ReviewStepStatus.APPROVED,
    approved_snapshot: result,
  });
}

function noteCreateData() {
  expect(mockTx.note.create).toHaveBeenCalledTimes(1);
  return mockTx.note.create.mock.calls[0][0].data;
}

function readsLiveFinancials(calls: unknown[][]) {
  return calls.some((args) => JSON.stringify(args).includes("financial_statements"));
}

describe("Note creation copies the approved Financial Review result", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockNoteRepository.findBySource.mockResolvedValue(null);
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "prod_1",
      workflow: [],
      service_fee_rate_percent: { toNumber: () => 15 },
      product_code: "ARF",
    });
    mockPrisma.paymaster.findUnique.mockResolvedValue(null);
    mockPrisma.note.findMany.mockResolvedValue([]);
    mockApprovedReviewRow(approvedResult());

    mockTx.$queryRaw.mockResolvedValue([]);
    mockTx.contract.findUnique.mockResolvedValue({
      contract_details: { financing: 10000, facility_enabled: true },
    });
    mockTx.displayReferenceAllocation.create.mockResolvedValue({});
    mockTx.displayReferenceAllocation.findUnique.mockResolvedValue(null);
    mockTx.note.create.mockImplementation(async ({ data }: any) => ({
      id: data.id,
      created_at: data.created_at,
      target_amount: { toNumber: () => 10000 },
      profit_rate_percent: { toNumber: () => 10 },
      note_reference: data.note_reference,
      status: NoteStatus.DRAFT,
    }));
    mockTx.noteEvent.create.mockResolvedValue({});
    mockTx.notePaymentSchedule.create.mockResolvedValue({});
    mockTx.note.findUniqueOrThrow.mockImplementation(async ({ where }: any) => ({
      id: where.id,
      note_reference: "NOTE-ARF-202608-BX5",
      status: NoteStatus.DRAFT,
    }));
  });

  describe("eligibility is unchanged", () => {
    it("creates a Note from an APPROVED invoice on a non-COMPLETED application", async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...invoice(),
        application: application({
          status: ApplicationStatus.INVOICES_SENT,
          contract: sourceContract,
        }),
        contract: sourceContract,
      });

      const note = await new NoteService().createFromInvoice("inv_1", {}, actor);

      expect(note).toMatchObject({ noteReference: "NOTE-ARF-202608-BX5" });
      expect(mockTx.note.create).toHaveBeenCalledTimes(1);
      expect(mockLoadApproved).toHaveBeenCalledWith(mockPrisma, "app_1");
    });

    it("still rejects createFromApplication for a non-COMPLETED application", async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        ...application({ status: ApplicationStatus.INVOICES_SENT }),
        invoices: [invoice()],
      });

      await expect(
        new NoteService().createFromApplication("app_1", {}, actor)
      ).rejects.toMatchObject({ statusCode: 409, code: "APPLICATION_NOT_COMPLETED" });
      expect(mockLoadApproved).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("still rejects an invoice that is not APPROVED", async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...invoice({ status: InvoiceStatus.SUBMITTED }),
        application: application(),
        contract: sourceContract,
      });

      await expect(new NoteService().createFromInvoice("inv_1", {}, actor)).rejects.toMatchObject({
        statusCode: 409,
        code: "INVOICE_NOT_APPROVED",
      });
      await expect(
        createFromInvoiceSource({ invoice: invoice({ status: InvoiceStatus.SUBMITTED }) })
      ).rejects.toMatchObject({ statusCode: 409, code: "INVOICE_NOT_APPROVED" });
      expect(mockLoadApproved).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("no dropped guard remains in notes/service.ts", () => {
    const source = readFileSync(path.join(__dirname, "service.ts"), "utf8");

    function methodBody(start: string, end: string) {
      const from = source.indexOf(start);
      const to = source.indexOf(end, from + start.length);
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeGreaterThan(from);
      return source.slice(from, to);
    }

    it("has none of the removed review-section guards", () => {
      expect(source).not.toContain("REVIEW_SECTIONS_NOT_APPROVED");
      expect(source).not.toContain("loadApplicationReviewApproval");
      expect(source).not.toContain("review-section-approval");
    });

    it("checks APPLICATION_NOT_COMPLETED only inside createFromApplication", () => {
      const occurrences = (text: string) => text.split("APPLICATION_NOT_COMPLETED").length - 1;
      const createFromApplication = methodBody(
        "async createFromApplication(",
        "private async createFromInvoiceSource("
      );
      const createFromInvoiceSourceBody = methodBody(
        "private async createFromInvoiceSource(",
        "async updateDraft("
      );

      expect(occurrences(createFromApplication)).toBe(1);
      expect(occurrences(source)).toBe(occurrences(createFromApplication));
      expect(occurrences(createFromInvoiceSourceBody)).toBe(0);
      expect(
        createFromInvoiceSourceBody.split("FINANCIAL_APPROVED_RESULT_REQUIRED").length - 1
      ).toBe(1);
    });

    it("does not reference live financial inputs", () => {
      expect(source).not.toContain("financial_statements");
      expect(source).not.toContain("resolveFinancialReviewResult");
      expect(source).not.toContain("ctosReport");
    });
  });

  it("copies the approved result exactly onto financial_snapshot", async () => {
    await createFromInvoiceSource();

    const data = noteCreateData();
    const loaded = await mockLoadApproved.mock.results[0].value;
    expect(loaded).toStrictEqual(approvedResult());

    expect(data.financial_snapshot).toStrictEqual(
      buildNoteFinancialSnapshot(loaded, data.created_at)
    );
    expect(data.financial_snapshot.captured_at).toBe(data.created_at.toISOString());
    expect(data.financial_snapshot.approved_financial_result).toStrictEqual(loaded);
    expect(
      data.financial_snapshot.approved_financial_result.years[0].calculated_values.turnover_growth
    ).toBe(12.345678901234567);
    expect(parseNoteFinancialSnapshot(data.financial_snapshot)).toStrictEqual(
      data.financial_snapshot
    );
  });

  it("does not resolve or read live financial data", async () => {
    await expect(createFromInvoiceSource()).resolves.toMatchObject({
      noteReference: "NOTE-ARF-202608-BX5",
    });

    expect(mockResolve).not.toHaveBeenCalled();
    expect(readsLiveFinancials(mockPrisma.application.findUnique.mock.calls)).toBe(false);
    expect(readsLiveFinancials(mockPrisma.application.findFirst.mock.calls)).toBe(false);
    expect(readsLiveFinancials(mockTx.application.findUnique.mock.calls)).toBe(false);
    expect(readsLiveFinancials(mockTx.application.findFirst.mock.calls)).toBe(false);
    for (const client of [mockPrisma, mockTx]) {
      expect(client.ctosReport.findUnique).not.toHaveBeenCalled();
      expect(client.ctosReport.findFirst).not.toHaveBeenCalled();
      expect(client.ctosReport.findMany).not.toHaveBeenCalled();
    }
    expect(mockPrisma.applicationReview.findUnique).toHaveBeenCalledWith({
      where: { application_id_section: { application_id: "app_1", section: "financial" } },
      select: { status: true, approved_snapshot: true },
    });
  });

  it.each([
    ["no Financial review row", null],
    ["a reopened Financial review with a leftover snapshot", "PENDING"],
    ["an APPROVED review whose snapshot does not parse", "APPROVED_MALFORMED"],
  ])("rejects with FINANCIAL_APPROVED_RESULT_REQUIRED for %s", async (_label, state) => {
    if (state === null) {
      mockPrisma.applicationReview.findUnique.mockResolvedValue(null);
    } else if (state === "PENDING") {
      mockPrisma.applicationReview.findUnique.mockResolvedValue({
        status: ReviewStepStatus.PENDING,
        approved_snapshot: approvedResult(),
      });
    } else {
      mockApprovedReviewRow({ ...approvedResult(), version: 99 });
    }

    await expect(createFromInvoiceSource()).rejects.toMatchObject({
      statusCode: 409,
      code: "FINANCIAL_APPROVED_RESULT_REQUIRED",
    });
    expect(mockLoadApproved).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockTx.note.create).not.toHaveBeenCalled();
  });

  it("keeps existing validation errors ahead of the missing approved result", async () => {
    mockPrisma.applicationReview.findUnique.mockResolvedValue(null);

    await expect(
      createFromInvoiceSource({
        application: application({ financing_type: { product_name: "No code" } }),
      })
    ).rejects.toMatchObject({ statusCode: 422, code: "PRODUCT_CODE_REQUIRED" });
    expect(mockLoadApproved).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns an existing Note for the same source without loading the approved result", async () => {
    mockNoteRepository.findBySource.mockResolvedValue({
      id: "note_old",
      note_reference: "NOTE-20250512-A1B2C3D4",
      status: NoteStatus.DRAFT,
    });

    await expect(createFromInvoiceSource()).resolves.toEqual({
      id: "note_old",
      noteReference: "NOTE-20250512-A1B2C3D4",
    });
    expect(mockLoadApproved).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
