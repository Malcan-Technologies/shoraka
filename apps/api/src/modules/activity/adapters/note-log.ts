import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  audienceFromPortal,
  formatNoteActivity,
  getNoteActivityEventTypes,
  isIssuerNoteTermsVisible,
  isNoteActivityVisible,
  settlementHasInvestorAllocation,
  type ActivityAudience,
} from "@cashsouk/types";
import {
  AuditLogAdapter,
  ActivityFilters,
  UnifiedActivity,
  buildDateFilter,
} from "./base";

type NoteActivityRecord = Prisma.NoteAuditLogGetPayload<object> & {
  noteReference: string | null;
  noteTitle: string | null;
};

type NoteVisibilityLabel = {
  noteReference: string | null;
  noteTitle: string | null;
  publishedAt: Date | null;
  listingStatus: string | null;
};

const DEFAULT_BATCH_SIZE = 50;

export class NoteLogAdapter implements AuditLogAdapter<NoteActivityRecord> {
  public readonly name = "NoteLogAdapter";
  public readonly category = "organization" as const;
  public readonly domain = "note" as const;

  async query(userId: string, filters: ActivityFilters): Promise<NoteActivityRecord[]> {
    const { limit, offset = 0 } = filters;
    const targetCount = limit == null ? undefined : offset + limit;
    const visible = await this.collectVisibleRecords(userId, filters, targetCount);

    if (limit == null) {
      return visible.slice(offset);
    }

    return visible.slice(offset, offset + limit);
  }

  async count(userId: string, filters: ActivityFilters): Promise<number> {
    const visible = await this.collectVisibleRecords(userId, {
      ...filters,
      limit: undefined,
      offset: 0,
    });
    return visible.length;
  }

  transform(record: NoteActivityRecord, filters?: ActivityFilters): UnifiedActivity {
    const metadata = (record.metadata as Record<string, unknown> | null) ?? {};
    const presentation = this.buildPresentation(
      record.event_type,
      {
        ...metadata,
        noteReference: record.noteReference,
        noteTitle: record.noteTitle,
      },
      filters ? this.audienceOf(filters) : "issuer"
    );

    return {
      id: record.id,
      user_id: record.actor_user_id ?? "",
      category: this.category,
      domain: this.domain,
      event_type: record.event_type,
      activity: presentation.title,
      title: presentation.title,
      description: presentation.description,
      metadata,
      ip_address: record.ip_address,
      user_agent: record.user_agent,
      created_at: record.occurred_at,
      source_table: "note_audit_logs",
    };
  }

  buildPresentation(
    eventType: string,
    metadata?: Record<string, unknown>,
    audience: ActivityAudience = "issuer"
  ) {
    return formatNoteActivity(audience, eventType, metadata, {
      noteReference: this.getMetadataString(metadata, "noteReference"),
      noteTitle: this.getMetadataString(metadata, "noteTitle"),
    });
  }

  getEventTypes(): string[] {
    return Array.from(
      new Set([
        ...getNoteActivityEventTypes("issuer"),
        ...getNoteActivityEventTypes("investor"),
      ])
    );
  }

  private async collectVisibleRecords(
    userId: string,
    filters: ActivityFilters,
    targetCount?: number
  ): Promise<NoteActivityRecord[]> {
    const { limit } = filters;
    const supportedTypes = getNoteActivityEventTypes(this.audienceOf(filters));
    const supportedTypeSet = new Set<string>(supportedTypes);
    const filteredTypes = filters.event_types
      ? filters.event_types.filter((eventType) => supportedTypeSet.has(eventType))
      : supportedTypes;

    if (filteredTypes.length === 0) {
      return [];
    }

    const committedNoteIds = await this.getCommittedNoteIds(filters);
    const batchSize = Math.max(limit ?? DEFAULT_BATCH_SIZE, DEFAULT_BATCH_SIZE);
    const visible: NoteActivityRecord[] = [];
    let skip = 0;
    const noteLabels = new Map<string, NoteVisibilityLabel>();
    const settlementSnapshots = new Map<string, unknown>();

    while (targetCount == null || visible.length < targetCount) {
      const records = await prisma.noteAuditLog.findMany({
        where: await this.buildWhereClause(userId, filters, filteredTypes),
        orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
        skip,
        take: batchSize,
      });

      if (records.length === 0) {
        break;
      }

      const missingNoteIds = Array.from(
        new Set(
          records
            .map((record) => record.note_id)
            .filter((noteId): noteId is string => typeof noteId === "string" && !noteLabels.has(noteId))
        )
      );
      if (missingNoteIds.length > 0) {
        const notes = await prisma.note.findMany({
          where: { id: { in: missingNoteIds } },
          select: {
            id: true,
            note_reference: true,
            title: true,
            published_at: true,
            listing_status: true,
          },
        });
        for (const note of notes) {
          noteLabels.set(note.id, {
            noteReference: note.note_reference,
            noteTitle: note.title,
            publishedAt: note.published_at,
            listingStatus: note.listing_status,
          });
        }
      }

      const missingSettlementIds = Array.from(
        new Set(
          records
            .filter((record) => record.event_type === "SETTLEMENT_POSTED")
            .map((record) =>
              this.getMetadataString((record.metadata as Record<string, unknown> | null) ?? {}, "settlementId")
            )
            .filter((settlementId): settlementId is string => {
              if (!settlementId) return false;
              return !settlementSnapshots.has(settlementId);
            })
        )
      );
      if (missingSettlementIds.length > 0) {
        const settlements = await prisma.noteSettlement.findMany({
          where: { id: { in: missingSettlementIds } },
          select: { id: true, preview_snapshot: true },
        });
        for (const settlement of settlements) {
          settlementSnapshots.set(settlement.id, settlement.preview_snapshot);
        }
      }

      const hydrated = records.map((record) => {
        const labels = record.note_id ? noteLabels.get(record.note_id) : undefined;
        return {
          ...record,
          noteReference: labels?.noteReference ?? null,
          noteTitle: labels?.noteTitle ?? null,
        };
      });

      for (const record of hydrated) {
        if (
          this.isVisibleRecord(record, filters, {
            note: record.note_id ? noteLabels.get(record.note_id) : undefined,
            committedNoteIds,
            settlementSnapshots,
          })
        ) {
          visible.push(record);
        }
      }

      if (records.length < batchSize) {
        break;
      }

      skip += records.length;
    }

    return visible;
  }

