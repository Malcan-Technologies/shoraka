import { Request } from "express";
import {
  LEGAL_DOCUMENT_CHECKBOX_WORDING,
  LEGAL_DOCUMENT_TYPE_LABELS,
  getRequiredLegalTypesForAudience,
  isLegalDocumentType,
  legalDocumentSlugToType,
  legalDocumentTypeToSlug,
  type LegalAcceptanceAudience,
  type LegalAcceptanceStatus,
  type LegalAcceptanceStatusResponse,
  type LegalBlockedAction,
  type LegalComplianceStatus,
  type LegalDocumentAudience,
  type LegalDocumentType,
  type PendingLegalDocumentResponse,
  type PublicLegalDocumentResponse,
  type RequiredLegalDocumentResponse,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import {
  generatePresignedDownloadUrl,
  generatePresignedViewUrl,
} from "../../lib/s3/client";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { documentLogRepository } from "../site-documents/repository";
import {
  legalDocumentRepository,
  type VersionWithDocument,
} from "./repository";
import {
  resolveActivePublishedByTypeAndAudiences,
  resolveActivePublishedReacceptanceByTypeAndAudiences,
  resolveActivePublicPublishedByType,
  resolveActivePublicPublishedVersions,
} from "./active-published";

type AcceptanceRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  audience_role: LegalAcceptanceAudience;
  legal_document_version_id: string;
  document_hash: string | null;
  status: LegalAcceptanceStatus;
  opened_at: Date | null;
  accepted_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
};

function audiencesForRole(role: LegalAcceptanceAudience): LegalDocumentAudience[] {
  return role === "ISSUER" ? ["ISSUER", "BOTH"] : ["INVESTOR", "BOTH"];
}

async function assertOrgAccess(
  userId: string,
  organizationId: string,
  audience: LegalAcceptanceAudience
) {
  if (audience === "ISSUER") {
    const org = await prisma.issuerOrganization.findFirst({
      where: {
        id: organizationId,
        OR: [
          { owner_user_id: userId },
          { members: { some: { user_id: userId } } },
        ],
      },
      select: { id: true, owner_user_id: true, tnc_accepted: true },
    });
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }
    return org;
  }

  const org = await prisma.investorOrganization.findFirst({
    where: {
      id: organizationId,
      OR: [
        { owner_user_id: userId },
        { members: { some: { user_id: userId } } },
      ],
    },
    select: { id: true, owner_user_id: true, tnc_accepted: true },
  });
  if (!org) {
    throw new AppError(404, "NOT_FOUND", "Organization not found");
  }
  return org;
}

async function findUserAcceptance(
  userId: string,
  organizationId: string,
  versionId: string
) {
  return (await prisma.legalDocumentAcceptance.findFirst({
    where: {
      user_id: userId,
      organization_id: organizationId,
      legal_document_version_id: versionId,
    },
  })) as AcceptanceRow | null;
}

/** Org-level: any ACCEPTED row for this org + version satisfies compliance. */
async function findOrgAccepted(organizationId: string, versionId: string) {
  return (await prisma.legalDocumentAcceptance.findFirst({
    where: {
      organization_id: organizationId,
      legal_document_version_id: versionId,
      status: "ACCEPTED",
    },
  })) as AcceptanceRow | null;
}

function toRequiredDoc(
  version: VersionWithDocument,
  acceptance: AcceptanceRow | null,
  orgAccepted: boolean
): RequiredLegalDocumentResponse {
  const type = version.legal_document.type as LegalDocumentType;
  const status: LegalAcceptanceStatus = orgAccepted
    ? "ACCEPTED"
    : acceptance?.status ?? "NOT_OPENED";

  return {
    legalDocumentId: version.legal_document_id,
    legalDocumentVersionId: version.id,
    type,
    title: version.legal_document.title || LEGAL_DOCUMENT_TYPE_LABELS[type],
    version: version.version,
    file_name: version.file_name,
    file_hash: version.file_hash,
    open_before_accept_required: true,
    acceptance_required: version.legal_document.required_for_onboarding,
    checkbox_wording: LEGAL_DOCUMENT_CHECKBOX_WORDING[type],
    acceptance_status: status,
    opened_at: acceptance?.opened_at?.toISOString() ?? null,
    accepted_at:
      acceptance?.accepted_at?.toISOString() ??
      (orgAccepted ? new Date(0).toISOString() : null),
  };
}

