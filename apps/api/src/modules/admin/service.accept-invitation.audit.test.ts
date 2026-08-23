import type { Request } from "express";
import { UserRole } from "@prisma/client";

type UserRow = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: UserRole[];
};

type AdminRow = {
  user_id: string;
  role_id: string | null;
  role_description: string;
  status: "ACTIVE" | "INACTIVE";
};

type InvitationRow = {
  id: string;
  token: string;
  email: string;
  role_description: string;
  accepted: boolean;
  accepted_at: Date | null;
  expires_at: Date;
};

const createdAuditLogs: Array<Record<string, unknown>> = [];
let failAuditEventType: string | null = null;
let userRow: UserRow;
let adminRow: AdminRow | null;
let invitationRow: InvitationRow;

jest.mock("./repository", () => ({
  AdminRepository: jest.fn().mockImplementation(() => ({
    getAdminInvitationByToken: jest.fn(),
    getAdminRoleConfigByKey: jest.fn(),
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

function cloneUser(row: UserRow): UserRow {
  return { ...row, roles: [...row.roles] };
}

function cloneAdmin(row: AdminRow | null): AdminRow | null {
  return row ? { ...row } : null;
}

function cloneInvitation(row: InvitationRow): InvitationRow {
  return { ...row };
}

const mockTx = {
  user: {
    findUnique: jest.fn(async ({ where }: { where: { user_id: string } }) => {
      if (where.user_id !== userRow.user_id) return null;
      return cloneUser(userRow);
    }),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { user_id: string };
        data: { roles?: { set: UserRole[] } };
      }) => {
        if (where.user_id !== userRow.user_id) throw new Error("User not found");
        if (data.roles?.set) userRow.roles = [...data.roles.set];
        return cloneUser(userRow);
      }
    ),
  },
  admin: {
    findUnique: jest.fn(async ({ where }: { where: { user_id: string } }) => {
      if (!adminRow || adminRow.user_id !== where.user_id) return null;
      return cloneAdmin(adminRow);
    }),
    create: jest.fn(async ({ data }: { data: AdminRow }) => {
      adminRow = { ...data };
      return cloneAdmin(adminRow);
    }),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { user_id: string };
        data: Partial<AdminRow>;
      }) => {
        if (!adminRow || adminRow.user_id !== where.user_id) throw new Error("Admin not found");
        adminRow = { ...adminRow, ...data };
        return cloneAdmin(adminRow);
      }
    ),
  },
  adminRoleConfig: {
    findUnique: jest.fn(async ({ where }: { where: { key: string } }) => ({
      id: `role-${where.key}`,
      key: where.key,
    })),
  },
  adminInvitation: {
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { token: string };
        data: { accepted: boolean; accepted_at: Date };
      }) => {
        if (invitationRow.token !== where.token) throw new Error("Invitation not found");
        invitationRow.accepted = data.accepted;
        invitationRow.accepted_at = data.accepted_at;
        return cloneInvitation(invitationRow);
      }
    ),
  },
  securityAuditLog: {
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (failAuditEventType && data.event_type === failAuditEventType) {
        throw new Error(`${String(data.event_type)} insert failed`);
      }
      createdAuditLogs.push(data);
      return data;
    }),
  },
};

jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email?: string; user_id?: string } }) => {
        if (where.email && where.email === userRow.email) return cloneUser(userRow);
        if (where.user_id && where.user_id === userRow.user_id) return cloneUser(userRow);
        return null;
      }),
    },
    $transaction: async (fn: (client: typeof mockTx) => Promise<unknown>) => {
      const snapshot = {
        user: cloneUser(userRow),
        admin: cloneAdmin(adminRow),
        invitation: cloneInvitation(invitationRow),
        audits: [...createdAuditLogs],
      };
      try {
        return await fn(mockTx);
      } catch (error) {
        userRow = snapshot.user;
        adminRow = snapshot.admin;
        invitationRow = snapshot.invitation;
        createdAuditLogs.length = 0;
        createdAuditLogs.push(...snapshot.audits);
        throw error;
      }
    },
  },
}));

import { AdminService } from "./service";

function makeReq(): Request {
  return {
    headers: { "user-agent": "jest" },
    ip: "127.0.0.1",
    res: { locals: { correlationId: "corr-invite-accept" } },
  } as unknown as Request;
}

type AcceptRepo = {
  getAdminInvitationByToken: jest.Mock;
  getAdminRoleConfigByKey: jest.Mock;
};

