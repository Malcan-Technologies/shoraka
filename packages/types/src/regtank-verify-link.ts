/**
 * Shared RegTank verify-link helpers for Person onboarding JSON.
 * Expiry is always timestamp + expiredIn seconds — never a hardcoded duration.
 */

export type PersonVerifyLinkExpiryState = "missing" | "valid" | "unknown" | "expired";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Parse RegTank `timestamp` values such as `2023-07-31 09:45:29+0000`. */
export function parseRegTankTimestamp(value: unknown, fallbackNow: Date = new Date()): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }
  if (isFiniteNumber(value)) {
    return new Date(value > 1e12 ? value : value * 1000);
  }
  if (typeof value !== "string" || !value.trim()) {
    return fallbackNow;
  }
  const raw = value.trim();
  const withT = raw.includes("T") ? raw : raw.replace(" ", "T");
  const withColonOffset = withT.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = Date.parse(withColonOffset);
  if (Number.isFinite(parsed)) {
    return new Date(parsed);
  }
  const fallbackParsed = Date.parse(raw);
  if (Number.isFinite(fallbackParsed)) {
    return new Date(fallbackParsed);
  }
  return fallbackNow;
}

export function parseRegTankExpiredInSeconds(value: unknown): number | undefined {
  if (isFiniteNumber(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return undefined;
}

/**
 * `verifyLinkExpiresAt = timestamp + expiredIn seconds`.
 * If `expiredIn` is missing, expiry is unknown (caller must not invent 1h/24h/7d).
 * If `timestamp` is missing or unparsable, `now` is the base.
 */
export function calculateRegTankVerifyLinkExpiresAt(params: {
  expiredIn: unknown;
  timestamp?: unknown;
  now?: Date;
}): Date | undefined {
  const expiredIn = parseRegTankExpiredInSeconds(params.expiredIn);
  if (expiredIn === undefined) {
    return undefined;
  }
  const now = params.now ?? new Date();
  const base = parseRegTankTimestamp(params.timestamp, now);
  return new Date(base.getTime() + expiredIn * 1000);
}

export function classifyPersonVerifyLinkExpiry(params: {
  verifyLink?: string | null;
  verifyLinkExpiresAt?: string | null;
  now?: Date;
}): PersonVerifyLinkExpiryState {
  if (!(params.verifyLink ?? "").trim()) {
    return "missing";
  }
  const expiry = (params.verifyLinkExpiresAt ?? "").trim();
  if (!expiry) {
    return "unknown";
  }
  const expiresAtMs = Date.parse(expiry);
  if (!Number.isFinite(expiresAtMs)) {
    return "unknown";
  }
  return (params.now ?? new Date()).getTime() < expiresAtMs ? "valid" : "expired";
}

export function replaceRegTankVerifyLinkToken(verifyLink: string, token: string): string {
  const url = new URL(verifyLink);
  url.searchParams.set("token", token);
  return url.toString();
}

export function getRegTankVerifyLinkRequestId(verifyLink: string): string {
  try {
    return new URL(verifyLink).searchParams.get("requestId")?.trim() ?? "";
  } catch {
    return "";
  }
}

export function deriveRegTankIndividualOnboardingOrigin(apiBaseUrl: string): string {
  const base = apiBaseUrl.trim().replace(/\/+$/, "");
  if (base.includes("-server")) {
    return base.replace("-server", "-onboarding");
  }
  return base;
}

export function buildRegTankIndividualVerifyLink(params: {
  origin: string;
  requestId: string;
  token: string;
  formId: number;
}): string {
  const url = new URL(params.origin);
  url.searchParams.set("requestId", params.requestId);
  url.searchParams.set("formId", String(params.formId));
  url.searchParams.set("token", params.token);
  url.searchParams.set("language", "EN");
  url.searchParams.set("step", "BaseInfo");
  url.searchParams.set("skipFormPage", "false");
  return url.toString();
}

export function resolvePersonRenewedVerifyLink(params: {
  existingVerifyLink?: string | null;
  requestId: string;
  token: string;
  formId: number;
  origin: string;
  returnedVerifyLink?: string | null;
}): string {
  const returned = (params.returnedVerifyLink ?? "").trim();
  if (returned) {
    return returned;
  }
  const token = params.token.trim();
  const existing = (params.existingVerifyLink ?? "").trim();
  if (existing && token) {
    try {
      return replaceRegTankVerifyLinkToken(existing, token);
    } catch {
      // Reconstruct from known Person onboarding URL shape when the stored link is not a valid URL.
    }
  }
  if (!token) {
    throw new Error("RegTank renew-token did not return a token");
  }
  return buildRegTankIndividualVerifyLink({
    origin: params.origin,
    requestId: params.requestId,
    token,
    formId: params.formId,
  });
}
