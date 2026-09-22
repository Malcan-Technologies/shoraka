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
    const refreshToken = jest.fn().mockResolvedValue(null);

    await expect(
      resolveAccessTokenWithCookieFallback({
        fetchSessionToken: async () => null,
        refreshToken,
        readTokenFromCookies: () => "cookie-token",
        isTokenExpired: () => false,
      })
    ).resolves.toBe("cookie-token");

    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  it("refreshes before falling back to the cookie when fetchAuthSession throws", async () => {
    const refreshToken = jest.fn().mockResolvedValue("refreshed-token");
    const readTokenFromCookies = jest.fn().mockReturnValue("cookie-token");

    await expect(
      resolveAccessTokenWithCookieFallback({
        fetchSessionToken: async () => {
          throw new Error("Amplify unhydrated");
        },
        refreshToken,
        readTokenFromCookies,
        isTokenExpired: () => false,
      })
    ).resolves.toBe("refreshed-token");

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(readTokenFromCookies).not.toHaveBeenCalled();
  });

  it("falls back to the cookie when fetchAuthSession throws and refresh is empty", async () => {
    const refreshToken = jest.fn().mockResolvedValue(null);

    await expect(
      resolveAccessTokenWithCookieFallback({
        fetchSessionToken: async () => {
          throw new Error("Amplify unhydrated");
        },
        refreshToken,
        readTokenFromCookies: () => "cookie-token",
        isTokenExpired: () => false,
      })
    ).resolves.toBe("cookie-token");

    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  it("falls back to the cookie when fetchAuthSession throws and refresh is unavailable", async () => {
    const refreshToken = jest.fn().mockRejectedValue(new Error("refresh endpoint down"));

    await expect(
      resolveAccessTokenWithCookieFallback({
        fetchSessionToken: async () => {
          throw new Error("Amplify unhydrated");
        },
        refreshToken,
        readTokenFromCookies: () => "cookie-token",
        isTokenExpired: () => false,
      })
    ).resolves.toBe("cookie-token");

    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  it("returns null when Amplify throws, refresh is empty, and no cookie token is present", async () => {
    const refreshToken = jest.fn().mockResolvedValue(null);

    await expect(
      resolveAccessTokenWithCookieFallback({
        fetchSessionToken: async () => {
          throw new Error("Amplify unhydrated");
        },
        refreshToken,
        readTokenFromCookies: () => null,
        isTokenExpired: () => false,
      })
    ).resolves.toBeNull();

    expect(refreshToken).toHaveBeenCalledTimes(1);
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
