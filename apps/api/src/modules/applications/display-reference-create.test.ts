const mockTx: any = {
  application: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  applicationAuditLog: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
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
  product: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(async (cb: any) => cb(mockTx)),
};

jest.mock("../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

jest.mock("../legal-documents/acceptance-service", () => ({
  legalDocumentAcceptanceService: {
    assertNoPendingReacceptance: jest.fn(async () => undefined),
  },
}));

import { ProductStatus } from "@prisma/client";
import { ApplicationService } from "./service";

describe("ApplicationService createApplication display reference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.application.create.mockReset();
    mockTx.application.update.mockReset();
    mockTx.application.findUnique.mockReset();
    mockTx.application.findUniqueOrThrow.mockReset();
    mockTx.applicationAuditLog.create.mockReset();
    mockTx.user.findUnique.mockReset();
    mockTx.displayReferenceAllocation.create.mockReset();
    mockTx.displayReferenceAllocation.findUnique.mockReset();
    mockPrisma.product.findUnique.mockReset();
    mockPrisma.product.findFirst.mockReset();
    mockPrisma.$transaction.mockClear();

    mockTx.displayReferenceAllocation.findUnique.mockResolvedValue(null);
    mockPrisma.product.findUnique.mockResolvedValue({ id: "prod_1", base_id: "prod_1", product_code: "ARF" });
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockTx.application.create.mockResolvedValue({
      id: "app_1",
      created_at: new Date("2026-08-10T01:00:00.000Z"),
      display_reference: null,
    });
    mockTx.application.findUnique.mockResolvedValue({ issuer_organization_id: "org_1" });
    mockTx.user.findUnique.mockResolvedValue({
      user_id: "user_1",
      first_name: "Ada",
      last_name: "Admin",
      email: "ada@example.com",
    });
    mockTx.applicationAuditLog.create.mockResolvedValue({});
    mockTx.application.update.mockResolvedValue({});
    mockTx.application.findUniqueOrThrow.mockResolvedValue({
      id: "app_1",
      display_reference: "APP-ARF-202608-A82",
    });
    mockTx.displayReferenceAllocation.create.mockResolvedValue({});
  });

  it("creates APP reference atomically and snapshots product_code", async () => {
    const service = new ApplicationService();
    (service as any).productRepository = {
      findById: jest.fn(async () => ({
        id: "prod_1",
        version: 3,
        status: ProductStatus.ACTIVE,
        product_code: "ARF",
      })),
    };

    const result = await service.createApplication(
      { issuerOrganizationId: "org_1", productId: "prod_1" },
      "user_1"
    );

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          financing_type: { product_id: "prod_1", product_code: "ARF" },
        }),
      })
    );
    expect(mockTx.displayReferenceAllocation.create).toHaveBeenCalledTimes(1);
    expect(mockTx.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { display_reference: expect.stringMatching(/^APP-ARF-202608-[A-Z0-9]{3}$/) },
      })
    );
    expect(result.display_reference).toBe("APP-ARF-202608-A82");
  });

  it("rejects when selected product has no product_code", async () => {
    const service = new ApplicationService();
    (service as any).productRepository = {
      findById: jest.fn(async () => ({
        id: "prod_1",
        version: 3,
        status: ProductStatus.ACTIVE,
        product_code: null,
      })),
    };
    mockPrisma.product.findUnique.mockResolvedValueOnce({
      id: "prod_1",
      base_id: "prod_1",
      product_code: null,
    });
    mockPrisma.product.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createApplication({ issuerOrganizationId: "org_1", productId: "prod_1" }, "user_1")
    ).rejects.toThrow("Selected product is missing a canonical product code");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
