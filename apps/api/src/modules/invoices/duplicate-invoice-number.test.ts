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
    findMany: jest.fn(),
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
  invoice: {
    findMany: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { InvoiceService } from "./service";
import { AppError } from "../../lib/http/error-handler";
import { InvoiceStatus } from "@cashsouk/types";

describe("InvoiceService duplicate invoice numbers on a facility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.$queryRaw.mockReset();
    mockTx.application.findUnique.mockReset();
    mockTx.invoice.count.mockReset();
    mockTx.invoice.create.mockReset();
    mockTx.invoice.update.mockReset();
    mockTx.invoice.findUniqueOrThrow.mockReset();
    mockTx.invoice.findMany.mockReset();
    mockPrisma.invoice.findMany.mockReset();

    mockTx.$queryRaw.mockResolvedValue([
      { financing_structure: { structure_type: "existing_contract" } },
    ]);
    mockTx.invoice.count.mockResolvedValue(0);
    mockTx.application.findUnique.mockResolvedValue({
      id: "app_1",
      financing_type: { product_id: "prod_1", product_code: "ARF" },
      product_version: 1,
    });
    mockTx.invoice.create.mockResolvedValue({
      id: "inv_new",
      created_at: new Date("2026-08-10T01:00:00.000Z"),
    });
    mockTx.invoice.update.mockResolvedValue({});
    mockTx.invoice.findUniqueOrThrow.mockResolvedValue({
      id: "inv_new",
      display_reference: "INV-ARF-202608-0N5",
      details: { number: "INV-100" },
    });
    mockTx.displayReferenceAllocation.create.mockResolvedValue({});
    mockTx.displayReferenceAllocation.findUnique.mockResolvedValue(null);
    mockTx.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
  });

  it("throws DUPLICATE_INVOICE_NUMBER on create when another non-withdrawn invoice on the facility has the same number", async () => {
    mockTx.invoice.findMany.mockResolvedValue([
      { id: "inv_other", details: { number: " INV-100 " } },
    ]);

    const service = new InvoiceService();
    (service as any).verifyApplicationAccess = jest.fn(async () => ({ id: "app_1" }));
    (service as any).loadWorkflowForApplication = jest.fn(async () => null);

    await expect(
      service.createInvoice(
        "app_1",
        "con_1",
        { number: "INV-100", value: 5000 },
        "user_1"
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "DUPLICATE_INVOICE_NUMBER",
      message: "An invoice with this number already exists on this facility.",
    } satisfies Partial<AppError>);

    expect(mockTx.invoice.create).not.toHaveBeenCalled();
  });

  it("skips the duplicate check on create when there is no contract_id", async () => {
    mockTx.invoice.findMany.mockResolvedValue([
      { id: "inv_other", details: { number: "INV-100" } },
    ]);

    const service = new InvoiceService();
    (service as any).verifyApplicationAccess = jest.fn(async () => ({ id: "app_1" }));
    (service as any).loadWorkflowForApplication = jest.fn(async () => null);

    await service.createInvoice(
      "app_1",
      undefined,
      { number: "INV-100", value: 5000 },
      "user_1"
    );

    expect(mockTx.invoice.findMany).not.toHaveBeenCalled();
    expect(mockTx.invoice.create).toHaveBeenCalled();
  });

  it("throws DUPLICATE_INVOICE_NUMBER on update when another invoice on the facility has the same number", async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: "inv_other", details: { number: "INV-200" } },
    ]);

    const service = new InvoiceService();
    (service as any).verifyInvoiceAccess = jest.fn(async () => ({
      id: "inv_1",
      status: InvoiceStatus.DRAFT,
      application_id: "app_1",
      contract_id: "con_1",
      details: { number: "INV-100", value: 1000 },
    }));
    (service as any).loadWorkflowForApplication = jest.fn(async () => null);
    (service as any).applicationRepository.findById = jest.fn(async () => ({
      id: "app_1",
      status: "DRAFT",
    }));

    await expect(
      service.updateInvoice(
        "inv_1",
        { details: { number: "INV-200" } },
        "user_1"
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "DUPLICATE_INVOICE_NUMBER",
    } satisfies Partial<AppError>);
  });

  it("ignores withdrawn invoices when checking duplicate numbers on update", async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const service = new InvoiceService();
    (service as any).verifyInvoiceAccess = jest.fn(async () => ({
      id: "inv_1",
      status: InvoiceStatus.DRAFT,
      application_id: "app_1",
      contract_id: "con_1",
      details: { number: "INV-100", value: 1000 },
    }));
    (service as any).loadWorkflowForApplication = jest.fn(async () => null);
    (service as any).applicationRepository.findById = jest.fn(async () => ({
      id: "app_1",
      status: "DRAFT",
    }));
    (service as any).repository.update = jest.fn(async () => ({
      id: "inv_1",
      details: { number: "INV-200" },
    }));
    (service as any).refreshLinkedContractFacilities = jest.fn(async () => undefined);

    await service.updateInvoice(
      "inv_1",
      { details: { number: "INV-200" } },
      "user_1"
    );

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contract_id: "con_1",
          status: { not: InvoiceStatus.WITHDRAWN },
          id: { not: "inv_1" },
        }),
      })
    );
    expect((service as any).repository.update).toHaveBeenCalled();
  });
});
