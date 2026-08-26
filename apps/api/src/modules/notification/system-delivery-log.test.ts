import {
  NotificationCategory,
  NotificationLogSource,
  NotificationPriority,
  NotificationPortalTarget,
} from "@prisma/client";
import { NotificationTypeIds } from "./registry";
import { systemNotificationLogKey } from "./delivery-log";

const mockFindByIdempotencyKey = jest.fn();
const mockFindTypeById = jest.fn();
const mockFindUserPreferences = jest.fn();
const mockRepositoryCreate = jest.fn();
const mockSendEmail = jest.fn();
const mockNotificationLogCreate = jest.fn();
const mockNotificationLogFindMany = jest.fn();
const mockNotificationLogCount = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserFindMany = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
    notification: { update: jest.fn() },
    notificationLog: {
      create: (...args: unknown[]) => mockNotificationLogCreate(...args),
      findMany: (...args: unknown[]) => mockNotificationLogFindMany(...args),
      count: (...args: unknown[]) => mockNotificationLogCount(...args),
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
    createTypeIfNotExist: jest.fn(),
  })),
  NotificationGroupRepository: jest.fn().mockImplementation(() => ({})),
}));

import { prisma } from "../../lib/prisma";
import { NotificationService } from "./service";

const ownerUser = {
  user_id: "owner-1",
  email: "owner@example.com",
  first_name: "Owner",
};

function mockTypeRow(typeId: string, enabledPlatform: boolean, enabledEmail: boolean) {
  return {
    id: typeId,
    name: "Note published",
    category: NotificationCategory.SYSTEM,
    default_priority: NotificationPriority.INFO,
    enabled_platform: enabledPlatform,
    enabled_email: enabledEmail,
    user_configurable: false,
    portal_targets: [NotificationPortalTarget.ISSUER],
    retention_days: null,
  };
}

