import type {
  ApplicationAuditLogDto,
  NoteAuditLogDto,
  PaymentAuditLogDto,
} from "@cashsouk/types";
import { formatAuditEventLabel } from "@/lib/audit-tabs";
import type { AuditLogDetail } from "@/components/audit/audit-log-detail-sheet";

function actorFields(actor: {
  type: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
}) {
  return {
    actorType: actor.type,
    actorName: actor.displayName,
    actorEmail: actor.email,
    actorUserId: actor.userId,
  };
}

export function applicationAuditToDetail(log: ApplicationAuditLogDto): AuditLogDetail {
  return {
    id: log.id,
    eventType: log.eventType,
    eventLabel: formatAuditEventLabel(log.eventType),
    occurredAt: log.occurredAt,
    createdAt: log.createdAt,
    ...actorFields(log.actor),
    organizationId: log.organizationId,
    organizationKind: log.organizationKind,
    targetType: log.target.type,
    targetId: log.target.id,
    source: log.source,
    portal: log.portal,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    correlationId: log.correlationId,
    extraFields: [
      { label: "Application ID", value: log.applicationId },
      { label: "Signing envelope ID", value: log.signingEnvelopeId },
    ],
    metadata: log.metadata,
  };
}

export function noteAuditToDetail(log: NoteAuditLogDto): AuditLogDetail {
  return {
    id: log.id,
    eventType: log.eventType,
    eventLabel: formatAuditEventLabel(log.eventType),
    occurredAt: log.occurredAt,
    createdAt: log.createdAt,
    ...actorFields(log.actor),
    organizationId: log.organizationId,
    organizationKind: log.organizationKind,
    targetType: log.target.type,
    targetId: log.target.id,
    source: log.source,
    portal: log.portal,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    correlationId: log.correlationId,
    extraFields: [{ label: "Note ID", value: log.noteId }],
    metadata: log.metadata,
  };
}

export function paymentAuditToDetail(log: PaymentAuditLogDto): AuditLogDetail {
  return {
    id: log.id,
    eventType: log.eventType,
    eventLabel: formatAuditEventLabel(log.eventType),
    occurredAt: log.occurredAt,
    createdAt: log.createdAt,
    ...actorFields(log.actor),
    organizationId: log.organizationId,
    organizationKind: log.organizationKind,
    targetType: log.target.type,
    targetId: log.target.id,
    source: log.source,
    portal: log.portal,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    correlationId: log.correlationId,
    extraFields: [{ label: "Gateway payment ID", value: log.gatewayPaymentId }],
    metadata: log.metadata,
  };
}
