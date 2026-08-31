const mockTx: any = {
  application: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  applicationLog: {
    create: jest.fn(),
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
    mockTx.applicationLog.create.mockReset();
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
    mockTx.application.update.mockResolvedValue({});
    mockTx.application.findUnique.mockResolvedValue({
      display_reference: "APP-ARF-202608-A82",
    });
    mockTx.application.findUniqueOrThrow.mockResolvedValue({
      id: "app_1",
      display_reference: "APP-ARF-202608-A82",
    });
    mockTx.applicationLog.create.mockResolvedValue({ id: "log_1" });
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
          financing_type: { product_id: "prod_1", product_code: "ARF", split_origination: true },
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
    expect(mockTx.applicationLog.create).toHaveBeenCalledTimes(1);
    expect(mockTx.applicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: "APPLICATION_CREATED",
          user_id: "user_1",
          application_id: "app_1",
          portal: "ISSUER",
          review_cycle: 1,
        }),
      })
    );
  });

  it("writes APPLICATION_CREATED on the same transaction client with the real issuer actor", async () => {
    const service = new ApplicationService();
    (service as any).productRepository = {
      findById: jest.fn(async () => ({
        id: "prod_1",
        version: 3,
        status: ProductStatus.ACTIVE,
        product_code: "ARF",
      })),
    };

    await service.createApplication(
      { issuerOrganizationId: "org_1", productId: "prod_1" },
      "user_1",
      {
        ipAddress: "203.0.113.10",
        userAgent: "issuer-portal",
        context: {
          actorType: "USER",
          actorUserId: "user_1",
          source: "API",
          portal: "ISSUER",
          ipAddress: "203.0.113.10",
          userAgent: "issuer-portal",
          correlationId: "corr-create-1",
        },
      }
    );

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.application.create).toHaveBeenCalledTimes(1);
    expect(mockTx.applicationLog.create).toHaveBeenCalledTimes(1);
    expect(mockTx.applicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: "APPLICATION_CREATED",
          user_id: "user_1",
          application_id: "app_1",
          portal: "ISSUER",
          actor_type: "USER",
          source: "API",
          correlation_id: "corr-create-1",
          ip_address: "203.0.113.10",
          user_agent: "issuer-portal",
        }),
      })
    );
  });

  it("rolls back draft creation when APPLICATION_CREATED insert fails", async () => {
    const service = new ApplicationService();
    (service as any).productRepository = {
      findById: jest.fn(async () => ({
        id: "prod_1",
        version: 3,
        status: ProductStatus.ACTIVE,
        product_code: "ARF",
      })),
    };
    mockTx.applicationLog.create.mockRejectedValue(new Error("timeline insert failed"));

    await expect(
      service.createApplication({ issuerOrganizationId: "org_1", productId: "prod_1" }, "user_1")
    ).rejects.toThrow("timeline insert failed");
    expect(mockTx.application.findUniqueOrThrow).not.toHaveBeenCalled();
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