describe("NotificationService system delivery logs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockFindUserPreferences.mockResolvedValue([]);
    mockUserFindUnique.mockResolvedValue(ownerUser);
    mockSendEmail.mockResolvedValue(undefined);
    (prisma.notification.update as jest.Mock).mockResolvedValue({});
    mockNotificationLogCreate.mockResolvedValue({ id: "log-1" });
    mockNotificationLogFindMany.mockResolvedValue([]);
    mockNotificationLogCount.mockResolvedValue(0);
  });

  it("writes one SYSTEM row per batch including all-skipped zero counts", async () => {
    const service = new NotificationService();
    const idempotencyKey = systemNotificationLogKey(
      NotificationTypeIds.NOTE_PUBLISHED,
      "note:lifecycle:n1:published"
    );
    await service.logTypedSystemBatch(
      NotificationTypeIds.NOTE_PUBLISHED,
      { noteId: "n1", noteTitle: "Note One" },
      [null, null],
      { idempotencyKey }
    );

    expect(mockNotificationLogCreate).toHaveBeenCalledTimes(1);
    expect(mockNotificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: NotificationLogSource.SYSTEM,
        notification_type_id: NotificationTypeIds.NOTE_PUBLISHED,
        title: "Note published",
        recipient_count: 2,
        delivered_platform_count: 0,
        delivered_email_count: 0,
        target_type: "ISSUERS",
        idempotency_key: idempotencyKey,
      }),
    });
  });

  it("counts selected platform and email channels from created rows", async () => {
    const service = new NotificationService();
    await service.logSystemDelivery({
      typeId: NotificationTypeIds.NOTE_PUBLISHED,
      title: "Note published",
      message: "Your note was published.",
      targetType: "ISSUERS",
      recipientCount: 3,
      idempotencyKey: systemNotificationLogKey(
        NotificationTypeIds.NOTE_PUBLISHED,
        "note:lifecycle:n1:published"
      ),
      results: [
        { send_to_platform: true, send_to_email: false },
        { send_to_platform: true, send_to_email: true },
        null,
      ],
    });

    expect(mockNotificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: NotificationLogSource.SYSTEM,
        recipient_count: 3,
        delivered_platform_count: 2,
        delivered_email_count: 1,
        idempotency_key: systemNotificationLogKey(
          NotificationTypeIds.NOTE_PUBLISHED,
          "note:lifecycle:n1:published"
        ),
      }),
    });
  });

  it("does not throw when the system log write fails", async () => {
    mockNotificationLogCreate.mockRejectedValueOnce(new Error("db down"));
    const service = new NotificationService();

    await expect(
      service.logSystemDelivery({
        typeId: NotificationTypeIds.NOTE_PUBLISHED,
        title: "Note published",
        message: "Your note was published.",
        targetType: "ISSUERS",
        recipientCount: 1,
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_PUBLISHED,
          "note:lifecycle:n1:published"
        ),
        results: [{ send_to_platform: true, send_to_email: false }],
      })
    ).resolves.toBeUndefined();
  });

  it("skips an empty typed batch so wrappers do not log zero-recipient events", async () => {
    const service = new NotificationService();
    await service.logTypedSystemBatch(
      NotificationTypeIds.NOTE_PUBLISHED,
      { noteId: "n1", noteTitle: "Note One" },
      [],
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_PUBLISHED,
          "note:lifecycle:n1:published"
        ),
      }
    );
    expect(mockNotificationLogCreate).not.toHaveBeenCalled();
  });

  it("sets ADMIN source and selected-channel counts on bulk send", async () => {
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(NotificationTypeIds.SYSTEM_ANNOUNCEMENT, true, true)
    );
    mockUserFindMany.mockResolvedValue([{ user_id: "u1" }, { user_id: "u2" }]);
    mockRepositoryCreate
      .mockResolvedValueOnce({
        id: "n1",
        send_to_platform: true,
        send_to_email: true,
      })
      .mockResolvedValueOnce({
        id: "n2",
        send_to_platform: true,
        send_to_email: false,
      });

    const service = new NotificationService();
    await service.sendBulkNotification("admin-1", {
      targetType: "INVESTORS",
      typeId: NotificationTypeIds.SYSTEM_ANNOUNCEMENT,
      title: "Hello",
      message: "World",
      ip_address: "1.1.1.1",
      user_agent: "jest",
      device_info: "test-device",
    });

    expect(mockNotificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        admin_user_id: "admin-1",
        source: NotificationLogSource.ADMIN,
        target_type: "INVESTORS",
        notification_type_id: NotificationTypeIds.SYSTEM_ANNOUNCEMENT,
        title: "Hello",
        message: "World",
        recipient_count: 2,
        delivered_platform_count: 2,
        delivered_email_count: 1,
        ip_address: "1.1.1.1",
        user_agent: "jest",
        device_info: "test-device",
        idempotency_key: null,
      }),
    });
  });

  it("does not write a log from create()", async () => {
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(NotificationTypeIds.NOTE_PUBLISHED, true, false)
    );
    mockRepositoryCreate.mockResolvedValue({
      id: "n-create",
      send_to_platform: true,
      send_to_email: false,
    });
    const service = new NotificationService();
    await service.create({
      userId: ownerUser.user_id,
      typeId: NotificationTypeIds.NOTE_PUBLISHED,
      title: "Note published",
      message: "Your note was published.",
    });
    expect(mockRepositoryCreate).toHaveBeenCalled();
    expect(mockNotificationLogCreate).not.toHaveBeenCalled();
  });

  it("logs a batch-of-one SYSTEM row when sendTypedAndLogSystem skips every channel", async () => {
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(NotificationTypeIds.NOTE_PUBLISHED, false, false)
    );
    const service = new NotificationService();
    const result = await service.sendTypedAndLogSystem(
      ownerUser.user_id,
      NotificationTypeIds.NOTE_PUBLISHED,
      { noteId: "n1", noteTitle: "Note One" },
      "note:lifecycle:n1:published:user:owner-1"
    );

    expect(result).toBeNull();
    expect(mockRepositoryCreate).not.toHaveBeenCalled();
    expect(mockNotificationLogCreate).toHaveBeenCalledTimes(1);
    expect(mockNotificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: NotificationLogSource.SYSTEM,
        title: "Note published",
        recipient_count: 1,
        delivered_platform_count: 0,
        delivered_email_count: 0,
        target_type: "ISSUERS",
        idempotency_key: systemNotificationLogKey(
          NotificationTypeIds.NOTE_PUBLISHED,
          "note:lifecycle:n1:published:user:owner-1"
        ),
      }),
    });
  });

  it("does not throw when the admin bulk log write fails", async () => {
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(NotificationTypeIds.SYSTEM_ANNOUNCEMENT, true, true)
    );
    mockUserFindMany.mockResolvedValue([{ user_id: "u1" }]);
    mockRepositoryCreate.mockResolvedValue({
      id: "n1",
      send_to_platform: true,
      send_to_email: true,
    });
    mockNotificationLogCreate.mockRejectedValueOnce(new Error("db down"));

    const service = new NotificationService();
    await expect(
      service.sendBulkNotification("admin-1", {
        targetType: "INVESTORS",
        typeId: NotificationTypeIds.SYSTEM_ANNOUNCEMENT,
        title: "Hello",
        message: "World",
      })
    ).resolves.toEqual([{ userId: "u1", success: true, id: "n1" }]);
  });

  it("still attempts a SYSTEM log on sendTypedAndLogSystem notification replay", async () => {
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(NotificationTypeIds.NOTE_PUBLISHED, true, false)
    );
    mockFindByIdempotencyKey.mockResolvedValue({
      id: "existing",
      send_to_platform: true,
      send_to_email: false,
    });

    const service = new NotificationService();
    const result = await service.sendTypedAndLogSystem(
      ownerUser.user_id,
      NotificationTypeIds.NOTE_PUBLISHED,
      { noteId: "n1", noteTitle: "Note One" },
      "note:lifecycle:n1:published:user:owner-1"
    );

    expect(result).toEqual(expect.objectContaining({ id: "existing" }));
    expect(mockRepositoryCreate).not.toHaveBeenCalled();
    expect(mockNotificationLogCreate).toHaveBeenCalledTimes(1);
    expect(mockNotificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotency_key: systemNotificationLogKey(
          NotificationTypeIds.NOTE_PUBLISHED,
          "note:lifecycle:n1:published:user:owner-1"
        ),
      }),
    });
  });

  it("treats a SYSTEM log unique conflict as a successful replay", async () => {
    const { logger } = await import("../../lib/logger");
    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => logger);
    const service = new NotificationService();
    const idempotencyKey = systemNotificationLogKey(
      NotificationTypeIds.NOTE_PUBLISHED,
      "note:lifecycle:n1:published"
    );
    const input = {
      typeId: NotificationTypeIds.NOTE_PUBLISHED,
      title: "Note published",
      message: "Your note was published.",
      targetType: "ISSUERS",
      recipientCount: 1,
      idempotencyKey,
      results: [{ send_to_platform: true, send_to_email: false }],
    };

    await service.logSystemDelivery(input);
    mockNotificationLogCreate.mockRejectedValueOnce({ code: "P2002" });
    await expect(service.logSystemDelivery(input)).resolves.toBeUndefined();

    expect(mockNotificationLogCreate).toHaveBeenCalledTimes(2);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("writes a second SYSTEM row when the batch key differs", async () => {
    const service = new NotificationService();
    await service.logSystemDelivery({
      typeId: NotificationTypeIds.NOTE_PUBLISHED,
      title: "Note published",
      message: "Your note was published.",
      targetType: "ISSUERS",
      recipientCount: 1,
      idempotencyKey: systemNotificationLogKey(
        NotificationTypeIds.NOTE_PUBLISHED,
        "note:lifecycle:n1:published"
      ),
      results: [{ send_to_platform: true, send_to_email: false }],
    });
    await service.logSystemDelivery({
      typeId: NotificationTypeIds.NOTE_PAYMENT_RECEIVED,
      title: "Payment received",
      message: "A payment was posted.",
      targetType: "INVESTORS",
      recipientCount: 1,
      idempotencyKey: systemNotificationLogKey(
        NotificationTypeIds.NOTE_PAYMENT_RECEIVED,
        "note:lifecycle:n1:payment_received:pay-1"
      ),
      results: [{ send_to_platform: true, send_to_email: false }],
    });

    expect(mockNotificationLogCreate).toHaveBeenCalledTimes(2);
    expect(mockNotificationLogCreate.mock.calls[0]?.[0].data.idempotency_key).toBe(
      systemNotificationLogKey(NotificationTypeIds.NOTE_PUBLISHED, "note:lifecycle:n1:published")
    );
    expect(mockNotificationLogCreate.mock.calls[1]?.[0].data.idempotency_key).toBe(
      systemNotificationLogKey(
        NotificationTypeIds.NOTE_PAYMENT_RECEIVED,
        "note:lifecycle:n1:payment_received:pay-1"
      )
    );
  });

  it("writes one grouped ADMIN log when every custom recipient fails", async () => {
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(NotificationTypeIds.SYSTEM_ANNOUNCEMENT, true, true)
    );
    mockUserFindMany.mockResolvedValue([{ user_id: "u1" }, { user_id: "u2" }]);
    mockRepositoryCreate.mockRejectedValue(new Error("user missing"));

    const service = new NotificationService();
    const results = await service.sendBulkNotification("admin-1", {
      targetType: "INVESTORS",
      typeId: NotificationTypeIds.SYSTEM_ANNOUNCEMENT,
      title: "Hello",
      message: "World",
    });

    expect(results).toHaveLength(2);
    expect(results.every((row) => row.success === false)).toBe(true);
    expect(mockNotificationLogCreate).toHaveBeenCalledTimes(1);
    expect(mockNotificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        admin_user_id: "admin-1",
        source: NotificationLogSource.ADMIN,
        title: "Hello",
        message: "World",
        recipient_count: 2,
        delivered_platform_count: 0,
        delivered_email_count: 0,
        idempotency_key: null,
      }),
    });
  });

  it("writes one grouped ADMIN log for an empty custom audience", async () => {
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(NotificationTypeIds.SYSTEM_ANNOUNCEMENT, true, true)
    );
    mockUserFindMany.mockResolvedValue([]);

    const service = new NotificationService();
    await service.sendBulkNotification("admin-1", {
      targetType: "INVESTORS",
      typeId: NotificationTypeIds.SYSTEM_ANNOUNCEMENT,
      title: "Hello",
      message: "World",
    });

    expect(mockRepositoryCreate).not.toHaveBeenCalled();
    expect(mockNotificationLogCreate).toHaveBeenCalledTimes(1);
    expect(mockNotificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: NotificationLogSource.ADMIN,
        recipient_count: 0,
        delivered_platform_count: 0,
        delivered_email_count: 0,
      }),
    });
  });

  it("still writes a SYSTEM log when sendTypedAndLogSystem throws", async () => {
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(NotificationTypeIds.NOTE_PUBLISHED, true, false)
    );
    mockUserFindUnique.mockResolvedValue(null);

    const service = new NotificationService();
    await expect(
      service.sendTypedAndLogSystem(
        "missing-user",
        NotificationTypeIds.NOTE_PUBLISHED,
        { noteId: "n1", noteTitle: "Note One" },
        "note:lifecycle:n1:published:user:missing-user"
      )
    ).rejects.toThrow("User missing-user not found");

    expect(mockNotificationLogCreate).toHaveBeenCalledTimes(1);
    expect(mockNotificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: NotificationLogSource.SYSTEM,
        recipient_count: 1,
        delivered_platform_count: 0,
        delivered_email_count: 0,
        target_type: "ISSUERS",
        idempotency_key: systemNotificationLogKey(
          NotificationTypeIds.NOTE_PUBLISHED,
          "note:lifecycle:n1:published:user:missing-user"
        ),
      }),
    });
  });

  it("honors an explicit SYSTEM log target type", async () => {
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(NotificationTypeIds.PASSWORD_CHANGED, true, true)
    );
    mockRepositoryCreate.mockResolvedValue({
      id: "n-auth",
      send_to_platform: true,
      send_to_email: true,
    });

    const service = new NotificationService();
    await service.sendTypedAndLogSystem(
      ownerUser.user_id,
      NotificationTypeIds.PASSWORD_CHANGED,
      { changedAt: new Date("2026-08-26T00:00:00.000Z") },
      "password_changed:owner-1:2026-08-26T00:00:00.000Z",
      { targetType: "ALL_USERS" }
    );

    expect(mockNotificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: NotificationLogSource.SYSTEM,
        target_type: "ALL_USERS",
        notification_type_id: NotificationTypeIds.PASSWORD_CHANGED,
        recipient_count: 1,
      }),
    });
  });

  it("filters admin logs by source and searches title/type with null admin", async () => {
    const service = new NotificationService();
    await service.getAdminLogs({
      search: "Note published",
      source: "SYSTEM",
      type: "all",
      target: "all",
    });

    expect(mockNotificationLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: expect.arrayContaining([
                { title: { contains: "Note published", mode: "insensitive" } },
                { message: { contains: "Note published", mode: "insensitive" } },
                { notification_type_id: { contains: "Note published", mode: "insensitive" } },
                {
                  notification_type: { name: { contains: "Note published", mode: "insensitive" } },
                },
                { admin: { first_name: { contains: "Note published", mode: "insensitive" } } },
              ]),
            },
            {},
            {},
            { source: NotificationLogSource.SYSTEM },
          ],
        },
        include: expect.objectContaining({
          admin: expect.any(Object),
          notification_type: true,
        }),
      })
    );
  });
});
