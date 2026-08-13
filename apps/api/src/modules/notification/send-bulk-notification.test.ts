import { NotificationPriority, NotificationPortalTarget } from "@prisma/client";
import type { NotificationBroadcastAuditContext } from "./audit/context";

const mockFindByIdempotencyKey = jest.fn();
const mockFindTypeById = jest.fn();
const mockFindUserPreferences = jest.fn();
const mockRepositoryCreate = jest.fn();
const mockGroupFindById = jest.fn();
const mockWriteAudit = jest.fn();
const mockSendEmail = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    notification: { update: jest.fn() },
    notificationBroadcastAuditLog: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock("../../lib/email/ses-client", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

jest.mock("./repository", () => ({
  NotificationRepository: jest.fn().mockImplementation(() => ({
    findByIdempotencyKey: mockFindByIdempotencyKey,
    findTypeById: mockFindTypeById,
    findUserPreferences: mockFindUserPreferences,
    create: mockRepositoryCreate,
  })),
}));

jest.mock("./group-repository", () => ({
  NotificationGroupRepository: jest.fn().mockImplementation(() => ({
    findById: mockGroupFindById,
  })),
}));

jest.mock("./audit/writer", () => ({
  writeNotificationBroadcastProcessedAudit: (...args: unknown[]) => mockWriteAudit(...args),
}));

import { prisma } from "../../lib/prisma";
import { NotificationService } from "./service";

const context: NotificationBroadcastAuditContext = {
  actorType: "ADMIN",
  actorUserId: "admin-1",
  organizationId: null,
  organizationKind: null,
  source: "API",
  portal: "ADMIN",
  ipAddress: "127.0.0.1",
  userAgent: "Jest",
  correlationId: "corr-1",
  idempotencyKey: null,
};

const typeRow = {
  id: "system_announcement",
  name: "System Announcement",
  default_priority: NotificationPriority.INFO,
  enabled_platform: true,
  enabled_email: true,
  user_configurable: true,
  portal_targets: [NotificationPortalTarget.INVESTOR, NotificationPortalTarget.ISSUER],
  retention_days: null,
};

describe("NotificationService.sendBulkNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockFindTypeById.mockResolvedValue(typeRow);
    mockFindUserPreferences.mockResolvedValue([]);
    mockWriteAudit.mockResolvedValue("audit-1");
    mockSendEmail.mockResolvedValue(undefined);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      user_id: "u1",
      email: "u1@example.com",
      first_name: "User",
    });
    (prisma.notification.update as jest.Mock).mockResolvedValue({});
  });

  it("writes one PROCESSED audit after the loop with aggregate counts", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { user_id: "u1" },
      { user_id: "u2" },
      { user_id: "u3" },
    ]);
    mockRepositoryCreate
      .mockResolvedValueOnce({ id: "n1", title: "T", message: "M", link_path: null, metadata: {} })
      .mockResolvedValueOnce({ id: "n2", title: "T", message: "M", link_path: null, metadata: {} });
    mockFindUserPreferences
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          notification_type_id: "system_announcement",
          enabled_platform: false,
          enabled_email: false,
        },
      ]);

    const service = new NotificationService();
    const result = await service.sendBulkNotification(context, {
      targetType: "ALL_USERS",
      typeId: "system_announcement",
      title: "Hello",
      message: "World",
    });

    expect(result).toEqual({
      targetedCount: 3,
      createdCount: 2,
      skippedCount: 1,
      failedCount: 0,
    });
    expect(result.createdCount + result.skippedCount + result.failedCount).toBe(
      result.targetedCount
    );
    expect(mockWriteAudit).toHaveBeenCalledTimes(1);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "NOTIFICATION_BROADCAST_PROCESSED",
        audienceType: "ALL_USERS",
        metadata: expect.objectContaining({
          targetedCount: 3,
          createdCount: 2,
          skippedCount: 1,
          failedCount: 0,
          channelMode: "TYPE_AND_USER_PREFERENCES",
          sendToPlatform: null,
          sendToEmail: null,
        }),
      })
    );
  });

  it("counts create exceptions as failedCount and still writes PROCESSED", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ user_id: "u1" }, { user_id: "u2" }]);
    mockRepositoryCreate
      .mockResolvedValueOnce({ id: "n1", title: "T", message: "M", link_path: null, metadata: {} })
      .mockRejectedValueOnce(new Error("db down"));

    const service = new NotificationService();
    const result = await service.sendBulkNotification(context, {
      targetType: "INVESTORS",
      typeId: "system_announcement",
      title: "Hello",
      message: "World",
      sendToPlatform: true,
      sendToEmail: false,
    });

    expect(result).toEqual({
      targetedCount: 2,
      createdCount: 1,
      skippedCount: 0,
      failedCount: 1,
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          channelMode: "EXPLICIT_OVERRIDE",
          sendToPlatform: true,
          sendToEmail: false,
          failedCount: 1,
        }),
      })
    );
  });

  it("does not roll back created Notification rows when audit write fails", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ user_id: "u1" }]);
    mockRepositoryCreate.mockResolvedValue({
      id: "n1",
      title: "T",
      message: "M",
      link_path: null,
      metadata: {},
    });
    mockWriteAudit.mockRejectedValue(new Error("audit insert failed"));

    const service = new NotificationService();
    await expect(
      service.sendBulkNotification(context, {
        targetType: "SPECIFIC_USERS",
        userIds: ["u1"],
        typeId: "system_announcement",
        title: "Hello",
        message: "World",
        sendToPlatform: true,
        sendToEmail: false,
      })
    ).rejects.toThrow("audit insert failed");

    expect(mockRepositoryCreate).toHaveBeenCalledTimes(1);
    expect(prisma.notificationBroadcastAuditLog.delete).not.toHaveBeenCalled();
    expect(prisma.notificationBroadcastAuditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("writes PROCESSED with zero counts when the resolved audience is empty", async () => {
    mockGroupFindById.mockResolvedValue(null);

    const service = new NotificationService();
    const result = await service.sendBulkNotification(context, {
      targetType: "GROUP",
      groupId: "missing-group",
      typeId: "system_announcement",
      title: "Hello",
      message: "World",
      sendToPlatform: true,
      sendToEmail: false,
    });

    expect(result).toEqual({
      targetedCount: 0,
      createdCount: 0,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(mockRepositoryCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledTimes(1);
  });

  it("writes PROCESSED when every recipient create fails", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ user_id: "u1" }, { user_id: "u2" }]);
    mockRepositoryCreate.mockRejectedValue(new Error("db down"));

    const service = new NotificationService();
    const result = await service.sendBulkNotification(context, {
      targetType: "ALL_USERS",
      typeId: "system_announcement",
      title: "Hello",
      message: "World",
      sendToPlatform: true,
      sendToEmail: false,
    });

    expect(result).toEqual({
      targetedCount: 2,
      createdCount: 0,
      skippedCount: 0,
      failedCount: 2,
    });
    expect(mockWriteAudit).toHaveBeenCalledTimes(1);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "NOTIFICATION_BROADCAST_PROCESSED",
        metadata: expect.objectContaining({
          targetedCount: 2,
          createdCount: 0,
          failedCount: 2,
        }),
      })
    );
  });
});