function toPendingDoc(
  version: VersionWithDocument,
  acceptance: AcceptanceRow | null
): PendingLegalDocumentResponse {
  const type = version.legal_document.type as LegalDocumentType;
  return {
    legalDocumentId: version.legal_document_id,
    legalDocumentVersionId: version.id,
    documentType: type,
    title: version.legal_document.title || LEGAL_DOCUMENT_TYPE_LABELS[type],
    version: version.version,
    file_name: version.file_name,
    file_hash: version.file_hash,
    open_before_accept_required: true,
    checkbox_wording: LEGAL_DOCUMENT_CHECKBOX_WORDING[type],
    acceptance_status: acceptance?.status ?? "NOT_OPENED",
    openedAt: acceptance?.opened_at?.toISOString() ?? null,
    acceptedAt: acceptance?.accepted_at?.toISOString() ?? null,
  };
}

function blockedActionsFor(
  audience: LegalAcceptanceAudience,
  hasPending: boolean
): LegalBlockedAction[] {
  if (!hasPending) return [];
  if (audience === "ISSUER") {
    return ["NEW_FINANCING_APPLICATION", "NEW_UTILISATION"];
  }
  return ["NEW_INVESTMENT"];
}

export class LegalDocumentAcceptanceService {
  async getRequiredDocuments(
    userId: string,
    organizationId: string,
    audience: LegalAcceptanceAudience
  ): Promise<LegalAcceptanceStatusResponse> {
    await assertOrgAccess(userId, organizationId, audience);

    const requiredTypes = getRequiredLegalTypesForAudience(audience);
    const allowedAudiences = audiencesForRole(audience);
    const documents: RequiredLegalDocumentResponse[] = [];

    for (const type of requiredTypes) {
      const published = await resolveActivePublishedByTypeAndAudiences(type, [
        ...allowedAudiences,
      ]);
      if (!published) continue;

      const [acceptance, orgAccepted] = await Promise.all([
        findUserAcceptance(userId, organizationId, published.id),
        findOrgAccepted(organizationId, published.id),
      ]);

      documents.push(toRequiredDoc(published, acceptance, Boolean(orgAccepted)));
    }

    const allAccepted =
      documents.length === 0 ||
      documents.every((d) => d.acceptance_status === "ACCEPTED");

    return {
      audience,
      organization_id: organizationId,
      all_accepted: allAccepted,
      documents,
    };
  }

  async getPendingReacceptanceDocuments(
    userId: string,
    organizationId: string,
    audience: LegalAcceptanceAudience
  ): Promise<PendingLegalDocumentResponse[]> {
    const org = await assertOrgAccess(userId, organizationId, audience);
    if (!org.tnc_accepted) {
      return [];
    }

    const requiredTypes = getRequiredLegalTypesForAudience(audience);
    const allowedAudiences = audiencesForRole(audience);
    const pending: PendingLegalDocumentResponse[] = [];

    for (const type of requiredTypes) {
      const published = await resolveActivePublishedReacceptanceByTypeAndAudiences(
        type,
        [...allowedAudiences]
      );
      if (!published) continue;

      const orgAccepted = await findOrgAccepted(organizationId, published.id);
      if (orgAccepted) continue;

      const acceptance = await findUserAcceptance(userId, organizationId, published.id);
      pending.push(toPendingDoc(published, acceptance));
    }

    return pending;
  }

  async getComplianceStatus(
    userId: string,
    organizationId: string,
    audience: LegalAcceptanceAudience
  ): Promise<LegalComplianceStatus> {
    const org = await assertOrgAccess(userId, organizationId, audience);
    const isOrganisationOwner = org.owner_user_id === userId;
    const onboardingDocs = await this.getRequiredDocuments(userId, organizationId, audience);
    const pendingDocuments = org.tnc_accepted
      ? await this.getPendingReacceptanceDocuments(userId, organizationId, audience)
      : [];

    const hasPendingReacceptance = pendingDocuments.length > 0;
    const onboardingComplete =
      org.tnc_accepted &&
      (!onboardingDocs.documents.length || onboardingDocs.all_accepted);

    return {
      onboardingComplete,
      hasPendingReacceptance,
      isOrganisationOwner,
      pendingDocuments,
      blockedActions: blockedActionsFor(audience, hasPendingReacceptance),
      tncAccepted: org.tnc_accepted,
    };
  }

