import { UserRole } from "@prisma/client";
import { Request } from "express";
import {
  fillActiveRoleFromRequiredRoles,
  requestedRoleFromRequest,
  resolveActiveRole,
} from "./request-active-role";

function fakeReq(init: {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  origin?: string;
  referer?: string;
}): Request {
  return {
    headers: init.headers ?? {},
    query: init.query ?? {},
    get: (name: string) => {
      if (name === "origin") return init.origin ?? init.headers?.origin;
      if (name === "referer") return init.referer ?? init.headers?.referer;
      if (name === "x-portal") return init.headers?.["x-portal"];
      return undefined;
    },
  } as Request;
}

describe("resolveActiveRole", () => {
  it("uses Investor context for an Investor-only user", () => {
    expect(resolveActiveRole([UserRole.INVESTOR], UserRole.INVESTOR)).toBe(UserRole.INVESTOR);
  });

  it("uses Issuer context for an Issuer-only user", () => {
    expect(resolveActiveRole([UserRole.ISSUER], UserRole.ISSUER)).toBe(UserRole.ISSUER);
  });

  it("uses Investor for a dual-role user on an Investor request", () => {
    expect(
      resolveActiveRole([UserRole.ISSUER, UserRole.INVESTOR], UserRole.INVESTOR)
    ).toBe(UserRole.INVESTOR);
  });

  it("uses Issuer for the same dual-role user on an Issuer request", () => {
    expect(
      resolveActiveRole([UserRole.ISSUER, UserRole.INVESTOR], UserRole.ISSUER)
    ).toBe(UserRole.ISSUER);
  });

  it("does not follow roles array order", () => {
    expect(resolveActiveRole([UserRole.INVESTOR, UserRole.ISSUER], UserRole.ISSUER)).toBe(
      UserRole.ISSUER
    );
    expect(resolveActiveRole([UserRole.ISSUER, UserRole.INVESTOR], UserRole.INVESTOR)).toBe(
      UserRole.INVESTOR
    );
  });

  it("does not manufacture INVESTOR for empty roles", () => {
    expect(resolveActiveRole([], UserRole.INVESTOR)).toBeUndefined();
    expect(resolveActiveRole([], null)).toBeUndefined();
  });

  it("does not grant ISSUER when the user lacks it", () => {
    expect(resolveActiveRole([UserRole.INVESTOR], UserRole.ISSUER)).toBeUndefined();
  });

  it("uses Admin context for an Admin request", () => {
    expect(resolveActiveRole([UserRole.ADMIN], UserRole.ADMIN)).toBe(UserRole.ADMIN);
  });
});

describe("requestedRoleFromRequest", () => {
  it("prefers x-portal over Origin", () => {
    expect(
      requestedRoleFromRequest(
        fakeReq({
          headers: { "x-portal": "issuer" },
          origin: "https://investor.cashsouk.com/",
        })
      )
    ).toBe(UserRole.ISSUER);
  });

  it("maps production hostnames", () => {
    expect(
      requestedRoleFromRequest(fakeReq({ origin: "https://investor.cashsouk.com/deposits" }))
    ).toBe(UserRole.INVESTOR);
    expect(
      requestedRoleFromRequest(fakeReq({ origin: "https://admin.cashsouk.com/" }))
    ).toBe(UserRole.ADMIN);
  });

  it("maps local portal ports and not landing :3000", () => {
    expect(requestedRoleFromRequest(fakeReq({ origin: "http://localhost:3002/" }))).toBe(
      UserRole.INVESTOR
    );
    expect(requestedRoleFromRequest(fakeReq({ origin: "http://localhost:3001/" }))).toBe(
      UserRole.ISSUER
    );
    expect(requestedRoleFromRequest(fakeReq({ origin: "http://localhost:3003/" }))).toBe(
      UserRole.ADMIN
    );
    expect(requestedRoleFromRequest(fakeReq({ origin: "http://localhost:3000/" }))).toBeNull();
  });
});

describe("fillActiveRoleFromRequiredRoles", () => {
  it("uses the single authorized role as this request's context", () => {
    expect(fillActiveRoleFromRequiredRoles(UserRole.INVESTOR, [UserRole.ISSUER])).toBe(
      UserRole.ISSUER
    );
    expect(fillActiveRoleFromRequiredRoles(undefined, [UserRole.ADMIN])).toBe(UserRole.ADMIN);
  });

  it("does not guess among multiple required roles", () => {
    expect(
      fillActiveRoleFromRequiredRoles(UserRole.INVESTOR, [UserRole.INVESTOR, UserRole.ADMIN])
    ).toBe(UserRole.INVESTOR);
    expect(
      fillActiveRoleFromRequiredRoles(undefined, [UserRole.INVESTOR, UserRole.ADMIN])
    ).toBeUndefined();
  });
});
