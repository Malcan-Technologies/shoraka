import type { LegalDocumentType } from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import type { ListLegalDocumentAuditLogsQuery } from "./schemas";
import { matchingLegalDocumentTypes } from "./search-match";

function buildWhere(query: ListLegalDocumentAuditLogsQuery) {
  const where: Record<string, unknown> = {};

  if (query.action) where.action = query.action;
  if (query.documentType) where.document_type = query.documentType;
  if (query.legalDocumentId) where.legal_document_id = query.legalDocumentId;
  if (query.actorUserId) where.actor_user_id = query.actorUserId;

  if (query.dateFrom || query.dateTo) {
    where.created_at = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
  }

  if (query.search) {
    const search = query.search.trim();
    const matchingTypes = matchingLegalDocumentTypes(search);
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { actor_email_snapshot: { contains: search, mode: "insensitive" } },
      { actor_name_snapshot: { contains: search, mode: "insensitive" } },
      { legal_document_id: { contains: search, mode: "insensitive" } },
      { legal_document_version_id: { contains: search, mode: "insensitive" } },
      ...(matchingTypes.length > 0 ? [{ document_type: { in: matchingTypes } }] : []),
    ];
  }

  return where;
}

function toAuditLogItem(row: {
  id: string;
  action: string;
  legal_document_id: string | null;
  legal_document_version_id: string | null;
  document_type: LegalDocumentType | null;
  version_number: number | null;
  document_hash: string | null;
  actor_user_id: string | null;
  actor_name_snapshot: string | null;
  actor_email_snapshot: string | null;
  before_json: unknown;
  after_json: unknown;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string | null;
  created_at: Date;
}) {
  return {
    id: row.id,
    action: row.action,
    legalDocumentId: row.legal_document_id,
    legalDocumentVersionId: row.legal_document_version_id,
    documentType: row.document_type,
    versionNumber: row.version_number,
    documentHash: row.document_hash,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name_snapshot,
    actorEmail: row.actor_email_snapshot,
    beforeJson: row.before_json as Record<string, unknown> | null,
    afterJson: row.after_json as Record<string, unknown> | null,
    reason: row.reason,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    correlationId: row.correlation_id,
    createdAt: row.created_at.toISOString(),
  };
}

export class LegalDocumentAuditAdminService {
  async list(query: ListLegalDocumentAuditLogsQuery) {
    const where = buildWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await Promise.all([
      prisma.legalDocumentAuditLog.findMany({
        where: where as never,
        skip,
        take: query.pageSize,
        orderBy: [{ created_at: "desc" }],
      }),
      prisma.legalDocumentAuditLog.count({ where: where as never }),
    ]);

    return {
      logs: rows.map(toAuditLogItem),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / query.pageSize) || 1,
      },
    };
  }

  async export(query: Omit<ListLegalDocumentAuditLogsQuery, "page" | "pageSize">) {
    const where = buildWhere({ ...query, page: 1, pageSize: 20 });
    const rows = await prisma.legalDocumentAuditLog.findMany({
      where: where as never,
      orderBy: [{ created_at: "desc" }],
      take: 10_000,
    });
    return rows.map(toAuditLogItem);
  }
}

export const legalDocumentAuditAdminService = new LegalDocumentAuditAdminService();
