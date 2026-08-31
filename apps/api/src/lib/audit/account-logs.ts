/**
 * Standardized writers for the existing `access_logs`, `security_logs` and `onboarding_logs` tables.
 *
 * Both `AuthRepository` and `AdminRepository` had their own near-identical copies of these three
 * writers on origin/main; both now delegate here. Legacy columns are written exactly as before and
 * `metadata` is passed through untouched, because the admin log surfaces render metadata generically
 * and dump it as JSON. Everything new lands in dedicated nullable columns.
 *
 * These writers issue no extra query. `onboarding_logs.actor_user_id` (the acting admin, as opposed
 * to `user_id` which is the applicant) is read out of the admin id origin/main already recorded in
 * `metadata`, so nothing has to be looked up.
 */

import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../prisma";
import {
  AUDIT_ACTOR_TYPE,
  AUDIT_ORGANIZATION_KIND,
  AUDIT_TARGET_TYPE,
  AuditOrganizationKind,
  AuditRequestContext,
  AuditSource,
  AuditTargetType,
} from "./context";
import { resolveStandardAuditFields } from "./standard-fields";
import { sanitizeAuditMetadataRecord } from "./sanitize-metadata";

export type AccountAuditDb = Prisma.TransactionClient | typeof prisma;

function metaString(metadata: unknown, ...keys: string[]): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

type CommonAuditInput = {
  context?: AuditRequestContext | null;
  source?: AuditSource | null;
  correlationId?: string | null;
  targetType?: AuditTargetType | null;
  targetId?: string | null;
};

/* -------------------------------------------------------------------------- */
/* access_logs                                                                */
/* -------------------------------------------------------------------------- */

export type CreateAccessLogParams = CommonAuditInput & {
  /** The ACTOR. Admin-initiated rows store the admin here and the subject in metadata. */
  userId: string;
  eventType: string;
  portal?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
  deviceType?: string | null;
  cognitoEvent?: object | null;
  success?: boolean;
  metadata?: object | null;
};

/**
 * Access log rows always concern a user account: either the actor's own session (LOGIN / LOGOUT /
 * SIGNUP) or another user the admin acted on (`metadata.targetUserId`).
 */
function resolveAccessLogTarget(params: CreateAccessLogParams): {
  targetType: AuditTargetType;
  targetId: string;
} {
  return {
    targetType: AUDIT_TARGET_TYPE.USER,
    targetId: metaString(params.metadata, "targetUserId") ?? params.userId,
  };
}

