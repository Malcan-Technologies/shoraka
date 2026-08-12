type ApiErrorPayload = {
  code: string;
  message: string;
};

export class AdminApiQueryError extends Error {
  readonly code: string;

  constructor(error: ApiErrorPayload) {
    super(error.message);
    this.name = "AdminApiQueryError";
    this.code = error.code;
  }
}

function redirectToLandingOnUnauthorized(): void {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production") {
    return;
  }

  window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
}

/** Redirect only on 401; throw so callers can surface 403 as Access Denied in-place. */
export function handleAdminApiQueryError(error: ApiErrorPayload): never {
  if (error.code === "UNAUTHORIZED") {
    redirectToLandingOnUnauthorized();
  }

  throw new AdminApiQueryError(error);
}

export function shouldRetryAdminApiQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof AdminApiQueryError && error.code === "UNAUTHORIZED") {
    return false;
  }

  return failureCount < 2;
}
