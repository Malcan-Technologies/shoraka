import {
  NotificationCategory,
  NotificationPriority,
  NotificationPortalTarget,
} from "@prisma/client";
import { NotificationTypeIds } from "./registry";
import { AppError } from "../../lib/http/error-handler";

const mockFindByIdempotencyKey = jest.fn();
const mockFindTypeById = jest.fn();
const mockFindUserPreferences = jest.fn();
const mockRepositoryCreate = jest.fn();
const mockUpdateType = jest.fn();
const mockCreateTypeIfNotExist = jest.fn();
const mockSendEmail = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    notification: { update: jest.fn() },
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
    updateType: mockUpdateType,
    createTypeIfNotExist: mockCreateTypeIfNotExist,
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

function mockTypeRow(
  typeId: string,
  enabledPlatform: boolean,
  enabledEmail: boolean,
  extras: { category?: NotificationCategory; userConfigurable?: boolean } = {}
) {
  return {
    id: typeId,
    category: extras.category ?? NotificationCategory.SYSTEM,
    default_priority: NotificationPriority.WARNING,
    enabled_platform: enabledPlatform,
    enabled_email: enabledEmail,
    user_configurable: extras.userConfigurable ?? false,
    portal_targets:
      typeId === NotificationTypeIds.INVESTOR_DIRECTOR_SHAREHOLDER_ACTION_REQUIRED
        ? [NotificationPortalTarget.INVESTOR]
        : [NotificationPortalTarget.ISSUER],
    retention_days: null,
  };
}

async function runCreateForType(typeId: string, enabledPlatform: boolean, enabledEmail: boolean) {
  mockFindByIdempotencyKey.mockResolvedValue(null);
  mockFindTypeById.mockResolvedValue(mockTypeRow(typeId, enabledPlatform, enabledEmail));
  mockFindUserPreferences.mockResolvedValue([]);
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(ownerUser);
  mockRepositoryCreate.mockResolvedValue({
    id: "notif-1",
    title: "Action Required: Complete Director/Shareholder Onboarding",
    message: "Please complete onboarding for Director B.",
    link_path: "/profile",
    metadata: { portal: typeId.includes("investor") ? "investor" : "issuer" },
  });
  mockSendEmail.mockResolvedValue(undefined);
  (prisma.notification.update as jest.Mock).mockResolvedValue({});

  const service = new NotificationService();
  return service.create({
    userId: ownerUser.user_id,
    typeId,
    title: "Action Required: Complete Director/Shareholder Onboarding",
    message: "Please complete onboarding for Director B.",
    linkPath: "/profile",
    metadata: { portal: typeId.includes("investor") ? "investor" : "issuer" },
  });
}

describe("NotificationService delivery toggles for director/shareholder action-required types", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe.each([
    ["issuer", NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED],
    ["investor", NotificationTypeIds.INVESTOR_DIRECTOR_SHAREHOLDER_ACTION_REQUIRED],
  ] as const)("%s type", (_label, typeId) => {
    it("platform ON + email ON creates row with both channels and sends email", async () => {
      const result = await runCreateForType(typeId, true, true);
      expect(result).not.toBeNull();
      expect(mockRepositoryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          send_to_platform: true,
          send_to_email: true,
          notification_type: { connect: { id: typeId } },
          user: { connect: { user_id: ownerUser.user_id } },
        })
      );
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ownerUser.email,
          subject: "[CashSouk] Action Required: Complete Director/Shareholder Onboarding",
        })
      );
      expect(prisma.notification.update).toHaveBeenCalled();
    });

    it("platform OFF + email ON creates email-only row and sends email", async () => {
      const result = await runCreateForType(typeId, false, true);
      expect(result).not.toBeNull();
      expect(mockRepositoryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          send_to_platform: false,
          send_to_email: true,
        })
      );
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it("platform ON + email OFF creates platform-only row without email", async () => {
      const result = await runCreateForType(typeId, true, false);
      expect(result).not.toBeNull();
      expect(mockRepositoryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          send_to_platform: true,
          send_to_email: false,
        })
      );
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("platform OFF + email OFF skips notification creation", async () => {
      const result = await runCreateForType(typeId, false, false);
      expect(result).toBeNull();
      expect(mockRepositoryCreate).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });
});

