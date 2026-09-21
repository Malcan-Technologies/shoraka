const mockVerify = jest.fn();
const mockFindUser = jest.fn();
const mockFindAdmin = jest.fn();
const mockIsRevoked = jest.fn();

jest.mock("./cognito-jwt-verifier", () => ({
  verifyCognitoAccessToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUser(...args) },
    admin: { findUnique: (...args: unknown[]) => mockFindAdmin(...args) },
  },
}));

jest.mock("../../modules/auth/token-revocation.service", () => ({
  accessTokenRevocationService: {
    isRevoked: (...args: unknown[]) => mockIsRevoked(...args),
  },
}));

import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth } from "./middleware";

function mockReq(): Request {
  return {
    headers: { authorization: "Bearer valid-token" },
    query: {},
    get: () => undefined,
  } as unknown as Request;
}

describe("requireAuth token denylist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue({
      sub: "cognito-sub-1",
      jti: "jti-1",
      exp: 1_700_000_000,
    });
    mockFindUser.mockResolvedValue({
      user_id: "ABCDE",
      cognito_sub: "cognito-sub-1",
      roles: [UserRole.INVESTOR],
      investor_account: ["done"],
      issuer_account: [],
    });
    mockIsRevoked.mockResolvedValue(false);
  });

  it("rejects a cryptographically valid token that has been revoked", async () => {
    mockIsRevoked.mockResolvedValue(true);
    const next = jest.fn() as NextFunction;
    await requireAuth(mockReq(), {} as Response, next);
    const err = (next as jest.Mock).mock.calls[0][0] as { statusCode: number; code: string };
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(mockFindUser).not.toHaveBeenCalled();
  });

  it("attaches jti and exp for a live token", async () => {
    const req = mockReq();
    const next = jest.fn() as NextFunction;
    await requireAuth(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.accessTokenJti).toBe("jti-1");
    expect(req.accessTokenExp).toBe(1_700_000_000);
    expect(req.cognitoSub).toBe("cognito-sub-1");
  });

  it("returns 503 when the denylist lookup fails", async () => {
    mockIsRevoked.mockRejectedValue(new Error("relation revoked_access_tokens does not exist"));
    const next = jest.fn() as NextFunction;
    await requireAuth(mockReq(), {} as Response, next);
    const err = (next as jest.Mock).mock.calls[0][0] as {
      statusCode: number;
      code: string;
      message: string;
    };
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe("SERVICE_UNAVAILABLE");
    expect(err.message).toBe("Authentication service temporarily unavailable");
    expect(err.message).not.toMatch(/relation|revoked_access_tokens/i);
    expect(mockFindUser).not.toHaveBeenCalled();
  });
});

