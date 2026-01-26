import { NotificationService } from "./service";
import { NotificationRepository } from "./repository";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../lib/email/ses-client";
import { buildNotificationEmail } from "./email-templates";
import { NotificationPriority } from "@prisma/client";

jest.mock("./repository");
jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    notification: { update: jest.fn() },
    notificationType: { findMany: jest.fn() },
  },
}));
jest.mock("../../lib/email/ses-client");
jest.mock("./email-templates");
jest.mock("../../lib/logger");

describe("NotificationService", () => {
  let service: NotificationService;
  let mockRepository: jest.Mocked<NotificationRepository>;
  const userId = "user_123";

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
    mockRepository = (service as any).repository;
  });

  describe("create", () => {
    const createParams = {
      userId,
      typeId: "kyc_approved",
      title: "KYC Approved",
      message: "Your KYC has been approved",
    };

    const mockType = {
      id: "kyc_approved",
      enabled_platform: true,
      enabled_email: true,
      user_configurable: true,
      default_priority: NotificationPriority.INFO,
      retention_days: 30,
    };

    const mockUser = { user_id: userId, email: "test@example.com" };

    it("should handle idempotency correctly", async () => {
      const existingNotif = { id: "existing_1" };
      mockRepository.findByIdempotencyKey.mockResolvedValue(existingNotif as any);

      const result = await service.create({ ...createParams, idempotencyKey: "key_1" });

      expect(result).toEqual(existingNotif);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it("should create notification and send email when enabled", async () => {
      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.findTypeById.mockResolvedValue(mockType as any);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockRepository.findUserPreferences.mockResolvedValue([]); // Default to true

      const savedNotif = { id: "new_1", ...createParams };
      mockRepository.create.mockResolvedValue(savedNotif as any);
      (buildNotificationEmail as jest.Mock).mockReturnValue({ to: "test@example.com" });

      const result = await service.create(createParams);

      // Verify repository creation
      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        send_to_platform: true,
        send_to_email: true,
      }));

      // Verify email delivery
      expect(sendEmail).toHaveBeenCalled();
      expect(prisma.notification.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "new_1" },
        data: { email_sent_at: expect.any(Date) },
      }));

      expect(result).toEqual(savedNotif);
    });

    it("should NOT send email if user has disabled it in preferences", async () => {
      mockRepository.findTypeById.mockResolvedValue(mockType as any);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockRepository.findUserPreferences.mockResolvedValue([
        { notification_type_id: "kyc_approved", enabled_email: false, enabled_platform: true }
      ] as any);

      await service.create(createParams);

      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        send_to_email: false,
      }));
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("should throw error if notification type is missing", async () => {
      mockRepository.findTypeById.mockResolvedValue(null);
      await expect(service.create(createParams)).rejects.toThrow("Notification type kyc_approved not found");
    });
  });

  describe("getUserNotifications", () => {
    it("should return paginated notifications and unread count", async () => {
      const mockItems = [{ id: "1" }];
      mockRepository.findManyByUserId.mockResolvedValue([mockItems as any, 1]);
      mockRepository.countUnread.mockResolvedValue(1);

      const result = await service.getUserNotifications(userId, { limit: 10, offset: 0 });

      expect(result.items).toEqual(mockItems);
      expect(result.unreadCount).toBe(1);
    });
  });

  describe("getUnreadCount", () => {
    it("should call repository.countUnread", async () => {
      mockRepository.countUnread.mockResolvedValue(10);
      const result = await service.getUnreadCount(userId);
      expect(result).toBe(10);
    });
  });

  describe("markAsRead", () => {
    it("should call repository.markAsRead", async () => {
      await service.markAsRead("notif_1", userId);
      expect(mockRepository.markAsRead).toHaveBeenCalledWith("notif_1", userId);
    });
  });

  describe("markAllAsRead", () => {
    it("should return the count of updated notifications", async () => {
      mockRepository.markAllAsRead.mockResolvedValue({ count: 5 });
      const result = await service.markAllAsRead(userId);
      expect(result).toBe(5);
    });
  });

  describe("getUserPreferences", () => {
    it("should merge all types with user overrides", async () => {
      const mockTypes = [
        { id: "type_1", enabled_email: true, user_configurable: true },
        { id: "type_2", enabled_email: true, user_configurable: false },
      ];
      const mockPrefs = [
        { notification_type_id: "type_1", enabled_email: false },
      ];

      (prisma.notificationType.findMany as jest.Mock).mockResolvedValue(mockTypes);
      mockRepository.findUserPreferences.mockResolvedValue(mockPrefs as any);

      const result = await service.getUserPreferences(userId);

      expect(result[0].id).toBe("type_1");
      expect(result[0].enabled_email).toBe(false); // Overridden
      expect(result[1].id).toBe("type_2");
      expect(result[1].enabled_email).toBe(true); // Admin controlled
    });
  });

  describe("updateUserPreference", () => {
    it("should update if type is user configurable", async () => {
      mockRepository.findTypeById.mockResolvedValue({ id: "1", user_configurable: true } as any);

      await service.updateUserPreference(userId, "1", { enabled_email: true, enabled_platform: true });

      expect(mockRepository.upsertUserPreference).toHaveBeenCalled();
    });

    it("should throw error if type is NOT user configurable", async () => {
      mockRepository.findTypeById.mockResolvedValue({ id: "1", user_configurable: false } as any);

      await expect(service.updateUserPreference(userId, "1", { enabled_email: true, enabled_platform: true }))
        .rejects.toThrow("Notification type 1 is not user configurable");
    });
  });

  describe("runCleanup", () => {
    it("should run cleanup for expired and old notifications", async () => {
      mockRepository.deleteExpired.mockResolvedValue({ count: 1 });
      (prisma.notificationType.findMany as jest.Mock).mockResolvedValue([
        { id: "type_1", retention_days: 30 }
      ]);
      mockRepository.deleteOldNotifications.mockResolvedValue({ count: 5 });

      await service.runCleanup();

      expect(mockRepository.deleteExpired).toHaveBeenCalled();
      expect(mockRepository.deleteOldNotifications).toHaveBeenCalledWith("type_1", 30);
    });
  });
});