describe("NotificationService AUTHENTICATION forced delivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function runPasswordChangedCreate(overrides?: {
    sendToPlatform?: boolean;
    sendToEmail?: boolean;
    userPref?: { enabled_platform: boolean; enabled_email: boolean };
  }) {
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(NotificationTypeIds.PASSWORD_CHANGED, false, false, {
        category: NotificationCategory.AUTHENTICATION,
        userConfigurable: true,
      })
    );
    mockFindUserPreferences.mockResolvedValue(
      overrides?.userPref
        ? [
            {
              notification_type_id: NotificationTypeIds.PASSWORD_CHANGED,
              ...overrides.userPref,
            },
          ]
        : []
    );
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(ownerUser);
    mockRepositoryCreate.mockResolvedValue({
      id: "notif-auth",
      title: "Password Changed",
      message: "The password for your account was changed.",
      link_path: "/account",
      metadata: {},
    });
    mockSendEmail.mockResolvedValue(undefined);
    (prisma.notification.update as jest.Mock).mockResolvedValue({});

    const service = new NotificationService();
    return service.create({
      userId: ownerUser.user_id,
      typeId: NotificationTypeIds.PASSWORD_CHANGED,
      title: "Password Changed",
      message: "The password for your account was changed.",
      linkPath: "/account",
      sendToPlatform: overrides?.sendToPlatform,
      sendToEmail: overrides?.sendToEmail,
    });
  }

  it("forces platform and email on even when type settings, prefs, and overrides are off", async () => {
    const result = await runPasswordChangedCreate({
      sendToPlatform: false,
      sendToEmail: false,
      userPref: { enabled_platform: false, enabled_email: false },
    });

    expect(result).not.toBeNull();
    expect(mockRepositoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        send_to_platform: true,
        send_to_email: true,
        notification_type: { connect: { id: NotificationTypeIds.PASSWORD_CHANGED } },
      })
    );
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("NotificationService.updateNotificationType AUTHENTICATION guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects disabling platform or email on AUTHENTICATION types", async () => {
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(NotificationTypeIds.PASSWORD_CHANGED, true, true, {
        category: NotificationCategory.AUTHENTICATION,
      })
    );
    const service = new NotificationService();

    await expect(
      service.updateNotificationType(NotificationTypeIds.PASSWORD_CHANGED, {
        enabled_platform: false,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "AUTHENTICATION_NOTIFICATION_REQUIRED",
    });
    await expect(
      service.updateNotificationType(NotificationTypeIds.PASSWORD_CHANGED, {
        enabled_email: false,
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(mockUpdateType).not.toHaveBeenCalled();
  });

  it("allows AUTHENTICATION updates that keep both channels enabled", async () => {
    const typeRow = mockTypeRow(NotificationTypeIds.PASSWORD_CHANGED, true, true, {
      category: NotificationCategory.AUTHENTICATION,
    });
    mockFindTypeById.mockResolvedValue(typeRow);
    mockUpdateType.mockResolvedValue({ ...typeRow, retention_days: 90 });
    const service = new NotificationService();

    await expect(
      service.updateNotificationType(NotificationTypeIds.PASSWORD_CHANGED, {
        enabled_platform: true,
        enabled_email: true,
        retention_days: 90,
      })
    ).resolves.toEqual(expect.objectContaining({ retention_days: 90 }));
    expect(mockUpdateType).toHaveBeenCalled();
  });

  it("allows disabling channels on non-AUTHENTICATION types", async () => {
    const typeRow = mockTypeRow(NotificationTypeIds.NOTE_PUBLISHED, true, false);
    mockFindTypeById.mockResolvedValue(typeRow);
    mockUpdateType.mockResolvedValue({ ...typeRow, enabled_platform: false });
    const service = new NotificationService();

    await expect(
      service.updateNotificationType(NotificationTypeIds.NOTE_PUBLISHED, {
        enabled_platform: false,
      })
    ).resolves.toEqual(expect.objectContaining({ enabled_platform: false }));
  });
});

describe("NotificationService.resetNotificationTypesToDefault", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds missing types and turns both channels on for existing catalog types", async () => {
    mockCreateTypeIfNotExist.mockImplementation(async (type: { id: string }) => {
      if (type.id === "password_changed") return { id: type.id };
      return null;
    });
    mockUpdateType.mockResolvedValue({});
    const service = new NotificationService();
    const result = await service.resetNotificationTypesToDefault();

    expect(result.added).toBe(1);
    expect(result.reset).toBe(result.count - 1);
    expect(result.count).toBeGreaterThan(1);
    expect(mockUpdateType).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ enabled_platform: true, enabled_email: true })
    );
    expect(mockUpdateType).not.toHaveBeenCalledWith("password_changed", expect.anything());
  });
});

