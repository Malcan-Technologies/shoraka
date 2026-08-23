const mockPrisma: any = {
  user: { findMany: jest.fn() },
  productAuditLog: { findMany: jest.fn(), count: jest.fn() },
};

jest.mock("../../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { ProductAuditLogReader } from "./reader";

describe("ProductAuditLogReader", () => {
  const reader = new ProductAuditLogReader();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps rows to the camelCase DTO and batches actor lookups", async () => {
    mockPrisma.productAuditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        product_id: "prod_1",
        event_type: "PRODUCT_CREATED",
        occurred_at: new Date("2026-08-13T01:00:00.000Z"),
        created_at: new Date("2026-08-13T01:00:00.000Z"),
        actor_type: "ADMIN",
        actor_user_id: "admin_1",
        organization_id: null,
        organization_kind: null,
        target_type: "PRODUCT",
        target_id: "prod_1",
        source: "API",
        portal: "ADMIN",
        ip_address: "1.1.1.1",
        user_agent: "Mozilla/5.0 Chrome/120.0",
        correlation_id: "c1",
        idempotency_key: null,
        metadata: { productName: "Invoice Financing", baseId: "prod_1", version: 1 },
      },
      {
        id: "a2",
        product_id: "prod_1",
        event_type: "PRODUCT_INACTIVATED",
        occurred_at: new Date("2026-08-13T02:00:00.000Z"),
        created_at: new Date("2026-08-13T02:00:00.000Z"),
        actor_type: "ADMIN",
        actor_user_id: "admin_1",
        organization_id: null,
        organization_kind: null,
        target_type: "PRODUCT",
        target_id: "prod_1",
        source: "API",
        portal: "ADMIN",
        ip_address: "1.1.1.1",
        user_agent: null,
        correlation_id: "c2",
        idempotency_key: null,
        metadata: { productName: "Invoice Financing", previousStatus: "ACTIVE", newStatus: "INACTIVE" },
      },
    ]);
    mockPrisma.productAuditLog.count.mockResolvedValue(2);
    mockPrisma.user.findMany.mockResolvedValue([
      { user_id: "admin_1", first_name: "Ada", last_name: "Admin", email: "ada@example.com" },
    ]);

    const { logs, total } = await reader.findAll({
      page: 1,
      pageSize: 15,
      dateRange: "all",
    });

    expect(total).toBe(2);
    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.findMany.mock.calls[0][0].where.user_id.in).toEqual(["admin_1"]);
    expect(logs[0].eventType).toBe("PRODUCT_CREATED");
    expect(logs[0].occurredAt).toBe("2026-08-13T01:00:00.000Z");
    expect(logs[0].actor).toEqual({
      type: "ADMIN",
      userId: "admin_1",
      displayName: "Ada Admin",
      email: "ada@example.com",
    });
    expect(logs[0].target).toEqual({ type: "PRODUCT", id: "prod_1" });
    expect(logs[0].metadata.productName).toBe("Invoice Financing");
    expect(logs[0].deviceInfo).toContain("Chrome");
    expect(logs[1].eventType).toBe("PRODUCT_INACTIVATED");
    expect(logs[1].deviceInfo).toBeNull();
  });

  it("filters by eventType and returns empty when search matches no users", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await reader.findAll({
      page: 1,
      pageSize: 15,
      search: "nobody",
      eventType: "PRODUCT_DELETED",
      dateRange: "7d",
    });

    expect(result).toEqual({ logs: [], total: 0 });
    expect(mockPrisma.productAuditLog.findMany).not.toHaveBeenCalled();
  });

  it("export reads ProductAuditLog", async () => {
    mockPrisma.productAuditLog.findMany.mockResolvedValue([]);
    const logs = await reader.findForExport({ dateRange: "all", eventType: "PRODUCT_UPDATED" });
    expect(logs).toEqual([]);
    expect(mockPrisma.productAuditLog.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.productAuditLog.findMany.mock.calls[0][0].where.event_type).toBe(
      "PRODUCT_UPDATED"
    );
  });
});
