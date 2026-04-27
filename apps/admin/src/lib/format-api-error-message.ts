import type { ApiError } from "@cashsouk/types";

/**
 * Builds a single string for toasts/query errors so `error.details` (e.g. CTOS upstream) is visible.
 */
export function formatApiErrorMessage(error: ApiError["error"]): string {
  const { message, details } = error;
  if (details === undefined || details === null) return message;

  if (typeof details === "object" && "upstreamMessage" in details) {
    const u = (details as { upstreamMessage?: unknown }).upstreamMessage;
    if (u !== undefined && u !== null && String(u).length > 0) {
      return `${message} — ${String(u)}`;
    }
  }

  try {
    const s = JSON.stringify(details);
    if (s && s !== "{}") return `${message} — ${s}`;
  } catch {
    /* ignore */
  }
  return message;
}