  async hasCompletedRequiredAcceptances(
    userId: string,
    organizationId: string,
    audience: LegalAcceptanceAudience
  ): Promise<{ hasRequiredDocuments: boolean; allAccepted: boolean }> {
    const status = await this.getRequiredDocuments(userId, organizationId, audience);
    return {
      hasRequiredDocuments: status.documents.length > 0,
      allAccepted: status.all_accepted,
    };
  }

  async assertNoPendingReacceptance(
    userId: string,
    organizationId: string,
    audience: LegalAcceptanceAudience,
    action: LegalBlockedAction
  ) {
    const compliance = await this.getComplianceStatus(userId, organizationId, audience);
    if (!compliance.hasPendingReacceptance) return;
    if (!compliance.blockedActions.includes(action)) return;

    throw new AppError(
      403,
      "LEGAL_REACCEPTANCE_REQUIRED",
      "An updated legal document requires your review and acceptance before you can start new transactions."
    );
  }

  async recordOpened(
    req: Request,
    userId: string,
    versionId: string,
    organizationId: string,
    audience: LegalAcceptanceAudience
  ) {
    await assertOrgAccess(userId, organizationId, audience);

    const version = await legalDocumentRepository.findVersionById(versionId);
    if (!version || version.status !== "PUBLISHED") {
      throw new AppError(404, "NOT_FOUND", "Published document version not found");
    }

    this.assertDocumentAudience(version, audience);

    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
    const existing = await findUserAcceptance(userId, organizationId, versionId);

    if (existing?.status === "ACCEPTED" || existing?.status === "OPENED") {
      return existing;
    }

    const row = existing
      ? ((await prisma.legalDocumentAcceptance.update({
          where: { id: existing.id },
          data: {
            status: "OPENED",
            opened_at: new Date(),
            ip_address: ipAddress,
            user_agent: userAgent,
          },
        })) as AcceptanceRow)
      : ((await prisma.legalDocumentAcceptance.create({
          data: {
            user_id: userId,
            organization_id: organizationId,
            audience_role: audience,
            legal_document_version_id: versionId,
            document_hash: version.file_hash,
            status: "OPENED",
            opened_at: new Date(),
            ip_address: ipAddress,
            user_agent: userAgent,
          },
        })) as AcceptanceRow);

    await documentLogRepository.create({
      userId,
      documentId: version.legal_document_id,
      eventType: "LEGAL_DOCUMENT_OPENED" as never,
      ipAddress,
      userAgent,
      deviceInfo,
      metadata: {
        organization_id: organizationId,
        audience,
        legal_document_id: version.legal_document_id,
        legal_document_version_id: versionId,
        document_type: version.legal_document.type,
        version: version.version,
        file_hash: version.file_hash,
        acceptance_status: "OPENED",
      },
    });

    logger.info(
      { userId, versionId, organizationId, audience },
      "Legal document open recorded"
    );

    return row;
  }

