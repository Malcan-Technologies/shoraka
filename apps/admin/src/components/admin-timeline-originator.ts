export type AdminTimelineOriginator = "admin" | "issuer" | "investor" | "system";

export const ADMIN_TIMELINE_ORIGINATOR_LABEL: Record<AdminTimelineOriginator, string> = {
  admin: "Admin",
  issuer: "Issuer",
  investor: "Investor",
  system: "System",
};

export const ADMIN_TIMELINE_ORIGINATOR_CLASS: Record<AdminTimelineOriginator, string> = {
  admin: "bg-status-active-bg text-status-active-text",
  issuer: "bg-portal-issuer-bg text-portal-issuer-text",
  investor: "bg-portal-investor-bg text-portal-investor-text",
  system: "bg-status-neutral-bg text-status-neutral-text",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOpaqueAdminTimelineActorId(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 16 || /\s/.test(trimmed)) return false;
  if (UUID.test(trimmed)) return true;
  return /^[a-z0-9_-]{20,}$/i.test(trimmed);
}

const SYSTEM_ACTOR_RE = /^(sys|system|system job|automated|auto)$/i;

export function displayAdminTimelineActorName(actorLabel?: string | null): string | null {
  const trimmed = actorLabel?.trim() ?? "";
  if (!trimmed || SYSTEM_ACTOR_RE.test(trimmed)) return null;
  if (isOpaqueAdminTimelineActorId(trimmed)) return null;
  return trimmed;
}

export function resolveAdminTimelineActorLabel({
  actorName,
  actorUserId,
  portal,
}: {
  actorName?: string | null;
  actorUserId?: string | null;
  portal?: string | null;
}): string {
  const named = displayAdminTimelineActorName(actorName);
  if (named) return named;

  const hasUser = Boolean(actorUserId?.trim());
  if (!hasUser) return "System";

  const originator = resolveAdminTimelineOriginator({
    actorLabel: "user",
    portal,
  });
  return ADMIN_TIMELINE_ORIGINATOR_LABEL[originator];
}

export function resolveAdminTimelineOriginator({
  actorLabel,
  portal,
}: {
  actorLabel?: string | null;
  portal?: string | null;
}): AdminTimelineOriginator {
  const actor = actorLabel?.trim().toLowerCase() ?? "";
  if (!actor || actor === "system" || actor === "sys" || actor === "system job") return "system";

  const key = portal?.trim().toLowerCase() ?? "";
  if (key === "admin") return "admin";
  if (key === "investor") return "investor";
  if (key === "issuer") return "issuer";
  return "admin";
}
