const mockRevokeCurrentToken = jest.fn();
const mockSignOut = jest.fn();
const mockFindActiveSession = jest.fn();
const mockRevokeSession = jest.fn();
const mockCreateAccessLog = jest.fn();
const mockRevokeRefreshCookie = jest.fn();

jest.mock("./token-revocation.service", () => ({
  AccessTokenRevocationService: jest.fn().mockImplementation(() => ({
    revokeCurrentToken: (...args: unknown[]) => mockRevokeCurrentToken(...args),
    isRevoked: jest.fn(),
  })),
  accessTokenRevocationService: {
    isRevoked: jest.fn(),
    revokeCurrentToken: jest.fn(),
  },
}));

jest.mock("../../lib/auth/cognito-global-signout", () => ({
  signOutCognitoUserGlobally: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock("../../lib/auth/refresh-token-cookie", () => ({
  revokeAndClearCurrentRefreshTokenCookie: (...args: unknown[]) => mockRevokeRefreshCookie(...args),
}));

jest.mock("./repository", () => ({
  AuthRepository: jest.fn().mockImplementation(() => ({
    findActiveSession: (...args: unknown[]) => mockFindActiveSession(...args),
    revokeSession: (...args: unknown[]) => mockRevokeSession(...args),
    createAccessLog: (...args: unknown[]) => mockCreateAccessLog(...args),
  })),
}));

jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../../lib/http/request-utils", () => ({
  extractRequestMetadata: () => ({
    ipAddress: "127.0.0.1",
    userAgent: "jest",
    deviceInfo: "test",
    deviceType: "desktop",
  }),
}));

jest.mock("../../lib/role-detector", () => ({
  detectInitiatingPortal: () => "investor",
}));

jest.mock("../../config/env", () => ({
  getEnv: async () => ({ FRONTEND_URL: "https://www.cashsouk.test" }),
}));

import { Request, Response } from "express";
import { AuthService } from "./service";
import { AppError } from "../../lib/http/error-handler";

describe("AuthService logout token invalidation", () => {
  const service = new AuthService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindActiveSession.mockResolvedValue(null);
    mockCreateAccessLog.mockResolvedValue({});
    mockRevokeCurrentToken.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    mockRevokeRefreshCookie.mockResolvedValue(undefined);
  });

  function logoutReq(): Request {
    return {
      accessTokenJti: "jti-1",
      accessTokenExp: 1_700_000_000,
      cognitoSub: "cognito-sub-1",
      headers: {},
      get: () => undefined,
    } as unknown as Request;
  }

  function logoutRes(): Response {
    return { clearCookie: jest.fn() } as unknown as Response;
  }

  it("records the current jti and globally signs out of Cognito", async () => {
    const req = logoutReq();
    const res = logoutRes();

    await service.logout(req, res, "ABCDE");

    expect(mockRevokeCurrentToken).toHaveBeenCalledWith({
      jti: "jti-1",
      userId: "ABCDE",
      exp: 1_700_000_000,
    });
    expect(mockSignOut).toHaveBeenCalledWith("cognito-sub-1");
    expect(mockRevokeRefreshCookie).toHaveBeenCalledWith(req, res);
  });

  it("persists the jti before Cognito refresh-token revocation", async () => {
    const order: string[] = [];
    mockRevokeCurrentToken.mockImplementation(async () => {
      order.push("local");
    });
    mockSignOut.mockImplementation(async () => {
      order.push("global");
    });
    mockRevokeRefreshCookie.mockImplementation(async () => {
      order.push("refresh");
    });

    await service.logout(logoutReq(), logoutRes(), "ABCDE");

    expect(order).toEqual(["local", "global", "refresh"]);
  });

  it("does not report successful logout when local revocation fails", async () => {
    mockRevokeCurrentToken.mockRejectedValue(new Error("write failed"));
    const req = logoutReq();
    const res = logoutRes();

    await expect(service.logout(req, res, "ABCDE")).rejects.toMatchObject({
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockRevokeRefreshCookie).not.toHaveBeenCalled();
    expect(mockCreateAccessLog).not.toHaveBeenCalled();
  });

  it("fails logout with 503 when refresh-token revocation fails", async () => {
    mockRevokeRefreshCookie.mockRejectedValue(
      new AppError(503, "SERVICE_UNAVAILABLE", "Authentication service temporarily unavailable")
    );

    await expect(service.logout(logoutReq(), logoutRes(), "ABCDE")).rejects.toMatchObject({
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(mockRevokeCurrentToken).toHaveBeenCalled();
    expect(mockCreateAccessLog).not.toHaveBeenCalled();
  });

  it("still records the local revocation when Cognito sign-out fails", async () => {
    mockSignOut.mockRejectedValue(new Error("Cognito unavailable"));

    await expect(
      service.invalidateCurrentAccessToken({
        jti: "jti-1",
        exp: 1_700_000_000,
        userId: "ABCDE",
        cognitoSub: "cognito-sub-1",
      })
    ).resolves.toBeUndefined();

    expect(mockRevokeCurrentToken).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("revokes the local jti before Cognito sign-out", async () => {
    const order: string[] = [];
    mockRevokeCurrentToken.mockImplementation(async () => {
      order.push("local");
    });
    mockSignOut.mockImplementation(async () => {
      order.push("cognito");
    });

    await service.invalidateCurrentAccessToken({
      jti: "jti-1",
      exp: 1_700_000_000,
      userId: "ABCDE",
      cognitoSub: "cognito-sub-1",
    });

    expect(order).toEqual(["local", "cognito"]);
  });

  it("fails logout when local revocation cannot be persisted", async () => {
    mockRevokeCurrentToken.mockRejectedValue(new Error("relation does not exist"));

    await expect(
      service.invalidateCurrentAccessToken({
        jti: "jti-1",
        exp: 1_700_000_000,
        userId: "ABCDE",
        cognitoSub: "cognito-sub-1",
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
    });

    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
