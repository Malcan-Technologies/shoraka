const mockTx: any = {
  $queryRaw: jest.fn(),
  product: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  displayReferenceAllocation: {
    findFirst: jest.fn(),
  },
  productLog: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  productAuditLog: {
    create: jest.fn(),
    deleteMany: jest.fn(),
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

import { ProductRepository } from "./repository";

function baseCurrentProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod_v1",
    base_id: "base_1",
    version: 1,
    status: "ACTIVE",
    workflow: [{ name: "Financing type", config: { category: "ARF", name: "ARF" } }],
    marketplace_listing_duration_days: 14,
    service_fee_rate_percent: { toNumber: () => 15 },
    default_facility_fee_rate_percent: { toNumber: () => 1 },
    created_at: new Date("2026-08-01T00:00:00.000Z"),
    updated_at: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("ProductRepository product_code foundation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.$queryRaw.mockReset();
    mockTx.product.findMany.mockReset();
    mockTx.product.findFirst.mockReset();
    mockTx.product.create.mockReset();
    mockTx.product.update.mockReset();
    mockTx.product.updateMany.mockReset();
    mockTx.productLog.create.mockReset();
    mockTx.productAuditLog.create.mockReset();
    mockTx.displayReferenceAllocation.findFirst.mockReset();
    mockPrisma.product.findUnique.mockReset();

    mockTx.product.findMany.mockResolvedValue([]);
    mockTx.product.update.mockResolvedValue({});
    mockTx.product.findFirst.mockResolvedValue(null);
    mockTx.product.updateMany.mockResolvedValue({ count: 1 });
    mockTx.displayReferenceAllocation.findFirst.mockResolvedValue(null);
    mockTx.product.create.mockImplementation(async ({ data }: any) => ({
      id: "prod_v2",
      base_id: "base_1",
      version: data.version,
      status: "ACTIVE",
      workflow: data.workflow,
      product_code: data.product_code ?? null,
      category_display_order: 1,
      product_display_order: 1,
      created_at: new Date("2026-08-10T00:00:00.000Z"),
      updated_at: new Date("2026-08-10T00:00:00.000Z"),
    }));

    mockTx.$queryRaw.mockResolvedValue([{ max: 1 }]);
  });

  it("allows same product code across versions of the same family", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(
      baseCurrentProduct({ product_code: "ARF" })
    );
    mockTx.product.findMany
      .mockResolvedValueOnce([
        { id: "prod_v1", base_id: "base_1", product_code: "ARF" },
        { id: "prod_v0", base_id: "base_1", product_code: "ARF" },
      ])
      .mockResolvedValueOnce([
        { id: "prod_v1", base_id: "base_1" },
        { id: "prod_v0", base_id: "base_1" },
      ]);

    const repo = new ProductRepository();
    const result = await repo.update("prod_v1", {
      workflow: [{ name: "Financing type", config: { category: "ARF", name: "ARF Updated" } }],
      product_code: "ARF",
    });

    expect(result.product_code).toBe("ARF");
  });

  it("allows A(v1=null), B(v2->A), C(v3->A) family to keep ARF", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(
      baseCurrentProduct({ base_id: "A", product_code: "ARF" })
    );
    mockTx.product.findMany.mockResolvedValueOnce([
      { id: "A", base_id: null, product_code: "ARF" },
      { id: "B", base_id: "A", product_code: "ARF" },
      { id: "C", base_id: "A", product_code: "ARF" },
    ]);

    const repo = new ProductRepository();
    const result = await repo.update("prod_v1", {
      workflow: [{ name: "Financing type", config: { category: "ARF", name: "ARF v4" } }],
    });
    expect(result.product_code).toBe("ARF");
  });

  it("rejects new version when requested code differs from existing family code", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(
      baseCurrentProduct({ product_code: "ARF" })
    );
    mockTx.product.findMany.mockResolvedValueOnce([
      { id: "A", base_id: null, product_code: "ARF" },
      { id: "B", base_id: "A", product_code: "ARF" },
    ]);

    const repo = new ProductRepository();
    await expect(
      repo.update("prod_v1", {
        workflow: [{ name: "Financing type", config: { category: "ARF", name: "ARF v4" } }],
        product_code: "RCF",
      })
    ).rejects.toThrow("must use the existing family product code");
  });

  it("rejects other root family D from using ARF already owned by A-family", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(
      baseCurrentProduct({ base_id: "D", product_code: null })
    );
    mockTx.product.findMany
      // Current family D has no code yet.
      .mockResolvedValueOnce([
        { id: "D", base_id: null, product_code: null },
        { id: "E", base_id: "D", product_code: null },
      ])
      // ARF exists on family A elsewhere.
      .mockResolvedValueOnce([
        { id: "A", base_id: null, product_code: null },
        { id: "B", base_id: "A", product_code: null },
      ]);

    const repo = new ProductRepository();
    await expect(
      repo.update("prod_v1", {
        workflow: [{ name: "Financing type", config: { category: "RCF", name: "RCF v2" } }],
        product_code: "ARF",
      })
    ).rejects.toThrow("already used by another product family");
  });

  it("new version inherits family code when product_code omitted", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(
      baseCurrentProduct({ base_id: "A", product_code: "ARF" })
    );
    mockTx.product.findMany.mockResolvedValueOnce([
      { id: "A", base_id: null, product_code: "ARF" },
      { id: "B", base_id: "A", product_code: "ARF" },
    ]);

    const repo = new ProductRepository();
    const result = await repo.update("prod_v1", {
      workflow: [{ name: "Financing type", config: { category: "ARF", name: "ARF inherited v4" } }],
    });

    expect(result.product_code).toBe("ARF");
    expect(mockTx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          product_code: "ARF",
        }),
      })
    );
  });

  it("allows family code change before allocations via family edit path", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(
      baseCurrentProduct({ base_id: "A", product_code: "ARF" })
    );
    mockTx.product.findMany
      .mockResolvedValueOnce([
        { id: "A", base_id: null, product_code: "ARF" },
        { id: "B", base_id: "A", product_code: "ARF" },
      ])
      .mockResolvedValueOnce([]);
    mockTx.product.update.mockResolvedValueOnce(
      baseCurrentProduct({ product_code: "RCF" })
    );

    const repo = new ProductRepository();
    const result = await repo.update("prod_v1", {
      workflow: [{ name: "Financing type", config: { category: "ARF", name: "ARF edited" } }],
      completeCreate: true,
      product_code: "rcf",
    });

    expect(result.product_code).toBe("RCF");
    expect(mockTx.product.updateMany).toHaveBeenCalledWith({
      where: { OR: [{ id: "A" }, { base_id: "A" }] },
      data: { product_code: "RCF" },
    });
  });

  it("rejects family code change after allocations exist", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(
      baseCurrentProduct({ base_id: "A", product_code: "ARF" })
    );
    mockTx.product.findMany.mockResolvedValueOnce([
      { id: "A", base_id: null, product_code: "ARF" },
      { id: "B", base_id: "A", product_code: "ARF" },
    ]);
    mockTx.displayReferenceAllocation.findFirst.mockResolvedValueOnce({ id: "alloc_1" });

    const repo = new ProductRepository();
    await expect(
      repo.update("prod_v1", {
        workflow: [{ name: "Financing type", config: { category: "ARF", name: "ARF edited" } }],
        completeCreate: true,
        product_code: "RCF",
      })
    ).rejects.toThrow("cannot be changed after canonical references have been allocated");
  });

  it("rejects creating another root family with code already used by A-family", async () => {
    mockTx.product.findFirst.mockResolvedValueOnce({ id: "A" });
    const repo = new ProductRepository();

    await expect(
      repo.create({
        workflow: [{ name: "Financing type", config: { category: "Invoice", name: "D Root" } }],
        product_code: "ARF",
      })
    ).rejects.toThrow("already used by another product family");
  });
});
