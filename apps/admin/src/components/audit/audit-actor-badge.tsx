"use client";

import { PortalBadge, StatusBadge, type StatusToken } from "@cashsouk/ui";
import {
  formatAuditActorTypeLabel,
  type AuditActorKind,
} from "./audit-presentation";

const ACTOR_STATUS: Record<AuditActorKind, StatusToken> = {
  ADMIN: "active",
  SYSTEM: "neutral",
  INVESTOR: "submitted",
  ISSUER: "rejected",
  USER: "in-progress",
};

export function AuditActorBadge({
  type,
  className,
}: {
  type: string | null | undefined;
  className?: string;
}) {
  if (!type?.trim()) return null;
  const key = type.trim().toUpperCase();
  if (key === "INVESTOR" || key === "ISSUER") {
    return <PortalBadge portal={key === "INVESTOR" ? "investor" : "issuer"} className={className} />;
  }
  const kind = (["ADMIN", "SYSTEM", "USER"].includes(key) ? key : "USER") as AuditActorKind;
  return (
    <StatusBadge
      label={formatAuditActorTypeLabel(key)}
      status={ACTOR_STATUS[kind]}
      className={className}
    />
  );
}
