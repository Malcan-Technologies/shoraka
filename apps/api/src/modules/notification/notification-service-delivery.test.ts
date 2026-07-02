import { NotificationPriority, NotificationPortalTarget } from "@prisma/client";
import { NotificationTypeIds } from "./registry";

const mockFindByIdempotencyKey = jest.fn();
const mockFindTypeById = jest.fn();
const mockFindUserPreferences = jest.fn();
const mockRepositoryCreate = jest.fn();
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
    default_priority: NotificationPriority.WARNING,
    enabled_platform: enabledPlatform,
    enabled_email: enabledEmail,
    user_configurable: false,
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
