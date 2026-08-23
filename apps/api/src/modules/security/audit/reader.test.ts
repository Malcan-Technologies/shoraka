const mockPrisma: {
  user: { findMany: jest.Mock };
  securityAuditLog: { findMany: jest.Mock; count: jest.Mock };
} = {
  user: { findMany: jest.fn() },
  securityAuditLog: { findMany: jest.fn(), count: jest.fn() },
};

jest.mock("../../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { SecurityAuditLogReader } from "./reader";
import { SECURITY_AUDIT_EVENTS } from "./events";

describe("SecurityAuditLogReader", () => {
  const reader = new SecurityAuditLogReader();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findMany.mockResolvedValue([]);
  });

  it("maps camelCase DTOs and derives device from user-agent", async () => {
    mockPrisma.securityAuditLog.findMany.mockResolvedValue([
      {
        id: "s1",
        subject_user_id: "USER1",
        event_type: "USER_ROLES_UPDATED",
        occurred_at: new Date("2026-08-13T02:00:00.000Z"),
        created_at: new Date("2026-08-13T02:00:00.000Z"),
        actor_type: "ADMIN",
        actor_user_id: "ADMIN",
        organization_id: null,
        organization_kind: null,
        target_type: "USER",
        target_id: "USER1",
        source: "API",
        portal: "ADMIN",
        ip_address: "8.8.8.8",
        user_agent: "Mozilla/5.0 Chrome/120.0",
        correlation_id: "c2",
        idempotency_key: null,
        metadata: { actorName: "Ada Admin", actorEmail: "admin@example.com" },
      },
    ]);
    mockPrisma.securityAuditLog.count.mockResolvedValue(1);

    const { logs, total } = await reader.findAll({
      page: 1,
      pageSize: 15,
      dateRange: "all",
    });

    expect(total).toBe(1);
    expect(logs[0].eventType).toBe("USER_ROLES_UPDATED");
    expect(logs[0].subjectUserId).toBe("USER1");
    expect(logs[0].actor.displayName).toBe("Ada Admin");
    expect(logs[0].deviceInfo).toBeTruthy();
    expect(mockPrisma.securityAuditLog.findMany.mock.calls[0][0].where.event_type).toBeUndefined();
  });

  it("does not silently restrict the default filter to a stale event subset", async () => {
    mockPrisma.securityAuditLog.findMany.mockResolvedValue([]);
    mockPrisma.securityAuditLog.count.mockResolvedValue(0);
    await reader.findAll({ page: 1, pageSize: 15, dateRange: "all" });
    const where = mockPrisma.securityAuditLog.findMany.mock.calls[0][0].where;
    expect(where.event_type).toBeUndefined();
    expect(SECURITY_AUDIT_EVENTS.length).toBeGreaterThan(20);
  });

  it("filters by a live event type when requested", async () => {
    mockPrisma.securityAuditLog.findMany.mockResolvedValue([]);
    mockPrisma.securityAuditLog.count.mockResolvedValue(0);
    await reader.findAll({
      page: 1,
      pageSize: 15,
      dateRange: "all",
      eventType: "ADMIN_ACCESS_DENIED",
    });
    expect(mockPrisma.securityAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ event_type: "ADMIN_ACCESS_DENIED" }),
      })
    );
  });
});
