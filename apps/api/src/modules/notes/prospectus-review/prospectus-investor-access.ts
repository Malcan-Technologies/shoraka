/**
 * SECTION: Investor published Prospectus access (frozen PDF via private S3)
 */

import { NoteStatus } from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import { prisma } from "../../../lib/prisma";
import {
  generateProspectusPdfViewUrl,
  PROSPECTUS_PDF_STATUS_READY,
  prospectusPdfFileName,
} from "../prospectus/prospectus-pdf";
import { parseApprovedSnapshot } from "./prospectus-approved-snapshot";

export type InvestorProspectusPdf = {
  publicationId: string;
  contentVersion: number;
  pdfViewUrl: string;
  pdfExpiresIn: number;
  pdfContentType: "application/pdf";
  pdfFileName: string;
  pdfSha256: string | null;
  pdfSnapshotHash: string | null;
};

async function resolveReadyPublicationPdf(
  publication: {
    id: string;
    content_version: number;
    published_at: Date | null;
    pdf_generation_status: string | null;
    pdf_storage_key: string | null;
    pdf_sha256: string | null;
    pdf_snapshot_hash: string | null;
    note_id: string;
  },
  options: { requirePublishedAt?: boolean } = {}
): Promise<InvestorProspectusPdf> {
  if (options.requirePublishedAt !== false && !publication.published_at) {
    throw new AppError(404, "PROSPECTUS_NOT_FOUND", "Published Prospectus not found");
  }
  if (
    publication.pdf_generation_status !== PROSPECTUS_PDF_STATUS_READY ||
    !publication.pdf_storage_key
  ) {
    throw new AppError(
      404,
      "PROSPECTUS_PDF_UNAVAILABLE",
      "Prospectus PDF is not available"
    );
  }

  const note = await prisma.note.findUnique({
    where: { id: publication.note_id },
    select: { note_reference: true },
  });
  const fileName = prospectusPdfFileName(note?.note_reference);
  const { viewUrl, expiresIn } = await generateProspectusPdfViewUrl({
    storageKey: publication.pdf_storage_key,
    fileName,
  });

  return {
    publicationId: publication.id,
    contentVersion: publication.content_version,
    pdfViewUrl: viewUrl,
    pdfExpiresIn: expiresIn,
    pdfContentType: "application/pdf",
    pdfFileName: fileName,
    pdfSha256: publication.pdf_sha256,
    pdfSnapshotHash: publication.pdf_snapshot_hash,
  };
}

/** Marketplace: published Note only — signed URL to frozen approved PDF. */
export async function getMarketplacePublishedProspectus(
  noteId: string
): Promise<InvestorProspectusPdf> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      status: true,
      published_at: true,
      prospectus_review: {
        select: { status: true, approved_publication_id: true },
      },
    },
  });
  if (!note || note.status !== NoteStatus.PUBLISHED || !note.published_at) {
    throw new AppError(404, "PROSPECTUS_NOT_FOUND", "Published Prospectus not found");
  }

  const publication = await prisma.noteProspectusPublication.findFirst({
    where: {
      note_id: noteId,
      published_at: { not: null },
      ...(note.prospectus_review?.approved_publication_id
        ? { id: note.prospectus_review.approved_publication_id }
        : {}),
    },
    orderBy: { published_at: "desc" },
  });
  if (!publication) {
    throw new AppError(404, "PROSPECTUS_NOT_FOUND", "Published Prospectus not found");
  }

  // Ensure frozen HTML still exists (audit source) even though investor receives PDF.
  const snapshot = parseApprovedSnapshot(publication.snapshot);
  if (!snapshot?.html?.page1) {
    throw new AppError(404, "PROSPECTUS_NOT_FOUND", "Published Prospectus not found");
  }

  return resolveReadyPublicationPdf(publication);
}

/** Admin: frozen approved PDF, including before the note is listed on the marketplace. */
export async function getAdminApprovedProspectusPdf(noteId: string): Promise<InvestorProspectusPdf> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      prospectus_review: {
        select: { approved_publication_id: true },
      },
    },
  });
  if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");

  const publicationId = note.prospectus_review?.approved_publication_id;
  if (!publicationId) {
    throw new AppError(404, "PROSPECTUS_PDF_UNAVAILABLE", "Prospectus PDF is not available");
  }

  const publication = await prisma.noteProspectusPublication.findUnique({
    where: { id: publicationId },
  });
  if (!publication) {
    throw new AppError(404, "PROSPECTUS_PDF_UNAVAILABLE", "Prospectus PDF is not available");
  }

  return resolveReadyPublicationPdf(publication, { requirePublishedAt: false });
}

/**
 * Investment-scoped: resolve only via investment.prospectus_publication_id.
 * Never falls back to “current” Note prospectus.
 */
export async function getInvestmentPublishedProspectus(
  investmentId: string,
  actor: { userId: string }
): Promise<InvestorProspectusPdf & { noteId: string }> {
  const investment = await prisma.noteInvestment.findUnique({
    where: { id: investmentId },
    select: {
      id: true,
      note_id: true,
      investor_user_id: true,
      investor_organization_id: true,
      prospectus_publication_id: true,
    },
  });
  if (!investment) {
    throw new AppError(404, "INVESTMENT_NOT_FOUND", "Investment not found");
  }

  const orgAccess = await prisma.investorOrganization.findFirst({
    where: {
      id: investment.investor_organization_id,
      OR: [
        { owner_user_id: actor.userId },
        { members: { some: { user_id: actor.userId } } },
      ],
    },
    select: { id: true },
  });
  if (investment.investor_user_id !== actor.userId && !orgAccess) {
    throw new AppError(403, "INVESTMENT_FORBIDDEN", "Investment not accessible");
  }

  if (!investment.prospectus_publication_id) {
    throw new AppError(404, "PROSPECTUS_NOT_FOUND", "Prospectus reference missing for investment");
  }

  const publication = await prisma.noteProspectusPublication.findUnique({
    where: { id: investment.prospectus_publication_id },
  });
  if (!publication || !publication.published_at) {
    throw new AppError(404, "PROSPECTUS_NOT_FOUND", "Stored Prospectus publication not found");
  }
  if (publication.note_id !== investment.note_id) {
    throw new AppError(404, "PROSPECTUS_NOT_FOUND", "Stored Prospectus publication not found");
  }

  const snapshot = parseApprovedSnapshot(publication.snapshot);
  if (!snapshot?.html?.page1) {
    throw new AppError(404, "PROSPECTUS_NOT_FOUND", "Stored Prospectus publication not found");
  }

  const pdf = await resolveReadyPublicationPdf(publication);
  return {
    noteId: investment.note_id,
    ...pdf,
  };
}
