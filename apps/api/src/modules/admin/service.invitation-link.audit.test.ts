import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const invitationMutations = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

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
  sendEmail: jest.fn(),
}));
jest.mock("../security/audit/writer", () => ({
  writeSecurityAuditLog: jest.fn(async (input: (typeof auditWrites)[number]) => {
    auditWrites.push(input);
  }),
}));

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

function expectSafeLinkGenerated(
  event: (typeof auditWrites)[number],
  invitation: InvitationRow,
  correlationId: string
) {
  expect(event).toEqual(
    expect.objectContaining({
      eventType: "ADMIN_INVITATION_LINK_GENERATED",
      subjectUserId: null,
      targetType: "ADMIN_INVITATION",
      targetId: invitation.id,
      context: expect.objectContaining({
        actorType: "ADMIN",
        actorUserId: inviter.user_id,
        correlationId,
      }),
      metadata: expect.objectContaining({
        invitationId: invitation.id,
        email: invitation.email,
        role: invitation.role_description,
        expiresAt: invitation.expires_at.toISOString(),
      }),
    })
  );
  const serialized = JSON.stringify(event.metadata);
  expect(serialized).not.toContain(invitation.token);
  expect(serialized).not.toMatch(/https?:\/\//);
  expect(event.metadata.token).toBeUndefined();
  expect(event.metadata.inviteUrl).toBeUndefined();
  expect(event.metadata.url).toBeUndefined();
}

describe("Admin invitation copy-link audit", () => {
  const service = new AdminService();
  const repository = (service as unknown as { repository: InviteRepo }).repository;
  const previousAdminUrl = process.env.ADMIN_URL;

  beforeAll(() => {
    process.env.ADMIN_URL = "https://admin.example.com";
  });

  afterAll(() => {
    process.env.ADMIN_URL = previousAdminUrl;
  });

  beforeEach(() => {
    auditWrites.length = 0;
    invitations = [];
    nextInvitationId = 1;
    invitationMutations.create.mockClear();
    invitationMutations.update.mockClear();
    invitationMutations.delete.mockClear();
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

  it("dialog generateInvitationUrl writes LINK_GENERATED once without token or URL metadata", async () => {
    const result = await service.generateInvitationUrl(
      makeReq("corr-dialog"),
      { email: "ops@example.com", roleDescription: "OPERATIONS" },
      inviter.user_id,
      { writeLinkGenerated: true }
    );

    expect(invitations).toHaveLength(1);
    expect(invitationMutations.create).toHaveBeenCalledTimes(1);
    expect(result.inviteUrl).toBe(
      `https://admin.example.com/callback?invitation=${invitations[0].token}&role=OPERATIONS`
    );
    expect(auditWrites.map((row) => row.eventType)).toEqual([
      "ADMIN_INVITATION_CREATED",
      "ADMIN_INVITATION_LINK_GENERATED",
    ]);
    expectSafeLinkGenerated(auditWrites[1], invitations[0], "corr-dialog");
  });

  it("dialog generateInvitationUrl reuses a pending invite and still writes LINK_GENERATED once", async () => {
    const existing = pendingInvitation();
    invitations.push(existing);

    const result = await service.generateInvitationUrl(
      makeReq("corr-dialog-reuse"),
      { email: existing.email, roleDescription: existing.role_description },
      inviter.user_id,
      { writeLinkGenerated: true }
    );

    expect(invitations).toHaveLength(1);
    expect(invitations[0].token).toBe(existing.token);
    expect(invitations[0].expires_at).toEqual(existing.expires_at);
    expect(invitationMutations.create).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(auditWrites.map((row) => row.eventType)).toEqual(["ADMIN_INVITATION_LINK_GENERATED"]);
    expectSafeLinkGenerated(auditWrites[0], existing, "corr-dialog-reuse");
  });

  it("pending-table copyInvitationLink reuses the row and writes LINK_GENERATED once", async () => {
    const existing = pendingInvitation();
    invitations.push(existing);
    const tokenBefore = existing.token;
    const expiresBefore = existing.expires_at.getTime();

    const result = await service.copyInvitationLink(makeReq("corr-table"), existing.id);

    expect(result.inviteUrl).toBe(
      `https://admin.example.com/callback?invitation=${tokenBefore}&role=OPERATIONS`
    );
    expect(invitations).toHaveLength(1);
    expect(invitations[0].id).toBe(existing.id);
    expect(invitations[0].token).toBe(tokenBefore);
    expect(invitations[0].expires_at.getTime()).toBe(expiresBefore);
    expect(invitations[0].role_description).toBe("OPERATIONS");
    expect(invitations[0].accepted).toBe(false);
    expect(invitationMutations.create).not.toHaveBeenCalled();
    expect(invitationMutations.update).not.toHaveBeenCalled();
    expect(invitationMutations.delete).not.toHaveBeenCalled();
    expect(auditWrites.map((row) => row.eventType)).toEqual(["ADMIN_INVITATION_LINK_GENERATED"]);
    expectSafeLinkGenerated(auditWrites[0], existing, "corr-table");
  });

  it("copying the same pending link twice writes two LINK_GENERATED rows with distinct correlation ids", async () => {
    const existing = pendingInvitation();
    invitations.push(existing);

    await service.copyInvitationLink(makeReq("corr-copy-1"), existing.id);
    await service.copyInvitationLink(makeReq("corr-copy-2"), existing.id);

    expect(invitations).toHaveLength(1);
    expect(invitationMutations.create).not.toHaveBeenCalled();
    expect(auditWrites).toHaveLength(2);
    expect(auditWrites.map((row) => row.eventType)).toEqual([
      "ADMIN_INVITATION_LINK_GENERATED",
      "ADMIN_INVITATION_LINK_GENERATED",
    ]);
    expectSafeLinkGenerated(auditWrites[0], existing, "corr-copy-1");
    expectSafeLinkGenerated(auditWrites[1], existing, "corr-copy-2");
    expect(auditWrites[0].metadata.invitationId).toBe(existing.id);
    expect(auditWrites[1].metadata.invitationId).toBe(existing.id);
    expect(auditWrites[0].context.correlationId).not.toBe(auditWrites[1].context.correlationId);
  });

  it("does not write LINK_GENERATED for missing, expired, or accepted invitations", async () => {
    const expired = pendingInvitation({
      id: "inv-expired",
      expires_at: new Date("2020-01-01T00:00:00.000Z"),
    });
    const accepted = pendingInvitation({ id: "inv-accepted", accepted: true });
    invitations.push(expired, accepted);

    await expect(service.copyInvitationLink(makeReq("corr-missing"), "missing")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
    await expect(service.copyInvitationLink(makeReq("corr-expired"), expired.id)).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
    await expect(service.copyInvitationLink(makeReq("corr-accepted"), accepted.id)).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });

    expect(auditWrites).toEqual([]);
    expect(invitationMutations.create).not.toHaveBeenCalled();
    expect(invitations).toHaveLength(2);
  });

  it("copy-link HTTP route requires roles.manage and does not create invitations", () => {
    const controllerSource = readFileSync(join(__dirname, "controller.ts"), "utf8");
    const routeStart = controllerSource.indexOf('"/invitations/:id/copy-link"');
    expect(routeStart).toBeGreaterThan(-1);
    const routeBlock = controllerSource.slice(Math.max(0, routeStart - 120), routeStart + 900);
    expect(routeBlock).toContain('requirePermission("roles.manage")');
    expect(routeBlock).toContain("copyInvitationLink");
    expect(routeBlock).not.toContain("generateInvitationUrl");
    expect(routeBlock).not.toContain("writeLinkGenerated");
  });
});

jest.mock("../../lib/prisma", () => ({
  prisma: {
    adminInvitation: {
      findFirst: jest.fn(
        async ({ where }: { where: { email: string; role_description: string } }) => {
          return (
            invitations.find(
              (row) =>
                row.email === where.email &&
                row.role_description === where.role_description &&
                row.accepted === false &&
                row.expires_at > new Date()
            ) ?? null
          );
        }
      ),
      create: jest.fn(async (args: unknown) => {
        invitationMutations.create(args);
        throw new Error("unexpected prisma.adminInvitation.create");
      }),
      update: jest.fn(async (args: unknown) => {
        invitationMutations.update(args);
        throw new Error("unexpected prisma.adminInvitation.update");
      }),
      delete: jest.fn(async (args: unknown) => {
        invitationMutations.delete(args);
        throw new Error("unexpected prisma.adminInvitation.delete");
      }),
    },
    $transaction: async (
      fn: (tx: { adminInvitation: { create: jest.Mock } }) => Promise<unknown>
    ) => {
      const tx = {
        adminInvitation: {
          create: jest.fn(
            async ({
              data,
            }: {
              data: Omit<InvitationRow, "id" | "accepted" | "created_at">;
            }) => {
              invitationMutations.create(data);
              const created = pendingInvitation({
                email: data.email,
                role_description: data.role_description,
                token: data.token,
                expires_at: data.expires_at,
                invited_by_user_id: data.invited_by_user_id,
              });
              invitations.push(created);
              return created;
            }
          ),
        },
      };
      return fn(tx);
    },
  },
}));