export async function createAccessLogRow(
  params: CreateAccessLogParams,
  db: AccountAuditDb = prisma
) {
  const target = resolveAccessLogTarget(params);
  const standard = resolveStandardAuditFields({
    context: params.context,
    actorUserId: params.userId,
    portal: params.portal,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    correlationId: params.correlationId,
    source: params.source,
    targetType: params.targetType ?? target.targetType,
    targetId: params.targetId ?? target.targetId,
  });

  return db.accessLog.create({
    data: {
      user_id: params.userId,
      event_type: params.eventType,
      portal: params.portal ?? undefined,
      ip_address: params.ipAddress ?? undefined,
      user_agent: params.userAgent ?? undefined,
      device_info: params.deviceInfo ?? undefined,
      device_type: params.deviceType ?? undefined,
      cognito_event: (params.cognitoEvent ?? undefined) as Prisma.InputJsonValue | undefined,
      success: params.success ?? true,
      metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,

      actor_type: standard.actor_type,
      target_type: standard.target_type,
      target_id: standard.target_id,
      source: standard.source,
      correlation_id: standard.correlation_id,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* security_logs                                                              */
/* -------------------------------------------------------------------------- */

export type CreateSecurityLogParams = CommonAuditInput & {
  /** The ACTOR: the user changing their own credentials, or the acting admin. */
  userId: string;
  eventType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
  portal?: string | null;
  metadata?: object | null;
};

/**
 * Security events are either RBAC-catalogue changes (role key), invitation lifecycle changes
 * (invitation id), or credential changes on the actor's own account.
 */
function resolveSecurityLogTarget(params: CreateSecurityLogParams): {
  targetType: AuditTargetType;
  targetId: string;
} {
  const roleKey = metaString(params.metadata, "roleKey", "deletedRoleKey");
  if (roleKey) return { targetType: AUDIT_TARGET_TYPE.ADMIN_ROLE, targetId: roleKey };

  const invitationId = metaString(params.metadata, "invitationId");
  if (invitationId) {
    return { targetType: AUDIT_TARGET_TYPE.ADMIN_INVITATION, targetId: invitationId };
  }

  const settingsKey = metaString(params.metadata, "settingsKey");
  if (settingsKey) {
    return { targetType: AUDIT_TARGET_TYPE.PLATFORM_FINANCE_SETTINGS, targetId: settingsKey };
  }

  return {
    targetType: AUDIT_TARGET_TYPE.USER,
    targetId: metaString(params.metadata, "targetUserId") ?? params.userId,
  };
}

export async function createSecurityLogRow(
  params: CreateSecurityLogParams,
  db: AccountAuditDb = prisma
) {
  const target = resolveSecurityLogTarget(params);
  const standard = resolveStandardAuditFields({
    context: params.context,
    actorUserId: params.userId,
    portal: params.portal,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    correlationId: params.correlationId,
    source: params.source,
    targetType: params.targetType ?? target.targetType,
    targetId: params.targetId ?? target.targetId,
  });

  return db.securityLog.create({
    data: {
      user_id: params.userId,
      event_type: params.eventType,
      ip_address: params.ipAddress ?? undefined,
      user_agent: params.userAgent ?? undefined,
      device_info: params.deviceInfo ?? undefined,
      metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,

      actor_type: standard.actor_type,
      target_type: standard.target_type,
      target_id: standard.target_id,
      source: standard.source,
      portal: standard.portal,
      correlation_id: standard.correlation_id,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* onboarding_logs                                                            */
/* -------------------------------------------------------------------------- */

export type CreateOnboardingLogParams = CommonAuditInput & {
  /**
   * The SUBJECT of the onboarding record — the applicant, not necessarily the actor. Admin
   * decisions keep the applicant here (origin/main behaviour) and record the admin separately.
   */
  userId: string;
  role: UserRole;
  eventType: string;
  portal?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
  deviceType?: string | null;
  organizationName?: string | null;
  investorOrganizationId?: string | null;
  issuerOrganizationId?: string | null;
  metadata?: object | null;

  /**
   * Who performed the action. Falls back to the context actor, then to an id-shaped admin id already
   * present in metadata (`approvedBy` / `updatedBy` / `rejectedBy` / `resetBy`), then to the subject
   * for self-service events.
   */
  actorUserId?: string | null;
  organizationKind?: AuditOrganizationKind | null;
};

/** Matches the id formats used for `users.id` (uuid and cuid2), so sentinels are never stored. */
const USER_ID_SHAPE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9]{24,32})$/i;

/**
 * Resolves the actor for an onboarding decision.
 *
 * Several origin/main call sites record the decision maker only inside metadata, as `approvedBy` and
 * friends, sometimes with a sentinel such as `"admin"` or `"system"` instead of an id. A sentinel
 * means the actor is genuinely unknown, so the column stays null rather than being backfilled with
 * the subject, which would misattribute an admin decision to the applicant. The subject is used only
 * when no actor hint exists at all, which is the self-service case.
 */
function resolveOnboardingActorUserId(params: CreateOnboardingLogParams): string | null {
  if (params.actorUserId) return params.actorUserId;
  if (
    params.context?.actorType === AUDIT_ACTOR_TYPE.INTEGRATION ||
    params.context?.actorType === AUDIT_ACTOR_TYPE.SYSTEM
  ) {
    return params.context.actorUserId;
  }
  if (params.context?.actorUserId) return params.context.actorUserId;

  const hint = metaString(
    params.metadata,
    "approvedBy",
    "rejectedBy",
    "updatedBy",
    "resetBy",
    "cancelledBy",
    "actorUserId"
  );
  if (hint) return USER_ID_SHAPE.test(hint) ? hint : null;
  return params.userId;
}

export async function createOnboardingLogRow(
  params: CreateOnboardingLogParams,
  db: AccountAuditDb = prisma
) {
  const actorUserId = resolveOnboardingActorUserId(params);
  const organizationId = params.investorOrganizationId ?? params.issuerOrganizationId ?? null;
  const organizationKind =
    params.organizationKind ??
    (params.investorOrganizationId
      ? AUDIT_ORGANIZATION_KIND.INVESTOR
      : params.issuerOrganizationId
        ? AUDIT_ORGANIZATION_KIND.ISSUER
        : params.role === UserRole.INVESTOR
          ? AUDIT_ORGANIZATION_KIND.INVESTOR
          : params.role === UserRole.ISSUER
            ? AUDIT_ORGANIZATION_KIND.ISSUER
            : null);

  const standard = resolveStandardAuditFields({
    context: params.context,
    actorUserId,
    portal: params.portal,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    correlationId: params.correlationId,
    source: params.source,
    organizationKind,
    targetType:
      params.targetType ??
      (organizationId ? AUDIT_TARGET_TYPE.ORGANIZATION : AUDIT_TARGET_TYPE.USER),
    targetId: params.targetId ?? organizationId ?? params.userId,
  });

  return db.onboardingLog.create({
    data: {
      user_id: params.userId,
      role: params.role,
      event_type: params.eventType,
      portal: params.portal ?? undefined,
      ip_address: params.ipAddress ?? undefined,
      user_agent: params.userAgent ?? undefined,
      device_info: params.deviceInfo ?? undefined,
      device_type: params.deviceType ?? undefined,
      organization_name: params.organizationName ?? undefined,
      investor_organization_id: params.investorOrganizationId ?? undefined,
      issuer_organization_id: params.issuerOrganizationId ?? undefined,
      metadata: (sanitizeAuditMetadataRecord(params.metadata) ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,

      actor_type: standard.actor_type,
      actor_user_id: actorUserId,
      organization_kind: standard.organization_kind,
      target_type: standard.target_type,
      target_id: standard.target_id,
      source: standard.source,
      correlation_id: standard.correlation_id,
    },
  });
}
