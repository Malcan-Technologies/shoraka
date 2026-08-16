import type { ApplicationAuditLog } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import type { SigningAuditLogDto } from "../../signing/audit/reader";
import { isApplicationAuditEventType } from "./events";

export type ApplicationAuditActorDto = {
  type: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
};

export type ApplicationAuditLogDto = {
  id: string;
  eventType: string;
  occurredAt: string;
  createdAt: string;
  actor: ApplicationAuditActorDto;
  organizationId: string | null;
  organizationKind: string | null;
  target: { type: string; id: string };
  source: string;
  portal: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
  activity?: string;
  applicationId: string | null;
  signingEnvelopeId: string | null;
};

function metadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function eventTypeOf(value: string): string {
  return isApplicationAuditEventType(value) ? value : value;
}

function activityFromMetadata(eventType: string, metadata: Record<string, unknown>): string | undefined {
  if (eventType === "APPLICATION_RESUBMITTED") {
    const summary = metadata.activitySummary;
    if (typeof summary === "string" && summary.trim().length > 0) {
      return summary.trim();
    }
  }
  return undefined;
}

export function toApplicationAuditLogDto(row: ApplicationAuditLog): ApplicationAuditLogDto {
  const metadata = metadataRecord(row.metadata);
  const eventType = eventTypeOf(row.event_type);
  const activity = activityFromMetadata(eventType, metadata);
  return {
    id: row.id,
    eventType,
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    actor: {
      type: row.actor_type,
      userId: row.actor_user_id,
      displayName: stringOrNull(metadata.actorName),
      email: stringOrNull(metadata.actorEmail),
    },
    organizationId: row.organization_id,
    organizationKind: row.organization_kind,
    target: { type: row.target_type, id: row.target_id },
    source: row.source,
    portal: row.portal,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    correlationId: row.correlation_id,
    metadata,
    ...(activity ? { activity } : {}),
    applicationId: row.application_id,
    signingEnvelopeId: null,
  };
}

export function signingAuditLogToApplicationHistory(
  log: SigningAuditLogDto
): ApplicationAuditLogDto {
  return {
    id: log.id,
    eventType: log.eventType,
    occurredAt: log.occurredAt,
    createdAt: log.createdAt,
    actor: log.actor,
    organizationId: log.organizationId,
    organizationKind: log.organizationKind,
    target: log.target,
    source: log.source,
    portal: log.portal,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    correlationId: log.correlationId,
    metadata: log.metadata,
    applicationId: log.applicationId,
    signingEnvelopeId: log.signingEnvelopeId,
  };
}

/** Unfiltered Application + Signing merge. Newest first. No Activity allowlist. */
export function mergeApplicationAndSigningAuditLogs(
  applicationLogs: ApplicationAuditLogDto[],
  signingLogs: SigningAuditLogDto[]
): ApplicationAuditLogDto[] {
  return [...applicationLogs, ...signingLogs.map(signingAuditLogToApplicationHistory)].sort(
    (a, b) => {
      const byTime = b.occurredAt.localeCompare(a.occurredAt);
      if (byTime !== 0) return byTime;
      return b.id.localeCompare(a.id);
    }
  );
}

export class ApplicationAuditLogReader {
  async listByApplicationId(applicationId: string): Promise<ApplicationAuditLogDto[]> {
    const rows = await prisma.applicationAuditLog.findMany({
      where: { application_id: applicationId },
      orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
    });
    return rows.map(toApplicationAuditLogDto);
  }
}

export const applicationAuditLogReader = new ApplicationAuditLogReader();
