import type { ApiError } from "@cashsouk/types";

/**
 * Toast/query copy for API errors. Never append SOAP/upstream payloads or stack traces.
 */
export function formatApiErrorMessage(error: ApiError["error"]): string {
  return error.message;
}
