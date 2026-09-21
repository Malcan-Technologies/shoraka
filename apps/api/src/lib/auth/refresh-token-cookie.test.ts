const mockSend = jest.fn();

jest.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  RevokeTokenCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

jest.mock("../../config/env", () => ({
  getEnv: () => ({
    COGNITO_CLIENT_ID: "test-client-id",
    COGNITO_CLIENT_SECRET: "test-client-secret",
    COOKIE_DOMAIN: ".cashsouk.com",
    NODE_ENV: "production",
  }),
}));

import { RevokeTokenCommand } from "@aws-sdk/client-cognito-identity-provider";
import type { Request, Response } from "express";
import { AppError } from "../http/error-handler";
import {
  cognitoRefreshTokenCookieOptions,
  readCognitoRefreshTokenCookie,
  revokeAndClearCurrentRefreshTokenCookie,
} from "./refresh-token-cookie";

const clientId = "test-client-id";
const lastAuthUser = "cognito-user-1";
const cookieName = `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.refreshToken`;
const refreshToken = "held-refresh-token";

function reqWithCookies(cookies: Record<string, string>): Request {
  return { cookies } as unknown as Request;
}

function mockRes(): Response & { clearCookie: jest.Mock } {
  return { clearCookie: jest.fn() } as unknown as Response & { clearCookie: jest.Mock };
}

describe("readCognitoRefreshTokenCookie", () => {
  it("derives the httpOnly refresh cookie from LastAuthUser and requires possession", () => {
    expect(
      readCognitoRefreshTokenCookie(
        {
          [`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`]: lastAuthUser,
          [cookieName]: refreshToken,
        },
        clientId
      )
    ).toEqual({ cookieName, refreshToken });
  });

  it("does not treat LastAuthUser alone as enough to target an account", () => {
    expect(
      readCognitoRefreshTokenCookie(
        {
          [`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`]: "victim-user",
        },
        clientId
      )
    ).toBeNull();
  });
});

describe("revokeAndClearCurrentRefreshTokenCookie", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  it("revokes the held refresh token then clears the matching httpOnly cookie", async () => {
    const res = mockRes();
    await revokeAndClearCurrentRefreshTokenCookie(
      reqWithCookies({
        [`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`]: lastAuthUser,
        [cookieName]: refreshToken,
      }),
      res
    );

    expect(RevokeTokenCommand).toHaveBeenCalledWith({
      Token: refreshToken,
      ClientId: clientId,
      ClientSecret: "test-client-secret",
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).toHaveBeenCalledWith(cookieName, cognitoRefreshTokenCookieOptions());
    expect(res.clearCookie.mock.calls[0][1]).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      domain: ".cashsouk.com",
      path: "/",
    });
  });

  it("is a no-op when no refresh cookie is held", async () => {
    const res = mockRes();
    await revokeAndClearCurrentRefreshTokenCookie(
      reqWithCookies({
        [`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`]: lastAuthUser,
      }),
      res
    );

    expect(mockSend).not.toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it("treats an already-invalid refresh token as idempotent and still clears the cookie", async () => {
    const alreadyInvalid = new Error("Invalid Refresh Token");
    alreadyInvalid.name = "InvalidParameterException";
    mockSend.mockRejectedValue(alreadyInvalid);
    const res = mockRes();

    await expect(
      revokeAndClearCurrentRefreshTokenCookie(
        reqWithCookies({
          [`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`]: lastAuthUser,
          [cookieName]: refreshToken,
        }),
        res
      )
    ).resolves.toBeUndefined();

    expect(res.clearCookie).toHaveBeenCalledWith(cookieName, cognitoRefreshTokenCookieOptions());
  });

  it("returns 503 and does not clear the cookie on a transient Cognito failure", async () => {
    mockSend.mockRejectedValue(new Error("Cognito unavailable"));
    const res = mockRes();

    await expect(
      revokeAndClearCurrentRefreshTokenCookie(
        reqWithCookies({
          [`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`]: lastAuthUser,
          [cookieName]: refreshToken,
        }),
        res
      )
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Authentication service temporarily unavailable",
    });

    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it("does not treat a misconfigured revoke as an already-invalid token", async () => {
    const misconfigured = new Error("Missing required parameter ClientSecret");
    misconfigured.name = "InvalidParameterException";
    mockSend.mockRejectedValue(misconfigured);
    const res = mockRes();

    await expect(
      revokeAndClearCurrentRefreshTokenCookie(
        reqWithCookies({
          [`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`]: lastAuthUser,
          [cookieName]: refreshToken,
        }),
        res
      )
    ).rejects.toBeInstanceOf(AppError);

    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it("does not include the refresh token in the 503 error", async () => {
    mockSend.mockRejectedValue(new Error(`failed for ${refreshToken}`));
    const res = mockRes();

    try {
      await revokeAndClearCurrentRefreshTokenCookie(
        reqWithCookies({
          [`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`]: lastAuthUser,
          [cookieName]: refreshToken,
        }),
        res
      );
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).not.toContain(refreshToken);
      expect((error as AppError).message).not.toContain("test-client-secret");
    }
  });
});
