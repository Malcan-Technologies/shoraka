import {
  GatewayReconExceptionType,
  GatewayReconRunStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { runGatewaySettlementReconJob, getYesterdayMytDateOnly } from "../../lib/jobs/gateway-settlement-recon";
import type { ListReconExceptionsQuery, ListReconRunsQuery } from "./recon-schemas";

export type AdminActorContext = {
  userId: string;
};

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value == null) return null;
  return value.toNumber();
}

function parseRunDateInput(runDate?: string): Date {
  if (!runDate) {
    throw new AppError(400, "INVALID_RUN_DATE", "runDate is required for manual trigger");
  }
  const [year, month, day] = runDate.split("-").map(Number);
  if (!year || !month || !day) {
    throw new AppError(400, "INVALID_RUN_DATE", "runDate must be YYYY-MM-DD");
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function mapReconRun(run: {
  id: string;
  run_date: Date;
  status: GatewayReconRunStatus;
  triggered_by: string;
  settlements_scanned: number;
  payments_matched: number;
  payments_stamped: number;
  exceptions_count: number;
  started_at: Date;
  completed_at: Date | null;
  error: string | null;
  created_at: Date;
}) {
  return {
    id: run.id,
    runDate: run.run_date.toISOString().slice(0, 10),
    status: run.status,
    triggeredBy: run.triggered_by,
    settlementsScanned: run.settlements_scanned,
    paymentsMatched: run.payments_matched,
    paymentsStamped: run.payments_stamped,
    exceptionsCount: run.exceptions_count,
    startedAt: run.started_at.toISOString(),
    completedAt: run.completed_at?.toISOString() ?? null,
    error: run.error,
    createdAt: run.created_at.toISOString(),
  };
}

function mapReconException(row: {
  id: string;
  recon_run_id: string;
  type: GatewayReconExceptionType;
  gateway_payment_id: string | null;
  curlec_payment_id: string | null;
  curlec_settlement_id: string | null;
  expected_amount: Prisma.Decimal | null;
  actual_amount: Prisma.Decimal | null;
  detail: string | null;
  resolved_at: Date | null;
  resolved_by_user_id: string | null;
  resolve_reason: string | null;
  created_at: Date;
}) {
  return {
    id: row.id,
    reconRunId: row.recon_run_id,
    type: row.type,
    gatewayPaymentId: row.gateway_payment_id,
    curlecPaymentId: row.curlec_payment_id,
    curlecSettlementId: row.curlec_settlement_id,
    expectedAmount: decimalToNumber(row.expected_amount),
    actualAmount: decimalToNumber(row.actual_amount),
    detail: row.detail,
    resolvedAt: row.resolved_at?.toISOString() ?? null,
    resolvedByUserId: row.resolved_by_user_id,
    resolveReason: row.resolve_reason,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listReconRuns(
  query: ListReconRunsQuery,
  db: PrismaClient = defaultPrisma
) {
  const skip = (query.page - 1) * query.pageSize;
  const [total, items] = await Promise.all([
    db.gatewayReconRun.count(),
    db.gatewayReconRun.findMany({
      orderBy: { run_date: "desc" },
      skip,
      take: query.pageSize,
    }),
  ]);

  return {
    items: items.map(mapReconRun),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getReconRunDetail(
  runId: string,
  db: PrismaClient = defaultPrisma
) {
  const run = await db.gatewayReconRun.findUnique({
    where: { id: runId },
    include: {
      exceptions: { orderBy: { created_at: "desc" } },
    },
  });

  if (!run) {
    throw new AppError(404, "RECON_RUN_NOT_FOUND", "Reconciliation run not found");
  }

  return {
    ...mapReconRun(run),
    exceptions: run.exceptions.map(mapReconException),
  };
}

export async function listReconExceptions(
  query: ListReconExceptionsQuery,
  db: PrismaClient = defaultPrisma
) {
  const where: Prisma.GatewayReconExceptionWhereInput = {};

  if (query.resolved === true) {
    where.resolved_at = { not: null };
  } else if (query.resolved === false) {
    where.resolved_at = null;
  }

  if (query.runId) where.recon_run_id = query.runId;
  if (query.type) where.type = query.type;

  const skip = (query.page - 1) * query.pageSize;

  const [total, items] = await Promise.all([
    db.gatewayReconException.count({ where }),
    db.gatewayReconException.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: query.pageSize,
    }),
  ]);

  return {
    items: items.map(mapReconException),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getUnresolvedReconExceptionsCount(db: PrismaClient = defaultPrisma) {
  const count = await db.gatewayReconException.count({ where: { resolved_at: null } });
  return { count };
}

export async function triggerReconRun(
  actor: AdminActorContext,
  runDateInput?: string,
  db: PrismaClient = defaultPrisma
) {
  const runDate = runDateInput ? parseRunDateInput(runDateInput) : getYesterdayMytDateOnly();
  const result = await runGatewaySettlementReconJob(
    { runDate, triggeredBy: actor.userId },
    db
  );
  return getReconRunDetail(result.runId, db);
}

export async function resolveReconException(
  actor: AdminActorContext,
  exceptionId: string,
  reason: string,
  db: PrismaClient = defaultPrisma
) {
  const existing = await db.gatewayReconException.findUnique({ where: { id: exceptionId } });
  if (!existing) {
    throw new AppError(404, "RECON_EXCEPTION_NOT_FOUND", "Reconciliation exception not found");
  }

  if (existing.resolved_at) {
    throw new AppError(409, "RECON_EXCEPTION_ALREADY_RESOLVED", "Exception is already resolved");
  }

  const updated = await db.gatewayReconException.update({
    where: { id: exceptionId },
    data: {
      resolved_at: new Date(),
      resolved_by_user_id: actor.userId,
      resolve_reason: reason,
    },
  });

  return mapReconException(updated);
}
