const mockNoteRepository = {
  findBySource: jest.fn(),
};

const mockTx: any = {
  $queryRaw: jest.fn(async () => []),
  contract: { findUnique: jest.fn() },
  note: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
  notePaymentSchedule: { create: jest.fn() },
  noteEvent: { create: jest.fn() },
  displayReferenceAllocation: { create: jest.fn(), findUnique: jest.fn() },
};

const mockPrisma: any = {
  invoice: { findUnique: jest.fn() },
  application: { findUnique: jest.fn() },
  applicationReview: { findUnique: jest.fn() },
  ctosReport: { findFirst: jest.fn() },
  note: { findMany: jest.fn() },
  product: { findUnique: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn(async (cb: any) => cb(mockTx)),
};

jest.mock("../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

jest.mock("./repository", () => ({
  noteRepository: mockNoteRepository,
  noteInclude: {},
}));

jest.mock("./mapper", () => ({
  mapLedgerEntry: jest.fn(),
  mapMarketplaceNoteDetail: jest.fn(),
  mapNoteListItem: jest.fn(),
  mapWithdrawalInstruction: jest.fn(),
  resolveIssuerResidualPayoutListStatus: jest.fn(),
  resolveProductNameFromWorkflow: jest.fn(() => null),
  mapNoteDetail: jest.fn((note: { id: string }) => ({ id: note.id })),
}));

import { ApplicationStatus, InvoiceStatus, NoteStatus } from "@prisma/client";
import { NoteService } from "./service";
import { parseNoteFinancialSnapshot } from "./note-financial-snapshot.types";

type ReviewRow = { section: string; status: string };

const actor = { userId: "admin-1", role: "ADMIN", portal: "ADMIN" } as const;

const workflow = (stepIds: string[]) => stepIds.map((id) => ({ id }));

const CONTRACT_WORKFLOW = workflow([
  "financing_type_1",
  "financing_structure_1",
  "contract_details_1",
  "invoice_details_1",
  "company_details_1",
  "business_details_1",
  "financial_statements_1",
  "supporting_documents_1",
  "declarations_1",
]);

const CONTRACT_SECTIONS = [
  "financial",
  "company_details",
  "business_details",
  "supporting_documents",
  "contract_details",
  "invoice_details",
];

const financialStatements = {
  questionnaire: { last_closing_date: "2025-12-31" },
  unaudited_by_year: { "2025": { pl_revenue: "1200000" } },
  admin_input_by_year: { "2024": { pl_revenue: "900000" } },
  admin_field_overrides: { "2025": { pl_revenue: { value: "1250000" } } },
};

const submittedAt = new Date("2026-05-01T02:00:00.000Z");

function approvedRows(sections: string[]): ReviewRow[] {
  return sections.map((section) => ({ section, status: "APPROVED" }));
}

function withStatus(rows: ReviewRow[], section: string, status: string): ReviewRow[] {
  return rows.map((row) => (row.section === section ? { ...row, status } : row));
}

function buildApplication(structureType: string, financingType: Record<string, unknown>) {
  return {
    id: "app-1",
    status: ApplicationStatus.COMPLETED,
    issuer_organization_id: "org-1",
    contract_id: "con-1",
    product_version: 2,
    financing_type: financingType,
    financing_structure: { structure_type: structureType },
    business_details: null,
    issuer_organization: {
      id: "org-1",
      name: "Issuer Co",
      type: "COMPANY",
      registration_number: "123",
      country: "MY",
      corporate_onboarding_data: null,
    },
    contract: {
      id: "con-1",
      status: "APPROVED",
      contract_details: { financing: 10000 },
      offer_details: null,
      customer_details: null,
    },
  };
}

function buildInvoice(status: InvoiceStatus = InvoiceStatus.APPROVED) {
  return {
    id: "inv-1",
    application_id: "app-1",
    contract_id: "con-1",
    display_reference: "INV-REF-1",
    details: { number: "INV-1", value: 12500 },
    offer_details: {
      offered_amount: 10000,
      offered_profit_rate_percent: 10,
      financing_tenure_days: 90,
    },
    status,
  };
}

/** Arrange DB state read by the creation guard and the snapshot builder. */
function arrange(input: {
  applicationStatus?: ApplicationStatus;
  structureType?: string;
  financingType?: Record<string, unknown>;
  productWorkflow?: unknown[] | null;
  reviews: ReviewRow[];
}) {
  const structureType = input.structureType ?? "new_contract";
  const financingType = input.financingType ?? { product_id: "prod-1", product_code: "ARF" };
  const application = buildApplication(structureType, financingType);
  const invoice = buildInvoice();
  mockPrisma.invoice.findUnique.mockResolvedValue({
    ...invoice,
    application,
    contract: application.contract,
  });

  const productWorkflow = input.productWorkflow === undefined ? CONTRACT_WORKFLOW : input.productWorkflow;
  mockPrisma.product.findUnique.mockResolvedValue(
    productWorkflow
      ? {
          id: "prod-1",
          base_id: null,
          version: 2,
          status: "ACTIVE",
          workflow: productWorkflow,
          service_fee_rate_percent: { toNumber: () => 15 },
          product_code: "ARF",
        }
      : null
  );

  mockPrisma.application.findUnique.mockImplementation(
    async (args: { select?: Record<string, unknown> }) => {
      if (args.select?.application_reviews) {
        return {
          status: input.applicationStatus ?? ApplicationStatus.COMPLETED,
          financing_type: financingType,
          financing_structure: { structure_type: structureType },
          product_version: 2,
          application_reviews: input.reviews,
        };
      }
      // Financial snapshot read (runs before the Note transaction).
      if (args.select?.financial_statements) {
        return {
          id: "app-1",
          issuer_organization_id: "org-1",
          submitted_at: submittedAt,
          review_cycle: 3,
          financial_statements: financialStatements,
        };
      }
      return { ...application, invoices: [invoice] };
    }
  );
  mockPrisma.applicationReview.findUnique.mockResolvedValue({
    status: "APPROVED",
    reviewed_at: new Date("2026-05-10T03:00:00.000Z"),
    reviewer_user_id: "admin-reviewer-1",
  });
  mockPrisma.ctosReport.findFirst.mockResolvedValue({
    id: "ctos-1",
    fetched_at: new Date("2026-04-20T01:00:00.000Z"),
    financials_json: [{ financial_year: 2024, pl_revenue: 880000 }],
  });
}

function expectNothingWritten() {
  expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  expect(mockTx.displayReferenceAllocation.create).not.toHaveBeenCalled();
  expect(mockTx.note.create).not.toHaveBeenCalled();
  expect(mockTx.noteEvent.create).not.toHaveBeenCalled();
  expect(mockTx.notePaymentSchedule.create).not.toHaveBeenCalled();
}

describe("Note creation review guards and financial snapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNoteRepository.findBySource.mockResolvedValue(null);
    mockPrisma.note.findMany.mockResolvedValue([]);
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockTx.$queryRaw.mockResolvedValue([]);
    mockTx.contract.findUnique.mockResolvedValue({
      contract_details: { financing: 10000, facility_enabled: true },
    });
    mockTx.note.create.mockImplementation(async (args: { data: { id: string } }) => ({
      id: args.data.id,
      target_amount: { toNumber: () => 10000 },
      profit_rate_percent: { toNumber: () => 10 },
      status: NoteStatus.DRAFT,
    }));
    mockTx.note.findUniqueOrThrow.mockImplementation(async (args: { where: { id: string } }) => ({
      id: args.where.id,
    }));
    mockTx.notePaymentSchedule.create.mockResolvedValue({});
    mockTx.noteEvent.create.mockResolvedValue({});
    mockTx.displayReferenceAllocation.create.mockResolvedValue({});
    mockTx.displayReferenceAllocation.findUnique.mockResolvedValue(null);
  });

  it("refuses createFromInvoice when the invoice is approved but the application is not completed", async () => {
    arrange({
      applicationStatus: ApplicationStatus.INVOICE_PENDING,
      reviews: approvedRows(CONTRACT_SECTIONS),
    });

    await expect(new NoteService().createFromInvoice("inv-1", {}, actor)).rejects.toMatchObject({
      statusCode: 409,
      code: "APPLICATION_NOT_COMPLETED",
      message: "Only completed applications can become notes",
    });
    expectNothingWritten();
  });

  it("refuses createFromInvoice when the invoice is not approved", async () => {
    arrange({ reviews: approvedRows(CONTRACT_SECTIONS) });
    mockPrisma.invoice.findUnique.mockResolvedValue({
      ...buildInvoice(InvoiceStatus.OFFER_SENT),
      application: buildApplication("new_contract", { product_id: "prod-1" }),
      contract: null,
    });

    await expect(new NoteService().createFromInvoice("inv-1", {}, actor)).rejects.toMatchObject({
      code: "INVOICE_NOT_APPROVED",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["createFromInvoice", (service: NoteService) => service.createFromInvoice("inv-1", {}, actor)],
    [
      "createFromApplication",
      (service: NoteService) => service.createFromApplication("app-1", {}, actor),
    ],
  ])("%s refuses when Financial review is not approved", async (_path, create) => {
    arrange({ reviews: withStatus(approvedRows(CONTRACT_SECTIONS), "financial", "PENDING") });

    await expect(create(new NoteService())).rejects.toMatchObject({
      statusCode: 409,
      code: "REVIEW_SECTIONS_NOT_APPROVED",
      message: "All required review sections must be approved before creating a note.",
      details: { sections: ["financial"] },
    });
    expectNothingWritten();
  });

  it("refuses when a non-Financial required section is not approved or has no review row", async () => {
    const reviews = withStatus(
      approvedRows(CONTRACT_SECTIONS),
      "supporting_documents",
      "AMENDMENT_REQUESTED"
    ).filter((row) => row.section !== "business_details");
    arrange({ reviews });

    await expect(new NoteService().createFromInvoice("inv-1", {}, actor)).rejects.toMatchObject({
      code: "REVIEW_SECTIONS_NOT_APPROVED",
      details: { sections: ["business_details", "supporting_documents"] },
    });
    expectNothingWritten();
  });

  it("creates the Note with a financial snapshot when every required section is approved", async () => {
    arrange({ reviews: approvedRows(CONTRACT_SECTIONS) });

    const result = await new NoteService().createFromInvoice("inv-1", {}, actor);

    expect(mockTx.note.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: expect.any(String) });
    const data = mockTx.note.create.mock.calls[0][0].data;
    const snapshot = parseNoteFinancialSnapshot(data.financial_snapshot);
    expect(snapshot).not.toBeNull();
    expect(snapshot).toEqual({
      version: 1,
      captured_at: data.created_at.toISOString(),
      reference_date: submittedAt.toISOString(),
      financial_statements: financialStatements,
      ctos: {
        report_id: "ctos-1",
        fetched_at: "2026-04-20T01:00:00.000Z",
        financials: [{ financial_year: 2024, pl_revenue: 880000 }],
      },
      source: {
        application_id: "app-1",
        review_cycle: 3,
        application_submitted_at: submittedAt.toISOString(),
        financial_review: {
          status: "APPROVED",
          reviewed_at: "2026-05-10T03:00:00.000Z",
          reviewer_user_id: "admin-reviewer-1",
        },
      },
    });
    expect(mockPrisma.ctosReport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          issuer_organization_id: "org-1",
          fetched_at: { lte: submittedAt },
        }),
      })
    );
  });

  it("creates the Note from createFromApplication when every required section is approved", async () => {
    arrange({ reviews: approvedRows(CONTRACT_SECTIONS) });

    await new NoteService().createFromApplication("app-1", {}, actor);

    expect(mockTx.note.create).toHaveBeenCalledTimes(1);
    expect(
      parseNoteFinancialSnapshot(mockTx.note.create.mock.calls[0][0].data.financial_snapshot)
    ).not.toBeNull();
  });

  it("does not refuse an existing_contract application whose facility was approved on a prior application", async () => {
    arrange({
      structureType: "existing_contract",
      reviews: approvedRows(CONTRACT_SECTIONS.filter((section) => section !== "contract_details")),
    });

    await new NoteService().createFromInvoice("inv-1", {}, actor);

    expect(mockTx.note.create).toHaveBeenCalledTimes(1);
  });

  it("does not refuse an existing_contract application whose facility row on this application is still pending", async () => {
    arrange({
      structureType: "existing_contract",
      reviews: withStatus(approvedRows(CONTRACT_SECTIONS), "contract_details", "PENDING"),
    });

    await new NoteService().createFromInvoice("inv-1", {}, actor);

    expect(mockTx.note.create).toHaveBeenCalledTimes(1);
  });

  it("still refuses an existing_contract application with its own sections unapproved", async () => {
    arrange({
      structureType: "existing_contract",
      reviews: withStatus(
        approvedRows(CONTRACT_SECTIONS.filter((section) => section !== "contract_details")),
        "invoice_details",
        "PENDING"
      ),
    });

    await expect(new NoteService().createFromInvoice("inv-1", {}, actor)).rejects.toMatchObject({
      code: "REVIEW_SECTIONS_NOT_APPROVED",
      details: { sections: ["invoice_details"] },
    });
    expectNothingWritten();
  });

  it("treats inherited Facility and Acceptance as approved when the existing_contract policy falls back to every section", async () => {
    arrange({
      structureType: "existing_contract",
      financingType: { product_code: "ARF" },
      productWorkflow: null,
      reviews: approvedRows(
        CONTRACT_SECTIONS.filter((section) => section !== "contract_details")
      ),
    });

    await new NoteService().createFromInvoice("inv-1", {}, actor);

    expect(mockTx.note.create).toHaveBeenCalledTimes(1);
  });

  it("requires Acceptance on a non-inherited application when the policy falls back to every section", async () => {
    arrange({
      structureType: "new_contract",
      financingType: { product_code: "ARF" },
      productWorkflow: null,
      reviews: approvedRows(CONTRACT_SECTIONS),
    });

    await expect(new NoteService().createFromInvoice("inv-1", {}, actor)).rejects.toMatchObject({
      code: "REVIEW_SECTIONS_NOT_APPROVED",
      details: { sections: ["acceptance_documents"] },
    });
    expectNothingWritten();
  });

  it("only requires the sections in the frozen product workflow", async () => {
    arrange({
      structureType: "invoice_only",
      productWorkflow: workflow([
        "financing_type_1",
        "financing_structure_1",
        "invoice_details_1",
        "company_details_1",
        "financial_statements_1",
        "declarations_1",
      ]),
      reviews: approvedRows(["financial", "company_details", "invoice_details"]),
    });

    await new NoteService().createFromInvoice("inv-1", {}, actor);

    expect(mockTx.note.create).toHaveBeenCalledTimes(1);
  });
});
