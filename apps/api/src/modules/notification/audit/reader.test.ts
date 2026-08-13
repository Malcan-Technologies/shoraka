const mockPrisma: {
  user: { findMany: jest.Mock };
  notificationBroadcastAuditLog: { findMany: jest.Mock; count: jest.Mock };
} = {
  user: { findMany: jest.fn() },
  notificationBroadcastAuditLog: { findMany: jest.fn(), count: jest.fn() },
};

jest.mock("../../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

jest.mock("../../../lib/http/request-utils", () => ({
  formatDeviceInfoFromUserAgent: (ua: string | null) => (ua ? "Jest Browser on Jest OS" : null),
}));

import { NotificationBroadcastAuditLogReader } from "./reader";

describe("NotificationBroadcastAuditLogReader", () => {
  const reader = new NotificationBroadcastAuditLogReader();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps rows to the camelCase DTO using metadata snapshots", async () => {
    mockPrisma.notificationBroadcastAuditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        event_type: "NOTIFICATION_BROADCAST_PROCESSED",
        occurred_at: new Date("2026-08-13T01:00:00.000Z"),
        created_at: new Date("2026-08-13T01:00:00.000Z"),
        actor_type: "ADMIN",
        actor_user_id: "admin_1",
        organization_id: null,
        organization_kind: null,
        target_type: "NOTIFICATION_BROADCAST",
        target_id: "a1",
        source: "API",
        portal: "ADMIN",
        ip_address: "1.1.1.1",
        user_agent: "Mozilla/5.0",
        correlation_id: "c1",
        idempotency_key: null,
        audience_type: "INVESTORS",
        notification_type_id: "system_announcement",
        metadata: {
          actorName: "Ada Admin",
          actorEmail: "ada@example.com",
          notificationTypeName: "System Announcement",
          portalTargets: ["INVESTOR"],
          title: "Hello",
          message: "World",
          targetedCount: 4,
          createdCount: 3,
          skippedCount: 0,
          failedCount: 1,
          channelMode: "EXPLICIT_OVERRIDE",
          sendToPlatform: true,
          sendToEmail: false,
          groupId: null,
          linkPath: null,
          expiresAt: null,
        },
      },
    ]);
    mockPrisma.notificationBroadcastAuditLog.count.mockResolvedValue(1);

    const { items, pagination } = await reader.list({ limit: 20, offset: 0 });

    expect(pagination.total).toBe(1);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(items[0].eventType).toBe("NOTIFICATION_BROADCAST_PROCESSED");
    expect(items[0].occurredAt).toBe("2026-08-13T01:00:00.000Z");
    expect(items[0].actor).toEqual({
      type: "ADMIN",
      userId: "admin_1",
      displayName: "Ada Admin",
      email: "ada@example.com",
    });
    expect(items[0].audienceType).toBe("INVESTORS");
    expect(items[0].targetedCount).toBe(4);
    expect(items[0].createdCount).toBe(3);
    expect(items[0].failedCount).toBe(1);
    expect(items[0].deviceInfo).toBe("Jest Browser on Jest OS");
  });

  it("maps type query to notification_type_id and target query to audience_type", async () => {
    mockPrisma.notificationBroadcastAuditLog.findMany.mockResolvedValue([]);
    mockPrisma.notificationBroadcastAuditLog.count.mockResolvedValue(0);

    await reader.list({
      limit: 20,
      offset: 0,
      type: "system_announcement",
      target: "GROUP",
    });

    expect(mockPrisma.notificationBroadcastAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          notification_type_id: "system_announcement",
          audience_type: "GROUP",
        }),
      })
    );
  });
});
