import type { ApiError, ApiResponse } from "@cashsouk/types";

export const AUTH_SESSION_UNAVAILABLE_MESSAGE =
  "We couldn't verify your session right now. Please try again.";

export const ACCESS_TOKEN_HYDRATION_MAX_WAIT_MS = 2500;
export const ACCESS_TOKEN_HYDRATION_INTERVAL_MS = 250;
export const AUTH_ME_RETRY_MAX_ATTEMPTS = 3;
export const AUTH_ME_RETRY_DELAYS_MS = [300, 800] as const;

export type AuthMeCheckResult =
  | { status: "authenticated" }
  | { status: "unauthorized" }
  | { status: "unauthenticated" }
  | { status: "retryable"; message: string };

export type AuthMeEnvelope = ApiResponse<unknown> | ApiError;

export class AuthMeRequestError extends Error {
  readonly result: Exclude<AuthMeCheckResult, { status: "authenticated" }>;

  constructor(result: Exclude<AuthMeCheckResult, { status: "authenticated" }>) {
    super(result.status === "retryable" ? result.message : result.status);
    this.name = "AuthMeRequestError";
    this.result = result;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readErrorCode(error: unknown): string | undefined {
  if (!isRecord(error) || !isRecord(error.error) || typeof error.error.code !== "string") {
    return undefined;
  }
  return error.error.code;
}

export function classifyAuthMeResult(result: AuthMeEnvelope): AuthMeCheckResult {
  if (result.success === true) {
    return { status: "authenticated" };
  }

  const code = readErrorCode(result);
  if (code === "UNAUTHORIZED") {
    return { status: "unauthorized" };
  }

  return { status: "retryable", message: AUTH_SESSION_UNAVAILABLE_MESSAGE };
}

export function classifyAuthMeFailure(
  error: unknown
): Exclude<AuthMeCheckResult, { status: "authenticated" }> {
  if (error instanceof AuthMeRequestError) {
    return error.result;
  }

  if (isRecord(error) && error.success === false) {
    const classified = classifyAuthMeResult(error as unknown as AuthMeEnvelope);
    if (classified.status !== "authenticated") {
      return classified;
    }
  }

  const code =
    error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
  if (code === "UNAUTHORIZED") {
    return { status: "unauthorized" };
  }

  return { status: "retryable", message: AUTH_SESSION_UNAVAILABLE_MESSAGE };
}

export function shouldRetryAuthMeFailure(failureCount: number, error: unknown): boolean {
  if (failureCount >= AUTH_ME_RETRY_MAX_ATTEMPTS - 1) {
    return false;
  }
  return classifyAuthMeFailure(error).status === "retryable";
}

export function authMeRetryDelayMs(attemptIndex: number): number {
  return (
    AUTH_ME_RETRY_DELAYS_MS[attemptIndex] ??
    AUTH_ME_RETRY_DELAYS_MS[AUTH_ME_RETRY_DELAYS_MS.length - 1]
  );
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForHydratedAccessToken(options: {
  getAccessToken: () => Promise<string | null>;
  isCancelled?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  maxWaitMs?: number;
  intervalMs?: number;
}): Promise<string | null> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const maxWaitMs = options.maxWaitMs ?? ACCESS_TOKEN_HYDRATION_MAX_WAIT_MS;
  const intervalMs = options.intervalMs ?? ACCESS_TOKEN_HYDRATION_INTERVAL_MS;
  const startedAt = now();

  while (true) {
    if (options.isCancelled?.()) {
      return null;
    }

    try {
      const token = await options.getAccessToken();
      if (token) {
        return token;
      }
    } catch {
      // Cookie/Amplify hydration can throw while cookies are still propagating.
    }

    if (options.isCancelled?.() || now() - startedAt >= maxWaitMs) {
      return null;
    }

    await sleep(intervalMs);
  }
}

export async function verifyAuthMeSession(
  fetchMe: () => Promise<AuthMeEnvelope>,
  options?: {
    sleep?: (ms: number) => Promise<void>;
    isCancelled?: () => boolean;
  }
): Promise<AuthMeCheckResult> {
  const sleep = options?.sleep ?? defaultSleep;
  let lastResult: AuthMeCheckResult = {
    status: "retryable",
    message: AUTH_SESSION_UNAVAILABLE_MESSAGE,
  };

  for (let attempt = 0; attempt < AUTH_ME_RETRY_MAX_ATTEMPTS; attempt++) {
    if (options?.isCancelled?.()) {
      return lastResult;
    }

    try {
      lastResult = classifyAuthMeResult(await fetchMe());
    } catch (error) {
      lastResult = classifyAuthMeFailure(error);
    }

    if (lastResult.status !== "retryable") {
      return lastResult;
    }

    const delay = AUTH_ME_RETRY_DELAYS_MS[attempt];
    if (delay == null) {
      break;
    }
    await sleep(delay);
  }

  return lastResult;
}

export function createFixedAccessTokenGetter(token: string): () => Promise<string | null> {
  return async () => token;
}

export async function runPortalAuthSessionCheck(options: {
  getAccessToken: () => Promise<string | null>;
  fetchMe: (accessToken: string) => Promise<AuthMeEnvelope>;
  isCancelled?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<AuthMeCheckResult> {
  const token = await waitForHydratedAccessToken({
    getAccessToken: options.getAccessToken,
    isCancelled: options.isCancelled,
    sleep: options.sleep,
    now: options.now,
  });

  if (options.isCancelled?.()) {
    return { status: "retryable", message: AUTH_SESSION_UNAVAILABLE_MESSAGE };
  }

  if (!token) {
    return { status: "unauthenticated" };
  }

  return verifyAuthMeSession(() => options.fetchMe(token), {
    sleep: options.sleep,
    isCancelled: options.isCancelled,
  });
}

export function applyAuthSessionOutcome(
  result: AuthMeCheckResult,
  actions: {
    onAuthenticated: () => void;
    onUnauthorized: () => void;
    onUnauthenticated: () => void;
    onRetryable: (result: Extract<AuthMeCheckResult, { status: "retryable" }>) => void;
  }
): void {
  if (result.status === "authenticated") {
    actions.onAuthenticated();
    return;
  }
  if (result.status === "unauthorized") {
    actions.onUnauthorized();
    return;
  }
  if (result.status === "unauthenticated") {
    actions.onUnauthenticated();
    return;
  }
  actions.onRetryable(result);
}
