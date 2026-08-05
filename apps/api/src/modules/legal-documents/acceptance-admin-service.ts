import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  type LegalAcceptanceAudience,
  type LegalAcceptanceStatus,
  type LegalDocumentAcceptanceDetail,
  type LegalDocumentAcceptanceListItem,
  type LegalDocumentType,
  type LegalDocumentVersionStatus,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { generatePresignedDownloadUrl } from "../../lib/s3/client";
import type {
  ExportLegalAcceptancesQuery,
  ListLegalAcceptancesQuery,
} from "./schemas";

type AcceptanceWithRelations = {
  id: string;
  legal_document_version_id: string;
  legal_document_id: string | null;
  document_type: LegalDocumentType | null;
  version_number: number | null;
  user_id: string;
  organization_id: string | null;
  audience_role: LegalAcceptanceAudience;
  status: LegalAcceptanceStatus;
  opened_at: Date | null;
  accepted_at: Date | null;
  document_hash: string | null;
  acknowledgement_text: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  user_email_snapshot: string | null;
  user_name_snapshot: string | null;
  created_at: Date;
  user: {
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  version: {
    id: string;
    version: number;
    status: LegalDocumentVersionStatus;
    file_name: string;
    content_type: string;
    file_size: number;
    file_hash: string | null;
    s3_key: string;
    legal_document: {
      id: string;
      type: LegalDocumentType;
      title: string;
    };
  };
};

function displayName(first: string, last: string): string {
  return [first, last].filter(Boolean).join(" ").trim();
}

function buildOrgNameMap(
  issuerOrgs: Array<{ id: string; name: string | null }>,
  investorOrgs: Array<{ id: string; name: string | null }>
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const org of issuerOrgs) map.set(org.id, org.name);
  for (const org of investorOrgs) map.set(org.id, org.name);
  return map;
}

function toListItem(
  row: AcceptanceWithRelations,
  orgNames: Map<string, string | null>
): LegalDocumentAcceptanceListItem {
  const type =
    row.document_type ??
    (row.version.legal_document.type as LegalDocumentType) ??
    null;
  const userName =
    row.user_name_snapshot ||
    displayName(row.user.first_name, row.user.last_name) ||
    null;
  const userEmail = row.user_email_snapshot || row.user.email || null;

  return {
    id: row.id,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    openedAt: row.opened_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    status: row.status,
    documentType: type,
    documentTitle: type
      ? LEGAL_DOCUMENT_TYPE_LABELS[type]
      : row.version.legal_document.title,
    versionNumber: row.version_number ?? row.version.version,
    legalDocumentVersionId: row.legal_document_version_id,
    legalDocumentId: row.legal_document_id ?? row.version.legal_document.id,
    fileName: row.version.file_name,
    documentHash: row.document_hash ?? row.version.file_hash,
    organizationId: row.organization_id,
    organizationName: row.organization_id
      ? orgNames.get(row.organization_id) ?? null
      : null,
    organizationType: row.audience_role,
    userId: row.user_id,
    userName,
    userEmail,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceInfo: row.device_info,
    acknowledgementText: row.acknowledgement_text,
  };
}

function toDetail(
  row: AcceptanceWithRelations,
  orgNames: Map<string, string | null>
): LegalDocumentAcceptanceDetail {
  return {
    ...toListItem(row, orgNames),
    versionStatus: row.version.status,
    contentType: row.version.content_type,
    fileSize: row.version.file_size,
  };
}

function buildWhere(query: ListLegalAcceptancesQuery | ExportLegalAcceptancesQuery) {
  const where: Record<string, unknown> = {};

  if (query.documentType) where.document_type = query.documentType;
  if (query.audience) where.audience_role = query.audience;
  if (query.organizationId) where.organization_id = query.organizationId;
  if (query.status) where.status = query.status;
  if (query.versionNumber) where.version_number = query.versionNumber;

  if (query.dateFrom || query.dateTo) {
    where.accepted_at = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
  }

  if (query.userEmail) {
    where.OR = [
      { user_email_snapshot: { contains: query.userEmail, mode: "insensitive" } },
      { user: { email: { contains: query.userEmail, mode: "insensitive" } } },
    ];
  }

  if (query.search) {
    const search = query.search.trim();
    const searchOr = [
      { id: { contains: search, mode: "insensitive" } },
      { user_email_snapshot: { contains: search, mode: "insensitive" } },
      { user_name_snapshot: { contains: search, mode: "insensitive" } },
      { organization_id: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { first_name: { contains: search, mode: "insensitive" } } },
      { user: { last_name: { contains: search, mode: "insensitive" } } },
    ];
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchOr }];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  return where;
}

