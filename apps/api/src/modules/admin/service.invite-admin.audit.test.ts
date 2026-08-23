import type { Request } from "express";
import { UserRole } from "@prisma/client";

type InvitationRow = {
  id: string;
  token: string;
  email: string;
  role_description: string;
  accepted: boolean;
  expires_at: Date;
  invited_by_user_id: string;
  created_at: Date;
};

const auditWrites: Array<{
  eventType: string;
  context: { correlationId: string | null; actorUserId: string | null; actorType: string };
  subjectUserId: string | null;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
}> = [];

let invitations: InvitationRow[] = [];
let nextInvitationId = 1;
let sendEmailImpl: () => Promise<{ messageId: string }> = async () => ({ messageId: "msg-1" });

jest.mock("./repository", () => ({
  AdminRepository: jest.fn().mockImplementation(() => ({
    getUserById: jest.fn(),
    getAdminRoleConfigByKey: jest.fn(),
    getAdminInvitationById: jest.fn(),
  })),
}));
jest.mock("../regtank/repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/api-client", () => ({
  RegTankAPIClient: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/service", () => ({
  RegTankService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../../lib/auth/rbac", () => ({
  ensureAdminRoleCatalog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../lib/http/request-utils", () => ({
  extractRequestMetadata: () => ({
    ipAddress: "127.0.0.1",
    userAgent: "jest",
    deviceInfo: "test",
    deviceType: "desktop",
  }),
  getClientIp: () => "127.0.0.1",
}));
jest.mock("../../lib/email/ses-client", () => ({
  sendEmail: jest.fn(async () => sendEmailImpl()),
}));
jest.mock("../security/audit/writer", () => ({
  writeSecurityAuditLog: jest.fn(async (input: (typeof auditWrites)[number]) => {
    auditWrites.push(input);
  }),
}));

import { sendEmail } from "../../lib/email/ses-client";
import { writeSecurityAuditLog } from "../security/audit/writer";
import { AdminService } from "./service";

const inviter = {
  user_id: "admin-actor",
  email: "actor@cashsouk.com",
  first_name: "Aisha",
  last_name: "Rahman",
  roles: [UserRole.ADMIN],
};

type InviteRepo = {
  getUserById: jest.Mock;
  getAdminRoleConfigByKey: jest.Mock;
  getAdminInvitationById: jest.Mock;
};

function makeReq(correlationId: string): Request {
  return {
    headers: { "user-agent": "jest" },
    ip: "127.0.0.1",
    user: { user_id: inviter.user_id, roles: [UserRole.ADMIN] },
    res: { locals: { correlationId } },
  } as unknown as Request;
}

