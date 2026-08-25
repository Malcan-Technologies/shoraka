import {
  NoteFundingStatus,
  NoteListingStatus,
  NoteServicingStatus,
  NoteSettlementStatus,
  NoteStatus,
  Prisma,
  SettlementTrusteeInstructionStatus,
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
  prospectus_review: {
    select: {
      id: true,
      status: true,
      content_version: true,
      updated_at: true,
      approved_at: true,
      approved_publication_id: true,
    },
  },
};

export class NoteRepository {
  list(params: GetNotesQuery) {
    const {
      page,
      pageSize,
      search,
      status,
      listingStatus,
      fundingStatus,
      servicingStatus,
      issuerOrganizationId,
      paymaster,
      featuredOnly,
      includeClosed,
      excludeRepaid,
      excludeFullySettledRegistryNotes,
    } = params;
    const where: Prisma.NoteWhereInput = {};

    if (status) {
      where.status = status;
    } else if (excludeRepaid) {
      where.status = { not: NoteStatus.REPAID };
    }
    if (listingStatus) where.listing_status = listingStatus;
    if (fundingStatus) where.funding_status = fundingStatus;
    if (servicingStatus) where.servicing_status = servicingStatus;
    if (issuerOrganizationId) where.issuer_organization_id = issuerOrganizationId;

    const and: Prisma.NoteWhereInput[] = [];
    if (search) {
      const query = search.trim();
      const jsonSearchVariants = [...new Set([
        query,
        query.toLowerCase(),
        query.toUpperCase(),
        query.replace(/\b\w/g, (char) => char.toUpperCase()),
      ])];
      and.push({
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { note_reference: { contains: query, mode: "insensitive" } },
          { source_application_id: { contains: query, mode: "insensitive" } },
          ...jsonSearchVariants.map((variant) => ({
            issuer_snapshot: {
              path: ["name"],
              string_contains: variant,
            },
          })),
          ...jsonSearchVariants.map((variant) => ({
            issuer_snapshot: {
              path: ["industry"],
              string_contains: variant,
            },
          })),
          ...jsonSearchVariants.map((variant) => ({
            paymaster_snapshot: {
              path: ["name"],
              string_contains: variant,
            },
          })),
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
    if (includeClosed) {
      and.push({
        OR: [
          {
            status: NoteStatus.PUBLISHED,
            listing_status: NoteListingStatus.PUBLISHED,
            funding_status: NoteFundingStatus.OPEN,
          },
          {
            listing_status: NoteListingStatus.CLOSED,
            funding_status: { in: [NoteFundingStatus.FUNDED, NoteFundingStatus.FAILED] },
          },
        ],
      });
    }
    if (featuredOnly) {
      const now = new Date();
      and.push({
        is_featured: true,
        AND: [
          { OR: [{ featured_from: null }, { featured_from: { lte: now } }] },
          { OR: [{ featured_until: null }, { featured_until: { gte: now } }] },
        ],
      });
    }
    if (excludeFullySettledRegistryNotes) {
      const settlementTrusteeIncomplete: Prisma.NoteSettlementWhereInput = {
        status: NoteSettlementStatus.POSTED,
        AND: [
          {
            OR: [
              { investor_principal: { gt: new Prisma.Decimal("0.005") } },
              { investor_profit_net: { gt: new Prisma.Decimal("0.005") } },
              { tawidh_investor_amount: { gt: new Prisma.Decimal("0.005") } },
              { service_fee_amount: { gt: new Prisma.Decimal("0.005") } },
              { tawidh_account_amount: { gt: new Prisma.Decimal("0.005") } },
              { gharamah_amount: { gt: new Prisma.Decimal("0.005") } },
              { issuer_residual_amount: { gt: new Prisma.Decimal("0.005") } },
            ],
          },
          {
            OR: [
              { settlement_trustee_status: null },
              {
                settlement_trustee_status: {
                  not: SettlementTrusteeInstructionStatus.COMPLETED,
                },
              },
            ],
          },
        ],
      };
      and.push({
        NOT: {
          AND: [
            {
              OR: [
                { status: NoteStatus.REPAID },
                { servicing_status: NoteServicingStatus.SETTLED },
              ],
            },
            {
              settlements: {
                some: { status: NoteSettlementStatus.POSTED },
              },
            },
            {
              NOT: {
                settlements: {
                  some: settlementTrusteeIncomplete,
                },
              },
            },
          ],
        },
      });
    }
    if (and.length > 0) where.AND = and;

    const orderBy: Prisma.NoteOrderByWithRelationInput[] = featuredOnly
      ? [{ featured_rank: "asc" }, { updated_at: "desc" }]
      : [{ updated_at: "desc" }];

    return prisma.$transaction(async (tx) => {
      const [notes, totalCount] = await Promise.all([
        tx.note.findMany({
          where,
          include: noteInclude,
          orderBy,
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

  /**
   * Full, unlimited note event history for exports/audit — `noteInclude.events` is capped at
   * take:50 for the note-detail timeline's UI performance, but compliance/audit CSV exports
   * must never silently truncate. Ordering matches the timeline (sortAdminNoteEvents applies
   * the deterministic tie-break) since this returns raw rows, not pre-sorted ones.
   */
  findAllEventsByNoteId(noteId: string) {
    return prisma.noteEvent.findMany({
      where: { note_id: noteId },
      orderBy: { created_at: "desc" },
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
