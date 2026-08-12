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

export function isAdminApiQueryError(error: unknown): error is AdminApiQueryError {
  return error instanceof AdminApiQueryError;
}

export function isAdminApiForbiddenError(error: unknown): boolean {
  return isAdminApiQueryError(error) && error.code === "FORBIDDEN";
}

export function isAdminApiUnauthorizedError(error: unknown): boolean {
  return isAdminApiQueryError(error) && error.code === "UNAUTHORIZED";
}

export function isAdminApiAuthFailure(error: unknown): boolean {
  return (
    isAdminApiQueryError(error) &&
    (error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN")
  );
}

export function shouldRetryAdminApiQuery(failureCount: number, error: unknown): boolean {
  if (isAdminApiAuthFailure(error)) {
    return false;
  }

  return failureCount < 2;
}
