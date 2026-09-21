const mockVerify = jest.fn();
const mockFindUser = jest.fn();
const mockIsRevoked = jest.fn();
const mockInvalidate = jest.fn();
const mockSignOut = jest.fn();
const mockCreateAccessLog = jest.fn();

jest.mock("../../lib/auth/cognito-jwt-verifier", () => ({
  verifyCognitoAccessToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUser(...args) },
  },
}));

jest.mock("./token-revocation.service", () => ({
  AccessTokenRevocationService: jest.fn(),
  accessTokenRevocationService: {
    isRevoked: (...args: unknown[]) => mockIsRevoked(...args),
  },
}));

jest.mock("./service", () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    invalidateCurrentAccessToken: (...args: unknown[]) => mockInvalidate(...args),
  })),
}));

jest.mock("../../lib/auth/cognito-global-signout", () => ({
  signOutCognitoUserGlobally: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock("../../lib/audit", () => ({
  auditContextFromRequest: () => ({}),
  createAccessLogRow: (...args: unknown[]) => mockCreateAccessLog(...args),
}));

jest.mock("../../lib/auth/oauth-state", () => ({
  encryptOAuthState: jest.fn(),
  decryptOAuthState: jest.fn(),
  createOAuthState: jest.fn(),
}));

jest.mock("../../lib/openid-client", () => ({
  getOpenIdClient: jest.fn(),
  generators: { nonce: jest.fn(), state: jest.fn() },
}));

jest.mock("../../config/env", () => ({
  getEnv: () => ({ FRONTEND_URL: "https://www.cashsouk.test" }),
}));

jest.mock("../admin/service", () => ({
  AdminService: jest.fn(),
}));

jest.mock("./repository", () => ({
  AuthRepository: jest.fn(),
}));

import express from "express";
import request from "supertest";
import { errorHandler } from "../../lib/http/error-handler";
import router from "./cognito.routes";

function logoutApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.session = { destroy: (cb?: (err?: Error) => void) => cb?.() } as never;
    next();
  });
  app.use(router);
  app.use(errorHandler);
  return app;
}

describe("GET /logout token revocation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue({
      sub: "cognito-sub-1",
      jti: "jti-1",
      exp: 1_700_000_000,
    });
    mockIsRevoked.mockResolvedValue(false);
    mockFindUser.mockResolvedValue({ user_id: "ABCDE", roles: ["INVESTOR"] });
    mockInvalidate.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    mockCreateAccessLog.mockResolvedValue({});
  });

  it("revokes a live token before returning success", async () => {
    const res = await request(logoutApp())
      .get("/logout")
      .set("Authorization", "Bearer live-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockInvalidate).toHaveBeenCalledWith({
      jti: "jti-1",
      exp: 1_700_000_000,
      userId: "ABCDE",
      cognitoSub: "cognito-sub-1",
    });
    expect(mockCreateAccessLog).toHaveBeenCalled();
  });

  it("is inert when the same jti is already revoked", async () => {
    mockIsRevoked.mockResolvedValue(true);

    const res = await request(logoutApp())
      .get("/logout")
      .set("Authorization", "Bearer replayed-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockFindUser).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockCreateAccessLog).not.toHaveBeenCalled();
  });

  it("returns 503 when local revocation cannot be persisted", async () => {
    mockInvalidate.mockRejectedValue(new Error("write failed"));

    const res = await request(logoutApp())
      .get("/logout")
      .set("Authorization", "Bearer live-token");

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(res.body.error.message).not.toMatch(/write failed/i);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockCreateAccessLog).not.toHaveBeenCalled();
  });

  it("returns 503 when the denylist lookup fails", async () => {
    mockIsRevoked.mockRejectedValue(new Error("relation does not exist"));

    const res = await request(logoutApp())
      .get("/logout")
      .set("Authorization", "Bearer live-token");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(res.body.error.message).not.toMatch(/relation/i);
    expect(mockInvalidate).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("treats an invalid or expired token as a successful logout", async () => {
    mockVerify.mockRejectedValue(new Error("Token verification failed"));

    const res = await request(logoutApp())
      .get("/logout")
      .set("Authorization", "Bearer expired-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockIsRevoked).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
