import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import {
  COMPANY_SEAL_MANAGE_FORBIDDEN_MESSAGE,
  isIssuerCompanySealS3Key,
  issuerCompanySealS3Prefix,
  type IssuerCompanySealDto,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { generatePresignedUploadUrl, generatePresignedViewUrl } from "../../lib/s3/client";
import { confirmSigningCloudLegalImageFromS3 } from "../../lib/signingcloud/legal-image";
import { OrganizationService } from "./service";
import { requireOrganizationOwnerOrAdmin } from "./org-rbac";
import type { IssuerCompanySealConfirmInput, IssuerCompanySealUploadUrlInput } from "./schemas";

const organizationService = new OrganizationService();

const SEAL_IN_USE_MESSAGE =
  "This company seal is still used on a signing package and cannot be removed.";

export { COMPANY_SEAL_MANAGE_FORBIDDEN_MESSAGE };

type CompanySealRow = {
  id: string;
  s3_key: string;
  original_file_name: string;
  content_type: string;
  byte_size: number;
  sha256: string;
  width_px: number;
  height_px: number;
  transparency_mode: IssuerCompanySealDto["transparencyMode"];
  created_at: Date;
  superseded_at: Date | null;
};

export function requireIssuerCompanySealS3Key(organizationId: string, key: string): void {
  if (!isIssuerCompanySealS3Key(organizationId, key)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "This upload does not belong to this organization."
    );
  }
}

function toIssuerCompanySealDto(row: CompanySealRow): IssuerCompanySealDto {
  return {
    id: row.id,
    fileName: row.original_file_name,
    contentType: row.content_type,
    byteSize: row.byte_size,
    widthPx: row.width_px,
    heightPx: row.height_px,
    sha256: row.sha256,
    transparencyMode: row.transparency_mode,
    createdAt: row.created_at.toISOString(),
    supersededAt: row.superseded_at?.toISOString() ?? null,
  };
}

function sealExtension(contentType: string): "png" | "jpg" {
  return contentType === "image/jpeg" || contentType === "image/jpg" ? "jpg" : "png";
}

function isPrismaRestrictError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2003" || error.code === "P2014")
  );
}

async function loadIssuerOrganization(userId: string, organizationId: string) {
  return organizationService.getOrganization(userId, organizationId, "issuer");
}

async function requireSealManager(userId: string, organizationId: string) {
  const organization = await loadIssuerOrganization(userId, organizationId);
  requireOrganizationOwnerOrAdmin(organization, userId, COMPANY_SEAL_MANAGE_FORBIDDEN_MESSAGE);
}

export async function getIssuerCompanySeal(
  userId: string,
  organizationId: string
): Promise<{ seal: IssuerCompanySealDto | null }> {
  await loadIssuerOrganization(userId, organizationId);
  const row = await prisma.issuerOrganizationCompanySeal.findFirst({
    where: { issuer_organization_id: organizationId, superseded_at: null },
  });
  return { seal: row ? toIssuerCompanySealDto(row) : null };
}

export async function getIssuerCompanySealPreview(
  userId: string,
  organizationId: string
): Promise<{ viewUrl: string; expiresIn: number } | { viewUrl: null; expiresIn: null }> {
  await loadIssuerOrganization(userId, organizationId);
  const row = await prisma.issuerOrganizationCompanySeal.findFirst({
    where: { issuer_organization_id: organizationId, superseded_at: null },
    select: { s3_key: true },
  });
  if (!row) return { viewUrl: null, expiresIn: null };
  const data = await generatePresignedViewUrl({ key: row.s3_key });
  return { viewUrl: data.viewUrl, expiresIn: data.expiresIn };
}

export async function requestIssuerCompanySealUploadUrl(
  userId: string,
  organizationId: string,
  input: IssuerCompanySealUploadUrlInput
): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
  await requireSealManager(userId, organizationId);
  const date = new Date().toISOString().split("T")[0];
  const key = `${issuerCompanySealS3Prefix(organizationId)}v1-${date}-${randomUUID()}.${sealExtension(input.contentType)}`;
  const { uploadUrl, key: s3Key, expiresIn } = await generatePresignedUploadUrl({
    key,
    contentType: input.contentType,
    contentLength: input.fileSize,
  });
  return { uploadUrl, s3Key, expiresIn };
}

export async function confirmIssuerCompanySeal(
  userId: string,
  organizationId: string,
  input: IssuerCompanySealConfirmInput
): Promise<{ seal: IssuerCompanySealDto }> {
  await requireSealManager(userId, organizationId);
  requireIssuerCompanySealS3Key(organizationId, input.s3Key);
  const confirmed = await confirmSigningCloudLegalImageFromS3(input.s3Key);
  const now = new Date();
  try {
    const row = await prisma.$transaction(async (tx) => {
      await tx.issuerOrganizationCompanySeal.updateMany({
        where: { issuer_organization_id: organizationId, superseded_at: null },
        data: { superseded_at: now },
      });
      return tx.issuerOrganizationCompanySeal.create({
        data: {
          issuer_organization_id: organizationId,
          s3_key: input.s3Key,
          original_file_name: input.fileName,
          content_type: confirmed.contentType,
          byte_size: confirmed.byteSize,
          sha256: confirmed.sha256,
          width_px: confirmed.widthPx,
          height_px: confirmed.heightPx,
          transparency_mode: confirmed.transparencyMode,
          uploaded_by_user_id: userId,
        },
      });
    });
    return { seal: toIssuerCompanySealDto(row) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(
        409,
        "COMPANY_SEAL_CONFLICT",
        "Another company seal was saved. Refresh and try again."
      );
    }
    if (isPrismaRestrictError(error)) {
      throw new AppError(409, "COMPANY_SEAL_IN_USE", SEAL_IN_USE_MESSAGE);
    }
    throw error;
  }
}

export async function removeIssuerCompanySeal(
  userId: string,
  organizationId: string
): Promise<{ seal: null }> {
  await requireSealManager(userId, organizationId);
  try {
    const updated = await prisma.issuerOrganizationCompanySeal.updateMany({
      where: { issuer_organization_id: organizationId, superseded_at: null },
      data: { superseded_at: new Date() },
    });
    if (updated.count === 0) {
      throw new AppError(404, "NOT_FOUND", "No company seal to remove.");
    }
    return { seal: null };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isPrismaRestrictError(error)) {
      throw new AppError(409, "COMPANY_SEAL_IN_USE", SEAL_IN_USE_MESSAGE);
    }
    throw error;
  }
}