describe("requireAuth password_changed_at", () => {
  const passwordChangedAt = new Date("2024-01-15T12:00:00.400Z");
  const passwordChangedAtSeconds = Math.floor(passwordChangedAt.getTime() / 1000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsRevoked.mockResolvedValue(false);
    mockFindUser.mockResolvedValue({
      user_id: "ABCDE",
      cognito_sub: "cognito-sub-1",
      roles: [UserRole.INVESTOR],
      investor_account: ["done"],
      issuer_account: [],
      password_changed_at: passwordChangedAt,
    });
    mockVerify.mockResolvedValue({
      sub: "cognito-sub-1",
      jti: "jti-1",
      exp: 1_700_000_000,
      iat: passwordChangedAtSeconds + 1,
    });
  });

  it("rejects a refreshed JWT with a new iat when auth_time is at or before password_changed_at", async () => {
    mockVerify.mockResolvedValue({
      sub: "cognito-sub-1",
      jti: "jti-refreshed-pre-change",
      exp: 1_700_000_000,
      iat: passwordChangedAtSeconds + 120,
      auth_time: passwordChangedAtSeconds - 30,
    });
    const next = jest.fn() as NextFunction;
    await requireAuth(mockReq(), {} as Response, next);
    const err = (next as jest.Mock).mock.calls[0][0] as {
      statusCode: number;
      code: string;
      message: string;
    };
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Invalid or expired token");
    expect(err.message).not.toMatch(/password_changed_at|auth_time|iat|2024-01-15/i);
  });

  it("rejects a refreshed JWT whose auth_time is the password-change second even with a newer iat", async () => {
    mockVerify.mockResolvedValue({
      sub: "cognito-sub-1",
      jti: "jti-refreshed-same-second",
      exp: 1_700_000_000,
      iat: passwordChangedAtSeconds + 5,
      auth_time: passwordChangedAtSeconds,
    });
    const next = jest.fn() as NextFunction;
    await requireAuth(mockReq(), {} as Response, next);
    const err = (next as jest.Mock).mock.calls[0][0] as { statusCode: number; code: string };
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("accepts a fresh login whose auth_time is after the password change second", async () => {
    mockVerify.mockResolvedValue({
      sub: "cognito-sub-1",
      jti: "jti-fresh-login",
      exp: 1_700_000_000,
      iat: passwordChangedAtSeconds + 1,
      auth_time: passwordChangedAtSeconds + 1,
    });
    const req = mockReq();
    const next = jest.fn() as NextFunction;
    await requireAuth(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
  });

  it("rejects a token issued before password_changed_at even when the jti is not denylisted", async () => {
    mockVerify.mockResolvedValue({
      sub: "cognito-sub-1",
      jti: "jti-pre-change",
      exp: 1_700_000_000,
      iat: passwordChangedAtSeconds - 1,
    });
    const next = jest.fn() as NextFunction;
    await requireAuth(mockReq(), {} as Response, next);
    const err = (next as jest.Mock).mock.calls[0][0] as {
      statusCode: number;
      code: string;
      message: string;
    };
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Invalid or expired token");
    expect(err.message).not.toMatch(/password_changed_at|iat|2024-01-15/i);
    expect(mockIsRevoked).toHaveBeenCalledWith("jti-pre-change");
  });

  it("rejects a token issued in the same Unix second as password_changed_at", async () => {
    mockVerify.mockResolvedValue({
      sub: "cognito-sub-1",
      jti: "jti-same-second",
      exp: 1_700_000_000,
      iat: passwordChangedAtSeconds,
    });
    const next = jest.fn() as NextFunction;
    await requireAuth(mockReq(), {} as Response, next);
    const err = (next as jest.Mock).mock.calls[0][0] as { statusCode: number; code: string };
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("accepts a token issued after the password change second", async () => {
    const req = mockReq();
    const next = jest.fn() as NextFunction;
    await requireAuth(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
  });

  it("does not reject when password_changed_at is absent", async () => {
    mockFindUser.mockResolvedValue({
      user_id: "ABCDE",
      cognito_sub: "cognito-sub-1",
      roles: [UserRole.INVESTOR],
      investor_account: ["done"],
      issuer_account: [],
      password_changed_at: null,
    });
    mockVerify.mockResolvedValue({
      sub: "cognito-sub-1",
      jti: "jti-1",
      exp: 1_700_000_000,
      iat: passwordChangedAtSeconds - 60,
    });
    const next = jest.fn() as NextFunction;
    await requireAuth(mockReq(), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("does not reject when token iat is absent", async () => {
    mockVerify.mockResolvedValue({
      sub: "cognito-sub-1",
      jti: "jti-1",
      exp: 1_700_000_000,
    });
    const next = jest.fn() as NextFunction;
    await requireAuth(mockReq(), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("falls back to iat when auth_time is absent and still rejects a pre-change token", async () => {
    mockVerify.mockResolvedValue({
      sub: "cognito-sub-1",
      jti: "jti-iat-fallback",
      exp: 1_700_000_000,
      iat: passwordChangedAtSeconds - 1,
    });
    const next = jest.fn() as NextFunction;
    await requireAuth(mockReq(), {} as Response, next);
    const err = (next as jest.Mock).mock.calls[0][0] as { statusCode: number; code: string };
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("falls back to iat when auth_time is absent and accepts a post-change token", async () => {
    mockVerify.mockResolvedValue({
      sub: "cognito-sub-1",
      jti: "jti-iat-fallback-fresh",
      exp: 1_700_000_000,
      iat: passwordChangedAtSeconds + 1,
    });
    const next = jest.fn() as NextFunction;
    await requireAuth(mockReq(), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});

