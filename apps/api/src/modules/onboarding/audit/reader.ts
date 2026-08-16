import type { OnboardingAuditLog, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import type { GetOnboardingLogsQuery } from "../../admin/schemas";
import {
  ONBOARDING_AUDIT_EVENTS,
  isOnboardingAuditEventType,
  type OnboardingAuditEventType,
} from "./events";

export type OnboardingAuditActorDto = {
  type: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
};

export type OnboardingAuditLogDto = {
  id: string;
  eventType: OnboardingAuditEventType;
  occurredAt: string;
  createdAt: string;
  subjectUserId: string | null;
  userId: string | null;
  actor: OnboardingAuditActorDto;
  organizationId: string | null;
  organizationKind: string | null;
  organizationType: string | null;
  onboardingId: string | null;
  target: { type: string; id: string };
  source: string;
  portal: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
};

function dateRangeStart(dateRange: GetOnboardingLogsQuery["dateRange"]): Date | null {
  if (!dateRange || dateRange === "all") return null;
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

async function buildWhere(params: GetOnboardingLogsQuery): Promise<Prisma.OnboardingAuditLogWhereInput> {
  const where: Prisma.OnboardingAuditLogWhereInput = {};
  const and: Prisma.OnboardingAuditLogWhereInput[] = [];

  if (params.eventTypes && params.eventTypes.length > 0) {
    where.event_type = { in: params.eventTypes };
  } else if (params.eventType) {
    where.event_type = params.eventType;
  } else {
    where.event_type = { in: [...ONBOARDING_AUDIT_EVENTS] };
  }

  if (params.userId) {
    where.subject_user_id = params.userId;
  }

  if (params.organizationId) {
    where.organization_id = params.organizationId;
  }

  if (params.role) {
    const kind = params.role === "ISSUER" ? "ISSUER" : "INVESTOR";
    where.OR = [{ organization_kind: kind }, { portal: kind }];
  }

  const startDate = dateRangeStart(params.dateRange);
  if (startDate) {
    where.occurred_at = { gte: startDate };
  }

  if (params.search) {
    const search = params.search.trim();
    if (search) {
      const userIds = await userIdsMatchingSearch(search);
      const or: Prisma.OnboardingAuditLogWhereInput[] = [
        { metadata: { path: ["actorName"], string_contains: search } },
        { metadata: { path: ["actorEmail"], string_contains: search } },
        { event_type: { contains: search, mode: "insensitive" } },
        { subject_user_id: { contains: search, mode: "insensitive" } },
      ];
      if (userIds.length > 0) {
        or.push({ subject_user_id: { in: userIds } }, { actor_user_id: { in: userIds } });
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

function eventTypeOf(value: string): OnboardingAuditEventType {
  return isOnboardingAuditEventType(value) ? value : (value as OnboardingAuditEventType);
}

function toDto(row: OnboardingAuditLog): OnboardingAuditLogDto {
  const metadata = metadataRecord(row.metadata);
  return {
    id: row.id,
    eventType: eventTypeOf(row.event_type),
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    subjectUserId: row.subject_user_id,
    userId: row.subject_user_id,
    actor: {
      type: row.actor_type,
      userId: row.actor_user_id,
      displayName: stringOrNull(metadata.actorName),
      email: stringOrNull(metadata.actorEmail),
    },
    organizationId: row.organization_id,
    organizationKind: row.organization_kind,
    organizationType: row.organization_type,
    onboardingId: row.onboarding_id,
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

export class OnboardingAuditLogReader {
  async findAll(params: GetOnboardingLogsQuery): Promise<{ logs: OnboardingAuditLogDto[]; total: number }> {
    const skip = (params.page - 1) * params.pageSize;
    const where = await buildWhere(params);

    const [rows, total] = await Promise.all([
      prisma.onboardingAuditLog.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
      }),
      prisma.onboardingAuditLog.count({ where }),
    ]);

    return { logs: rows.map(toDto), total };
  }

  async findById(id: string): Promise<OnboardingAuditLogDto | null> {
    const row = await prisma.onboardingAuditLog.findUnique({ where: { id } });
    return row ? toDto(row) : null;
  }

  async findAllForExport(
    params: Omit<GetOnboardingLogsQuery, "page" | "pageSize">
  ): Promise<OnboardingAuditLogDto[]> {
    const where = await buildWhere({ ...params, page: 1, pageSize: 100 });
    const rows = await prisma.onboardingAuditLog.findMany({
      where,
      orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
      take: 10_000,
    });
    return rows.map(toDto);
  }
}

export const onboardingAuditLogReader = new OnboardingAuditLogReader();
