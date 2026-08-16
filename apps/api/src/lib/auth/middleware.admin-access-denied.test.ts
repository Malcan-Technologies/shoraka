jest.mock("../../modules/security/audit/writer", () => ({
  writeSecurityAuditLogBestEffort: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../prisma", () => ({
  prisma: {},
}));

jest.mock("./cognito-jwt-verifier", () => ({
  verifyCognitoAccessToken: jest.fn(),
}));

jest.mock("./rbac", () => ({
  resolveAdminAccess: jest.fn(),
}));

import { UserRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { requireAnyPermission, requirePermission } from "./middleware";
import { AppError } from "../http/error-handler";
import { writeSecurityAuditLogBestEffort } from "../../modules/security/audit/writer";

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    path: "/v1/admin/roles",
    originalUrl: "/v1/admin/roles",
    headers: { "user-agent": "Jest" },
    user: undefined,
    admin: undefined,
    adminPermissions: [],
    adminRoleKey: undefined,
    ...overrides,
  } as Request;
}

describe("admin 403 ADMIN_ACCESS_DENIED", () => {
  const res = {} as Response;

  beforeEach(() => {
    writeSecurityAuditLogBestEffort.mockClear();
  });

  it("does not audit unauthenticated 401s", () => {
    const next = jest.fn() as NextFunction;
    requirePermission("roles.manage")(mockReq(), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error = (next as jest.Mock).mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(401);
    expect(writeSecurityAuditLogBestEffort).not.toHaveBeenCalled();
  });

  it("writes ADMIN_ACCESS_DENIED for authenticated admin 403", () => {
    const next = jest.fn() as NextFunction;
    requirePermission("roles.manage")(
      mockReq({
        user: {
          user_id: "ADMIN",
          roles: [UserRole.ADMIN],
        } as Request["user"],
        admin: { status: "ACTIVE" } as Request["admin"],
        adminPermissions: [],
        adminRoleKey: "OPS",
      }),
      res,
      next
    );
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error = (next as jest.Mock).mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
    expect(writeSecurityAuditLogBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ADMIN_ACCESS_DENIED",
        context: expect.objectContaining({
          actorType: "ADMIN",
          portal: "ADMIN",
        }),
        metadata: expect.objectContaining({
          reasonCode: "INSUFFICIENT_PERMISSIONS",
          method: "GET",
          path: "/v1/admin/roles",
          permission: "roles.manage",
        }),
      })
    );
  });

  it("does not audit authenticated non-admin 403s", () => {
    const next = jest.fn() as NextFunction;
    requireAnyPermission("roles.manage")(
      mockReq({
        user: {
          user_id: "INV01",
          roles: [UserRole.INVESTOR],
        } as Request["user"],
      }),
      res,
      next
    );
    const error = (next as jest.Mock).mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
    expect(writeSecurityAuditLogBestEffort).not.toHaveBeenCalled();
  });
});
