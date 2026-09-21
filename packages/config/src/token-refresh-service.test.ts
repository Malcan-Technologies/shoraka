import { resolveAccessTokenWithCookieFallback } from "./token-refresh-service";

describe("resolveAccessTokenWithCookieFallback", () => {
  it("returns the Amplify session token when it is live", async () => {
    const readTokenFromCookies = jest.fn().mockReturnValue("cookie-token");

    await expect(
      resolveAccessTokenWithCookieFallback({
        fetchSessionToken: async () => "amplify-token",
        refreshToken: async () => "refreshed-token",
        readTokenFromCookies,
        isTokenExpired: () => false,
      })
    ).resolves.toBe("amplify-token");

    expect(readTokenFromCookies).not.toHaveBeenCalled();
  });

  it("reads the cookie after Amplify returns empty and refresh fails", async () => {
    await expect(
      resolveAccessTokenWithCookieFallback({
        fetchSessionToken: async () => null,
        refreshToken: async () => null,
        readTokenFromCookies: () => "cookie-token",
        isTokenExpired: () => false,
      })
    ).resolves.toBe("cookie-token");
  });

  it("reads the cookie when fetchAuthSession throws", async () => {
    await expect(
      resolveAccessTokenWithCookieFallback({
        fetchSessionToken: async () => {
          throw new Error("Amplify unhydrated");
        },
        refreshToken: async () => "refreshed-token",
        readTokenFromCookies: () => "cookie-token",
        isTokenExpired: () => false,
      })
    ).resolves.toBe("cookie-token");
  });

  it("returns null when Amplify throws and no cookie token is present", async () => {
    await expect(
      resolveAccessTokenWithCookieFallback({
        fetchSessionToken: async () => {
          throw new Error("Amplify unhydrated");
        },
        refreshToken: async () => "refreshed-token",
        readTokenFromCookies: () => null,
        isTokenExpired: () => false,
      })
    ).resolves.toBeNull();
  });

  it("does not crash when the cookie reader throws (SSR / non-browser)", async () => {
    await expect(
      resolveAccessTokenWithCookieFallback({
        fetchSessionToken: async () => {
          throw new Error("Amplify unhydrated");
        },
        refreshToken: async () => null,
        readTokenFromCookies: () => {
          throw new Error("document is not defined");
        },
        isTokenExpired: () => false,
      })
    ).resolves.toBeNull();
  });
});
