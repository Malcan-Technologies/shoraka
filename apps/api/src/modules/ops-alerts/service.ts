import { OpsAlertSeverity, OpsAlertStatus, OpsAlertType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { AppError } from "../../lib/http/error-handler";

export type RaiseOpsAlertInput = {
  type: OpsAlertType;
  severity: OpsAlertSeverity;
  dedupeKey: string;
  title: string;
  summary?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
};

export async function raiseOpsAlert(input: RaiseOpsAlertInput): Promise<void> {
  try {
    const existing = await prisma.opsAlert.findUnique({
      where: { dedupe_key: input.dedupeKey },
    });

    if (!existing) {
      await prisma.opsAlert.create({
        data: {
          type: input.type,
          severity: input.severity,
          dedupe_key: input.dedupeKey,
          title: input.title,
          summary: input.summary ?? null,
          entity_type: input.entityType ?? null,
          entity_id: input.entityId ?? null,
          details: (input.details ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      return;
    }

    const reopen = existing.status === OpsAlertStatus.RESOLVED || existing.status === OpsAlertStatus.CLOSED;
    await prisma.opsAlert.update({
      where: { id: existing.id },
      data: {
        severity: input.severity,
        title: input.title,
        summary: input.summary ?? existing.summary,
        entity_type: input.entityType ?? existing.entity_type,
        entity_id: input.entityId ?? existing.entity_id,
        details: (input.details ?? existing.details ?? undefined) as Prisma.InputJsonValue | undefined,
        occurrence_count: { increment: 1 },
        last_seen_at: new Date(),
        ...(reopen
          ? {
              status: OpsAlertStatus.OPEN,
              resolved_at: null,
              resolved_by_user_id: null,
              closed_at: null,
              closed_by_user_id: null,
            }
          : {}),
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        dedupeKey: input.dedupeKey,
        type: input.type,
      },
      "Failed to raise ops alert (non-blocking)"
    );
  }
}

export async function raiseJobFailureAlert(jobName: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await raiseOpsAlert({
    type: OpsAlertType.REPEATED_JOB_FAILURE,
    severity: OpsAlertSeverity.HIGH,
    dedupeKey: `job-failure:${jobName}`,
    title: `Background job failed: ${jobName}`,
    summary: message,
    entityType: "job",
    entityId: jobName,
    details: { error: message },
  });
}

export type ListOpsAlertsQuery = {
  page: number;
  pageSize: number;
  status?: OpsAlertStatus;
  type?: OpsAlertType;
  severity?: OpsAlertSeverity;
  search?: string;
};

export async function listOpsAlerts(query: ListOpsAlertsQuery) {
  const where: Prisma.OpsAlertWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.severity) where.severity = query.severity;
  if (query.search?.trim()) {
    const q = query.search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
      { entity_id: { contains: q, mode: "insensitive" } },
      { dedupe_key: { contains: q, mode: "insensitive" } },
    ];
  }

  const skip = (query.page - 1) * query.pageSize;
  const [alerts, totalCount] = await prisma.$transaction([
    prisma.opsAlert.findMany({
      where,
      orderBy: [{ status: "asc" }, { severity: "asc" }, { last_seen_at: "desc" }],
      skip,
      take: query.pageSize,
    }),
    prisma.opsAlert.count({ where }),
  ]);

  return {
    alerts: alerts.map(toDto),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / query.pageSize) || 1,
    },
  };
}

export async function getOpsAlertById(id: string) {
  const row = await prisma.opsAlert.findUnique({ where: { id } });
  if (!row) throw new AppError(404, "OPS_ALERT_NOT_FOUND", "Ops alert not found");
  return toDto(row);
}

export async function acknowledgeOpsAlert(id: string, actorUserId: string) {
  const row = await prisma.opsAlert.findUnique({ where: { id } });
  if (!row) throw new AppError(404, "OPS_ALERT_NOT_FOUND", "Ops alert not found");
  if (row.status !== OpsAlertStatus.OPEN) {
    throw new AppError(409, "OPS_ALERT_INVALID_STATE", "Only OPEN alerts can be acknowledged");
  }
  const updated = await prisma.opsAlert.update({
    where: { id },
    data: {
      status: OpsAlertStatus.ACKNOWLEDGED,
      acknowledged_at: new Date(),
      acknowledged_by_user_id: actorUserId,
      owner_user_id: actorUserId,
    },
  });
  return toDto(updated);
}

export async function resolveOpsAlert(id: string, actorUserId: string, close = false) {
  const row = await prisma.opsAlert.findUnique({ where: { id } });
  if (!row) throw new AppError(404, "OPS_ALERT_NOT_FOUND", "Ops alert not found");
  if (row.status === OpsAlertStatus.CLOSED) {
    throw new AppError(409, "OPS_ALERT_INVALID_STATE", "Alert is already closed");
  }
  if (!close && row.status === OpsAlertStatus.RESOLVED) {
    throw new AppError(409, "OPS_ALERT_INVALID_STATE", "Alert is already resolved");
  }
  const now = new Date();
  const updated = await prisma.opsAlert.update({
    where: { id },
    data: close
      ? {
          status: OpsAlertStatus.CLOSED,
          resolved_at: row.resolved_at ?? now,
          resolved_by_user_id: row.resolved_by_user_id ?? actorUserId,
          closed_at: now,
          closed_by_user_id: actorUserId,
          owner_user_id: row.owner_user_id ?? actorUserId,
        }
      : {
          status: OpsAlertStatus.RESOLVED,
          resolved_at: now,
          resolved_by_user_id: actorUserId,
          owner_user_id: row.owner_user_id ?? actorUserId,
        },
  });
  return toDto(updated);
}

function toDto(row: {
  id: string;
  type: OpsAlertType;
  severity: OpsAlertSeverity;
  status: OpsAlertStatus;
  dedupe_key: string;
  title: string;
  summary: string | null;
  entity_type: string | null;
  entity_id: string | null;
  details: Prisma.JsonValue;
  owner_user_id: string | null;
  occurrence_count: number;
  first_seen_at: Date;
  last_seen_at: Date;
  created_at: Date;
  acknowledged_at: Date | null;
  acknowledged_by_user_id: string | null;
  resolved_at: Date | null;
  resolved_by_user_id: string | null;
  closed_at: Date | null;
  closed_by_user_id: string | null;
}) {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    status: row.status,
    dedupeKey: row.dedupe_key,
    title: row.title,
    summary: row.summary,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: row.details,
    ownerUserId: row.owner_user_id,
    occurrenceCount: row.occurrence_count,
    firstSeenAt: row.first_seen_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    acknowledgedAt: row.acknowledged_at?.toISOString() ?? null,
    acknowledgedByUserId: row.acknowledged_by_user_id,
    resolvedAt: row.resolved_at?.toISOString() ?? null,
    resolvedByUserId: row.resolved_by_user_id,
    closedAt: row.closed_at?.toISOString() ?? null,
    closedByUserId: row.closed_by_user_id,
  };
}