  private async buildWhereClause(
    userId: string,
    filters: ActivityFilters,
    eventTypes: string[]
  ): Promise<Prisma.NoteAuditLogWhereInput> {
    const { search, startDate, endDate, organizationId, portalType } = filters;
    const where: Prisma.NoteAuditLogWhereInput = {
      event_type: { in: eventTypes },
      occurred_at: buildDateFilter(startDate, endDate),
    };

    if (organizationId && portalType === "issuer") {
      where.organization_id = organizationId;
    } else if (organizationId && portalType === "investor") {
      const investments = await prisma.noteInvestment.findMany({
        where: { investor_organization_id: organizationId },
        select: { note_id: true },
        distinct: ["note_id"],
      });
      where.note_id = { in: investments.map((row) => row.note_id) };
    } else {
      where.actor_user_id = userId;
    }

    if (search) {
      const matchingEventTypes = this.buildSearchEventTypes(search, eventTypes, filters);
      const notes = await prisma.note.findMany({
        where: {
          OR: [
            { note_reference: { contains: search, mode: "insensitive" } },
            { title: { contains: search, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      where.OR = [
        { event_type: { contains: search, mode: "insensitive" } },
        { event_type: { in: matchingEventTypes } },
        { note_id: { in: notes.map((note) => note.id) } },
      ];
    }

    return where;
  }

  private isVisibleRecord(
    record: NoteActivityRecord,
    filters: ActivityFilters,
    context: {
      note?: NoteVisibilityLabel;
      committedNoteIds: Set<string>;
      settlementSnapshots: Map<string, unknown>;
    }
  ) {
    const metadata = (record.metadata as Record<string, unknown> | null) ?? {};
    const settlementId = this.getMetadataString(metadata, "settlementId");

    return isNoteActivityVisible(this.audienceOf(filters), record.event_type, metadata, {
      organizationId: filters.organizationId,
      noteVisibleToIssuer: isIssuerNoteTermsVisible({
        publishedAt: context.note?.publishedAt,
        listingStatus: context.note?.listingStatus,
      }),
      investorCommitted: record.note_id != null && context.committedNoteIds.has(record.note_id),
      settlementHasInvestorAllocation: settlementHasInvestorAllocation(
        settlementId ? context.settlementSnapshots.get(settlementId) : undefined,
        filters.organizationId
      ),
    });
  }

  private audienceOf(filters: ActivityFilters): ActivityAudience {
    return audienceFromPortal(filters.portalType);
  }

  private async getCommittedNoteIds(filters: ActivityFilters): Promise<Set<string>> {
    if (filters.portalType !== "investor" || !filters.organizationId) {
      return new Set();
    }

    const investments = await prisma.noteInvestment.findMany({
      where: { investor_organization_id: filters.organizationId },
      select: { note_id: true },
      distinct: ["note_id"],
    });
    return new Set(investments.map((row) => row.note_id));
  }

  private buildSearchEventTypes(search: string, eventTypes: string[], filters: ActivityFilters) {
    const searchTerm = search.toLowerCase();

    return eventTypes.filter((eventType) => {
      const presentation = this.buildPresentation(eventType, {}, this.audienceOf(filters));
      return (
        presentation.title.toLowerCase().includes(searchTerm) ||
        presentation.description.toLowerCase().includes(searchTerm)
      );
    });
  }

  private getMetadataString(metadata: unknown, key: string) {
    if (!metadata || typeof metadata !== "object") {
      return undefined;
    }

    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