async function resolveOrgNames(
  rows: Array<{ organization_id: string | null; audience_role: LegalAcceptanceAudience }>
): Promise<Map<string, string | null>> {
  const issuerIds = [
    ...new Set(
      rows
        .filter((r) => r.organization_id && r.audience_role === "ISSUER")
        .map((r) => r.organization_id as string)
    ),
  ];
  const investorIds = [
    ...new Set(
      rows
        .filter((r) => r.organization_id && r.audience_role === "INVESTOR")
        .map((r) => r.organization_id as string)
    ),
  ];

  const [issuerOrgs, investorOrgs] = await Promise.all([
    issuerIds.length
      ? prisma.issuerOrganization.findMany({
          where: { id: { in: issuerIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    investorIds.length
      ? prisma.investorOrganization.findMany({
          where: { id: { in: investorIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  return buildOrgNameMap(issuerOrgs, investorOrgs);
}

const includeRelations = {
  user: {
    select: {
      user_id: true,
      email: true,
      first_name: true,
      last_name: true,
    },
  },
  version: {
    include: {
      legal_document: {
        select: { id: true, type: true, title: true },
      },
    },
  },
} as const;

export class LegalDocumentAcceptanceAdminService {
  async listAcceptances(query: ListLegalAcceptancesQuery) {
    const where = buildWhere(query);
    const skip = (query.page - 1) * query.pageSize;
    const sortField = query.sortBy === "created_at" ? "created_at" : "accepted_at";
    const sortOrder = query.sortOrder ?? "desc";

    const [rows, total] = await Promise.all([
      prisma.legalDocumentAcceptance.findMany({
        where: where as never,
        skip,
        take: query.pageSize,
        orderBy: [{ [sortField]: sortOrder }, { created_at: "desc" }],
        include: includeRelations,
      }),
      prisma.legalDocumentAcceptance.count({ where: where as never }),
    ]);

    const typedRows = rows as unknown as AcceptanceWithRelations[];
    const orgNames = await resolveOrgNames(typedRows);

    return {
      acceptances: typedRows.map((row) => toListItem(row, orgNames)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / query.pageSize) || 1,
      },
    };
  }

  async getAcceptanceById(id: string): Promise<LegalDocumentAcceptanceDetail> {
    const row = (await prisma.legalDocumentAcceptance.findUnique({
      where: { id },
      include: includeRelations,
    })) as unknown as AcceptanceWithRelations | null;

    if (!row) {
      throw new AppError(404, "NOT_FOUND", "Legal document acceptance not found");
    }

    const orgNames = await resolveOrgNames([row]);
    return toDetail(row, orgNames);
  }

  async exportAcceptances(query: ExportLegalAcceptancesQuery) {
    const where = buildWhere(query);
    const sortField = query.sortBy === "created_at" ? "created_at" : "accepted_at";
    const sortOrder = query.sortOrder ?? "desc";

    const rows = (await prisma.legalDocumentAcceptance.findMany({
      where: where as never,
      orderBy: [{ [sortField]: sortOrder }, { created_at: "desc" }],
      take: 10_000,
      include: includeRelations,
    })) as unknown as AcceptanceWithRelations[];

    const orgNames = await resolveOrgNames(rows);
    return rows.map((row) => toDetail(row, orgNames));
  }

  /** Signed URL for the exact accepted version PDF (including archived). */
  async getAcceptedVersionDownloadUrl(acceptanceId: string) {
    const row = await prisma.legalDocumentAcceptance.findUnique({
      where: { id: acceptanceId },
      include: {
        version: {
          select: {
            s3_key: true,
            file_name: true,
            content_type: true,
            file_size: true,
          },
        },
      },
    });

    if (!row) {
      throw new AppError(404, "NOT_FOUND", "Legal document acceptance not found");
    }

    const { downloadUrl, expiresIn } = await generatePresignedDownloadUrl({
      key: row.version.s3_key,
      fileName: row.version.file_name,
    });

    return {
      downloadUrl,
      expiresIn,
      fileName: row.version.file_name,
      contentType: row.version.content_type,
      fileSize: row.version.file_size,
    };
  }
}

export const legalDocumentAcceptanceAdminService =
  new LegalDocumentAcceptanceAdminService();
