import {
  NoteFundingStatus,
  NoteListingStatus,
  NoteServicingStatus,
  NoteStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { GetNotesQuery } from "./schemas";

export const noteInclude = {
  listing: true,
  investments: { orderBy: { committed_at: "desc" as const } },
  payment_schedules: { orderBy: { sequence: "asc" as const } },
  payments: { orderBy: { receipt_date: "desc" as const } },
  settlements: { orderBy: { created_at: "desc" as const } },
  events: { orderBy: { created_at: "desc" as const }, take: 50 },
};

export class NoteRepository {
  list(params: GetNotesQuery) {
    const { page, pageSize, search, status, listingStatus, fundingStatus, servicingStatus, issuerOrganizationId, paymaster } = params;
    const where: Prisma.NoteWhereInput = {};

    if (status) where.status = status;
    if (listingStatus) where.listing_status = listingStatus;
    if (fundingStatus) where.funding_status = fundingStatus;
    if (servicingStatus) where.servicing_status = servicingStatus;
    if (issuerOrganizationId) where.issuer_organization_id = issuerOrganizationId;

    const and: Prisma.NoteWhereInput[] = [];
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { note_reference: { contains: search, mode: "insensitive" } },
          { source_application_id: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (paymaster) {
      and.push({
        paymaster_snapshot: {
          path: ["name"],
          string_contains: paymaster,
        },
      });
    }
    if (and.length > 0) where.AND = and;

    return prisma.$transaction(async (tx) => {
      const [notes, totalCount] = await Promise.all([
        tx.note.findMany({
          where,
          include: noteInclude,
          orderBy: { updated_at: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.note.count({ where }),
      ]);
      return { notes, totalCount };
    });
  }

  findById(id: string) {
    return prisma.note.findUnique({
      where: { id },
      include: noteInclude,
    });
  }

  findBySource(applicationId: string, invoiceId?: string | null) {
    return prisma.note.findFirst({
      where: {
        source_application_id: applicationId,
        source_invoice_id: invoiceId ?? null,
      },
      include: noteInclude,
    });
  }

  create(data: Prisma.NoteCreateInput) {
    return prisma.note.create({
      data,
      include: noteInclude,
    });
  }

  updateDraft(id: string, data: Prisma.NoteUpdateInput) {
    return prisma.note.update({
      where: { id },
      data,
      include: noteInclude,
    });
  }

  updateState(
    id: string,
    data: {
      status?: NoteStatus;
      listing_status?: NoteListingStatus;
      funding_status?: NoteFundingStatus;
      servicing_status?: NoteServicingStatus;
      published_at?: Date | null;
      funding_closed_at?: Date | null;
      activated_at?: Date | null;
      arrears_started_at?: Date | null;
      default_marked_at?: Date | null;
      default_marked_by_admin_user_id?: string | null;
      default_reason?: string | null;
    }
  ) {
    return prisma.note.update({
      where: { id },
      data,
      include: noteInclude,
    });
  }
}

export const noteRepository = new NoteRepository();
