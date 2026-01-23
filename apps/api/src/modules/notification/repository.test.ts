import { NotificationRepository } from "./repository";
import { prisma } from "../../lib/prisma";
import { NotificationPriority } from "@prisma/client";

// 1. Mock the Prisma client
jest.mock("../../lib/prisma", () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    userNotificationPreference: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    notificationType: {
      findUnique: jest.fn(),
    },
  },
}));

describe("NotificationRepository", () => {
  let repository: NotificationRepository;
  const userId = "user_123";

  beforeEach(() => {
    repository = new NotificationRepository();
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should call prisma.notification.create with correct data", async () => {
      const mockNotification = { id: "1", title: "Test" };
      (prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);

      const createData = {
        priority: NotificationPriority.INFO,
        title: "Test Title",
        message: "Test Message",
        user: { connect: { user_id: userId } },
        notification_type: { connect: { id: "1" } },
      };
      const result = await repository.create(createData as any);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: createData,
      });
      expect(result).toEqual(mockNotification);
    });
  });

  describe("findByIdempotencyKey", () => {
    it("should return notification when found by key", async () => {
      const mockNotification = { id: "1", idempotency_key: "abc" };
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(mockNotification);

      const result = await repository.findByIdempotencyKey("abc");

      expect(prisma.notification.findUnique).toHaveBeenCalledWith({
        where: { idempotency_key: "abc" },
      });
      expect(result).toEqual(mockNotification);
    });
  });

  describe("findById", () => {
    it("should return notification with details when found", async () => {
      const mockNotification = { id: "1", notification_type: { name: "Type A" } };
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(mockNotification);

      const result = await repository.findById("1");

      expect(prisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
        include: { notification_type: true },
      });
      expect(result).toEqual(mockNotification);
    });

    it("should return null when notification not found", async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await repository.findById("missing");
      expect(result).toBeNull();
    });
  });

  describe("findManyByUserId", () => {
    it("should call prisma with correct filters and pagination", async () => {
      const mockNotifications = [{ id: "1" }];
      (prisma.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications);
      (prisma.notification.count as jest.Mock).mockResolvedValue(1);

      const filters = { limit: 10, offset: 0, read: false };
      const [items, total] = await repository.findManyByUserId(userId, filters);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_id: userId, read_at: null }),
          take: 10,
          skip: 0,
        })
      );
      expect(items).toEqual(mockNotifications);
      expect(total).toBe(1);
    });
  });

  describe("countUnread", () => {
    it("should return count of unread and non-expired notifications", async () => {
      (prisma.notification.count as jest.Mock).mockResolvedValue(5);

      const count = await repository.countUnread(userId);

      expect(count).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_id: userId, read_at: null }),
        })
      );
    });
  });

  describe("markAsRead", () => {
    it("should update read_at for a specific notification", async () => {
      const mockResult = { id: "1", read_at: new Date() };
      (prisma.notification.update as jest.Mock).mockResolvedValue(mockResult);

      const result = await repository.markAsRead("1", userId);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: "1", user_id: userId },
        data: { read_at: expect.any(Date) },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe("markAllAsRead", () => {
    it("should updateMany for all unread notifications of a user", async () => {
      const mockBatch = { count: 3 };
      (prisma.notification.updateMany as jest.Mock).mockResolvedValue(mockBatch);

      const result = await repository.markAllAsRead(userId);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { user_id: userId, read_at: null },
        data: { read_at: expect.any(Date) },
      });
      expect(result).toEqual(mockBatch);
    });
  });

  describe("findTypeById", () => {
    it("should return notification type if it exists", async () => {
      const mockType = { id: "kyc_approved", name: "KYC Approved" };
      (prisma.notificationType.findUnique as jest.Mock).mockResolvedValue(mockType);

      const result = await repository.findTypeById("kyc_approved");

      expect(prisma.notificationType.findUnique).toHaveBeenCalledWith({
        where: { id: "kyc_approved" },
      });
      expect(result).toEqual(mockType);
    });
  });

  describe("findUserPreferences", () => {
    it("should return all preferences for a user", async () => {
      const mockPrefs = [{ notification_type_id: "a" }, { notification_type_id: "b" }];
      (prisma.userNotificationPreference.findMany as jest.Mock).mockResolvedValue(mockPrefs);

      const result = await repository.findUserPreferences(userId);

      expect(prisma.userNotificationPreference.findMany).toHaveBeenCalledWith({
        where: { user_id: userId },
      });
      expect(result).toEqual(mockPrefs);
    });
  });

  describe("upsertUserPreference", () => {
    it("should correctly upsert preferences", async () => {
      const data = { enabled_platform: true, enabled_email: false };
      await repository.upsertUserPreference(userId, "type_1", data);

      expect(prisma.userNotificationPreference.upsert).toHaveBeenCalledWith({
        where: {
          user_id_notification_type_id: { user_id: userId, notification_type_id: "type_1" },
        },
        create: { user_id: userId, notification_type_id: "type_1", ...data },
        update: data,
      });
    });
  });

  describe("deleteExpired", () => {
    it("should delete notifications where expires_at is in the past", async () => {
      const mockBatch = { count: 10 };
      (prisma.notification.deleteMany as jest.Mock).mockResolvedValue(mockBatch);

      const result = await repository.deleteExpired();

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { expires_at: { lt: expect.any(Date) } },
      });
      expect(result).toEqual(mockBatch);
    });
  });

  describe("deleteOldNotifications", () => {
    it("should delete notifications older than retention period", async () => {
      const mockBatch = { count: 5 };
      (prisma.notification.deleteMany as jest.Mock).mockResolvedValue(mockBatch);

      const result = await repository.deleteOldNotifications("type_1", 30);

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          notification_type_id: "type_1",
          created_at: { lt: expect.any(Date) },
        },
      });
      expect(result).toEqual(mockBatch);
    });
  });
});
