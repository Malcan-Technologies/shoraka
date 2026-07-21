/**
 * SECTION: Investor published Prospectus access (frozen snapshot only)
 */

import { NoteStatus } from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import { prisma } from "../../../lib/prisma";
import { combineProspectusPagesHtml } from "../prospectus/combine-prospectus-pages-html";
import { parseApprovedSnapshot } from "./prospectus-approved-snapshot";

export type InvestorProspectusHtml = {
  publicationId: string;
  contentVersion: number;
  html: { page1: string; page2: string; page3: string };
};

/** Marketplace: published Note only — render frozen snapshot HTML. */
export async function getMarketplacePublishedProspectus(
  noteId: string
): Promise<InvestorProspectusHtml & { documentHtml: string }> {
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

  const snapshot = parseApprovedSnapshot(publication.snapshot);
  if (!snapshot?.html?.page1) {
    throw new AppError(404, "PROSPECTUS_NOT_FOUND", "Published Prospectus not found");
  }

  return {
    publicationId: publication.id,
    contentVersion: publication.content_version,
    html: snapshot.html,
    documentHtml: combineProspectusPagesHtml(snapshot.html),
  };
}

/**
 * Investment-scoped: resolve only via investment.prospectus_publication_id.
 * Never falls back to “current” Note prospectus.
 */
export async function getInvestmentPublishedProspectus(
  investmentId: string,
  actor: { userId: string }
): Promise<InvestorProspectusHtml & { documentHtml: string; noteId: string }> {
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

  return {
    noteId: investment.note_id,
    publicationId: publication.id,
    contentVersion: publication.content_version,
    html: snapshot.html,
    documentHtml: combineProspectusPagesHtml(snapshot.html),
  };
}
