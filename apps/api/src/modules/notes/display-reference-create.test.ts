const mockNoteRepository = {
  findBySource: jest.fn(),
};

const mockTx: any = {
  note: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  notePaymentSchedule: {
    create: jest.fn(),
  },
  displayReferenceAllocation: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  noteAuditLog: {
    create: jest.fn(),
  },
};

const mockPrisma: any = {
  product: {
    findUnique: jest.fn(),
  },
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
  mapNoteDetail: jest.fn((note: { note_reference: string | null }) => ({
    noteReference: note.note_reference,
  })),
}));

import { InvoiceStatus, NoteStatus } from "@prisma/client";
import { NoteService } from "./service";

describe("NoteService createFromInvoiceSource display reference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNoteRepository.findBySource.mockReset();
    mockPrisma.product.findUnique.mockReset();
    mockPrisma.$transaction.mockClear();
    mockTx.note.create.mockReset();
    mockTx.note.update.mockReset();
    mockTx.note.findUnique.mockReset();
    mockTx.note.findUniqueOrThrow.mockReset();
    mockTx.notePaymentSchedule.create.mockReset();
    mockTx.displayReferenceAllocation.create.mockReset();
    mockTx.displayReferenceAllocation.findUnique.mockReset();
    mockTx.user.findUnique.mockReset();
    mockTx.noteAuditLog.create.mockReset();

    mockPrisma.product.findUnique.mockResolvedValue({
      id: "prod_1",
      workflow: [],
      service_fee_rate_percent: { toNumber: () => 15 },
      product_code: "ARF",
    });
    mockTx.note.create.mockResolvedValue({
      id: "note_1",
      created_at: new Date("2026-08-10T01:00:00.000Z"),
      maturity_date: new Date("2026-12-10T00:00:00.000Z"),
      target_amount: { toNumber: () => 10000 },
      profit_rate_percent: { toNumber: () => 10 },
      note_reference: "NOTE-ARF-202608-BX5",
      status: NoteStatus.DRAFT,
    });
    mockTx.note.findUniqueOrThrow.mockResolvedValue({
      id: "note_1",
      note_reference: "NOTE-ARF-202608-BX5",
      status: NoteStatus.DRAFT,
      listing_status: "NOT_LISTED",
      funding_status: "NOT_OPEN",
      servicing_status: "NOT_SCHEDULED",
    });
    mockTx.notePaymentSchedule.create.mockResolvedValue({});
    mockTx.displayReferenceAllocation.create.mockResolvedValue({});
    mockTx.displayReferenceAllocation.findUnique.mockResolvedValue(null);
    mockTx.note.findUnique.mockResolvedValue({ issuer_organization_id: "org_1" });
    mockTx.user.findUnique.mockResolvedValue({
      email: "admin@example.com",
      first_name: "Admin",
      last_name: "User",
    });
    mockTx.noteAuditLog.create.mockResolvedValue({});
  });

  it("uses canonical NOTE reference for new note", async () => {
    mockNoteRepository.findBySource.mockResolvedValue(null);
    const service = new NoteService();

    const result = await (service as any).createFromInvoiceSource({
      application: {
        id: "app_1",
        issuer_organization_id: "org_1",
        contract_id: "con_1",
        product_version: 2,
        financing_type: { product_id: "prod_1", product_code: "ARF" },
        business_details: null,
        issuer_organization: {
          id: "org_1",
          name: "Issuer Co",
          type: "COMPANY",
          registration_number: "123",
          country: "MY",
          corporate_onboarding_data: null,
        },
      },
      invoice: {
        id: "inv_1",
        application_id: "app_1",
        contract_id: "con_1",
        details: { number: "INV-556728", value: 10000, maturity_date: "2026-12-10" },
        offer_details: { offered_amount: 10000, offered_profit_rate_percent: 10 },
        status: InvoiceStatus.APPROVED,
      },
      sourceContract: {
        id: "con_1",
        status: "APPROVED",
        contract_details: { financing: 10000 },
        offer_details: null,
        customer_details: null,
      },
      actor: { userId: "admin_1", role: "ADMIN", portal: "ADMIN" },
    });

    expect(mockTx.displayReferenceAllocation.create).toHaveBeenCalledTimes(1);
    expect(mockTx.note.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          note_reference: expect.stringMatching(/^NOTE-ARF-202608-[A-Z0-9]{3}$/),
        }),
      })
    );
    expect(mockTx.note.update).not.toHaveBeenCalled();
    expect(mockTx.noteAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: "NOTE_CREATED",
          note_id: "note_1",
        }),
      })
    );
    expect(result.noteReference).toBe("NOTE-ARF-202608-BX5");
  });

  it("keeps legacy note_reference when idempotent source note already exists", async () => {
    mockNoteRepository.findBySource.mockResolvedValue({
      id: "note_old",
      note_reference: "NOTE-20250512-A1B2C3D4",
      status: NoteStatus.DRAFT,
      listing_status: "NOT_LISTED",
      funding_status: "NOT_OPEN",
      servicing_status: "NOT_SCHEDULED",
    });
    const service = new NoteService();

    const result = await (service as any).createFromInvoiceSource({
      application: {
        id: "app_1",
        issuer_organization_id: "org_1",
        contract_id: "con_1",
        product_version: 2,
        financing_type: { product_id: "prod_1", product_code: "ARF" },
        business_details: null,
        issuer_organization: {
          id: "org_1",
          name: "Issuer Co",
          type: "COMPANY",
          registration_number: "123",
          country: "MY",
          corporate_onboarding_data: null,
        },
      },
      invoice: {
        id: "inv_1",
        application_id: "app_1",
        contract_id: "con_1",
        details: { number: "INV-556728", value: 10000, maturity_date: "2026-12-10" },
        offer_details: { offered_amount: 10000, offered_profit_rate_percent: 10 },
        status: InvoiceStatus.APPROVED,
      },
      sourceContract: {
        id: "con_1",
        status: "APPROVED",
        contract_details: { financing: 10000 },
        offer_details: null,
        customer_details: null,
      },
      actor: { userId: "admin_1", role: "ADMIN", portal: "ADMIN" },
    });

    expect(result.noteReference).toBe("NOTE-20250512-A1B2C3D4");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockTx.displayReferenceAllocation.create).not.toHaveBeenCalled();
    expect(mockTx.noteAuditLog.create).not.toHaveBeenCalled();
  });
});
