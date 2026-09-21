import {
  AUTH_ME_RETRY_DELAYS_MS,
  AUTH_ME_RETRY_MAX_ATTEMPTS,
  AUTH_SESSION_UNAVAILABLE_MESSAGE,
  AuthMeRequestError,
  applyAuthSessionOutcome,
  createFixedAccessTokenGetter,
  classifyAuthMeFailure,
  classifyAuthMeResult,
  runPortalAuthSessionCheck,
  shouldRetryAuthMeFailure,
  verifyAuthMeSession,
  waitForHydratedAccessToken,
} from "./auth-session-check";

describe("classifyAuthMeResult", () => {
  it("treats a successful /me envelope as authenticated", () => {
    expect(classifyAuthMeResult({ success: true, data: { id: "user" }, correlationId: "c" })).toEqual({
      status: "authenticated",
    });
  });

  it("treats UNAUTHORIZED as unauthorized", () => {
    expect(
      classifyAuthMeResult({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Session expired. Please log in again." },
        correlationId: "c",
      })
    ).toEqual({ status: "unauthorized" });
  });

  it("treats SERVICE_UNAVAILABLE as retryable and not as invalid credentials", () => {
    expect(
      classifyAuthMeResult({
        success: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "Authentication service temporarily unavailable" },
        correlationId: "c",
      })
    ).toEqual({ status: "retryable", message: AUTH_SESSION_UNAVAILABLE_MESSAGE });
  });

  it("treats NETWORK_ERROR as retryable", () => {
    expect(
      classifyAuthMeResult({
        success: false,
        error: { code: "NETWORK_ERROR", message: "Could not reach the server." },
        correlationId: "c",
      })
    ).toEqual({ status: "retryable", message: AUTH_SESSION_UNAVAILABLE_MESSAGE });
  });

  it("treats HTTP 5xx and invalid JSON as retryable", () => {
    expect(
      classifyAuthMeResult({
        success: false,
        error: { code: "HTTP_ERROR", message: "Request failed with status 502" },
        correlationId: "c",
      }).status
    ).toBe("retryable");
    expect(
      classifyAuthMeResult({
        success: false,
        error: { code: "INVALID_JSON", message: "The server returned an invalid response." },
        correlationId: "c",
      }).status
    ).toBe("retryable");
  });
});

