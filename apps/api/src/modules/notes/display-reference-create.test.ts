const mockNoteRepository = {
  findBySource: jest.fn(),
};

const mockTx: any = {
  $queryRaw: jest.fn(async () => []),
  contract: {
    findUnique: jest.fn(),
  },
  note: {
    create: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  notePaymentSchedule: {
    create: jest.fn(),
  },
  noteEvent: {
    create: jest.fn().mockResolvedValue({}),
  },
  displayReferenceAllocation: {
    create: jest.fn(),
    findUnique: jest.fn(),
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
import { AppError } from "../../lib/http/error-handler";
import { NoteService } from "./service";

describe("NoteService createFromInvoiceSource display reference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNoteRepository.findBySource.mockReset();
    mockPrisma.product.findUnique.mockReset();
    mockPrisma.$transaction.mockClear();
    mockTx.$queryRaw.mockReset();
    mockTx.$queryRaw.mockResolvedValue([]);
    mockTx.contract.findUnique.mockReset();
    mockTx.contract.findUnique.mockResolvedValue({
      contract_details: { financing: 10000, facility_enabled: true },
    });
    mockTx.note.create.mockReset();
    mockTx.note.update.mockReset();
    mockTx.note.findUniqueOrThrow.mockReset();
    mockTx.notePaymentSchedule.create.mockReset();
    mockTx.noteEvent.create.mockReset();
    mockTx.noteEvent.create.mockResolvedValue({});
    mockTx.displayReferenceAllocation.create.mockReset();
    mockTx.displayReferenceAllocation.findUnique.mockReset();

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
        details: { number: "INV-556728", value: 12500, maturity_date: "2026-12-10" },
        offer_details: { offered_amount: 10000, offered_profit_rate_percent: 10, financing_tenure_days: 90 },
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
          note_reference: expect.stringMatching(/^NOTE-ARF-\d{6}-[A-Z0-9]{3}$/),
        }),
      })
    );
    expect(mockTx.note.update).not.toHaveBeenCalled();
    expect(result.noteReference).toBe("NOTE-ARF-202608-BX5");
  });

  it("keeps the holder snapshot but creates standalone notes without a source facility", async () => {
    mockNoteRepository.findBySource.mockResolvedValue(null);
    const service = new NoteService();

    await (service as any).createFromInvoiceSource({
      application: {
        id: "app_1",
        issuer_organization_id: "org_1",
        contract_id: "holder_1",
        product_version: 2,
        financing_type: { product_id: "prod_1", product_code: "ARF" },
        financing_structure: { structure_type: "invoice_only" },
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
        contract_id: null,
        details: { number: "INV-556728", value: 12500, maturity_date: "2026-12-10" },
        offer_details: {
          offered_amount: 10000,
          offered_profit_rate_percent: 10,
          financing_tenure_days: 90,
        },
        status: InvoiceStatus.APPROVED,
      },
      sourceContract: {
        id: "holder_1",
        status: "SUBMITTED",
        contract_details: null,
        offer_details: null,
        customer_details: { name: "Customer Co" },
      },
      actor: { userId: "admin_1", role: "ADMIN", portal: "ADMIN" },
    });

    expect(mockTx.contract.findUnique).not.toHaveBeenCalled();
    expect(mockTx.note.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source_contract_id: null,
          contract_snapshot: expect.objectContaining({ id: "holder_1" }),
        }),
      })
    );
  });

  it("copies frozen offer tenure, leaves maturity null, and keeps invoice due in the snapshot", async () => {
    mockNoteRepository.findBySource.mockResolvedValue(null);
    const service = new NoteService();

    await (service as any).createFromInvoiceSource({
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
        details: { number: "INV-556728", value: 12500, maturity_date: "2026-12-10" },
        offer_details: {
          offered_amount: 10000,
          offered_profit_rate_percent: 10,
          financing_tenure_days: 90,
        },
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

    expect(mockTx.note.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenure_days: 90,
          maturity_date: null,
          invoice_snapshot: expect.objectContaining({
            details: expect.objectContaining({ maturity_date: "2026-12-10" }),
          }),
        }),
      })
    );
    expect(mockTx.notePaymentSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          due_date: null,
        }),
      })
    );
  });

  it("falls back to invoice.details tenure when offer tenure is missing", async () => {
    mockNoteRepository.findBySource.mockResolvedValue(null);
    const service = new NoteService();

    await (service as any).createFromInvoiceSource({
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
        details: {
          number: "INV-556728",
          value: 12500,
          maturity_date: "2026-12-10",
          financing_tenure_days: 105,
        },
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

    expect(mockTx.note.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenure_days: 105,
          maturity_date: null,
        }),
      })
    );
  });

  it("rejects creating a note when financing tenure is missing", async () => {
    mockNoteRepository.findBySource.mockResolvedValue(null);
    const service = new NoteService();

    await expect(
      (service as any).createFromInvoiceSource({
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
          details: { number: "INV-556728", value: 12500, maturity_date: "2026-12-10" },
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
      })
    ).rejects.toMatchObject({ code: "FINANCING_TENURE_REQUIRED" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
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
        details: { number: "INV-556728", value: 12500, maturity_date: "2026-12-10" },
        offer_details: { offered_amount: 10000, offered_profit_rate_percent: 10, financing_tenure_days: 90 },
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
  });

  it("rejects creating a note from a disabled facility", async () => {
    mockNoteRepository.findBySource.mockResolvedValue(null);
    mockTx.contract.findUnique.mockResolvedValue({
      contract_details: { facility_enabled: false, facility_disabled_reason: "Paused" },
    });
    const service = new NoteService();

    await expect(
      (service as any).createFromInvoiceSource({
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
          details: { number: "INV-556728", value: 12500, maturity_date: "2026-12-10" },
          offer_details: { offered_amount: 10000, offered_profit_rate_percent: 10, financing_tenure_days: 90 },
          status: InvoiceStatus.APPROVED,
        },
        sourceContract: {
          id: "con_1",
          status: "APPROVED",
          contract_details: { financing: 10000, facility_enabled: false },
          offer_details: null,
          customer_details: null,
        },
        actor: { userId: "admin_1", role: "ADMIN", portal: "ADMIN" },
      })
    ).rejects.toMatchObject({ code: "FACILITY_DISABLED" } satisfies Partial<AppError>);
    expect(mockTx.note.create).not.toHaveBeenCalled();
  });
});
