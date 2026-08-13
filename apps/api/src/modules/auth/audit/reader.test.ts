const mockPrisma: any = {
  user: { findMany: jest.fn() },
  accessAuditLog: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
};

jest.mock("../../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { AccessAuditLogReader } from "./reader";

describe("AccessAuditLogReader", () => {
  const reader = new AccessAuditLogReader();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps camelCase DTOs and derives device from user-agent", async () => {
    mockPrisma.accessAuditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        user_id: "ABCDE",
        event_type: "USER_LOGGED_IN",
        occurred_at: new Date("2026-08-13T01:00:00.000Z"),
        created_at: new Date("2026-08-13T01:00:00.000Z"),
        actor_type: "USER",
        actor_user_id: "ABCDE",
        organization_id: null,
        organization_kind: null,
        target_type: "USER",
        target_id: "ABCDE",
        source: "API",
        portal: "INVESTOR",
        ip_address: "1.1.1.1",
        user_agent: "Mozilla/5.0 Chrome/120.0",
        correlation_id: "c1",
        idempotency_key: null,
        metadata: { actorName: "Ada", actorEmail: "ada@example.com", loginMethod: "COGNITO_OAUTH" },
      },
    ]);
    mockPrisma.accessAuditLog.count.mockResolvedValue(1);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const { logs, total } = await reader.findAll({
      page: 1,
      pageSize: 15,
      dateRange: "all",
    });

    expect(total).toBe(1);
    expect(logs[0].eventType).toBe("USER_LOGGED_IN");
    expect(logs[0].occurredAt).toBe("2026-08-13T01:00:00.000Z");
    expect(logs[0].actor.email).toBe("ada@example.com");
    expect(logs[0].deviceInfo).toBeTruthy();
  });

  it("status=failed matches nothing so Access UI cannot show login failures", async () => {
    mockPrisma.accessAuditLog.findMany.mockResolvedValue([]);
    mockPrisma.accessAuditLog.count.mockResolvedValue(0);
    mockPrisma.user.findMany.mockResolvedValue([]);
    await reader.findAll({
      page: 1,
      pageSize: 15,
      dateRange: "all",
      status: "failed",
    });
    expect(mockPrisma.accessAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining({ id: "__none__" })]),
        }),
      })
    );
  });

  it("findRecentLogins queries USER_LOGGED_IN only", async () => {
    mockPrisma.accessAuditLog.findMany.mockResolvedValue([]);
    await reader.findRecentLogins("ABCDE", 3);
    expect(mockPrisma.accessAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: "ABCDE", event_type: "USER_LOGGED_IN" },
        take: 3,
      })
    );
  });
});
