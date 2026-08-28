/**
 * Resolves the standard forensic columns for the existing log tables.
 *
 * Preservation rule: an explicitly supplied legacy value ALWAYS wins over anything derived from the
 * audit context. Call sites that were passing `ipAddress` / `userAgent` / `portal` individually keep
 * writing exactly the same values they wrote before; the context only fills the gaps.
 */

import {
  AUDIT_ACTOR_TYPE,
  AUDIT_SOURCE,
  AuditActorType,
  AuditOrganizationKind,
  AuditPortal,
  AuditRequestContext,
  AuditSource,
  AuditTargetType,
  auditActorTypeFor,
  auditPortalFromString,
} from "./context";

export type StandardAuditFieldInput = {
  context?: AuditRequestContext | null;
  /** Legacy per-call values. Non-undefined values take precedence over the context. */
  actorType?: AuditActorType | null;
  actorUserId?: string | null;
  source?: AuditSource | null;
  portal?: AuditPortal | string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  organizationId?: string | null;
  organizationKind?: AuditOrganizationKind | null;
  targetType?: AuditTargetType | null;
  targetId?: string | null;
  /** When true, an absent actor resolves to actor_type SYSTEM rather than USER. */
  systemWhenActorless?: boolean;
};

export type ResolvedStandardAuditFields = {
  actor_type: AuditActorType;
  actor_user_id: string | null;
  source: AuditSource;
  portal: AuditPortal | null;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string | null;
  organization_id: string | null;
  organization_kind: AuditOrganizationKind | null;
  target_type: AuditTargetType | null;
  target_id: string | null;
};

/**
 * Returns the first value the caller actually supplied. Only `undefined` counts as "not supplied",
 * so a caller that deliberately passes `null` to record "no value" is never overridden by the
 * context. An empty string is normalized to null so blank headers do not masquerade as evidence.
 */
function firstSupplied<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value === undefined) continue;
    return value === "" ? null : value;
  }
  return null;
}

export function resolveStandardAuditFields(
  input: StandardAuditFieldInput
): ResolvedStandardAuditFields {
  const context = input.context ?? null;
  const portal = auditPortalFromString(
    firstSupplied(typeof input.portal === "string" ? input.portal : input.portal, context?.portal)
  );
  const actorUserId = firstSupplied(input.actorUserId, context?.actorUserId);
  const hasActor = input.systemWhenActorless ? Boolean(actorUserId) : true;
  const actorType =
    input.actorType ?? context?.actorType ?? auditActorTypeFor({ portal, hasActor });

  return {
    actor_type: actorType ?? AUDIT_ACTOR_TYPE.USER,
    actor_user_id: actorUserId,
    // An actorless write is not an inbound API request. Webhook and job paths that pass no context
    // resolve to INTERNAL rather than claiming an authenticated request made the change.
    source:
      input.source ?? context?.source ?? (actorUserId ? AUDIT_SOURCE.API : AUDIT_SOURCE.INTERNAL),
    portal,
    ip_address: firstSupplied(input.ipAddress, context?.ipAddress),
    user_agent: firstSupplied(input.userAgent, context?.userAgent),
    correlation_id: firstSupplied(input.correlationId, context?.correlationId),
    organization_id: firstSupplied(input.organizationId),
    organization_kind: firstSupplied(input.organizationKind),
    target_type: firstSupplied(input.targetType),
    target_id: firstSupplied(input.targetId),
  };
}
