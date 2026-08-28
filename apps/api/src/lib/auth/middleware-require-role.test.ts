import { UserRole } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { requireRole } from "./middleware";

function userReq(roles: UserRole[], extra?: Partial<{ investor_account: string[]; issuer_account: string[] }>) {
  return {
    user: {
      roles,
      investor_account: extra?.investor_account ?? (roles.includes(UserRole.INVESTOR) ? ["done"] : []),
      issuer_account: extra?.issuer_account ?? (roles.includes(UserRole.ISSUER) ? ["done"] : []),
    },
    activeRole: undefined as UserRole | undefined,
  } as Request;
}

describe("requireRole authorization", () => {
  it("denies ISSUER routes when the user only has INVESTOR", () => {
    const req = userReq([UserRole.INVESTOR]);
    const next = jest.fn() as NextFunction;
    requireRole(UserRole.ISSUER)(req, {} as Response, next);
    const err = (next as jest.Mock).mock.calls[0][0] as { statusCode: number };
    expect(err.statusCode).toBe(403);
    expect(req.activeRole).toBeUndefined();
  });

  it("denies INVESTOR routes when roles are empty", () => {
    const req = userReq([]);
    const next = jest.fn() as NextFunction;
    requireRole(UserRole.INVESTOR)(req, {} as Response, next);
    const err = (next as jest.Mock).mock.calls[0][0] as { statusCode: number };
    expect(err.statusCode).toBe(403);
    expect(req.activeRole).toBeUndefined();
  });

  it("sets ISSUER context after a dual-role user is authorized on an Issuer route", () => {
    const req = userReq([UserRole.INVESTOR, UserRole.ISSUER]);
    req.activeRole = UserRole.INVESTOR;
    const next = jest.fn() as NextFunction;
    requireRole(UserRole.ISSUER)(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.activeRole).toBe(UserRole.ISSUER);
  });

  it("sets ADMIN context on Admin routes", () => {
    const req = userReq([UserRole.ADMIN]);
    const next = jest.fn() as NextFunction;
    requireRole(UserRole.ADMIN)(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.activeRole).toBe(UserRole.ADMIN);
  });
});
