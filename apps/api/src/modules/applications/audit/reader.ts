import type { ApplicationAuditLog } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  isApplicationAuditEventType,
  type ApplicationAuditEventType,
} from "./events";

export type ApplicationAuditActorDto = {
  type: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
};

export type ApplicationAuditLogDto = {
  id: string;
  eventType: ApplicationAuditEventType;
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

function eventTypeOf(value: string): ApplicationAuditEventType {
  return isApplicationAuditEventType(value) ? value : (value as ApplicationAuditEventType);
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
  };
}

export class ApplicationAuditLogReader {
  async listByApplicationId(applicationId: string): Promise<ApplicationAuditLogDto[]> {
    const rows = await prisma.applicationAuditLog.findMany({
      where: { application_id: applicationId },
      orderBy: { occurred_at: "desc" },
    });
    return rows.map(toApplicationAuditLogDto);
  }
}

export const applicationAuditLogReader = new ApplicationAuditLogReader();
