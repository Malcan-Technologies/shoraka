import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  type LegalDocumentType,
  type LegalDocumentVersionStatus,
  type LegalExternalAcceptanceSource,
  type LegalExternalAcceptanceStatus,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import type {
  ExportLegalExternalAcceptancesQuery,
  ListLegalExternalAcceptancesQuery,
} from "./external-acceptance-admin-schemas";

function maskIc(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `••••${digits.slice(-4)}`;
}

type ExternalAcceptanceVersion = {
  file_name: string;
  file_hash: string | null;
  version: number;
  status?: LegalDocumentVersionStatus;
  content_type?: string;
  file_size?: number;
  legal_document: { id: string; type: string; title: string };
};

type ExternalAcceptanceRow = {
  id: string;
  legal_document_version_id: string;
  legal_document_id: string | null;
  document_type: string | null;
  version_number: number | null;
  document_hash: string | null;
  party_name: string;
  party_email: string;
  party_ic_number: string | null;
  party_role: string | null;
  source_type: string;
  source_id: string;
  status: LegalExternalAcceptanceStatus;
  opened_at: Date | null;
  opened_ip_address?: string | null;
  opened_user_agent?: string | null;
  opened_device_info?: string | null;
  accepted_at: Date | null;
  accepted_ip_address?: string | null;
  accepted_user_agent?: string | null;
  accepted_device_info?: string | null;
  acknowledgement_text?: string | null;
  created_at: Date;
  envelope_id: string | null;
  application_id: string | null;
  organization_id: string | null;
  version: ExternalAcceptanceVersion;
};

const listVersionInclude = {
  select: {
    file_name: true,
    file_hash: true,
    version: true,
    legal_document: { select: { id: true, type: true, title: true } },
  },
} as const;

const detailVersionInclude = {
  select: {
    file_name: true,
    file_hash: true,
    version: true,
    status: true,
    content_type: true,
    file_size: true,
    legal_document: { select: { id: true, type: true, title: true } },
  },
} as const;

type ExternalAcceptanceFilters = Pick<
  ListLegalExternalAcceptancesQuery,
  | "documentType"
  | "status"
  | "applicationId"
  | "envelopeId"
  | "organizationId"
  | "dateFrom"
  | "dateTo"
  | "search"
>;

function sortOrderBy(query: { sortBy: "accepted_at" | "created_at"; sortOrder: "asc" | "desc" }) {
  return query.sortBy === "created_at"
    ? { created_at: query.sortOrder }
    : { accepted_at: query.sortOrder };
}

export async function listLegalExternalAcceptances(query: ListLegalExternalAcceptancesQuery) {
  const where = buildWhere(query);
  const skip = (query.page - 1) * query.pageSize;
  const orderBy = sortOrderBy(query);

  const [rows, totalCount] = await prisma.$transaction([
    prisma.legalExternalAcceptance.findMany({
      where,
      orderBy,
      skip,
      take: query.pageSize,
      include: {
        version: listVersionInclude,
      },
    }),
    prisma.legalExternalAcceptance.count({ where }),
  ]);

  const orgNames = await resolveOrgNames(rows);

  return {
    acceptances: rows.map((row) => toListItem(row, orgNames)),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / query.pageSize) || 1,
    },
  };
}

export async function getLegalExternalAcceptanceById(id: string) {
  const row = await prisma.legalExternalAcceptance.findUnique({
    where: { id },
    include: {
      version: detailVersionInclude,
    },
  });
  if (!row) {
    throw new AppError(404, "LEGAL_EXTERNAL_ACCEPTANCE_NOT_FOUND", "External acceptance not found");
  }
  const orgNames = await resolveOrgNames([row]);
  return toDetail(row, orgNames);
}

export async function exportLegalExternalAcceptances(query: ExportLegalExternalAcceptancesQuery) {
  const where = buildWhere(query);
  const orderBy = sortOrderBy(query);

  const rows = await prisma.legalExternalAcceptance.findMany({
    where,
    orderBy,
    take: 10_000,
    include: {
      version: detailVersionInclude,
    },
  });

  const orgNames = await resolveOrgNames(rows);
  return rows.map((row) => toDetail(row, orgNames));
}

async function resolveOrgNames(rows: Array<{ organization_id: string | null }>) {
  const orgIds = [...new Set(rows.map((row) => row.organization_id).filter(Boolean))] as string[];
  const orgs = orgIds.length
    ? await prisma.issuerOrganization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      })
    : [];
  return new Map(orgs.map((org) => [org.id, org.name]));
}

function buildWhere(query: ExternalAcceptanceFilters) {
  const where: Record<string, unknown> = {};
  if (query.documentType) where.document_type = query.documentType;
  if (query.status) where.status = query.status;
  if (query.applicationId) where.application_id = query.applicationId;
  if (query.envelopeId) where.envelope_id = query.envelopeId;
  if (query.organizationId) where.organization_id = query.organizationId;
  if (query.dateFrom || query.dateTo) {
    where.created_at = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
  }
  if (query.search?.trim()) {
    const q = query.search.trim();
    where.OR = [
      { party_name: { contains: q, mode: "insensitive" } },
      { party_email: { contains: q, mode: "insensitive" } },
      { source_id: { contains: q } },
      { envelope_id: { contains: q } },
      { application_id: { contains: q } },
    ];
  }
  return where;
}

function toListItem(row: ExternalAcceptanceRow, orgNames: Map<string, string | null>) {
  const type = (row.document_type ?? row.version.legal_document.type) as LegalDocumentType;
  return {
    id: row.id,
    status: row.status,
    documentType: type,
    documentTitle: LEGAL_DOCUMENT_TYPE_LABELS[type] ?? row.version.legal_document.title,
    versionNumber: row.version_number ?? row.version.version,
    legalDocumentVersionId: row.legal_document_version_id,
    legalDocumentId: row.legal_document_id ?? row.version.legal_document.id,
    documentHash: row.document_hash ?? row.version.file_hash,
    fileName: row.version.file_name,
    partyName: row.party_name,
    partyEmail: row.party_email,
    partyIcMasked: maskIc(row.party_ic_number),
    partyRole: row.party_role,
    sourceType: row.source_type as LegalExternalAcceptanceSource,
    sourceId: row.source_id,
    envelopeId: row.envelope_id,
    applicationId: row.application_id,
    organizationId: row.organization_id,
    organizationName: row.organization_id ? orgNames.get(row.organization_id) ?? null : null,
    openedAt: row.opened_at?.toISOString() ?? null,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

function toDetail(row: ExternalAcceptanceRow, orgNames: Map<string, string | null>) {
  return {
    ...toListItem(row, orgNames),
    openedIpAddress: row.opened_ip_address ?? null,
    openedUserAgent: row.opened_user_agent ?? null,
    openedDeviceInfo: row.opened_device_info ?? null,
    acceptedIpAddress: row.accepted_ip_address ?? null,
    acceptedUserAgent: row.accepted_user_agent ?? null,
    acceptedDeviceInfo: row.accepted_device_info ?? null,
    acknowledgementText: row.acknowledgement_text ?? null,
    versionStatus: row.version.status ?? null,
    contentType: row.version.content_type ?? null,
    fileSize: row.version.file_size ?? null,
  };
}

export const legalExternalAcceptanceAdminService = {
  listAcceptances: listLegalExternalAcceptances,
  getAcceptanceById: getLegalExternalAcceptanceById,
  exportAcceptances: exportLegalExternalAcceptances,
};
