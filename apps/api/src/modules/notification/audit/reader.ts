import type { NotificationBroadcastAuditLog, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import {
  NOTIFICATION_BROADCAST_AUDIT_EVENTS,
  NOTIFICATION_BROADCAST_CHANNEL_MODE,
  type NotificationBroadcastAuditEventType,
  type NotificationBroadcastChannelMode,
} from "./events";

export type NotificationBroadcastAuditLogDto = {
  id: string;
  eventType: NotificationBroadcastAuditEventType;
  occurredAt: string;
  createdAt: string;
  actor: {
    type: string;
    userId: string | null;
    displayName: string | null;
    email: string | null;
  };
  target: { type: string; id: string };
  audienceType: string;
  notificationTypeId: string;
  notificationTypeName: string;
  portalTargets: Array<"INVESTOR" | "ISSUER">;
  title: string;
  message: string;
  targetedCount: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  channelMode: NotificationBroadcastChannelMode;
  sendToPlatform: boolean | null;
  sendToEmail: boolean | null;
  linkPath: string | null;
  expiresAt: string | null;
  groupId: string | null;
  source: string;
  portal: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
};

export type NotificationBroadcastAuditLogPagination = {
  total: number;
  limit: number;
  offset: number;
  pages: number;
};

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

async function buildWhere(filters: {
  search?: string;
  type?: string;
  target?: string;
}): Promise<Prisma.NotificationBroadcastAuditLogWhereInput> {
  const where: Prisma.NotificationBroadcastAuditLogWhereInput = {};
  const and: Prisma.NotificationBroadcastAuditLogWhereInput[] = [];

  if (filters.type && filters.type !== "all") {
    where.notification_type_id = filters.type;
  }

  if (filters.target && filters.target !== "all") {
    where.audience_type = filters.target;
  }

  if (filters.search) {
    const search = filters.search.trim();
    if (search) {
      const userIds = await actorUserIdsMatchingSearch(search);
      const or: Prisma.NotificationBroadcastAuditLogWhereInput[] = [
        { metadata: { path: ["actorName"], string_contains: search } },
        { metadata: { path: ["actorEmail"], string_contains: search } },
      ];
      if (userIds.length > 0) {
        or.push({ actor_user_id: { in: userIds } });
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

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function portalTargetsOf(value: unknown): Array<"INVESTOR" | "ISSUER"> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is "INVESTOR" | "ISSUER" => item === "INVESTOR" || item === "ISSUER");
}

function channelModeOf(value: unknown): NotificationBroadcastChannelMode {
  if (value === NOTIFICATION_BROADCAST_CHANNEL_MODE.EXPLICIT_OVERRIDE) {
    return NOTIFICATION_BROADCAST_CHANNEL_MODE.EXPLICIT_OVERRIDE;
  }
  return NOTIFICATION_BROADCAST_CHANNEL_MODE.TYPE_AND_USER_PREFERENCES;
}

function eventTypeOf(value: string): NotificationBroadcastAuditEventType {
  if ((NOTIFICATION_BROADCAST_AUDIT_EVENTS as readonly string[]).includes(value)) {
    return value as NotificationBroadcastAuditEventType;
  }
  return value as NotificationBroadcastAuditEventType;
}

function toDto(row: NotificationBroadcastAuditLog): NotificationBroadcastAuditLogDto {
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
    target: {
      type: row.target_type,
      id: row.target_id,
    },
    audienceType: row.audience_type,
    notificationTypeId: row.notification_type_id,
    notificationTypeName:
      stringOrNull(metadata.notificationTypeName) ?? row.notification_type_id,
    portalTargets: portalTargetsOf(metadata.portalTargets),
    title: stringOrNull(metadata.title) ?? "",
    message: stringOrNull(metadata.message) ?? "",
    targetedCount: numberOrZero(metadata.targetedCount),
    createdCount: numberOrZero(metadata.createdCount),
    skippedCount: numberOrZero(metadata.skippedCount),
    failedCount: numberOrZero(metadata.failedCount),
    channelMode: channelModeOf(metadata.channelMode),
    sendToPlatform: booleanOrNull(metadata.sendToPlatform),
    sendToEmail: booleanOrNull(metadata.sendToEmail),
    linkPath: stringOrNull(metadata.linkPath),
    expiresAt: stringOrNull(metadata.expiresAt),
    groupId: stringOrNull(metadata.groupId),
    source: row.source,
    portal: row.portal,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceInfo: formatDeviceInfoFromUserAgent(row.user_agent),
    correlationId: row.correlation_id,
    metadata,
  };
}

export class NotificationBroadcastAuditLogReader {
  async list(filters: {
    limit?: number;
    offset?: number;
    search?: string;
    type?: string;
    target?: string;
  }) {
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    const where = await buildWhere(filters);

    const [rows, total] = await Promise.all([
      prisma.notificationBroadcastAuditLog.findMany({
        where,
        orderBy: { occurred_at: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.notificationBroadcastAuditLog.count({ where }),
    ]);

    return {
      items: rows.map(toDto),
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit) || 0,
      } satisfies NotificationBroadcastAuditLogPagination,
    };
  }
}

export const notificationBroadcastAuditLogReader = new NotificationBroadcastAuditLogReader();
