import type { LegalAdminAuditLog, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import type { ListLegalDocumentAuditLogsQuery } from "../schemas";
import { LEGAL_ADMIN_AUDIT_EVENTS, type LegalAdminAuditEventType } from "./events";

export type LegalAdminAuditActorDto = {
  type: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
};

export type LegalAdminAuditLogDto = {
  id: string;
  eventType: LegalAdminAuditEventType;
  occurredAt: string;
  createdAt: string;
  actor: LegalAdminAuditActorDto;
  target: { type: string; id: string };
  legalDocumentId: string;
  legalDocumentVersionId: string | null;
  source: string;
  portal: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
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

async function buildWhere(
  query: Omit<ListLegalDocumentAuditLogsQuery, "page" | "pageSize">
): Promise<Prisma.LegalAdminAuditLogWhereInput> {
  const where: Prisma.LegalAdminAuditLogWhereInput = {};
  const and: Prisma.LegalAdminAuditLogWhereInput[] = [];

  const eventType = query.action;
  if (eventType) {
    where.event_type = eventType;
  }

  if (query.legalDocumentId) {
    where.legal_document_id = query.legalDocumentId;
  }

  if (query.actorUserId) {
    where.actor_user_id = query.actorUserId;
  }

  if (query.dateFrom || query.dateTo) {
    where.occurred_at = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
  }

  if (query.documentType) {
    and.push({
      metadata: {
        path: ["documentType"],
        equals: query.documentType,
      },
    });
  }

  if (query.search) {
    const search = query.search.trim();
    const userIds = await actorUserIdsMatchingSearch(search);
    const or: Prisma.LegalAdminAuditLogWhereInput[] = [
      { event_type: { contains: search, mode: "insensitive" } },
      { legal_document_id: { contains: search, mode: "insensitive" } },
      { legal_document_version_id: { contains: search, mode: "insensitive" } },
      { metadata: { path: ["actorName"], string_contains: search } },
      { metadata: { path: ["actorEmail"], string_contains: search } },
    ];
    if (userIds.length > 0) {
      or.push({ actor_user_id: { in: userIds } });
    }
    and.push({ OR: or });
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

function toDto(row: LegalAdminAuditLog): LegalAdminAuditLogDto {
  const metadata = metadataRecord(row.metadata);
  const eventType = (LEGAL_ADMIN_AUDIT_EVENTS as readonly string[]).includes(row.event_type)
    ? (row.event_type as LegalAdminAuditEventType)
    : (row.event_type as LegalAdminAuditEventType);

  return {
    id: row.id,
    eventType,
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    actor: {
      type: row.actor_type,
      userId: row.actor_user_id,
      displayName: typeof metadata.actorName === "string" ? metadata.actorName : null,
      email: typeof metadata.actorEmail === "string" ? metadata.actorEmail : null,
    },
    target: {
      type: row.target_type,
      id: row.target_id,
    },
    legalDocumentId: row.legal_document_id,
    legalDocumentVersionId: row.legal_document_version_id,
    source: row.source,
    portal: row.portal,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    correlationId: row.correlation_id,
    metadata,
  };
}

export class LegalAdminAuditLogReader {
  async list(query: ListLegalDocumentAuditLogsQuery) {
    const where = await buildWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await Promise.all([
      prisma.legalAdminAuditLog.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ occurred_at: "desc" }],
      }),
      prisma.legalAdminAuditLog.count({ where }),
    ]);

    return {
      logs: rows.map(toDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / query.pageSize) || 1,
      },
    };
  }

  async export(query: Omit<ListLegalDocumentAuditLogsQuery, "page" | "pageSize">) {
    const where = await buildWhere(query);
    const rows = await prisma.legalAdminAuditLog.findMany({
      where,
      orderBy: [{ occurred_at: "desc" }],
      take: 10_000,
    });
    return rows.map(toDto);
  }
}

export const legalAdminAuditLogReader = new LegalAdminAuditLogReader();