describe("AdminService.acceptInvitation catalog role audit", () => {
  const service = new AdminService();
  const repository = (service as unknown as { repository: AcceptRepo }).repository;

  beforeEach(() => {
    createdAuditLogs.length = 0;
    failAuditEventType = null;
    userRow = {
      user_id: "user-ada",
      email: "ada@cashsouk.com",
      first_name: "Ada",
      last_name: "Admin",
      roles: [UserRole.ADMIN],
    };
    adminRow = null;
    invitationRow = {
      id: "inv-1",
      token: "token-1",
      email: "ada@cashsouk.com",
      role_description: "OPERATIONS",
      accepted: false,
      accepted_at: null,
      expires_at: new Date("2099-01-01T00:00:00.000Z"),
    };
    jest.clearAllMocks();
    repository.getAdminInvitationByToken.mockImplementation(async () => cloneInvitation(invitationRow));
    repository.getAdminRoleConfigByKey.mockResolvedValue({
      id: "role-OPERATIONS",
      key: "OPERATIONS",
    });
  });

  it("writes only ADMIN_INVITATION_ACCEPTED when creating a new Admin", async () => {
    userRow.roles = [];

    const result = await service.acceptInvitation(makeReq(), { token: "token-1" });

    expect(result.admin.role_description).toBe("OPERATIONS");
    expect(adminRow?.role_description).toBe("OPERATIONS");
    expect(invitationRow.accepted).toBe(true);
    expect(createdAuditLogs.map((row) => row.event_type)).toEqual(["ADMIN_INVITATION_ACCEPTED"]);
  });

  it("does not write ADMIN_USER_ROLE_CHANGED when an existing Admin keeps the same role", async () => {
    adminRow = {
      user_id: "user-ada",
      role_id: "role-OPERATIONS",
      role_description: "OPERATIONS",
      status: "ACTIVE",
    };

    await service.acceptInvitation(makeReq(), { token: "token-1" });

    expect(adminRow.role_description).toBe("OPERATIONS");
    expect(createdAuditLogs.map((row) => row.event_type)).toEqual(["ADMIN_INVITATION_ACCEPTED"]);
  });

  it("writes ADMIN_USER_ROLE_CHANGED then ADMIN_INVITATION_ACCEPTED when an existing Admin’s role changes", async () => {
    adminRow = {
      user_id: "user-ada",
      role_id: "role-SUPER_ADMIN",
      role_description: "SUPER_ADMIN",
      status: "ACTIVE",
    };

    await service.acceptInvitation(makeReq(), { token: "token-1" });

    expect(adminRow.role_description).toBe("OPERATIONS");
    expect(createdAuditLogs.map((row) => row.event_type)).toEqual([
      "ADMIN_USER_ROLE_CHANGED",
      "ADMIN_INVITATION_ACCEPTED",
    ]);
    expect(createdAuditLogs[0]).toEqual(
      expect.objectContaining({
        event_type: "ADMIN_USER_ROLE_CHANGED",
        actor_type: "ADMIN",
        actor_user_id: "user-ada",
        subject_user_id: "user-ada",
        target_type: "USER",
        target_id: "user-ada",
        source: "API",
        portal: "ADMIN",
        correlation_id: "corr-invite-accept",
        metadata: expect.objectContaining({
          actorName: "Ada Admin",
          actorEmail: "ada@cashsouk.com",
          previousRole: "SUPER_ADMIN",
          newRole: "OPERATIONS",
        }),
      })
    );
    expect(createdAuditLogs[1]).toEqual(
      expect.objectContaining({
        event_type: "ADMIN_INVITATION_ACCEPTED",
        actor_user_id: "user-ada",
        subject_user_id: "user-ada",
        correlation_id: "corr-invite-accept",
        metadata: expect.objectContaining({
          invitationId: "inv-1",
          email: "ada@cashsouk.com",
          role: "OPERATIONS",
        }),
      })
    );
  });

  it("rolls back the role update and invitation when ADMIN_USER_ROLE_CHANGED insert fails", async () => {
    adminRow = {
      user_id: "user-ada",
      role_id: "role-SUPER_ADMIN",
      role_description: "SUPER_ADMIN",
      status: "ACTIVE",
    };
    failAuditEventType = "ADMIN_USER_ROLE_CHANGED";

    await expect(service.acceptInvitation(makeReq(), { token: "token-1" })).rejects.toThrow(
      "ADMIN_USER_ROLE_CHANGED insert failed"
    );

    expect(adminRow.role_description).toBe("SUPER_ADMIN");
    expect(invitationRow.accepted).toBe(false);
    expect(createdAuditLogs).toEqual([]);
  });

  it("rolls back the role update when ADMIN_INVITATION_ACCEPTED insert fails after the role change", async () => {
    adminRow = {
      user_id: "user-ada",
      role_id: "role-SUPER_ADMIN",
      role_description: "SUPER_ADMIN",
      status: "ACTIVE",
    };
    failAuditEventType = "ADMIN_INVITATION_ACCEPTED";

    await expect(service.acceptInvitation(makeReq(), { token: "token-1" })).rejects.toThrow(
      "ADMIN_INVITATION_ACCEPTED insert failed"
    );

    expect(adminRow.role_description).toBe("SUPER_ADMIN");
    expect(invitationRow.accepted).toBe(false);
    expect(createdAuditLogs).toEqual([]);
  });
});
