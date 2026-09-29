/**
 * PATCH /v1/admin/users/:id/roles: users.manage covers Investor / Issuer portal access only.
 * Adding or removing ADMIN changes admin access, which belongs to roles.manage.
 */
import * as fs from "fs";
import * as path from "path";

jest.mock("./repository", () => ({
  AdminRepository: jest.fn().mockImplementation(() => ({})),
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
jest.mock("../../lib/http/request-utils", () => ({
  extractRequestMetadata: () => ({
    ipAddress: "127.0.0.1",
    userAgent: "jest",
    deviceInfo: "test",
    deviceType: "desktop",
  }),
}));
jest.mock("../../lib/prisma", () => ({ prisma: {} }));

import type { Request } from "express";
import { UserRole } from "@prisma/client";
import { AdminRole } from "@cashsouk/types";
import { AdminService } from "./service";
import { AppError } from "../../lib/http/error-handler";

const req = {} as Request;

function buildService(input: {
  userRoles: UserRole[];
  admin?: { status: "ACTIVE" | "INACTIVE"; role_description: string } | null;
  activeSuperAdmins?: number;
}) {
  const repository = {
    getUserById: jest.fn().mockResolvedValue({
      user_id: "user-1",
      email: "user@example.com",
      roles: input.userRoles,
      investor_account: [],
      issuer_account: [],
    }),
    getAdminByUserId: jest.fn().mockResolvedValue(input.admin ?? null),
    countActiveSuperAdmins: jest.fn().mockResolvedValue(input.activeSuperAdmins ?? 2),
    createAdmin: jest.fn(),
    updateAdminStatus: jest.fn(),
    updateUserRoles: jest.fn().mockResolvedValue({ user_id: "user-1" }),
    createSecurityLog: jest.fn(),
    createAccessLog: jest.fn(),
  };
  const service = new AdminService();
  (service as unknown as { repository: typeof repository }).repository = repository;
  return { service, repository };
}

function expectNoWrites(repository: ReturnType<typeof buildService>["repository"]) {
  expect(repository.createAdmin).not.toHaveBeenCalled();
  expect(repository.updateAdminStatus).not.toHaveBeenCalled();
  expect(repository.updateUserRoles).not.toHaveBeenCalled();
  expect(repository.createSecurityLog).not.toHaveBeenCalled();
  expect(repository.createAccessLog).not.toHaveBeenCalled();
}

describe("AdminService updateUserRoles admin access", () => {
  it("rejects adding ADMIN without roles.manage and writes nothing", async () => {
    const { service, repository } = buildService({
      userRoles: [UserRole.INVESTOR],
      admin: { status: "INACTIVE", role_description: AdminRole.SUPER_ADMIN },
    });

    await expect(
      service.updateUserRoles(
        req,
        "user-1",
        { roles: [UserRole.INVESTOR, UserRole.ADMIN] },
        "admin-1",
        false
      )
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" } satisfies Partial<AppError>);
    expectNoWrites(repository);
  });

  it("rejects removing ADMIN without roles.manage and writes nothing", async () => {
    const { service, repository } = buildService({
      userRoles: [UserRole.INVESTOR, UserRole.ADMIN],
      admin: { status: "ACTIVE", role_description: "OPERATIONS" },
    });

    await expect(
      service.updateUserRoles(req, "user-1", { roles: [UserRole.INVESTOR] }, "admin-1", false)
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" } satisfies Partial<AppError>);
    expectNoWrites(repository);
  });

  it("does not create an admin record when adding ADMIN to a user without one", async () => {
    const { service, repository } = buildService({ userRoles: [UserRole.INVESTOR], admin: null });

    await expect(
      service.updateUserRoles(
        req,
        "user-1",
        { roles: [UserRole.INVESTOR, UserRole.ADMIN] },
        "admin-1",
        true
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    } satisfies Partial<AppError>);
    expectNoWrites(repository);
  });

  it("reactivates an existing inactive admin record when the caller has roles.manage", async () => {
    const { service, repository } = buildService({
      userRoles: [UserRole.INVESTOR],
      admin: { status: "INACTIVE", role_description: "OPERATIONS" },
    });

    await service.updateUserRoles(
      req,
      "user-1",
      { roles: [UserRole.INVESTOR, UserRole.ADMIN] },
      "admin-1",
      true
    );

    expect(repository.updateAdminStatus).toHaveBeenCalledWith("user-1", "ACTIVE");
    expect(repository.createAdmin).not.toHaveBeenCalled();
    expect(repository.updateUserRoles).toHaveBeenCalledWith("user-1", [
      UserRole.INVESTOR,
      UserRole.ADMIN,
    ]);
  });

  it("allows Investor / Issuer portal access changes with users.manage alone", async () => {
    const { service, repository } = buildService({ userRoles: [UserRole.INVESTOR] });

    await service.updateUserRoles(
      req,
      "user-1",
      { roles: [UserRole.INVESTOR, UserRole.ISSUER] },
      "admin-1",
      false
    );

    expect(repository.updateUserRoles).toHaveBeenCalledWith("user-1", [
      UserRole.INVESTOR,
      UserRole.ISSUER,
    ]);
    expect(repository.getAdminByUserId).not.toHaveBeenCalled();
  });

  it("keeps ADMIN untouched for an admin user when only portal access changes", async () => {
    const { service, repository } = buildService({
      userRoles: [UserRole.ADMIN, UserRole.INVESTOR],
      admin: { status: "ACTIVE", role_description: "OPERATIONS" },
    });

    await service.updateUserRoles(
      req,
      "user-1",
      { roles: [UserRole.ADMIN, UserRole.INVESTOR, UserRole.ISSUER] },
      "admin-1",
      false
    );

    expect(repository.updateUserRoles).toHaveBeenCalled();
    expect(repository.updateAdminStatus).not.toHaveBeenCalled();
  });

  it("rejects removing ADMIN from the last active Super Admin", async () => {
    const { service, repository } = buildService({
      userRoles: [UserRole.ADMIN],
      admin: { status: "ACTIVE", role_description: AdminRole.SUPER_ADMIN },
      activeSuperAdmins: 1,
    });

    await expect(
      service.updateUserRoles(req, "user-1", { roles: [] }, "admin-1", true)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    } satisfies Partial<AppError>);
    expectNoWrites(repository);
  });

  it("removes ADMIN from a Super Admin when another active Super Admin remains", async () => {
    const { service, repository } = buildService({
      userRoles: [UserRole.ADMIN],
      admin: { status: "ACTIVE", role_description: AdminRole.SUPER_ADMIN },
      activeSuperAdmins: 2,
    });

    await service.updateUserRoles(req, "user-1", { roles: [] }, "admin-1", true);

    expect(repository.updateAdminStatus).toHaveBeenCalledWith("user-1", "INACTIVE");
  });
});

describe("PATCH /users/:id/roles route wiring", () => {
  const controller = fs.readFileSync(path.join(__dirname, "controller.ts"), "utf8");
  const start = controller.indexOf('router.patch(\n  "/users/:id/roles",');
  const block = controller.slice(start, controller.indexOf("\nrouter.", start + 1));

  it("stays on users.manage and passes roles.manage for admin access changes", () => {
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('requirePermission("users.manage")');
    expect(block).toContain('userHasPermission(req, "roles.manage")');
  });
});
