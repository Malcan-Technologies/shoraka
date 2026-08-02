import { Request } from "express";
import {
  LEGAL_DOCUMENT_CHECKBOX_WORDING,
  LEGAL_DOCUMENT_TYPE_LABELS,
  PUBLIC_FOOTER_LEGAL_TYPES,
  getRequiredLegalTypesForAudience,
  isOnboardingLegalDocumentType,
  type LegalAcceptanceAudience,
  type LegalAcceptanceStatus,
  type LegalAcceptanceStatusResponse,
  type OnboardingLegalDocumentType,
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
import { documentLogRepository, siteDocumentRepository, type SiteDocumentRow } from "./repository";
import type { SiteDocumentType } from "./schemas";

type AcceptanceRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  audience_role: LegalAcceptanceAudience;
  document_id: string;
  document_type: SiteDocumentType;
  version: number;
  file_hash: string | null;
  status: LegalAcceptanceStatus;
  opened_at: Date | null;
  accepted_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
};

function audiencesForRole(role: LegalAcceptanceAudience) {
  return role === "ISSUER"
    ? (["ISSUER", "BOTH", "PUBLIC"] as const)
    : (["INVESTOR", "BOTH", "PUBLIC"] as const);
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
      select: { id: true, owner_user_id: true },
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
    select: { id: true, owner_user_id: true },
  });
  if (!org) {
    throw new AppError(404, "NOT_FOUND", "Organization not found");
  }
  return org;
}

