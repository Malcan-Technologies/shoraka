import { auditPortalFromLegacy, type AuditPortal } from "../../lib/audit/context";

const EXPLICIT_LOGOUT_PORTALS = new Set(["issuer", "investor", "admin"]);

function firstQueryString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function portalFromHostname(urlValue: string | null | undefined): AuditPortal | null {
  if (!urlValue) return null;
  try {
    const hostname = new URL(urlValue).hostname.toLowerCase();
    if (hostname.includes("admin")) return auditPortalFromLegacy("admin");
    if (hostname.includes("investor")) return auditPortalFromLegacy("investor");
    if (hostname.includes("issuer")) return auditPortalFromLegacy("issuer");
  } catch {
    return null;
  }
  return null;
}

/**
 * Resolve USER_LOGGED_OUT portal for Cognito GET /logout.
 * Priority: explicit ?portal= → Origin/Referer hostname → null.
 * User roles never determine portal; they remain logout metadata only.
 */
export function resolveCognitoLogoutAuditPortal(input: {
  queryPortal?: unknown;
  referer?: string | null;
  origin?: string | null;
}): AuditPortal | null {
  const query = firstQueryString(input.queryPortal)?.trim().toLowerCase() ?? "";
  if (EXPLICIT_LOGOUT_PORTALS.has(query)) {
    return auditPortalFromLegacy(query);
  }

  return portalFromHostname(input.referer) ?? portalFromHostname(input.origin);
}
