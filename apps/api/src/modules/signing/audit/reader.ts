import type { SigningAuditLog } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  isSigningAuditEventType,
  type SigningAuditEventType,
} from "./events";

export type SigningAuditActorDto = {
  type: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
};

export type SigningAuditLogDto = {
  id: string;
  eventType: SigningAuditEventType;
  occurredAt: string;
  createdAt: string;
  actor: SigningAuditActorDto;
  organizationId: string | null;
  organizationKind: string | null;
  target: { type: string; id: string };
  source: string;
  portal: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
  signingEnvelopeId: string | null;
  applicationId: string | null;
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

function eventTypeOf(value: string): SigningAuditEventType {
  return isSigningAuditEventType(value) ? value : (value as SigningAuditEventType);
}

export function toSigningAuditLogDto(row: SigningAuditLog): SigningAuditLogDto {
  const metadata = metadataRecord(row.metadata);
  return {
    id: row.id,
    eventType: eventTypeOf(row.event_type),
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
    signingEnvelopeId: row.signing_envelope_id,
    applicationId: row.application_id,
  };
}

const ORDER_BY = [{ occurred_at: "desc" as const }, { id: "desc" as const }];

export class SigningAuditLogReader {
  async listByEnvelopeId(signingEnvelopeId: string): Promise<SigningAuditLogDto[]> {
    const rows = await prisma.signingAuditLog.findMany({
      where: { signing_envelope_id: signingEnvelopeId },
      orderBy: ORDER_BY,
    });
    return rows.map(toSigningAuditLogDto);
  }

  async listByApplicationId(applicationId: string): Promise<SigningAuditLogDto[]> {
    const rows = await prisma.signingAuditLog.findMany({
      where: { application_id: applicationId },
      orderBy: ORDER_BY,
    });
    return rows.map(toSigningAuditLogDto);
  }
}

export const signingAuditLogReader = new SigningAuditLogReader();
