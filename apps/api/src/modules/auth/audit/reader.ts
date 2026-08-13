import type { AccessAuditLog, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import type { GetAccessLogsQuery } from "../../admin/schemas";
import {
  ACCESS_AUDIT_EVENTS,
  type AccessAuditEventType,
} from "./events";

export type AccessAuditActorDto = {
  type: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
};

export type AccessAuditLogDto = {
  id: string;
  eventType: AccessAuditEventType;
  occurredAt: string;
  createdAt: string;
  userId: string | null;
  actor: AccessAuditActorDto;
  target: { type: string; id: string };
  source: string;
  portal: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
};

function dateRangeStart(dateRange: GetAccessLogsQuery["dateRange"]): Date | null {
  if (dateRange === "all") return null;
  const now = Date.now();
  if (dateRange === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (dateRange === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  return new Date(now - 30 * 24 * 60 * 60 * 1000);
}

async function userIdsMatchingSearch(search: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: search, mode: "insensitive" } },
        { first_name: { contains: search, mode: "insensitive" } },
        { last_name: { contains: search, mode: "insensitive" } },
        { user_id: { startsWith: search.toUpperCase(), mode: "insensitive" } },
      ],
    },
    select: { user_id: true },
  });
  return users.map((user) => user.user_id);
}

async function buildWhere(params: GetAccessLogsQuery): Promise<Prisma.AccessAuditLogWhereInput> {
  const where: Prisma.AccessAuditLogWhereInput = {};
  const and: Prisma.AccessAuditLogWhereInput[] = [];

  if (params.eventTypes && params.eventTypes.length > 0) {
    where.event_type = { in: params.eventTypes };
  } else if (params.eventType) {
    where.event_type = params.eventType;
  } else {
    where.event_type = { in: [...ACCESS_AUDIT_EVENTS] };
  }

  if (params.userId) {
    where.user_id = params.userId;
  }

  const startDate = dateRangeStart(params.dateRange);
  if (startDate) {
    where.occurred_at = { gte: startDate };
  }

  // Access events are completed successes only. Preserve the query param:
  // "failed" matches nothing; "success" does not add a filter.
  if (params.status === "failed") {
    and.push({ id: "__none__" });
  }

  if (params.search) {
    const search = params.search.trim();
    if (search) {
      const userIds = await userIdsMatchingSearch(search);
      const or: Prisma.AccessAuditLogWhereInput[] = [
        { metadata: { path: ["actorName"], string_contains: search } },
        { metadata: { path: ["actorEmail"], string_contains: search } },
        { user_id: { contains: search, mode: "insensitive" } },
      ];
      if (userIds.length > 0) {
        or.push({ user_id: { in: userIds } }, { actor_user_id: { in: userIds } });
      }
      and.push({ OR: or });
    }
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function eventTypeOf(value: string): AccessAuditEventType {
  return value as AccessAuditEventType;
}

function toDto(row: AccessAuditLog): AccessAuditLogDto {
  const metadata = metadataRecord(row.metadata);
  return {
    id: row.id,
    eventType: eventTypeOf(row.event_type),
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    userId: row.user_id,
    actor: {
      type: row.actor_type,
      userId: row.actor_user_id,
      displayName: stringOrNull(metadata.actorName),
      email: stringOrNull(metadata.actorEmail),
    },
    target: { type: row.target_type, id: row.target_id },
    source: row.source,
    portal: row.portal,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceInfo: formatDeviceInfoFromUserAgent(row.user_agent),
    correlationId: row.correlation_id,
    metadata,
  };
}

export class AccessAuditLogReader {
  async findAll(params: GetAccessLogsQuery): Promise<{ logs: AccessAuditLogDto[]; total: number }> {
    const skip = (params.page - 1) * params.pageSize;
    const where = await buildWhere(params);

    const [rows, total] = await Promise.all([
      prisma.accessAuditLog.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy: { occurred_at: "desc" },
      }),
      prisma.accessAuditLog.count({ where }),
    ]);

    return { logs: rows.map(toDto), total };
  }

  async findById(id: string): Promise<AccessAuditLogDto | null> {
    const row = await prisma.accessAuditLog.findUnique({ where: { id } });
    return row ? toDto(row) : null;
  }

  async findAllForExport(
    params: Omit<GetAccessLogsQuery, "page" | "pageSize">
  ): Promise<AccessAuditLogDto[]> {
    const where = await buildWhere({ ...params, page: 1, pageSize: 100 });
    const rows = await prisma.accessAuditLog.findMany({
      where,
      orderBy: { occurred_at: "desc" },
      take: 10_000,
    });
    return rows.map(toDto);
  }

  async findRecentLogins(userId: string, limit = 3): Promise<AccessAuditLogDto[]> {
    const rows = await prisma.accessAuditLog.findMany({
      where: {
        user_id: userId,
        event_type: "USER_LOGGED_IN",
      },
      orderBy: { occurred_at: "desc" },
      take: limit,
    });
    return rows.map(toDto);
  }

  async countForUser(userId: string): Promise<number> {
    return prisma.accessAuditLog.count({ where: { user_id: userId } });
  }
}

export const accessAuditLogReader = new AccessAuditLogReader();
