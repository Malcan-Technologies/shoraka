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
import { AppError } from "../../lib/http/error-handler";

describe("InvoiceService createInvoice MAX_INVOICES_REACHED", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.$queryRaw.mockReset();
    mockTx.application.findUnique.mockReset();
    mockTx.invoice.count.mockReset();
    mockTx.invoice.create.mockReset();

    mockTx.application.findUnique.mockResolvedValue({
      id: "app_1",
      financing_type: { product_id: "prod_1", product_code: "ARF" },
      product_version: 1,
    });
  });

  it.each([
    ["new_contract"],
    ["existing_contract"],
    ["invoice_only"],
  ] as const)("throws MAX_INVOICES_REACHED for %s when application already has an invoice", async (structureType) => {
    mockTx.$queryRaw.mockResolvedValue([
      { financing_structure: { structure_type: structureType } },
    ]);
    mockTx.invoice.count.mockResolvedValue(1);

    const service = new InvoiceService();
    (service as any).verifyApplicationAccess = jest.fn(async () => ({ id: "app_1" }));
    (service as any).loadWorkflowForApplication = jest.fn(async () => null);

    await expect(
      service.createInvoice(
        "app_1",
        "con_1",
        { number: "INV-002", value: 5000 },
        "user_1"
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MAX_INVOICES_REACHED",
      message: "Applications allow only one invoice.",
    } satisfies Partial<AppError>);

    expect(mockTx.invoice.create).not.toHaveBeenCalled();
  });
});
