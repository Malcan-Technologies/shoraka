const mockTx: any = {
  $queryRaw: jest.fn(),
  application: {
    findUnique: jest.fn(),
  },
  invoice: {
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  displayReferenceAllocation: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
};

const mockPrisma: any = {
  $transaction: jest.fn(async (cb: any) => cb(mockTx)),
};

jest.mock("../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { InvoiceService } from "./service";

describe("InvoiceService createInvoice display reference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.$queryRaw.mockReset();
    mockTx.application.findUnique.mockReset();
    mockTx.invoice.count.mockReset();
    mockTx.invoice.create.mockReset();
    mockTx.invoice.update.mockReset();
    mockTx.invoice.findUniqueOrThrow.mockReset();
    mockTx.displayReferenceAllocation.create.mockReset();
    mockTx.displayReferenceAllocation.findUnique.mockReset();

    mockTx.$queryRaw.mockResolvedValue([{ financing_structure: { structure_type: "new_contract" } }]);
    mockTx.invoice.count.mockResolvedValue(0);
    mockTx.application.findUnique.mockResolvedValue({
      id: "app_1",
      financing_type: { product_id: "prod_1", product_code: "ARF" },
      product_version: 1,
    });
    mockTx.invoice.create.mockResolvedValue({
      id: "inv_1",
      created_at: new Date("2026-08-10T01:00:00.000Z"),
    });
    mockTx.invoice.update.mockResolvedValue({});
    mockTx.invoice.findUniqueOrThrow.mockResolvedValue({
      id: "inv_1",
      display_reference: "INV-ARF-202608-0N5",
      details: { number: "INV-556728" },
    });
    mockTx.displayReferenceAllocation.create.mockResolvedValue({});
    mockTx.displayReferenceAllocation.findUnique.mockResolvedValue(null);
  });

  it("allocates INV reference without changing invoice number", async () => {
    const service = new InvoiceService();
    (service as any).verifyApplicationAccess = jest.fn(async () => ({ id: "app_1" }));
    (service as any).loadWorkflowForApplication = jest.fn(async () => null);

    const result = await service.createInvoice(
      "app_1",
      "con_1",
      { number: "INV-556728", value: 10000 },
      "user_1"
    );

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: expect.objectContaining({ number: "INV-556728" }),
        }),
      })
    );
    expect(mockTx.displayReferenceAllocation.create).toHaveBeenCalledTimes(1);
    expect(mockTx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_1" },
        data: { display_reference: expect.stringMatching(/^INV-ARF-202608-[A-Z0-9]{3}$/) },
      })
    );
    expect(result.details.number).toBe("INV-556728");
    expect(result.display_reference).toBe("INV-ARF-202608-0N5");
  });
});
