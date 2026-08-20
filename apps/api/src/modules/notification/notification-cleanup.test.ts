const mockDeleteExpired = jest.fn();
const mockDeleteOldNotifications = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    notificationType: { findMany: jest.fn() },
    notificationBroadcastAuditLog: {
      delete: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock("./repository", () => ({
  NotificationRepository: jest.fn().mockImplementation(() => ({
    deleteExpired: mockDeleteExpired,
    deleteOldNotifications: mockDeleteOldNotifications,
  })),
  NotificationGroupRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("./group-repository", () => ({
  NotificationGroupRepository: jest.fn().mockImplementation(() => ({})),
}));

import { prisma } from "../../lib/prisma";
import { NotificationService } from "./service";

describe("NotificationService.runCleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteExpired.mockResolvedValue({ count: 2 });
    mockDeleteOldNotifications.mockResolvedValue({ count: 1 });
    (prisma.notificationType.findMany as jest.Mock).mockResolvedValue([
      { id: "system_announcement", retention_days: 30 },
    ]);
  });

  it("deletes Notification rows only and never deletes broadcast audit history", async () => {
    const service = new NotificationService();
    await service.runCleanup();

    expect(mockDeleteExpired).toHaveBeenCalledTimes(1);
    expect(mockDeleteOldNotifications).toHaveBeenCalledWith("system_announcement", 30);
    expect(prisma.notificationBroadcastAuditLog.delete).not.toHaveBeenCalled();
    expect(prisma.notificationBroadcastAuditLog.deleteMany).not.toHaveBeenCalled();
    expect(prisma.notificationBroadcastAuditLog.update).not.toHaveBeenCalled();
    expect(prisma.notificationBroadcastAuditLog.upsert).not.toHaveBeenCalled();
  });
});