function toRequiredDoc(
  doc: SiteDocumentRow,
  acceptance: AcceptanceRow | null
): RequiredLegalDocumentResponse {
  const type = doc.type as OnboardingLegalDocumentType;
  return {
    id: doc.id,
    type,
    title: doc.title || LEGAL_DOCUMENT_TYPE_LABELS[type],
    version: doc.version,
    file_name: doc.file_name,
    file_hash: doc.file_hash,
    open_before_accept_required: doc.open_before_accept_required,
    acceptance_required: doc.acceptance_required,
    checkbox_wording: LEGAL_DOCUMENT_CHECKBOX_WORDING[type],
    acceptance_status: acceptance?.status ?? "NOT_OPENED",
    opened_at: acceptance?.opened_at?.toISOString() ?? null,
    accepted_at: acceptance?.accepted_at?.toISOString() ?? null,
  };
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
      const published = await siteDocumentRepository.findPublishedByTypeAndAudiences(
        type,
        [...allowedAudiences]
      );
      if (!published) {
        // RISK_STATEMENT and any other type without a published required version are skipped.
        continue;
      }

      const acceptance = (await prisma.legalDocumentAcceptance.findFirst({
        where: {
          user_id: userId,
          organization_id: organizationId,
          document_id: published.id,
        },
      })) as AcceptanceRow | null;

      documents.push(toRequiredDoc(published, acceptance));
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

  /**
   * True when every currently required published legal PDF for this audience
   * has been accepted for the organization. When no required PDFs exist yet,
   * returns true so the legacy markdown T&C gate (tnc_accepted) still applies.
   */
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

  async recordOpened(
    req: Request,
    userId: string,
    documentId: string,
    organizationId: string,
    audience: LegalAcceptanceAudience
  ) {
    await assertOrgAccess(userId, organizationId, audience);

    const document = await siteDocumentRepository.findById(documentId);
    if (!document || document.status !== "PUBLISHED") {
      throw new AppError(404, "NOT_FOUND", "Published document not found");
    }

    this.assertDocumentAudience(document, audience);

    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);

    const existing = (await prisma.legalDocumentAcceptance.findFirst({
      where: {
        user_id: userId,
        organization_id: organizationId,
        document_id: documentId,
      },
    })) as AcceptanceRow | null;

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
            document_id: documentId,
            document_type: document.type,
            version: document.version,
            file_hash: document.file_hash,
            status: "OPENED",
            opened_at: new Date(),
            ip_address: ipAddress,
            user_agent: userAgent,
          },
        })) as AcceptanceRow);

    await documentLogRepository.create({
      userId,
      documentId,
      eventType: "DOCUMENT_OPENED",
      ipAddress,
      userAgent,
      deviceInfo,
      metadata: {
        organization_id: organizationId,
        audience,
        document_type: document.type,
        version: document.version,
        file_hash: document.file_hash,
        acceptance_status: "OPENED",
      },
    });

    logger.info(
      { userId, documentId, organizationId, audience },
      "Legal document open recorded"
    );

    return row;
  }

  async recordAccepted(
    req: Request,
    userId: string,
    documentId: string,
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

    const document = await siteDocumentRepository.findById(documentId);
    if (!document || document.status !== "PUBLISHED") {
      throw new AppError(
        400,
        "INVALID_DOCUMENT",
        "Only the currently published document version can be accepted"
      );
    }

    this.assertDocumentAudience(document, audience);

    if (!document.acceptance_required) {
      throw new AppError(400, "NOT_REQUIRED", "Acceptance is not required for this document");
    }

    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);

    const existing = (await prisma.legalDocumentAcceptance.findFirst({
      where: {
        user_id: userId,
        organization_id: organizationId,
        document_id: documentId,
      },
    })) as AcceptanceRow | null;

    if (existing?.status === "ACCEPTED") {
      return existing;
    }

    if (
      document.open_before_accept_required &&
      (!existing || existing.status === "NOT_OPENED")
    ) {
      throw new AppError(
        400,
        "OPEN_REQUIRED",
        "You must open the PDF before accepting this document"
      );
    }

    const row = existing
      ? ((await prisma.legalDocumentAcceptance.update({
          where: { id: existing.id },
          data: {
            status: "ACCEPTED",
            accepted_at: new Date(),
            opened_at: existing.opened_at ?? new Date(),
            file_hash: document.file_hash,
            version: document.version,
            ip_address: ipAddress,
            user_agent: userAgent,
          },
        })) as AcceptanceRow)
      : ((await prisma.legalDocumentAcceptance.create({
          data: {
            user_id: userId,
            organization_id: organizationId,
            audience_role: audience,
            document_id: documentId,
            document_type: document.type,
            version: document.version,
            file_hash: document.file_hash,
            status: "ACCEPTED",
            opened_at: new Date(),
            accepted_at: new Date(),
            ip_address: ipAddress,
            user_agent: userAgent,
          },
        })) as AcceptanceRow);

    await documentLogRepository.create({
      userId,
      documentId,
      eventType: "DOCUMENT_ACCEPTED",
      ipAddress,
      userAgent,
      deviceInfo,
      metadata: {
        organization_id: organizationId,
        audience,
        document_type: document.type,
        version: document.version,
        file_hash: document.file_hash,
        acceptance_status: "ACCEPTED",
      },
    });

    logger.info(
      { userId, documentId, organizationId, audience },
      "Legal document acceptance recorded"
    );

    return row;
  }

  async getPublishedDownloadUrl(documentId: string) {
    const document = await siteDocumentRepository.findById(documentId);
    if (!document || document.status !== "PUBLISHED") {
      throw new AppError(404, "NOT_FOUND", "Published document not found");
    }

    const { downloadUrl, expiresIn } = await generatePresignedDownloadUrl({
      key: document.s3_key,
      fileName: document.file_name,
    });

    return {
      downloadUrl,
      expiresIn,
      fileName: document.file_name,
      contentType: document.content_type,
      fileSize: document.file_size,
    };
  }

  async getPublishedViewUrl(documentId: string) {
    const document = await siteDocumentRepository.findById(documentId);
    if (!document || document.status !== "PUBLISHED") {
      throw new AppError(404, "NOT_FOUND", "Published document not found");
    }

    const { viewUrl, expiresIn } = await generatePresignedViewUrl({
      key: document.s3_key,
    });

    return {
      viewUrl,
      expiresIn,
      fileName: document.file_name,
      contentType: document.content_type,
      fileSize: document.file_size,
    };
  }

  async listPublicPublishedDocuments(): Promise<PublicLegalDocumentResponse[]> {
    const rows = await siteDocumentRepository.findPublishedForPublic([
      ...PUBLIC_FOOTER_LEGAL_TYPES,
    ] as SiteDocumentType[]);

    const byType = new Map<string, SiteDocumentRow>();
    for (const row of rows) {
      if (!isOnboardingLegalDocumentType(row.type)) continue;
      if (!byType.has(row.type)) {
        byType.set(row.type, row);
      }
    }

    return PUBLIC_FOOTER_LEGAL_TYPES.filter((type) => byType.has(type)).map((type) => {
      const row = byType.get(type)!;
      return {
        id: row.id,
        type,
        title: row.title || LEGAL_DOCUMENT_TYPE_LABELS[type],
        version: row.version,
        file_name: row.file_name,
        published_at: row.published_at?.toISOString() ?? null,
      };
    });
  }

  private assertDocumentAudience(
    document: SiteDocumentRow,
    audience: LegalAcceptanceAudience
  ) {
    const allowed = audiencesForRole(audience);
    if (!allowed.includes(document.audience as (typeof allowed)[number])) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "This document is not available for your portal"
      );
    }
  }
}

export const legalDocumentAcceptanceService = new LegalDocumentAcceptanceService();
