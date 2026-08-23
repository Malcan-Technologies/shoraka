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

const auditWrites: Array<{ eventType: string }> = [];

let userRow: UserRow;
let adminRow: AdminRow | null;
let failUserUpdate = false;

function cloneUser(row: UserRow): UserRow {
  return { ...row, roles: [...row.roles] };
}

function cloneAdmin(row: AdminRow | null): AdminRow | null {
  return row ? { ...row } : null;
}

const mockTx = {
  user: {
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { user_id: string };
        data: { roles?: { set: UserRole[] } };
      }) => {
        if (failUserUpdate) {
          throw new Error("user.roles update failed");
        }
        if (where.user_id !== userRow.user_id) {
          throw new Error("User not found");
        }
        if (data.roles?.set) {
          userRow.roles = [...data.roles.set];
        }
        return cloneUser(userRow);
      }
    ),
  },
  admin: {
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
        if (!adminRow || adminRow.user_id !== where.user_id) {
          throw new Error("Admin not found");
        }
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
};

jest.mock("./repository", () => ({
  AdminRepository: jest.fn().mockImplementation(() => ({
    getUserById: jest.fn(),
    getAdminByUserId: jest.fn(),
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
jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));
jest.mock("../security/audit/writer", () => ({
  writeSecurityAuditLog: jest.fn(async (input: { eventType: string }) => {
    auditWrites.push(input);
  }),
}));

import { prisma } from "../../lib/prisma";
import { writeSecurityAuditLog } from "../security/audit/writer";
import { AdminService } from "./service";

type ReactivateRepo = {
  getUserById: jest.Mock;
  getAdminByUserId: jest.Mock;
};

function makeReq(): Request {
  return {
    headers: { "user-agent": "jest" },
    ip: "127.0.0.1",
    res: { locals: { correlationId: "corr-reactivate" } },
  } as unknown as Request;
}

describe("AdminService.reactivateAdmin origin/main role-repair parity", () => {
  const service = new AdminService();
  const repository = (service as unknown as { repository: ReactivateRepo }).repository;

  beforeEach(() => {
    auditWrites.length = 0;
    failUserUpdate = false;
    userRow = {
      user_id: "user-ada",
      email: "ada@cashsouk.com",
      first_name: "Ada",
      last_name: "Admin",
      roles: [],
    };
    adminRow = {
      user_id: "user-ada",
      role_id: "role-OPERATIONS",
      role_description: "OPERATIONS",
      status: "INACTIVE",
    };
    jest.clearAllMocks();

    repository.getUserById.mockImplementation(async (id: string) =>
      id === userRow.user_id ? cloneUser(userRow) : null
    );
    repository.getAdminByUserId.mockImplementation(async (id: string) =>
      adminRow && adminRow.user_id === id ? cloneAdmin(adminRow) : null
    );

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        const snapshot = {
          user: cloneUser(userRow),
          admin: cloneAdmin(adminRow),
          audits: [...auditWrites],
        };
        try {
          return await fn(mockTx);
        } catch (error) {
          userRow = snapshot.user;
          adminRow = snapshot.admin;
          auditWrites.length = 0;
          auditWrites.push(...snapshot.audits);
          throw error;
        }
      }
    );
  });

  it("reactivates an INACTIVE admin, restores ADMIN, and writes ADMIN_USER_REACTIVATED once", async () => {
    const result = await service.reactivateAdmin(makeReq(), "user-ada", "actor-1");

    expect(result.roles).toContain(UserRole.ADMIN);
    expect(userRow.roles).toContain(UserRole.ADMIN);
    expect(adminRow?.status).toBe("ACTIVE");
    expect(auditWrites.map((row) => row.eventType)).toEqual(["ADMIN_USER_REACTIVATED"]);
    expect(writeSecurityAuditLog).toHaveBeenCalledTimes(1);
  });

  it("rejects an already-active consistent admin with no mutation or audit", async () => {
    userRow.roles = [UserRole.ADMIN];
    adminRow = { ...adminRow!, status: "ACTIVE" };

    await expect(service.reactivateAdmin(makeReq(), "user-ada", "actor-1")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Admin is already active",
    });

    expect(userRow.roles).toEqual([UserRole.ADMIN]);
    expect(adminRow.status).toBe("ACTIVE");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditWrites).toEqual([]);
  });

  it("repairs missing ADMIN on an already-active admin, then returns the origin/main already-active error", async () => {
    userRow.roles = [UserRole.INVESTOR];
    adminRow = { ...adminRow!, status: "ACTIVE" };

    await expect(service.reactivateAdmin(makeReq(), "user-ada", "actor-1")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Admin is already active",
    });

    expect(userRow.roles).toEqual([UserRole.INVESTOR, UserRole.ADMIN]);
    expect(adminRow.status).toBe("ACTIVE");
    expect(mockTx.admin.update).not.toHaveBeenCalled();
    expect(auditWrites).toEqual([]);
    expect(writeSecurityAuditLog).not.toHaveBeenCalled();
  });

  it("does not leave a partial role repair when the user update fails", async () => {
    userRow.roles = [UserRole.INVESTOR];
    adminRow = { ...adminRow!, status: "ACTIVE" };
    failUserUpdate = true;

    await expect(service.reactivateAdmin(makeReq(), "user-ada", "actor-1")).rejects.toThrow(
      "user.roles update failed"
    );

    expect(userRow.roles).toEqual([UserRole.INVESTOR]);
    expect(adminRow.status).toBe("ACTIVE");
    expect(auditWrites).toEqual([]);
  });
});