describe("applyAuthSessionOutcome", () => {
  it("does not invoke sign-out or login redirect for a retryable /me result", () => {
    const onAuthenticated = jest.fn();
    const onUnauthorized = jest.fn();
    const onUnauthenticated = jest.fn();
    const onRetryable = jest.fn();

    applyAuthSessionOutcome(
      { status: "retryable", message: AUTH_SESSION_UNAVAILABLE_MESSAGE },
      { onAuthenticated, onUnauthorized, onUnauthenticated, onRetryable }
    );

    expect(onRetryable).toHaveBeenCalledTimes(1);
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("sends confirmed UNAUTHORIZED to the sign-out/redirect path", () => {
    const onUnauthorized = jest.fn();
    applyAuthSessionOutcome(
      { status: "unauthorized" },
      {
        onAuthenticated: jest.fn(),
        onUnauthorized,
        onUnauthenticated: jest.fn(),
        onRetryable: jest.fn(),
      }
    );
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe("verifyAuthMeSession", () => {
  it("returns authenticated without retrying a successful /me", async () => {
    const fetchMe = jest.fn().mockResolvedValue({ success: true, data: {}, correlationId: "c" });
    const sleep = jest.fn();

    await expect(verifyAuthMeSession(fetchMe, { sleep })).resolves.toEqual({ status: "authenticated" });
    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries NETWORK_ERROR and SERVICE_UNAVAILABLE, then stays retryable", async () => {
    const fetchMe = jest
      .fn()
      .mockResolvedValueOnce({
        success: false,
        error: { code: "NETWORK_ERROR", message: "down" },
        correlationId: "",
      })
      .mockResolvedValueOnce({
        success: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "denylist store down" },
        correlationId: "",
      })
      .mockResolvedValueOnce({
        success: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "denylist store down" },
        correlationId: "",
      });
    const sleep = jest.fn().mockResolvedValue(undefined);

    await expect(verifyAuthMeSession(fetchMe, { sleep })).resolves.toEqual({
      status: "retryable",
      message: AUTH_SESSION_UNAVAILABLE_MESSAGE,
    });
    expect(fetchMe).toHaveBeenCalledTimes(AUTH_ME_RETRY_MAX_ATTEMPTS);
    expect(sleep).toHaveBeenCalledWith(AUTH_ME_RETRY_DELAYS_MS[0]);
    expect(sleep).toHaveBeenCalledWith(AUTH_ME_RETRY_DELAYS_MS[1]);
  });

  it("stops retrying after a confirmed 401", async () => {
    const fetchMe = jest.fn().mockResolvedValue({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Token has been revoked" },
      correlationId: "c",
    });
    const sleep = jest.fn();

    await expect(verifyAuthMeSession(fetchMe, { sleep })).resolves.toEqual({ status: "unauthorized" });
    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe("waitForHydratedAccessToken", () => {
  it("returns immediately when a token is already present", async () => {
    const getAccessToken = jest.fn().mockResolvedValue("live-token");
    const sleep = jest.fn();

    await expect(
      waitForHydratedAccessToken({ getAccessToken, sleep, maxWaitMs: 2500, intervalMs: 250 })
    ).resolves.toBe("live-token");
    expect(sleep).not.toHaveBeenCalled();
    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });

  it("waits until the grace window before treating a missing token as absent", async () => {
    let now = 0;
    const getAccessToken = jest.fn().mockResolvedValue(null);
    const sleep = jest.fn().mockImplementation(async (ms: number) => {
      now += ms;
    });

    await expect(
      waitForHydratedAccessToken({
        getAccessToken,
        sleep,
        now: () => now,
        maxWaitMs: 2500,
        intervalMs: 250,
      })
    ).resolves.toBeNull();

    expect(now).toBeGreaterThanOrEqual(2500);
    expect(getAccessToken.mock.calls.length).toBeGreaterThan(1);
  });

  it("stops waiting when cancelled so a stale check cannot finish", async () => {
    let cancelled = false;
    const getAccessToken = jest.fn().mockResolvedValue(null);
    const sleep = jest.fn().mockImplementation(async () => {
      cancelled = true;
    });

    await expect(
      waitForHydratedAccessToken({
        getAccessToken,
        isCancelled: () => cancelled,
        sleep,
        maxWaitMs: 2500,
        intervalMs: 250,
      })
    ).resolves.toBeNull();
    expect(getAccessToken.mock.calls.length).toBeLessThan(4);
  });
});

describe("runPortalAuthSessionCheck", () => {
  it("does not fetch /me or sign out when cancelled during hydration", async () => {
    const fetchMe = jest.fn();
    const result = await runPortalAuthSessionCheck({
      getAccessToken: async () => null,
      fetchMe,
      isCancelled: () => true,
      sleep: async () => undefined,
    });

    expect(result.status).toBe("retryable");
    expect(fetchMe).not.toHaveBeenCalled();
  });

  it("returns unauthenticated when no token appears within the grace window", async () => {
    const fetchMe = jest.fn();
    await expect(
      runPortalAuthSessionCheck({
        getAccessToken: async () => null,
        fetchMe,
        sleep: async () => undefined,
        now: (() => {
          let n = 0;
          return () => {
            const current = n;
            n += 2500;
            return current;
          };
        })(),
      })
    ).resolves.toEqual({ status: "unauthenticated" });
    expect(fetchMe).not.toHaveBeenCalled();
  });

  it("checks /me with the hydrated token even if a later getter call would be null", async () => {
    let calls = 0;
    const getAccessToken = jest.fn().mockImplementation(async () => {
      calls += 1;
      return calls === 1 ? "hydrated-token" : null;
    });
    const fetchMe = jest.fn().mockImplementation(async (accessToken: string) => {
      expect(accessToken).toBe("hydrated-token");
      return { success: true, data: {}, correlationId: "c" };
    });

    await expect(
      runPortalAuthSessionCheck({
        getAccessToken,
        fetchMe,
        sleep: async () => undefined,
      })
    ).resolves.toEqual({ status: "authenticated" });

    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(fetchMe).toHaveBeenCalledWith("hydrated-token");
    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });
});

describe("createFixedAccessTokenGetter", () => {
  it("keeps returning the hydrated token after the original getter goes null", async () => {
    const originalGetAccessToken = jest
      .fn()
      .mockResolvedValueOnce("hydrated-token")
      .mockResolvedValue(null);
    const token = await originalGetAccessToken();
    expect(token).toBe("hydrated-token");

    const fixed = createFixedAccessTokenGetter(token);
    await expect(originalGetAccessToken()).resolves.toBeNull();
    await expect(fixed()).resolves.toBe("hydrated-token");
    await expect(fixed()).resolves.toBe("hydrated-token");
  });
});

describe("shouldRetryAuthMeFailure", () => {
  it("retries 503 and network failures until the attempt budget is spent", () => {
    const error = new AuthMeRequestError({
      status: "retryable",
      message: AUTH_SESSION_UNAVAILABLE_MESSAGE,
    });
    expect(shouldRetryAuthMeFailure(0, error)).toBe(true);
    expect(shouldRetryAuthMeFailure(AUTH_ME_RETRY_MAX_ATTEMPTS - 1, error)).toBe(false);
  });

  it("does not retry confirmed unauthorized failures", () => {
    expect(shouldRetryAuthMeFailure(0, new AuthMeRequestError({ status: "unauthorized" }))).toBe(
      false
    );
  });
});

describe("classifyAuthMeFailure", () => {
  it("preserves AuthMeRequestError classification for React Query", () => {
    expect(classifyAuthMeFailure(new AuthMeRequestError({ status: "unauthenticated" }))).toEqual({
      status: "unauthenticated",
    });
    expect(
      classifyAuthMeFailure(
        new AuthMeRequestError({ status: "retryable", message: AUTH_SESSION_UNAVAILABLE_MESSAGE })
      )
    ).toEqual({ status: "retryable", message: AUTH_SESSION_UNAVAILABLE_MESSAGE });
  });
});
