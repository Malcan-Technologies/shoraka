import type { ProductAuditLog } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import type { GetProductLogsQuery, DateRangeValue } from "../schemas";
import type { ProductEventType } from "../schemas";
import { PRODUCT_AUDIT_TARGET_TYPE, type ProductAuditEventType } from "./events";

export type ProductAuditActorDto = {
  type: string;
  userId: string | null;
  displayName?: string | null;
  email?: string | null;
};

export type ProductAuditLogDto = {
  id: string;
  eventType: ProductAuditEventType;
  occurredAt: string;
  createdAt: string;
  actor: ProductAuditActorDto;
  target: { type: "PRODUCT"; id: string };
  productId: string;
  source: string;
  portal: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
};

type ActorUser = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
};

function dateRangeStart(dateRange: DateRangeValue): Date | null {
  if (dateRange === "all") return null;
  const now = Date.now();
  if (dateRange === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (dateRange === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  return new Date(now - 30 * 24 * 60 * 60 * 1000);
}

async function actorUserIdsMatchingSearch(search: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: search, mode: "insensitive" } },
        { first_name: { contains: search, mode: "insensitive" } },
        { last_name: { contains: search, mode: "insensitive" } },
      ],
    },
    select: { user_id: true },
  });
  return users.map((user) => user.user_id);
}

async function buildWhere(params: {
  search?: string;
  eventType?: ProductEventType;
  eventTypes?: ProductEventType[];
  dateRange: DateRangeValue;
}): Promise<Record<string, unknown> | null> {
  const where: Record<string, unknown> = {};

  if (params.eventType) {
    where.event_type = params.eventType;
  } else if (params.eventTypes && params.eventTypes.length > 0) {
    where.event_type = { in: params.eventTypes };
  }

  const startDate = dateRangeStart(params.dateRange);
  if (startDate) {
    where.occurred_at = { gte: startDate };
  }

  if (params.search) {
    const userIds = await actorUserIdsMatchingSearch(params.search);
    if (userIds.length === 0) return null;
    where.actor_user_id = { in: userIds };
  }

  return where;
}

async function loadActorsById(userIds: Array<string | null>): Promise<Map<string, ActorUser>> {
  const uniqueIds = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { user_id: { in: uniqueIds } },
    select: { user_id: true, first_name: true, last_name: true, email: true },
  });

  return new Map(users.map((user) => [user.user_id, user]));
}

function toDto(row: ProductAuditLog, actors: Map<string, ActorUser>): ProductAuditLogDto {
  const actorUser = row.actor_user_id ? actors.get(row.actor_user_id) : undefined;
  const displayName = actorUser
    ? `${actorUser.first_name} ${actorUser.last_name}`.trim()
    : null;

  return {
    id: row.id,
    eventType: row.event_type as ProductAuditEventType,
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    actor: {
      type: row.actor_type,
      userId: row.actor_user_id,
      displayName,
      email: actorUser?.email ?? null,
    },
    target: {
      type: PRODUCT_AUDIT_TARGET_TYPE,
      id: row.target_id,
    },
    productId: row.product_id,
    source: row.source,
    portal: row.portal,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceInfo: formatDeviceInfoFromUserAgent(row.user_agent),
    correlationId: row.correlation_id,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

async function mapRows(rows: ProductAuditLog[]): Promise<ProductAuditLogDto[]> {
  const actors = await loadActorsById(rows.map((row) => row.actor_user_id));
  return rows.map((row) => toDto(row, actors));
}

export class ProductAuditLogReader {
  async findAll(params: GetProductLogsQuery): Promise<{ logs: ProductAuditLogDto[]; total: number }> {
    const where = await buildWhere(params);
    if (where === null) {
      return { logs: [], total: 0 };
    }

    const skip = (params.page - 1) * params.pageSize;
    const [rows, total] = await Promise.all([
      prisma.productAuditLog.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy: { occurred_at: "desc" },
      }),
      prisma.productAuditLog.count({ where }),
    ]);

    return { logs: await mapRows(rows), total };
  }

  async findForExport(params: {
    search?: string;
    eventType?: ProductEventType;
    eventTypes?: ProductEventType[];
    dateRange: DateRangeValue;
  }): Promise<ProductAuditLogDto[]> {
    const where = await buildWhere(params);
    if (where === null) return [];

    const rows = await prisma.productAuditLog.findMany({
      where,
      orderBy: { occurred_at: "desc" },
      take: 10000,
    });

    return mapRows(rows);
  }
}

export const productAuditLogReader = new ProductAuditLogReader();
