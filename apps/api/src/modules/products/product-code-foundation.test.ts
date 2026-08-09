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

  it("rejects using same code across different families", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(
      baseCurrentProduct({ product_code: "ARF" })
    );
    mockTx.product.findMany
      .mockResolvedValueOnce([
        { id: "prod_v1", base_id: "base_1", product_code: "ARF" },
      ])
      .mockResolvedValueOnce([
        { id: "other_v1", base_id: "other_base" },
      ]);

    const repo = new ProductRepository();
    await expect(
      repo.update("prod_v1", {
        workflow: [{ name: "Financing type", config: { category: "ARF", name: "ARF Updated" } }],
        product_code: "RCF",
      })
    ).rejects.toThrow("already used by another product family");
  });

  it("rejects product code change after allocations exist", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(
      baseCurrentProduct({ product_code: "ARF" })
    );
    mockTx.product.findMany.mockResolvedValueOnce([
      { id: "prod_v1", base_id: "base_1", product_code: "ARF" },
    ]);
    mockTx.displayReferenceAllocation.findFirst.mockResolvedValueOnce({ id: "alloc_1" });

    const repo = new ProductRepository();
    await expect(
      repo.update("prod_v1", {
        workflow: [{ name: "Financing type", config: { category: "ARF", name: "ARF Updated" } }],
        product_code: "RCF",
      })
    ).rejects.toThrow("cannot be changed after canonical references have been allocated");
  });

  it("allows product code change before allocations and syncs family", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(
      baseCurrentProduct({ product_code: "ARF" })
    );
    mockTx.product.findMany
      .mockResolvedValueOnce([
        { id: "prod_v1", base_id: "base_1", product_code: "ARF" },
        { id: "prod_v0", base_id: "base_1", product_code: "ARF" },
      ])
      .mockResolvedValueOnce([]);

    const repo = new ProductRepository();
    const result = await repo.update("prod_v1", {
      workflow: [{ name: "Financing type", config: { category: "ARF", name: "ARF Updated" } }],
      product_code: "rcf",
    });

    expect(mockTx.product.updateMany).toHaveBeenCalledWith({
      where: { OR: [{ id: "base_1" }, { base_id: "base_1" }] },
      data: { product_code: "RCF" },
    });
    expect(result.product_code).toBe("RCF");
  });

  it("allows non-code updates after allocations when code is unchanged", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(
      baseCurrentProduct({ product_code: "ARF" })
    );
    mockTx.product.findMany.mockResolvedValueOnce([
      { id: "prod_v1", base_id: "base_1", product_code: "ARF" },
      { id: "prod_v0", base_id: "base_1", product_code: "ARF" },
    ]);
    mockTx.displayReferenceAllocation.findFirst.mockResolvedValueOnce({ id: "alloc_1" });

    const repo = new ProductRepository();
    const result = await repo.update("prod_v1", {
      workflow: [{ name: "Financing type", config: { category: "ARF", name: "Renamed Product" } }],
    });

    expect(result.product_code).toBe("ARF");
  });

  it("new version inherits existing family product code when no override supplied", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(
      baseCurrentProduct({ product_code: "ARF" })
    );
    mockTx.product.findMany.mockResolvedValueOnce([
      { id: "prod_v1", base_id: "base_1", product_code: "ARF" },
      { id: "prod_v0", base_id: "base_1", product_code: "ARF" },
    ]);

    const repo = new ProductRepository();
    const result = await repo.update("prod_v1", {
      workflow: [{ name: "Financing type", config: { category: "ARF", name: "ARF Updated" } }],
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
});