  async recordAccepted(
    req: Request,
    userId: string,
    versionId: string,
    organizationId: string,
    audience: LegalAcceptanceAudience
  ) {
    const org = await assertOrgAccess(userId, organizationId, audience);
    if (org.owner_user_id !== userId) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Only the organization owner can accept legal documents"
      );
    }

    const version = await legalDocumentRepository.findVersionById(versionId);
    if (!version || version.status !== "PUBLISHED") {
      throw new AppError(
        400,
        "INVALID_DOCUMENT",
        "Only the currently published document version can be accepted"
      );
    }

    this.assertDocumentAudience(version, audience);

    if (!version.legal_document.required_for_onboarding) {
      throw new AppError(400, "NOT_REQUIRED", "Acceptance is not required for this document");
    }

    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
    const existing = await findUserAcceptance(userId, organizationId, versionId);

    if (existing?.status === "ACCEPTED") {
      return existing;
    }

    if (!existing || existing.status === "NOT_OPENED") {
      throw new AppError(
        400,
        "OPEN_REQUIRED",
        "You must open the PDF before accepting this document"
      );
    }

    const row = (await prisma.legalDocumentAcceptance.update({
      where: { id: existing.id },
      data: {
        status: "ACCEPTED",
        accepted_at: new Date(),
        opened_at: existing.opened_at ?? new Date(),
        document_hash: version.file_hash,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    })) as AcceptanceRow;

    await documentLogRepository.create({
      userId,
      documentId: version.legal_document_id,
      eventType: "LEGAL_DOCUMENT_ACCEPTED" as never,
      ipAddress,
      userAgent,
      deviceInfo,
      metadata: {
        organization_id: organizationId,
        audience,
        legal_document_id: version.legal_document_id,
        legal_document_version_id: versionId,
        document_type: version.legal_document.type,
        version: version.version,
        file_hash: version.file_hash,
        acceptance_status: "ACCEPTED",
      },
    });

    logger.info(
      { userId, versionId, organizationId, audience },
      "Legal document acceptance recorded"
    );

    return row;
  }

  async getPublishedDownloadUrl(versionId: string) {
    const version = await legalDocumentRepository.findVersionById(versionId);
    if (!version || version.status !== "PUBLISHED") {
      throw new AppError(404, "NOT_FOUND", "Published document version not found");
    }

    const { downloadUrl, expiresIn } = await generatePresignedDownloadUrl({
      key: version.s3_key,
      fileName: version.file_name,
    });

    return {
      downloadUrl,
      expiresIn,
      fileName: version.file_name,
      contentType: version.content_type,
      fileSize: version.file_size,
    };
  }

  async getPublishedViewUrl(versionId: string) {
    const version = await legalDocumentRepository.findVersionById(versionId);
    if (!version || version.status !== "PUBLISHED") {
      throw new AppError(404, "NOT_FOUND", "Published document version not found");
    }

    const { viewUrl, expiresIn } = await generatePresignedViewUrl({
      key: version.s3_key,
    });

    return {
      viewUrl,
      expiresIn,
      fileName: version.file_name,
      contentType: version.content_type,
      fileSize: version.file_size,
    };
  }

  async getPublicDownloadUrl(versionId: string) {
    const version = await legalDocumentRepository.findVersionById(versionId);
    if (!version || version.status !== "PUBLISHED") {
      throw new AppError(404, "NOT_FOUND", "Published document version not found");
    }

    if (!version.legal_document.public_visibility) {
      throw new AppError(404, "NOT_FOUND", "Published document version not found");
    }

    return this.getPublishedDownloadUrl(versionId);
  }

  async getPublicViewUrl(versionId: string) {
    const version = await legalDocumentRepository.findVersionById(versionId);
    if (!version || version.status !== "PUBLISHED") {
      throw new AppError(404, "NOT_FOUND", "Published document version not found");
    }

    if (!version.legal_document.public_visibility) {
      throw new AppError(404, "NOT_FOUND", "Published document version not found");
    }

    return this.getPublishedViewUrl(versionId);
  }

  async listPublicPublishedDocuments(): Promise<PublicLegalDocumentResponse[]> {
    const rows = await resolveActivePublicPublishedVersions();
    const byType = new Map<string, VersionWithDocument>();

    for (const row of rows) {
      if (!isLegalDocumentType(row.legal_document.type)) continue;
      if (!byType.has(row.legal_document.type)) {
        byType.set(row.legal_document.type, row);
      }
    }

    return [...byType.values()].map((row) => this.toPublicResponse(row));
  }

  async getPublicDocumentBySlug(slug: string): Promise<PublicLegalDocumentResponse> {
    const type = legalDocumentSlugToType(slug);
    if (!type) {
      throw new AppError(404, "NOT_FOUND", "Legal document not found");
    }

    const row = await resolveActivePublicPublishedByType(type);
    if (!row) {
      throw new AppError(404, "NOT_FOUND", "Legal document not found");
    }

    return this.toPublicResponse(row);
  }

  private toPublicResponse(row: VersionWithDocument): PublicLegalDocumentResponse {
    const type = row.legal_document.type as LegalDocumentType;
    return {
      legalDocumentId: row.legal_document_id,
      legalDocumentVersionId: row.id,
      type,
      slug: legalDocumentTypeToSlug(type),
      title: row.legal_document.title || LEGAL_DOCUMENT_TYPE_LABELS[type],
      description: row.legal_document.description,
      audience: row.legal_document.audience,
      version: row.version,
      file_name: row.file_name,
      published_at: row.published_at?.toISOString() ?? null,
    };
  }

  private assertDocumentAudience(
    version: VersionWithDocument,
    audience: LegalAcceptanceAudience
  ) {
    const allowed = audiencesForRole(audience);
    if (!allowed.includes(version.legal_document.audience)) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "This document is not available for your portal"
      );
    }
  }
}

export const legalDocumentAcceptanceService = new LegalDocumentAcceptanceService();