function pendingInvitation(overrides: Partial<InvitationRow> = {}): InvitationRow {
  return {
    id: `inv-${nextInvitationId++}`,
    token: `token-${nextInvitationId}`,
    email: "ops@example.com",
    role_description: "OPERATIONS",
    accepted: false,
    expires_at: new Date("2099-01-01T00:00:00.000Z"),
    invited_by_user_id: inviter.user_id,
    created_at: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("AdminService.inviteAdmin reuse audit", () => {
  const service = new AdminService();
  const repository = (service as unknown as { repository: InviteRepo }).repository;

  beforeEach(() => {
    auditWrites.length = 0;
    invitations = [];
    nextInvitationId = 1;
    sendEmailImpl = async () => ({ messageId: "msg-1" });
    jest.clearAllMocks();

    repository.getUserById.mockResolvedValue(inviter);
    repository.getAdminRoleConfigByKey.mockImplementation(async (key: string) => ({
      id: `role-${key}`,
      key,
      name: key === "SUPER_ADMIN" ? "Super Admin" : "Operations",
      description: `${key} role`,
    }));
    repository.getAdminInvitationById.mockImplementation(async (id: string) => {
      return invitations.find((row) => row.id === id) ?? null;
    });
  });

  it("writes ADMIN_INVITATION_CREATED (not RESENT) for a new invitation", async () => {
    const result = await service.inviteAdmin(
      makeReq("corr-create"),
      { email: "ops@example.com", roleDescription: "OPERATIONS" },
      inviter.user_id
    );

    expect(result.emailSent).toBe(true);
    expect(invitations).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(auditWrites.map((row) => row.eventType)).toEqual(["ADMIN_INVITATION_CREATED"]);
    expect(auditWrites[0]).toEqual(
      expect.objectContaining({
        eventType: "ADMIN_INVITATION_CREATED",
        targetType: "ADMIN_INVITATION",
        targetId: invitations[0].id,
        subjectUserId: null,
        context: expect.objectContaining({
          actorType: "ADMIN",
          actorUserId: inviter.user_id,
          correlationId: "corr-create",
        }),
        metadata: expect.objectContaining({
          invitationId: invitations[0].id,
          email: "ops@example.com",
          role: "OPERATIONS",
        }),
      })
    );
    expect(auditWrites[0].metadata.emailSent).toBeUndefined();
  });

  it("reuses a valid same-email same-role invite and writes ADMIN_INVITATION_RESENT after email success", async () => {
    await service.inviteAdmin(
      makeReq("corr-create"),
      { email: "ops@example.com", roleDescription: "OPERATIONS" },
      inviter.user_id
    );
    const existingId = invitations[0].id;
    const createdCorrelationId = auditWrites[0].context.correlationId;

    const result = await service.inviteAdmin(
      makeReq("corr-reuse"),
      { email: "ops@example.com", roleDescription: "OPERATIONS" },
      inviter.user_id
    );

    expect(result.emailSent).toBe(true);
    expect(invitations).toHaveLength(1);
    expect(invitations[0].id).toBe(existingId);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(auditWrites.map((row) => row.eventType)).toEqual([
      "ADMIN_INVITATION_CREATED",
      "ADMIN_INVITATION_RESENT",
    ]);
    expect(auditWrites[1]).toEqual(
      expect.objectContaining({
        eventType: "ADMIN_INVITATION_RESENT",
        subjectUserId: null,
        targetType: "ADMIN_INVITATION",
        targetId: existingId,
        context: expect.objectContaining({
          actorType: "ADMIN",
          actorUserId: inviter.user_id,
          correlationId: "corr-reuse",
        }),
        metadata: expect.objectContaining({
          invitationId: existingId,
          email: "ops@example.com",
          role: "OPERATIONS",
          expiresAt: invitations[0].expires_at.toISOString(),
          emailSent: true,
        }),
      })
    );
    expect(createdCorrelationId).toBe("corr-create");
    expect(auditWrites[1].context.correlationId).toBe("corr-reuse");
    expect(auditWrites[1].context.correlationId).not.toBe(createdCorrelationId);
  });

  it("creates a new invitation for the same email with a different role", async () => {
    invitations.push(pendingInvitation({ role_description: "OPERATIONS" }));

    const result = await service.inviteAdmin(
      makeReq("corr-other-role"),
      { email: "ops@example.com", roleDescription: "SUPER_ADMIN" },
      inviter.user_id
    );

    expect(result.emailSent).toBe(true);
    expect(invitations).toHaveLength(2);
    expect(invitations[1].role_description).toBe("SUPER_ADMIN");
    expect(auditWrites.map((row) => row.eventType)).toEqual(["ADMIN_INVITATION_CREATED"]);
    expect(auditWrites[0].targetId).toBe(invitations[1].id);
    expect(auditWrites[0].metadata).toEqual(
      expect.objectContaining({
        invitationId: invitations[1].id,
        role: "SUPER_ADMIN",
      })
    );
  });

  it("keeps the explicit resend path writing ADMIN_INVITATION_RESENT once", async () => {
    const existing = pendingInvitation();
    invitations.push(existing);

    const result = await service.resendInvitation(makeReq("corr-explicit"), existing.id, inviter.user_id);

    expect(result.emailSent).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(auditWrites.map((row) => row.eventType)).toEqual(["ADMIN_INVITATION_RESENT"]);
    expect(auditWrites[0].targetId).toBe(existing.id);
    expect(auditWrites[0].metadata).toEqual(
      expect.objectContaining({
        invitationId: existing.id,
        emailSent: true,
      })
    );
  });

  it("does not write ADMIN_INVITATION_RESENT when reused-invite email send fails", async () => {
    invitations.push(pendingInvitation());
    sendEmailImpl = async () => {
      throw new Error("SES unavailable");
    };

    const result = await service.inviteAdmin(
      makeReq("corr-reuse-fail"),
      { email: "ops@example.com", roleDescription: "OPERATIONS" },
      inviter.user_id
    );

    expect(result.emailSent).toBe(false);
    expect(result.emailError).toBe("SES unavailable");
    expect(invitations).toHaveLength(1);
    expect(auditWrites).toEqual([]);
  });
});

jest.mock("../../lib/prisma", () => ({
  prisma: {
    adminInvitation: {
      findFirst: jest.fn(async ({ where }: { where: { email: string; role_description: string } }) => {
        return (
          invitations.find(
            (row) =>
              row.email === where.email &&
              row.role_description === where.role_description &&
              row.accepted === false &&
              row.expires_at > new Date()
          ) ?? null
        );
      }),
    },
    $transaction: async (fn: (tx: { adminInvitation: { create: jest.Mock } }) => Promise<unknown>) => {
      const tx = {
        adminInvitation: {
          create: jest.fn(async ({ data }: { data: Omit<InvitationRow, "id" | "accepted" | "created_at"> }) => {
            const created = pendingInvitation({
              email: data.email,
              role_description: data.role_description,
              token: data.token,
              expires_at: data.expires_at,
              invited_by_user_id: data.invited_by_user_id,
            });
            invitations.push(created);
            return created;
          }),
        },
      };
      return fn(tx);
    },
  },
}));
