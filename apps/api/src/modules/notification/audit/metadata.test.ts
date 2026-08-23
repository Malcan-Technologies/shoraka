import { parseNotificationBroadcastAuditMetadata } from "./metadata";

const valid = {
  notificationTypeId: "system_announcement",
  notificationTypeName: "System Announcement",
  portalTargets: ["INVESTOR", "ISSUER"] as const,
  audienceType: "ALL_USERS",
  groupId: null,
  targetedCount: 3,
  createdCount: 2,
  skippedCount: 1,
  failedCount: 0,
  title: "Hello",
  message: "World",
  channelMode: "EXPLICIT_OVERRIDE" as const,
  sendToPlatform: true,
  sendToEmail: false,
  linkPath: "/dashboard",
  expiresAt: "2026-09-01T00:00:00.000Z",
  actorName: "Ada Admin",
  actorEmail: "ada@example.com",
};

describe("notification broadcast audit metadata", () => {
  it("accepts NOTIFICATION_BROADCAST_PROCESSED fields", () => {
    const parsed = parseNotificationBroadcastAuditMetadata(
      "NOTIFICATION_BROADCAST_PROCESSED",
      valid
    );
    expect(parsed.targetedCount).toBe(3);
    expect(parsed.channelMode).toBe("EXPLICIT_OVERRIDE");
  });

  it("rejects counts that do not sum to targetedCount", () => {
    expect(() =>
      parseNotificationBroadcastAuditMetadata("NOTIFICATION_BROADCAST_PROCESSED", {
        ...valid,
        createdCount: 1,
        skippedCount: 0,
        failedCount: 0,
      })
    ).toThrow();
  });

  it("requires null channel flags for TYPE_AND_USER_PREFERENCES", () => {
    expect(() =>
      parseNotificationBroadcastAuditMetadata("NOTIFICATION_BROADCAST_PROCESSED", {
        ...valid,
        channelMode: "TYPE_AND_USER_PREFERENCES",
        sendToPlatform: true,
        sendToEmail: false,
      })
    ).toThrow();
  });

  it("accepts TYPE_AND_USER_PREFERENCES with null channel flags", () => {
    const parsed = parseNotificationBroadcastAuditMetadata(
      "NOTIFICATION_BROADCAST_PROCESSED",
      {
        ...valid,
        channelMode: "TYPE_AND_USER_PREFERENCES",
        sendToPlatform: null,
        sendToEmail: null,
      }
    );
    expect(parsed.sendToPlatform).toBeNull();
  });
});
