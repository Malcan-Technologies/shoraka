import { AUDIT_ACTOR_TYPE, type AuditActorType } from "../../lib/audit/context";

export type CognitoAdminAccessDeniedReason = "MISSING_ADMIN_ROLE" | "ADMIN_INACTIVE";

/**
 * Classify ADMIN_ACCESS_DENIED from the Cognito Admin-portal gate.
 * actor_type is WHO (role membership), not WHERE (portal stays ADMIN at the writer).
 */
export function resolveCognitoAdminAccessDeniedClassification(hasAdminRole: boolean): {
  actorType: AuditActorType;
  reasonCode: CognitoAdminAccessDeniedReason;
} {
  if (hasAdminRole) {
    return {
      actorType: AUDIT_ACTOR_TYPE.ADMIN,
      reasonCode: "ADMIN_INACTIVE",
    };
  }

  return {
    actorType: AUDIT_ACTOR_TYPE.USER,
    reasonCode: "MISSING_ADMIN_ROLE",
  };
}
