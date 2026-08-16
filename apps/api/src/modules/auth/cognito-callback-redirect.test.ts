import {
  landingHomeUrl,
  oauthAuthErrorUrl,
  resolveAdminPortalAuthorizationDeniedRedirect,
} from "./cognito-callback-redirect";

const FRONTEND = "http://localhost:3000";

describe("resolveAdminPortalAuthorizationDeniedRedirect", () => {
  it("ISSUER / INVESTOR / empty roles / inactive ADMIN go to landing home, not /auth-error", () => {
    expect(resolveAdminPortalAuthorizationDeniedRedirect(FRONTEND)).toBe(FRONTEND);
    expect(resolveAdminPortalAuthorizationDeniedRedirect(`${FRONTEND}/`)).toBe(FRONTEND);
    expect(resolveAdminPortalAuthorizationDeniedRedirect(FRONTEND)).not.toContain("/auth-error");
  });

  it("does not create a redirect loop through /auth-error", () => {
    const dest = resolveAdminPortalAuthorizationDeniedRedirect(FRONTEND);
    expect(dest).toBe(FRONTEND);
    expect(dest).not.toMatch(/auth-error/);
    expect(dest).not.toMatch(/callback/);
    expect(dest).not.toMatch(/admin/);
  });
});

describe("oauthAuthErrorUrl", () => {
  it("genuine auth failures still land on /auth-error", () => {
    expect(
      oauthAuthErrorUrl(FRONTEND, {
        error: "missing_state",
        message: "Authentication session is missing. Please sign in again.",
      })
    ).toBe(
      `${FRONTEND}/auth-error?error=missing_state&message=Authentication+session+is+missing.+Please+sign+in+again.`
    );
    expect(
      oauthAuthErrorUrl(FRONTEND, {
        error: "expired_session",
        message: "Your login session has expired. Please sign in again.",
      })
    ).toContain("/auth-error?");
    expect(
      oauthAuthErrorUrl(FRONTEND, {
        error: "TOKEN_EXCHANGE_FAILED",
        message: "Authentication failed. Please try signing in again.",
      })
    ).toContain("/auth-error?");
    expect(
      oauthAuthErrorUrl(FRONTEND, {
        error: "unknown_error",
        message: "An unexpected error occurred. Please try again.",
      })
    ).toContain("/auth-error?");
  });
});

describe("landingHomeUrl", () => {
  it("strips a trailing slash without adding /auth-error", () => {
    expect(landingHomeUrl("https://cashsouk.com/")).toBe("https://cashsouk.com");
    expect(landingHomeUrl("https://cashsouk.com")).toBe("https://cashsouk.com");
  });
});
