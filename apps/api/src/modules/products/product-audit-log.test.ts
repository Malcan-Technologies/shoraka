const mockTx: any = {
  $queryRaw: jest.fn(),
  product: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  displayReferenceAllocation: {
    findFirst: jest.fn(),
  },
  productAuditLog: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockPrisma: any = {
  $transaction: jest.fn(async (cb: any) => cb(mockTx)),
  product: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { ProductRepository } from "./repository";
import type { ProductAuditContext } from "./audit/context";
import * as fs from "fs";
import * as path from "path";

const auditContext: ProductAuditContext = {
  actorType: "ADMIN",
  actorUserId: "admin_user_1",
  organizationId: null,
  organizationKind: null,
  source: "API",
  portal: "ADMIN",
  ipAddress: "203.0.113.10",
  userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0",
  correlationId: "corr-1",
  idempotencyKey: null,
};

const workflowV1 = [
  { id: "financing_type_1", name: "Financing type", config: { category: "ARF", name: "Invoice Financing" } },
];
const workflowV2 = [
  { id: "financing_type_1", name: "Financing type", config: { category: "ARF", name: "Invoice Financing v2" } },
];

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod_v1",
    base_id: "prod_v1",
    version: 1,
    status: "ACTIVE",
    workflow: workflowV1,
    product_code: "ARF",
    marketplace_listing_duration_days: 14,
    service_fee_rate_percent: { toNumber: () => 15 },
    default_facility_fee_rate_percent: { toNumber: () => 1 },
    category_display_order: 1,
    product_display_order: 1,
    deleted_at: null,
    created_at: new Date("2026-08-01T00:00:00.000Z"),
    updated_at: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function auditRows() {
  return mockTx.productAuditLog.create.mock.calls.map((call: any) => call[0].data);
}

describe("ProductAuditLog writers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.$queryRaw.mockResolvedValue([{ max: 1 }]);
    mockTx.product.findMany.mockResolvedValue([]);
    mockTx.product.findFirst.mockResolvedValue(null);
    mockTx.product.updateMany.mockResolvedValue({ count: 1 });
    mockTx.product.delete.mockResolvedValue({});
    mockPrisma.product.delete.mockResolvedValue({});
    mockTx.productAuditLog.create.mockResolvedValue({ id: "audit_1" });
    mockTx.displayReferenceAllocation.findFirst.mockResolvedValue(null);
    mockPrisma.product.findMany.mockResolvedValue([
      { id: "prod_v1", base_id: "prod_v1", product_code: "ARF" },
    ]);
  });

  it("writes one PRODUCT_CREATED with identity metadata and no workflow dump", async () => {
    mockTx.$queryRaw
      .mockResolvedValueOnce([{ max: 5 }])
      .mockResolvedValueOnce([{ min: null }])
      .mockResolvedValueOnce([{ max: 1 }]);

    const created = productRow({
      id: "prod_new_1",
      base_id: null,
      product_code: "ARF",
      category_display_order: 2,
      product_display_order: 6,
    });
    mockTx.product.create.mockResolvedValueOnce(created);
    mockTx.product.update.mockResolvedValueOnce({
      ...created,
      base_id: "prod_new_1",
    });

    const repo = new ProductRepository();
    await repo.create(
      { workflow: workflowV1, product_code: "ARF" },
      auditContext
    );

    expect(mockTx.productAuditLog.create).toHaveBeenCalledTimes(1);
    const row = auditRows()[0];
    expect(row.event_type).toBe("PRODUCT_CREATED");
    expect(row.product_id).toBe("prod_new_1");
    expect(row.target_type).toBe("PRODUCT");
    expect(row.target_id).toBe("prod_new_1");
    expect(row.actor_type).toBe("ADMIN");
    expect(row.actor_user_id).toBe("admin_user_1");
    expect(row.source).toBe("API");
    expect(row.portal).toBe("ADMIN");
    expect(row.ip_address).toBe("203.0.113.10");
    expect(row.user_agent).toContain("Chrome/120");
    expect(row.metadata.productName).toBe("Invoice Financing");
    expect(row.metadata.baseId).toBe("prod_new_1");
    expect(row.metadata.version).toBe(1);
    expect(row.metadata.status).toBe("ACTIVE");
    expect(row.metadata.productCode).toBe("ARF");
    expect(row.metadata.workflow).toBeUndefined();
  });

  it("captures changed fields on in-place completeCreate update", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(productRow());
    mockTx.product.findMany.mockResolvedValueOnce([
      { id: "prod_v1", base_id: "prod_v1", product_code: "ARF" },
    ]);
    mockTx.product.update.mockResolvedValueOnce(
      productRow({
        workflow: workflowV2,
        marketplace_listing_duration_days: 30,
      })
    );

    const repo = new ProductRepository();
    await repo.update(
      "prod_v1",
      {
        workflow: workflowV2,
        completeCreate: true,
        marketplace_listing_duration_days: 30,
      },
      auditContext
    );

    expect(mockTx.productAuditLog.create).toHaveBeenCalledTimes(1);
    const row = auditRows()[0];
    expect(row.event_type).toBe("PRODUCT_UPDATED");
    expect(row.product_id).toBe("prod_v1");
    expect(row.metadata.version).toBe(1);
    expect(row.metadata.changedFields).toEqual(
      expect.arrayContaining(["marketplaceListingDurationDays", "workflow"])
    );
    expect(row.metadata.before.marketplaceListingDurationDays).toBe(14);
    expect(row.metadata.after.marketplaceListingDurationDays).toBe(30);
    expect(row.metadata.before.workflow.changed[0].values.name).toBe("Invoice Financing");
    expect(row.metadata.after.workflow.changed[0].values.name).toBe("Invoice Financing v2");
    expect(row.metadata.previousProductId).toBeUndefined();
  });

  it("does not write PRODUCT_UPDATED or version-bump for same product_code no-op", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(productRow());
    mockPrisma.product.findMany.mockResolvedValue([
      { id: "prod_v1", base_id: "prod_v1", product_code: "ARF" },
    ]);

    const repo = new ProductRepository();
    const result = await repo.update("prod_v1", {
      workflow: workflowV1,
      product_code: "ARF",
    });

    expect(result.id).toBe("prod_v1");
    expect(mockTx.product.create).not.toHaveBeenCalled();
    expect(mockTx.productAuditLog.create).not.toHaveBeenCalled();
  });

  it("writes PRODUCT_INACTIVATED then PRODUCT_UPDATED for a versioned update", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(productRow());
    mockTx.product.findMany.mockResolvedValueOnce([
      { id: "prod_v1", base_id: "prod_v1", product_code: "ARF" },
    ]);
    mockTx.product.update.mockResolvedValueOnce(productRow({ status: "INACTIVE" }));
    mockTx.product.create.mockResolvedValueOnce(
      productRow({
        id: "prod_v2",
        version: 2,
        workflow: workflowV2,
        created_at: new Date("2026-08-10T00:00:00.000Z"),
        updated_at: new Date("2026-08-10T00:00:00.000Z"),
      })
    );

    const repo = new ProductRepository();
    await repo.update("prod_v1", { workflow: workflowV2 }, auditContext);

    const rows = auditRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].event_type).toBe("PRODUCT_INACTIVATED");
    expect(rows[0].product_id).toBe("prod_v1");
    expect(rows[0].metadata.previousStatus).toBe("ACTIVE");
    expect(rows[0].metadata.newStatus).toBe("INACTIVE");
    expect(rows[0].metadata.replacedByProductId).toBe("prod_v2");
    expect(rows[0].metadata.replacedByVersion).toBe(2);

    expect(rows[1].event_type).toBe("PRODUCT_UPDATED");
    expect(rows[1].product_id).toBe("prod_v2");
    expect(rows[1].metadata.version).toBe(2);
    expect(rows[1].metadata.previousProductId).toBe("prod_v1");
    expect(rows[1].metadata.newProductId).toBe("prod_v2");
    expect(rows[1].metadata.previousVersion).toBe(1);
    expect(rows[1].metadata.newVersion).toBe(2);
  });

  it("soft-deletes and writes one PRODUCT_DELETED", async () => {
    const current = productRow({ status: "ACTIVE" });
    mockTx.product.findUnique.mockResolvedValueOnce(current);
    mockTx.product.update.mockResolvedValueOnce({
      ...current,
      status: "DELETED",
      deleted_at: new Date("2026-08-13T00:00:00.000Z"),
    });

    const repo = new ProductRepository();
    const result = await repo.delete("prod_v1", auditContext);

    expect(result.status).toBe("DELETED");
    expect(result.deleted_at).toBeTruthy();
    expect(mockTx.productAuditLog.create).toHaveBeenCalledTimes(1);
    const row = auditRows()[0];
    expect(row.event_type).toBe("PRODUCT_DELETED");
    expect(row.product_id).toBe("prod_v1");
    expect(row.metadata.previousStatus).toBe("ACTIVE");
    expect(row.metadata.newStatus).toBe("DELETED");
    expect(mockTx.product.delete).not.toHaveBeenCalled();
  });

  it("writes PRODUCT_REACTIVATED from restoreProduct using actual previous status", async () => {
    const current = productRow({ status: "DELETED", deleted_at: new Date("2026-08-12T00:00:00.000Z") });
    mockTx.product.findUnique.mockResolvedValueOnce(current);
    mockTx.product.update.mockResolvedValueOnce({
      ...current,
      status: "ACTIVE",
      deleted_at: null,
    });

    const repo = new ProductRepository();
    await repo.restoreProduct("prod_v1", auditContext);

    expect(mockTx.productAuditLog.create).toHaveBeenCalledTimes(1);
    const row = auditRows()[0];
    expect(row.event_type).toBe("PRODUCT_REACTIVATED");
    expect(row.metadata.previousStatus).toBe("DELETED");
    expect(row.metadata.newStatus).toBe("ACTIVE");
  });

  it("rolls back the product mutation when audit insert fails", async () => {
    mockTx.$queryRaw
      .mockResolvedValueOnce([{ max: 1 }])
      .mockResolvedValueOnce([{ min: 1 }]);
    mockTx.product.create.mockResolvedValueOnce(productRow({ id: "prod_new_1", base_id: null }));
    mockTx.product.update.mockResolvedValueOnce(productRow({ id: "prod_new_1" }));
    mockTx.productAuditLog.create.mockRejectedValueOnce(new Error("audit insert failed"));

    const repo = new ProductRepository();
    await expect(
      repo.create({ workflow: workflowV1, product_code: "ARF" }, auditContext)
    ).rejects.toThrow("audit insert failed");
  });

  it("does not write an audit row when product create fails", async () => {
    mockTx.$queryRaw
      .mockResolvedValueOnce([{ max: 1 }])
      .mockResolvedValueOnce([{ min: 1 }]);
    mockTx.product.create.mockRejectedValueOnce(new Error("db create failed"));

    const repo = new ProductRepository();
    await expect(
      repo.create({ workflow: workflowV1, product_code: "ARF" }, auditContext)
    ).rejects.toThrow("db create failed");
    expect(mockTx.productAuditLog.create).not.toHaveBeenCalled();
  });

  it("does not delete ProductAuditLog during failed-create rollback", async () => {
    mockPrisma.product.delete.mockResolvedValue({ id: "prod_new_1" });
    const repo = new ProductRepository();
    await repo.hardDeleteForFailedCreate("prod_new_1");

    expect(mockPrisma.product.delete).toHaveBeenCalledWith({ where: { id: "prod_new_1" } });
    expect(mockTx.productAuditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("does not expose ProductAuditLog update/delete/deleteMany in Product module source", () => {
    const dir = path.join(__dirname);
    const files = fs.readdirSync(dir, { recursive: true }) as string[];
    const sources = files
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.endsWith(".spec.ts"))
      .map((file) => fs.readFileSync(path.join(dir, file), "utf8"))
      .join("\n");

    expect(sources).not.toMatch(/productAuditLog\.(update|delete|deleteMany|upsert)\s*\(/);
  });
});
