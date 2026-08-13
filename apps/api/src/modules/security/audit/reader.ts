import type { Prisma, SecurityAuditLog } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import type { GetSecurityLogsQuery } from "../../admin/schemas";
import { SECURITY_AUDIT_EVENTS, type SecurityAuditEventType } from "./events";

export type SecurityAuditActorDto = {
  type: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
};

export type SecurityAuditLogDto = {
  id: string;
  eventType: SecurityAuditEventType;
  occurredAt: string;
  createdAt: string;
  subjectUserId: string | null;
  actor: SecurityAuditActorDto;
  target: { type: string; id: string };
  organizationId: string | null;
  organizationKind: string | null;
  source: string;
  portal: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
};

function dateRangeStart(dateRange: GetSecurityLogsQuery["dateRange"]): Date | null {
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

async function buildWhere(params: GetSecurityLogsQuery): Promise<Prisma.SecurityAuditLogWhereInput> {
  const where: Prisma.SecurityAuditLogWhereInput = {};
  const and: Prisma.SecurityAuditLogWhereInput[] = [];

  if (params.eventTypes && params.eventTypes.length > 0) {
    where.event_type = { in: params.eventTypes };
  } else if (params.eventType) {
    where.event_type = params.eventType;
  }

  if (params.userId) {
    where.OR = [{ subject_user_id: params.userId }, { actor_user_id: params.userId }];
  }

  const startDate = dateRangeStart(params.dateRange);
  if (startDate) {
    where.occurred_at = { gte: startDate };
  }

  if (params.search) {
    const search = params.search.trim();
    if (search) {
      const userIds = await userIdsMatchingSearch(search);
      const or: Prisma.SecurityAuditLogWhereInput[] = [
        { metadata: { path: ["actorName"], string_contains: search } },
        { metadata: { path: ["actorEmail"], string_contains: search } },
        { metadata: { path: ["email"], string_contains: search } },
        { event_type: { contains: search.toUpperCase().replace(/\s+/g, "_"), mode: "insensitive" } },
      ];
      if (userIds.length > 0) {
        or.push({ actor_user_id: { in: userIds } }, { subject_user_id: { in: userIds } });
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

function toDto(row: SecurityAuditLog): SecurityAuditLogDto {
  const metadata = metadataRecord(row.metadata);
  return {
    id: row.id,
    eventType: row.event_type as SecurityAuditEventType,
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    subjectUserId: row.subject_user_id,
    actor: {
      type: row.actor_type,
      userId: row.actor_user_id,
      displayName: stringOrNull(metadata.actorName),
      email: stringOrNull(metadata.actorEmail),
    },
    target: { type: row.target_type, id: row.target_id },
    organizationId: row.organization_id,
    organizationKind: row.organization_kind,
    source: row.source,
    portal: row.portal,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceInfo: formatDeviceInfoFromUserAgent(row.user_agent),
    correlationId: row.correlation_id,
    metadata,
  };
}

export class SecurityAuditLogReader {
  async findAll(params: GetSecurityLogsQuery): Promise<{ logs: SecurityAuditLogDto[]; total: number }> {
    const skip = (params.page - 1) * params.pageSize;
    const where = await buildWhere(params);

    const [rows, total] = await Promise.all([
      prisma.securityAuditLog.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy: { occurred_at: "desc" },
      }),
      prisma.securityAuditLog.count({ where }),
    ]);

    return { logs: rows.map(toDto), total };
  }

  async findAllForExport(
    params: Omit<GetSecurityLogsQuery, "page" | "pageSize">
  ): Promise<SecurityAuditLogDto[]> {
    const where = await buildWhere({ ...params, page: 1, pageSize: 100 });
    const rows = await prisma.securityAuditLog.findMany({
      where,
      orderBy: { occurred_at: "desc" },
      take: 10_000,
    });
    return rows.map(toDto);
  }
}

export const securityAuditLogReader = new SecurityAuditLogReader();

export { SECURITY_AUDIT_EVENTS };
