import {
  CognitoLogoutError,
  completeCognitoPortalLogout,
  requestBackendCognitoLogout,
  resolveLogoutAccessToken,
} from "./cognito-portal-logout";

describe("requestBackendCognitoLogout", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("sends the live access token and resolves on 2xx", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await requestBackendCognitoLogout({
      apiUrl: "https://api.example.test",
      portal: "investor",
      accessToken: "live-token",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/auth/cognito/logout?portal=investor",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer live-token",
        },
      })
    );
  });

  it("omits Authorization when no access token is available", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await requestBackendCognitoLogout({
      apiUrl: "https://api.example.test",
      portal: "issuer",
      accessToken: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/auth/cognito/logout?portal=issuer",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("throws a safe API message on 503 and does not treat it as success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Authentication service temporarily unavailable",
          details: "relation revoked_access_tokens does not exist",
        },
      }),
    }) as unknown as typeof fetch;

    await expect(
      requestBackendCognitoLogout({
        apiUrl: "https://api.example.test",
        portal: "admin",
        accessToken: "live-token",
      })
    ).rejects.toMatchObject({
      name: "CognitoLogoutError",
      message: "Authentication service temporarily unavailable",
    });
  });

  it("does not leak multiline or detail payloads from a failed logout response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "write failed\nSELECT * FROM revoked_access_tokens",
        },
      }),
    }) as unknown as typeof fetch;

    await expect(
      requestBackendCognitoLogout({
        apiUrl: "https://api.example.test",
        portal: "issuer",
        accessToken: "live-token",
      })
    ).rejects.toMatchObject({
      name: "CognitoLogoutError",
      message: "Unable to complete logout. Please try again.",
    });
  });

  it("throws a generic message on network failure", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("Failed to fetch https://api.example.test")) as unknown as typeof fetch;

    await expect(
      requestBackendCognitoLogout({
        apiUrl: "https://api.example.test",
        portal: "investor",
        accessToken: "live-token",
      })
    ).rejects.toMatchObject({
      name: "CognitoLogoutError",
      message: "Unable to complete logout. Please try again.",
    });
  });
});

describe("completeCognitoPortalLogout", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("revokes on the server before destroying the local session", async () => {
    const order: string[] = [];
    global.fetch = jest.fn().mockImplementation(async () => {
      order.push("fetch");
      return { ok: true, json: async () => ({ success: true }) };
    }) as unknown as typeof fetch;

    const getAccessToken = jest.fn().mockImplementation(async () => {
      order.push("token");
      return "live-token";
    });
    const destroyLocalSession = jest.fn().mockImplementation(async () => {
      order.push("destroy");
    });

    await completeCognitoPortalLogout({
      apiUrl: "https://api.example.test",
      portal: "investor",
      getAccessToken,
      destroyLocalSession,
    });

    expect(order).toEqual(["token", "fetch", "destroy"]);
    expect(destroyLocalSession).toHaveBeenCalledTimes(1);
  });

  it("leaves local auth intact when denylist persistence returns 503", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Authentication service temporarily unavailable",
        },
      }),
    }) as unknown as typeof fetch;
    const destroyLocalSession = jest.fn();

    await expect(
      completeCognitoPortalLogout({
        apiUrl: "https://api.example.test",
        portal: "issuer",
        getAccessToken: async () => "live-token",
        destroyLocalSession,
      })
    ).rejects.toBeInstanceOf(CognitoLogoutError);

    expect(destroyLocalSession).not.toHaveBeenCalled();
  });

  it("leaves local auth intact when the logout request cannot be reached", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const destroyLocalSession = jest.fn();

    await expect(
      completeCognitoPortalLogout({
        apiUrl: "https://api.example.test",
        portal: "admin",
        getAccessToken: async () => "live-token",
        destroyLocalSession,
      })
    ).rejects.toMatchObject({
      name: "CognitoLogoutError",
      message: "Unable to complete logout. Please try again.",
    });

    expect(destroyLocalSession).not.toHaveBeenCalled();
  });

  it("sends a cookie token when getAccessToken resolves null", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const destroyLocalSession = jest.fn().mockResolvedValue(undefined);

    await completeCognitoPortalLogout({
      apiUrl: "https://api.example.test",
      portal: "admin",
      getAccessToken: async () => null,
      readAccessTokenFromCookies: () => "cookie-token",
      destroyLocalSession,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/auth/cognito/logout?portal=admin",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer cookie-token",
        },
      })
    );
    expect(destroyLocalSession).toHaveBeenCalledTimes(1);
  });

  it("sends a cookie token when getAccessToken throws", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const destroyLocalSession = jest.fn().mockResolvedValue(undefined);

    await completeCognitoPortalLogout({
      apiUrl: "https://api.example.test",
      portal: "investor",
      getAccessToken: async () => {
        throw new Error("Amplify unhydrated");
      },
      readAccessTokenFromCookies: () => "cookie-token",
      destroyLocalSession,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/auth/cognito/logout?portal=investor",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer cookie-token",
        },
      })
    );
    expect(destroyLocalSession).toHaveBeenCalledTimes(1);
  });

  it("treats a resolved null access token as the no-live-token case after cookie fallback", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const destroyLocalSession = jest.fn().mockResolvedValue(undefined);

    await completeCognitoPortalLogout({
      apiUrl: "https://api.example.test",
      portal: "admin",
      getAccessToken: async () => null,
      readAccessTokenFromCookies: () => null,
      destroyLocalSession,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/auth/cognito/logout?portal=admin",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(destroyLocalSession).toHaveBeenCalledTimes(1);
  });

  it("still destroys the local session when the server reports success for an already-revoked token", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: "Logged out successfully" }),
    }) as unknown as typeof fetch;
    const destroyLocalSession = jest.fn().mockResolvedValue(undefined);

    await completeCognitoPortalLogout({
      apiUrl: "https://api.example.test",
      portal: "investor",
      getAccessToken: async () => "already-revoked-token",
      destroyLocalSession,
    });

    expect(destroyLocalSession).toHaveBeenCalledTimes(1);
  });
});

describe("resolveLogoutAccessToken", () => {
  it("prefers a live getter token over cookies", async () => {
    await expect(
      resolveLogoutAccessToken({
        getAccessToken: async () => "live-token",
        readAccessTokenFromCookies: () => "cookie-token",
      })
    ).resolves.toBe("live-token");
  });

  it("falls back to cookies when Amplify returns null or throws", async () => {
    await expect(
      resolveLogoutAccessToken({
        getAccessToken: async () => null,
        readAccessTokenFromCookies: () => "cookie-token",
      })
    ).resolves.toBe("cookie-token");

    await expect(
      resolveLogoutAccessToken({
        getAccessToken: async () => {
          throw new Error("Amplify unhydrated");
        },
        readAccessTokenFromCookies: () => "cookie-token",
      })
    ).resolves.toBe("cookie-token");
  });

  it("returns null when getter and cookie fallback both miss, including cookie-reader throws", async () => {
    await expect(
      resolveLogoutAccessToken({
        getAccessToken: async () => null,
        readAccessTokenFromCookies: () => null,
      })
    ).resolves.toBeNull();

    await expect(
      resolveLogoutAccessToken({
        getAccessToken: async () => {
          throw new Error("Amplify unhydrated");
        },
        readAccessTokenFromCookies: () => {
          throw new Error("document is not defined");
        },
      })
    ).resolves.toBeNull();
  });
});