describe("Admin-configurable channels for investment_committed and deposit_successful", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockFindUserPreferences.mockResolvedValue([]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(ownerUser);
    mockSendEmail.mockResolvedValue(undefined);
    (prisma.notification.update as jest.Mock).mockResolvedValue({});
  });

  it.each([
    [
      NotificationTypeIds.INVESTMENT_COMMITTED,
      { amount: 2500, noteId: "n1", noteTitle: "Invoice Note" },
    ],
    [NotificationTypeIds.DEPOSIT_SUCCESSFUL, { amount: 1500 }],
  ] as const)("%s seed default (email off) does not send email", async (typeId, payload) => {
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(typeId, true, false, { userConfigurable: true })
    );
    mockRepositoryCreate.mockResolvedValue({
      id: "notif-1",
      send_to_platform: true,
      send_to_email: false,
    });
    const service = new NotificationService();
    await service.sendTyped(ownerUser.user_id, typeId, payload, `${typeId}:idem`);

    expect(mockRepositoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        send_to_platform: true,
        send_to_email: false,
      })
    );
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it.each([
    [
      NotificationTypeIds.INVESTMENT_COMMITTED,
      { amount: 2500, noteId: "n1", noteTitle: "Invoice Note" },
    ],
    [NotificationTypeIds.DEPOSIT_SUCCESSFUL, { amount: 1500 }],
  ] as const)("%s sends email when Admin enables the email channel", async (typeId, payload) => {
    mockFindTypeById.mockResolvedValue(
      mockTypeRow(typeId, true, true, { userConfigurable: true })
    );
    mockRepositoryCreate.mockResolvedValue({
      id: "notif-1",
      send_to_platform: true,
      send_to_email: true,
      title: "t",
      message: "m",
      link_path: "/",
      metadata: { portal: "investor" },
    });
    const service = new NotificationService();
    await service.sendTyped(ownerUser.user_id, typeId, payload, `${typeId}:email-on`);

    expect(mockRepositoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        send_to_platform: true,
        send_to_email: true,
      })
    );
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("lets Admin toggle the new types via updateNotificationType", async () => {
    const typeRow = mockTypeRow(NotificationTypeIds.INVESTMENT_COMMITTED, true, false, {
      userConfigurable: true,
    });
    mockFindTypeById.mockResolvedValue(typeRow);
    mockUpdateType.mockResolvedValue({ ...typeRow, enabled_email: true });
    const service = new NotificationService();

    await expect(
      service.updateNotificationType(NotificationTypeIds.INVESTMENT_COMMITTED, {
        enabled_platform: true,
        enabled_email: true,
      })
    ).resolves.toEqual(expect.objectContaining({ enabled_email: true }));
  });
});
