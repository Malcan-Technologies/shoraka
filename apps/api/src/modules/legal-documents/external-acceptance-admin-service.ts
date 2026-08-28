import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  type LegalDocumentType,
  type LegalExternalAcceptanceStatus,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import type { ListLegalExternalAcceptancesQuery } from "./external-acceptance-admin-schemas";

function maskIc(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `••••${digits.slice(-4)}`;
}

export async function listLegalExternalAcceptances(query: ListLegalExternalAcceptancesQuery) {
  const where = buildWhere(query);
  const skip = (query.page - 1) * query.pageSize;
  const orderBy =
    query.sortBy === "created_at"
      ? { created_at: query.sortOrder }
      : { accepted_at: query.sortOrder };

  const [rows, totalCount] = await prisma.$transaction([
    prisma.legalExternalAcceptance.findMany({
      where,
      orderBy,
      skip,
      take: query.pageSize,
      include: {
        version: {
          select: {
            file_name: true,
            file_hash: true,
            version: true,
            legal_document: { select: { id: true, type: true, title: true } },
          },
        },
      },
    }),
    prisma.legalExternalAcceptance.count({ where }),
  ]);

  const orgIds = [...new Set(rows.map((row) => row.organization_id).filter(Boolean))] as string[];
  const orgs = orgIds.length
    ? await prisma.issuerOrganization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      })
    : [];
  const orgNames = new Map(orgs.map((org) => [org.id, org.name]));

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
      version: {
        select: {
          file_name: true,
          file_hash: true,
          version: true,
          status: true,
          content_type: true,
          file_size: true,
          legal_document: { select: { id: true, type: true, title: true } },
        },
      },
    },
  });
  if (!row) {
    throw new AppError(404, "LEGAL_EXTERNAL_ACCEPTANCE_NOT_FOUND", "External acceptance not found");
  }
  let organizationName: string | null = null;
  if (row.organization_id) {
    const org = await prisma.issuerOrganization.findUnique({
      where: { id: row.organization_id },
      select: { name: true },
    });
    organizationName = org?.name ?? null;
  }
  return {
    ...toListItem(row, new Map(row.organization_id ? [[row.organization_id, organizationName]] : [])),
    partyIcNumber: row.party_ic_number,
    openedIpAddress: row.opened_ip_address,
    openedUserAgent: row.opened_user_agent,
    acceptedIpAddress: row.accepted_ip_address,
    acceptedUserAgent: row.accepted_user_agent,
    acknowledgementText: row.acknowledgement_text,
    versionStatus: row.version.status,
  };
}

function buildWhere(query: ListLegalExternalAcceptancesQuery) {
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

function toListItem(
  row: {
    id: string;
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
    accepted_at: Date | null;
    created_at: Date;
    envelope_id: string | null;
    application_id: string | null;
    organization_id: string | null;
    version: {
      file_name: string;
      file_hash: string | null;
      version: number;
      legal_document: { id: string; type: string; title: string };
    };
  },
  orgNames: Map<string, string | null>
) {
  const type = (row.document_type ?? row.version.legal_document.type) as LegalDocumentType;
  return {
    id: row.id,
    status: row.status,
    documentType: type,
    documentTitle: LEGAL_DOCUMENT_TYPE_LABELS[type] ?? row.version.legal_document.title,
    versionNumber: row.version_number ?? row.version.version,
    documentHash: row.document_hash ?? row.version.file_hash,
    fileName: row.version.file_name,
    partyName: row.party_name,
    partyEmail: row.party_email,
    partyIcMasked: maskIc(row.party_ic_number),
    partyRole: row.party_role,
    sourceType: row.source_type,
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

export const legalExternalAcceptanceAdminService = {
  listAcceptances: listLegalExternalAcceptances,
  getAcceptanceById: getLegalExternalAcceptanceById,
};
