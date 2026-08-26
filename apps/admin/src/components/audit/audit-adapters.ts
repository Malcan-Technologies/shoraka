import type {
  AdminContractActivityEvent,
  AdminNotificationLog,
  InvestorBalanceActivityEntry,
  LegalDocumentAuditLogListItem,
  NoteEvent,
  OnboardingLogResponse,
  ProductLogResponse,
} from "@cashsouk/types";
import type { GatewayPaymentEventDto } from "@cashsouk/types";
import type { ApplicationLogEntry } from "@/hooks/use-application-logs";
import { presentFields, type AuditDetailRecord } from "./audit-detail-model";
import {
  diffAuditValues,
  extractPreviousNext,
  formatAuditActorTypeLabel,
  formatAuditEventLabel,
  formatAuditSourceLabel,
  formatRoleSwitchedLabel,
  presentAuditActorName,
  resolveAuditActorType,
} from "./audit-presentation";

type ForensicFields = {
  actor_type?: string | null;
  source?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  correlation_id?: string | null;
  portal?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickString(record: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

function metadataReason(metadata: Record<string, unknown> | null | undefined): string | null {
  return pickString(metadata, [
    "reason",
    "remark",
    "rejection_reason",
    "rejectionReason",
    "amendment_reason",
    "newReason",
  ]);
}

function metadataAmount(metadata: Record<string, unknown> | null | undefined) {
  return {
    amount: pickString(metadata, ["amount", "investmentAmount", "withdrawalAmount"]),
    currency: pickString(metadata, ["currency"]),
    previousAmount: pickString(metadata, ["previousAmount", "previous_amount"]),
    newAmount: pickString(metadata, ["newAmount", "new_amount"]),
    paymentStatus: pickString(metadata, ["paymentStatus", "payment_status"]),
    settlementStatus: pickString(metadata, ["settlementStatus", "settlement_status"]),
  };
}

export type AccessLikeLog = ForensicFields & {
  id: string;
  user_id: string;
  user: { first_name: string; last_name: string; email: string; roles?: string[] };
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  device_type?: string | null;
  cognito_event?: Record<string, unknown> | null;
  success?: boolean;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
  organizationName?: string | null;
};

export function accessLogToAuditDetail(
  log: AccessLikeLog,
  labelOverrides?: Record<string, string>
): AuditDetailRecord {
  const actorName = `${log.user.first_name} ${log.user.last_name}`.trim();
  const actorType = resolveAuditActorType({
    actorType: log.actor_type,
    portal: log.portal,
    actorName,
    actorUserId: log.user_id,
  });
  const { previous, next } = extractPreviousNext(log.metadata);
  const financial = metadataAmount(log.metadata);
  const timestamp = log.created_at instanceof Date ? log.created_at.toISOString() : log.created_at;

  return {
    id: log.id,
    title: "Event details",
    eventLabel:
      log.event_type === "ROLE_SWITCHED"
        ? formatRoleSwitchedLabel(log.metadata)
        : formatAuditEventLabel(log.event_type, labelOverrides),
    eventType: log.event_type,
    timestamp,
    status: log.success === false ? "Failed" : log.success === true ? "Success" : null,
    actor: {
      name: presentAuditActorName(actorName, actorType),
      email: log.user.email,
      type: actorType,
      organisation: log.organizationName,
      source: log.source,
      id: log.user_id,
      portal: log.portal,
    },
    target: {
      type: log.target_type,
      id: log.target_id,
      extra: presentFields([
        {
          label: "Organisation ID",
          value: pickString(log.metadata, ["organizationId", "organization_id"]),
        },
      ]),
    },
    financial,
    changedFields: diffAuditValues(previous, next),
    reason: metadataReason(log.metadata),
    technical: presentFields([
      { label: "Event type", value: log.event_type },
      { label: "Actor ID", value: log.user_id },
      { label: "Source", value: log.source },
      { label: "Correlation ID", value: log.correlation_id },
      { label: "IP address", value: log.ip_address },
      { label: "Device", value: log.device_info ?? log.device_type },
      { label: "User agent", value: log.user_agent },
    ]),
    metadata: log.cognito_event
      ? { metadata: log.metadata, cognito_event: log.cognito_event }
      : log.metadata,
    previousValues: previous,
    nextValues: next,
  };
}

export function productLogToAuditDetail(log: ProductLogResponse & ForensicFields): AuditDetailRecord {
  const metadata = log.metadata;
  const workflow = (metadata?.workflow as unknown[]) ?? [];
  const first = workflow[0] as { config?: { name?: string; type?: { name?: string } } } | undefined;
  const productName =
    (typeof first?.config?.name === "string" ? first.config.name : null) ??
    (typeof first?.config?.type?.name === "string" ? first.config.type.name : null) ??
    pickString(metadata, ["product_name", "name"]);
  const actorName = `${log.user.first_name} ${log.user.last_name}`.trim();
  const actorType = resolveAuditActorType({
    actorType: log.actor_type,
    portal: log.portal ?? "ADMIN",
    actorName,
    actorUserId: log.user_id,
  });
  const { previous, next } = extractPreviousNext(metadata);

  return {
    id: log.id,
    title: "Event details",
    eventLabel: formatAuditEventLabel(log.event_type),
    eventType: log.event_type,
    timestamp: log.created_at,
    actor: {
      name: presentAuditActorName(actorName, actorType),
      email: log.user.email,
      type: actorType,
      source: log.source,
      id: log.user_id,
      portal: log.portal ?? "ADMIN",
    },
    target: {
      type: log.target_type ?? "PRODUCT",
      id: log.target_id ?? log.product_id,
      extra: presentFields([{ label: "Product", value: productName }]),
    },
    changedFields: diffAuditValues(previous, next),
    technical: presentFields([
      { label: "Event type", value: log.event_type },
      { label: "Actor ID", value: log.user_id },
      { label: "Source", value: log.source },
      { label: "Correlation ID", value: log.correlation_id },
      { label: "Product ID", value: log.product_id },
      { label: "IP address", value: log.ip_address },
      { label: "User agent", value: log.user_agent },
    ]),
    metadata,
    previousValues: previous,
    nextValues: next,
  };
}

export function legalAuditToAuditDetail(log: LegalDocumentAuditLogListItem): AuditDetailRecord {
  const actorType = resolveAuditActorType({
    actorName: log.actorName,
    actorUserId: log.actorUserId,
    portal: "ADMIN",
  });
  return {
    id: log.id,
    title: "Event details",
    eventLabel: formatAuditEventLabel(log.action),
    eventType: log.action,
    timestamp: log.createdAt,
    actor: {
      name: presentAuditActorName(log.actorName, actorType),
      email: log.actorEmail,
      type: actorType,
      source: "ADMIN",
      id: log.actorUserId,
      portal: "ADMIN",
    },
    target: {
      type: log.documentType,
      id: log.legalDocumentId,
      extra: presentFields([
        { label: "Version ID", value: log.legalDocumentVersionId },
        { label: "Version", value: log.versionNumber != null ? `v${log.versionNumber}` : null },
        { label: "Document hash", value: log.documentHash },
        { label: "File name", value: pickString(log.afterJson, ["file_name"]) },
      ]),
    },
    changedFields: diffAuditValues(log.beforeJson, log.afterJson),
    reason: log.reason,
    technical: presentFields([
      { label: "Event type", value: log.action },
      { label: "Actor ID", value: log.actorUserId },
      { label: "Correlation ID", value: log.correlationId },
      { label: "IP address", value: log.ipAddress },
      { label: "User agent", value: log.userAgent },
    ]),
    metadata: {
      beforeJson: log.beforeJson,
      afterJson: log.afterJson,
    },
    previousValues: log.beforeJson,
    nextValues: log.afterJson,
  };
}

export function notificationLogToAuditDetail(log: AdminNotificationLog): AuditDetailRecord {
  const actorName = log.admin ? `${log.admin.first_name} ${log.admin.last_name}`.trim() : "System";
  const actorType = log.source === "SYSTEM" || !log.admin ? "SYSTEM" : "ADMIN";
  const metadata = log.metadata;
  return {
    id: log.id,
    title: "Notification details",
    eventLabel: log.notification_type?.name || formatAuditEventLabel(log.notification_type_id),
    eventType: log.notification_type_id,
    timestamp: log.created_at,
    description: log.message,
    actor: {
      name: presentAuditActorName(actorName, actorType),
      email: log.admin?.email,
      type: actorType,
      source: log.source,
      id: log.admin_user_id,
    },
    target: {
      type: log.target_type,
      id: log.target_group_id,
      extra: presentFields([
        { label: "Related reference", value: pickString(metadata, ["targetId", "target_id", "noteId", "applicationId"]) },
      ]),
    },
    delivery: {
      notificationType: log.notification_type?.name || log.notification_type_id,
      title: log.title,
      message: log.message,
      audience: log.target_type.replace(/_/g, " "),
      platformDelivered: String(log.delivered_platform_count),
      emailDelivered: String(log.delivered_email_count),
      idempotencyKey: log.idempotency_key,
    },
    technical: presentFields([
      { label: "Event type", value: log.notification_type_id },
      { label: "Actor ID", value: log.admin_user_id },
      { label: "Source", value: log.source },
      { label: "Idempotency key", value: log.idempotency_key },
      { label: "Recipient count attempted", value: String(log.recipient_count) },
      { label: "IP address", value: log.ip_address },
      { label: "Device", value: log.device_info },
      { label: "User agent", value: log.user_agent },
    ]),
    metadata,
  };
}

export function noteEventToAuditDetail(
  event: NoteEvent & {
    actorType?: string | null;
    source?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
  eventLabel: string
): AuditDetailRecord {
  const metadata = event.metadata;
  const actorType = resolveAuditActorType({
    actorType: event.actorType,
    portal: event.portal,
    actorName: event.actorName,
    actorUserId: event.actorUserId,
  });
  const { previous, next } = extractPreviousNext(metadata);
  const financial = metadataAmount(metadata);
  return {
    id: event.id,
    title: "Event details",
    eventLabel,
    eventType: event.eventType,
    timestamp: event.createdAt,
    actor: {
      name: presentAuditActorName(event.actorName, actorType),
      type: actorType,
      source: event.source ?? event.portal,
      id: event.actorUserId,
      portal: event.portal,
    },
    target: {
      type: event.targetType ?? "NOTE",
      id: event.targetId ?? event.noteId,
      noteReference: pickString(metadata, ["noteReference", "note_reference"]),
      investmentReference: pickString(metadata, ["investmentReference", "investment_reference"]),
      withdrawalReference: pickString(metadata, ["withdrawalReference", "withdrawal_reference"]),
      paymentReference: pickString(metadata, ["paymentReference", "payment_reference"]),
      trusteeInstructionReference: pickString(metadata, [
        "trusteeReference",
        "trustee_reference",
        "settlementReference",
        "settlement_reference",
      ]),
    },
    financial,
    changedFields: diffAuditValues(previous, next),
    reason: metadataReason(metadata),
    technical: presentFields([
      { label: "Event type", value: event.eventType },
      { label: "Actor ID", value: event.actorUserId },
      { label: "Actor role", value: event.actorRole },
      { label: "Source", value: event.source },
      { label: "Portal", value: event.portal },
      { label: "Correlation ID", value: event.correlationId },
      { label: "IP address", value: event.ipAddress },
      { label: "User agent", value: event.userAgent },
    ]),
    metadata,
    previousValues: previous,
    nextValues: next,
  };
}

export function applicationLogToAuditDetail(
  log: ApplicationLogEntry & ForensicFields,
  eventLabel: string,
  description?: string | null
): AuditDetailRecord {
  const metadata = log.metadata;
  const actorName = pickString(metadata, ["actorName", "organizationName"]);
  const portal = pickString(metadata, ["portal", "portalType"]) ?? log.portal ?? null;
  const actorType = resolveAuditActorType({
    actorType: log.actor_type,
    portal,
    actorName,
    actorUserId: log.actor_id,
  });
  const { previous, next } = extractPreviousNext(metadata);
  return {
    id: log.id,
    title: "Event details",
    eventLabel,
    eventType: log.event_type,
    timestamp: log.created_at,
    description: description ?? (typeof log.activity === "string" ? log.activity : null),
    actor: {
      name: presentAuditActorName(actorName, actorType),
      type: actorType,
      organisation: pickString(metadata, ["organizationName"]),
      source: log.source ?? portal,
      id: log.actor_id,
      portal,
    },
    target: {
      type: log.target_type,
      id: log.target_id ?? log.entityId,
      applicationReference: pickString(metadata, ["applicationReference", "application_id"]),
      envelopeReference: pickString(metadata, ["envelopeId", "envelope_id"]),
    },
    financial: {
      ...metadataAmount(metadata),
      extra: presentFields([
        { label: "Offered facility", value: pickString(metadata, ["offered_facility"]) },
        { label: "Requested facility", value: pickString(metadata, ["requested_facility"]) },
        { label: "Offered amount", value: pickString(metadata, ["offered_amount"]) },
        { label: "Requested amount", value: pickString(metadata, ["requested_amount"]) },
      ]),
    },
    changedFields: diffAuditValues(previous, next),
    reason: log.remark ?? metadataReason(metadata),
    remark: log.remark,
    technical: presentFields([
      { label: "Event type", value: log.event_type },
      { label: "Actor ID", value: log.actor_id },
      { label: "Source", value: log.source },
      { label: "Correlation ID", value: log.correlation_id },
      { label: "IP address", value: log.ip_address },
      { label: "Review cycle", value: log.review_cycle != null ? String(log.review_cycle) : null },
    ]),
    metadata,
    previousValues: previous,
    nextValues: next,
  };
}

export function organizationLogToAuditDetail(
  log: OnboardingLogResponse & ForensicFields,
  eventLabel: string,
  description?: string | null
): AuditDetailRecord {
  const actorName = `${log.user.first_name} ${log.user.last_name}`.trim();
  const actorType = resolveAuditActorType({
    actorType: log.actor_type,
    portal: log.portal,
    actorName,
    actorUserId: log.user_id,
  });
  const { previous, next } = extractPreviousNext(log.metadata);
  return {
    id: log.id,
    title: "Event details",
    eventLabel,
    eventType: log.event_type,
    timestamp: log.created_at,
    description,
    actor: {
      name: presentAuditActorName(actorName, actorType),
      email: log.user.email,
      type: actorType,
      organisation: log.organizationName,
      source: log.source ?? log.portal,
      id: log.user_id,
      portal: log.portal,
    },
    target: {
      type: log.target_type ?? log.organizationType,
      id: log.target_id,
    },
    changedFields: diffAuditValues(previous, next),
    reason: metadataReason(log.metadata),
    technical: presentFields([
      { label: "Event type", value: log.event_type },
      { label: "Actor ID", value: log.user_id },
      { label: "Source", value: log.source },
      { label: "Correlation ID", value: log.correlation_id },
      { label: "IP address", value: log.ip_address },
      { label: "Device", value: log.device_info ?? log.device_type },
      { label: "User agent", value: log.user_agent },
    ]),
    metadata: log.metadata,
    previousValues: previous,
    nextValues: next,
  };
}

export function contractEventToAuditDetail(
  event: AdminContractActivityEvent,
  eventLabel: string
): AuditDetailRecord {
  const actorType = resolveAuditActorType({
    portal: event.portal,
    actorName: event.actorName,
    actorUserId: event.actorUserId,
  });
  const { previous, next } = extractPreviousNext(event.metadata);
  return {
    id: event.id,
    title: "Event details",
    eventLabel,
    eventType: event.eventType,
    timestamp: event.createdAt,
    actor: {
      name: presentAuditActorName(event.actorName, actorType),
      type: actorType,
      source: event.portal,
      id: event.actorUserId,
      portal: event.portal,
    },
    target: {
      type: "APPLICATION",
      id: event.applicationId,
      applicationReference: event.applicationId,
    },
    financial: metadataAmount(event.metadata),
    changedFields: diffAuditValues(previous, next),
    reason: event.remark,
    technical: presentFields([
      { label: "Event type", value: event.eventType },
      { label: "Actor ID", value: event.actorUserId },
      { label: "Source", value: event.portal },
    ]),
    metadata: event.metadata,
    previousValues: previous,
    nextValues: next,
  };
}

export function gatewayEventToAuditDetail(
  event: GatewayPaymentEventDto & {
    actorType?: string | null;
    source?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    portal?: string | null;
    correlationId?: string | null;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string | null;
  },
  eventLabel: string,
  description?: string | null
): AuditDetailRecord {
  const metadata = asRecord(event.metadata);
  const actorType = resolveAuditActorType({
    actorType: event.actorType,
    portal: event.portal ?? (event.actorUserId ? "ADMIN" : null),
    actorName: event.actorName,
    actorUserId: event.actorUserId,
  });
  return {
    id: event.id,
    title: "Event details",
    eventLabel,
    eventType: event.type,
    timestamp: event.createdAt,
    description,
    status: event.toStatus,
    actor: {
      name: presentAuditActorName(event.actorName, actorType),
      type: actorType,
      source: event.source ?? (event.actorUserId ? "ADMIN" : "SYSTEM"),
      id: event.actorUserId,
      portal: event.portal,
    },
    target: {
      type: event.targetType ?? "GATEWAY_PAYMENT",
      id: event.targetId,
      gatewayReference: pickString(metadata, ["gatewayReference", "curlecPaymentId"]),
      paymentReference: pickString(metadata, ["paymentReference"]),
    },
    financial: {
      paymentStatus: event.toStatus,
    },
    reason: event.reason,
    technical: presentFields([
      { label: "Event type", value: event.type },
      { label: "Actor ID", value: event.actorUserId },
      { label: "Source", value: event.source },
      { label: "Correlation ID", value: event.correlationId },
      { label: "From status", value: event.fromStatus },
      { label: "To status", value: event.toStatus },
      { label: "IP address", value: event.ipAddress },
    ]),
    metadata,
  };
}

export function walletActivityToAuditDetail(input: {
  title: string;
  statusLabel?: string | null;
  entry: InvestorBalanceActivityEntry;
}): AuditDetailRecord {
  const { entry, title, statusLabel } = input;
  const metadata = asRecord(entry.metadata);
  const related = entry.related;
  return {
    id: entry.id,
    title: "Transaction details",
    eventLabel: title,
    eventType: entry.source,
    timestamp: entry.postedAt,
    status: statusLabel,
    actor: {
      name: "System",
      type: "SYSTEM",
      source: "SYSTEM",
    },
    target: {
      type: related?.kind ? related.kind.toUpperCase() : null,
      id: entry.noteInvestmentId ?? entry.noteId,
      noteReference: entry.noteReference,
      investmentReference: entry.noteInvestmentId,
      paymentReference: pickString(metadata, ["paymentId", "gatewayPaymentId", "curlecPaymentId"]),
      withdrawalReference: pickString(metadata, ["withdrawalReference", "withdrawalId"]),
      extra: presentFields([{ label: "Organisation ID", value: entry.investorOrganizationId }]),
    },
    financial: {
      amount: String(entry.amount),
      paymentStatus: related?.status,
    },
    technical: presentFields([
      { label: "Event type", value: entry.source },
      { label: "Source", value: "SYSTEM" },
      { label: "Idempotency key", value: entry.idempotencyKey },
      { label: "Direction", value: entry.direction },
      { label: "Posted at", value: entry.postedAt },
    ]),
    metadata: {
      ...(metadata ?? {}),
      related,
      noteId: entry.noteId,
      noteInvestmentId: entry.noteInvestmentId,
      idempotencyKey: entry.idempotencyKey,
    },
  };
}

export function formatAuditActorCsv(
  name: string | null | undefined,
  actorType?: string | null
): string {
  return presentAuditActorName(name, actorType);
}

export function formatAuditSourceCsv(source: string | null | undefined): string {
  return formatAuditSourceLabel(source) || source || "";
}

export function formatAuditActorTypeCsv(type: string | null | undefined): string {
  return type ? formatAuditActorTypeLabel(type) : "";
}
