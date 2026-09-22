import { ACCESS_TOKEN_MAX_AGE_MS, REFRESH_TOKEN_MAX_AGE_MS, cognitoCookieOptions } from "./cognito-session-cookies";

jest.mock("../../config/env", () => ({
  getEnv: () => ({
    NODE_ENV: "production",
    COOKIE_DOMAIN: ".cashsouk.com",
  }),
}));

describe("cognito session cookies", () => {
  it("keeps access tokens at 15 minutes and the refresh cookie idle cutoff at 60 minutes", () => {
    // Cookie maxAge is the idle logout. Cognito RefreshTokenValidity is 30 days
    // from sign-in and is not reset by rotation.
    expect(ACCESS_TOKEN_MAX_AGE_MS).toBe(15 * 60 * 1000);
    expect(REFRESH_TOKEN_MAX_AGE_MS).toBe(60 * 60 * 1000);
  });

  it("builds readable access-token cookies and httpOnly refresh-token cookies", () => {
    expect(cognitoCookieOptions(false, ACCESS_TOKEN_MAX_AGE_MS)).toMatchObject({
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      domain: ".cashsouk.com",
      path: "/",
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });
    expect(cognitoCookieOptions(true, REFRESH_TOKEN_MAX_AGE_MS).httpOnly).toBe(true);
  });
});
