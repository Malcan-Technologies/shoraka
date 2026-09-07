import { AppError } from "../../../lib/http/error-handler";

export const REGTANK_RATE_LIMITED_CODE = "REGTANK_RATE_LIMITED";
export const REGTANK_RATE_LIMITED_MESSAGE =
  "RegTank is temporarily limiting status requests. Existing onboarding data has been preserved. Please try again later.";

export function parseRetryAfterHeader(header: string | null | undefined): number | null {
  const raw = String(header ?? "").trim();
  if (!raw) return null;
  const asSeconds = Number(raw);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.floor(asSeconds);
  }
  const asDate = Date.parse(raw);
  if (!Number.isFinite(asDate)) return null;
  return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
}

export function isRegTankRateLimited(error: unknown): boolean {
  if (!(error instanceof AppError)) return false;
  return error.code === REGTANK_RATE_LIMITED_CODE || error.statusCode === 429;
}
