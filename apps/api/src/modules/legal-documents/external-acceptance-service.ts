/**
 * Open/accept for people without a login (first source: signing-link guarantors).
 * Portal org-owner acceptances stay on LegalDocumentAcceptance.
 */
import { Request } from "express";
import {
  GUARANTOR_REQUIRED_LEGAL_TYPES,
  LEGAL_DOCUMENT_CHECKBOX_WORDING,
  LEGAL_DOCUMENT_TYPE_LABELS,
  type ExternalSigningWarningDto,
  type ExternalSigningWarningStatus,
  type LegalDocumentType,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import { generatePresignedViewUrl } from "../../lib/s3/client";
import { prisma } from "../../lib/prisma";
import { legalDocumentRepository, type VersionWithDocument } from "./repository";

const GUARANTOR_WARNING_TYPE = GUARANTOR_REQUIRED_LEGAL_TYPES[0];
const SOURCE_SIGNING_RECIPIENT = "SIGNING_RECIPIENT" as const;

function sourceVersionWhere(sourceId: string, versionId: string) {
  return {
    source_type_source_id_legal_document_version_id: {
      source_type: SOURCE_SIGNING_RECIPIENT,
      source_id: sourceId,
      legal_document_version_id: versionId,
    },
  } as const;
}

export type SigningRecipientParty = {
  id: string;
  role_key: string;
  name: string;
  email: string;
  ic_number: string | null;
};

function evidenceFromVersion(version: VersionWithDocument) {
  const type = version.legal_document.type as LegalDocumentType;
  return {
    legal_document_id: version.legal_document_id,
    document_type: type,
    version_number: version.version,
    document_hash: version.file_hash,
  };
}

function warningStatus(status: string | undefined): ExternalSigningWarningStatus {
  if (status === "ACCEPTED") return "accepted";
  if (status === "OPENED") return "opened";
  return "not_opened";
}

export class LegalExternalAcceptanceService {
  async getPublishedGuarantorWarning(): Promise<VersionWithDocument | null> {
    const published = await legalDocumentRepository.findPublishedByType(GUARANTOR_WARNING_TYPE);
    if (!published || published.legal_document.audience !== "GUARANTOR") return null;
    return published;
  }

  async getWarningForSigningRecipient(
    recipient: Pick<SigningRecipientParty, "id" | "role_key">
  ): Promise<ExternalSigningWarningDto | null> {
    if (recipient.role_key !== "guarantor") return null;

    const wording = LEGAL_DOCUMENT_CHECKBOX_WORDING[GUARANTOR_WARNING_TYPE];
    const published = await this.getPublishedGuarantorWarning();
    if (!published) {
      return {
        required: true,
        status: "not_opened",
        legal_document_version_id: null,
        title: LEGAL_DOCUMENT_TYPE_LABELS[GUARANTOR_WARNING_TYPE],
        checkbox_wording: wording,
      };
    }

    const row = await prisma.legalExternalAcceptance.findUnique({
      where: sourceVersionWhere(recipient.id, published.id),
      select: { status: true },
    });

    return {
      required: true,
      status: warningStatus(row?.status),
      legal_document_version_id: published.id,
      title: published.legal_document.title || LEGAL_DOCUMENT_TYPE_LABELS[GUARANTOR_WARNING_TYPE],
      checkbox_wording: wording,
    };
  }

  async acceptedAtBySigningRecipientIds(recipientIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (recipientIds.length === 0) return result;

    const published = await this.getPublishedGuarantorWarning();
    if (!published) return result;

    const rows = await prisma.legalExternalAcceptance.findMany({
      where: {
        source_type: SOURCE_SIGNING_RECIPIENT,
        source_id: { in: recipientIds },
        legal_document_version_id: published.id,
        status: "ACCEPTED",
      },
      select: { source_id: true, accepted_at: true },
    });

    for (const row of rows) {
      if (row.accepted_at) result.set(row.source_id, row.accepted_at.toISOString());
    }
    return result;
  }

  async assertSigningRecipientAccepted(recipient: Pick<SigningRecipientParty, "id" | "role_key">) {
    if (recipient.role_key !== "guarantor") return;

    const published = await this.getPublishedGuarantorWarning();
    if (!published) {
      throw new AppError(
        403,
        "LEGAL_DOCUMENT_UNAVAILABLE",
        "The guarantor warning statement is not available yet."
      );
    }

    const row = await prisma.legalExternalAcceptance.findUnique({
      where: sourceVersionWhere(recipient.id, published.id),
      select: { status: true },
    });

    if (row?.status !== "ACCEPTED") {
      throw new AppError(
        403,
        "WARNING_ACKNOWLEDGEMENT_REQUIRED",
        "Review and accept the warning statement before signing."
      );
    }
  }

  async recordOpenedForSigningRecipient(req: Request, recipient: SigningRecipientParty) {
    this.assertGuarantorIdentity(recipient);
    const version = await this.requirePublishedGuarantorWarning();
    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
    const existing = await prisma.legalExternalAcceptance.findUnique({
      where: sourceVersionWhere(recipient.id, version.id),
    });

    if (!existing) {
      await prisma.legalExternalAcceptance.create({
        data: {
          legal_document_version_id: version.id,
          ...evidenceFromVersion(version),
          party_name: recipient.name,
          party_email: recipient.email,
          party_ic_number: recipient.ic_number,
          source_type: SOURCE_SIGNING_RECIPIENT,
          source_id: recipient.id,
          status: "OPENED",
          opened_at: new Date(),
          opened_ip_address: ipAddress,
          opened_user_agent: userAgent,
          opened_device_info: deviceInfo,
        },
      });
    }

    const { viewUrl, expiresIn } = await generatePresignedViewUrl({ key: version.s3_key });
    return { viewUrl, expiresIn };
  }

  async recordAcceptedForSigningRecipient(req: Request, recipient: SigningRecipientParty) {
    this.assertGuarantorIdentity(recipient);
    const version = await this.requirePublishedGuarantorWarning();
    const existing = await prisma.legalExternalAcceptance.findUnique({
      where: sourceVersionWhere(recipient.id, version.id),
    });

    if (!existing) {
      throw new AppError(400, "OPEN_REQUIRED", "You must open the PDF before accepting this document");
    }
    if (existing.status === "ACCEPTED") return;

    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
    const documentType = version.legal_document.type as LegalDocumentType;

    await prisma.legalExternalAcceptance.update({
      where: { id: existing.id },
      data: {
        status: "ACCEPTED",
        accepted_at: new Date(),
        accepted_ip_address: ipAddress,
        accepted_user_agent: userAgent,
        accepted_device_info: deviceInfo,
        acknowledgement_text: LEGAL_DOCUMENT_CHECKBOX_WORDING[documentType],
        ...evidenceFromVersion(version),
        party_name: recipient.name,
        party_email: recipient.email,
        party_ic_number: recipient.ic_number,
      },
    });
  }

  private async requirePublishedGuarantorWarning(): Promise<VersionWithDocument> {
    const published = await this.getPublishedGuarantorWarning();
    if (!published) {
      throw new AppError(
        404,
        "LEGAL_DOCUMENT_UNAVAILABLE",
        "The guarantor warning statement is not available yet."
      );
    }
    return published;
  }

  private assertGuarantorIdentity(recipient: SigningRecipientParty) {
    if (recipient.role_key !== "guarantor") {
      throw new AppError(403, "FORBIDDEN", "This document is only required for guarantors.");
    }
    if (!recipient.ic_number?.trim()) {
      throw new AppError(403, "ACCESS_CODE_REQUIRED", "Verify your IC number before continuing.");
    }
  }
}

export const legalExternalAcceptanceService = new LegalExternalAcceptanceService();
