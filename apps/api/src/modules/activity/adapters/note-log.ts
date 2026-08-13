import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
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

type SupportedPortal = "investor" | "issuer";

const SHARED_EVENT_TYPES = [
  "NOTE_FUNDING_FAILED",
  "NOTE_ACTIVATED",
  "NOTE_MARKED_DEFAULT",
] as const;
const ISSUER_ONLY_EVENT_TYPES = [
  "NOTE_CREATED",
  "NOTE_PUBLISHED",
  "NOTE_FUNDING_CLOSED",
  "REPAYMENT_SUBMITTED",
  "DISBURSEMENT_COMPLETED",
] as const;
const INVESTOR_ONLY_EVENT_TYPES = ["INVESTMENT_COMMITTED", "SETTLEMENT_POSTED"] as const;

const ALL_NOTE_EVENT_TYPES = [
  ...SHARED_EVENT_TYPES,
  ...ISSUER_ONLY_EVENT_TYPES,
  ...INVESTOR_ONLY_EVENT_TYPES,
] as const;

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

  transform(record: NoteActivityRecord): UnifiedActivity {
    const metadata = (record.metadata as Record<string, unknown> | null) ?? {};
    const presentation = this.buildPresentation(record.event_type, {
      ...metadata,
      noteReference: record.noteReference,
      noteTitle: record.noteTitle,
    });

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

  buildPresentation(eventType: string, metadata?: Record<string, unknown>) {
    const noteLabel = this.getNoteLabel(metadata);

    switch (eventType) {
      case "NOTE_CREATED":
        return {
          title: "Note Created",
          description: noteLabel
            ? `${this.capitalize(noteLabel)} was created from an approved invoice and can now be prepared for listing.`
            : "A new note was created from an approved invoice and can now be prepared for listing.",
        };
      case "NOTE_PUBLISHED":
        return {
          title: "Note Published",
          description: noteLabel
            ? `${this.capitalize(noteLabel)} is now live and open for investment.`
            : "The note is now live and open for investment.",
        };
      case "NOTE_FUNDING_CLOSED":
        return {
          title: "Funding Closed",
          description: noteLabel
            ? `${this.capitalize(noteLabel)} completed funding and disbursement can proceed.`
            : "Funding completed and disbursement can proceed.",
        };
      case "NOTE_FUNDING_FAILED":
        return {
          title: "Funding Unsuccessful",
          description: noteLabel
            ? `${this.capitalize(noteLabel)} did not meet the minimum funding threshold and committed funds were released.`
            : "The note did not meet the minimum funding threshold and committed funds were released.",
        };
      case "NOTE_ACTIVATED":
        return {
          title: "Note Active",
          description: noteLabel
            ? `${this.capitalize(noteLabel)} is now active and servicing has started.`
            : "The note is now active and servicing has started.",
        };
      case "DISBURSEMENT_COMPLETED":
        return {
          title: "Disbursement Completed",
          description: noteLabel
            ? `Issuer disbursement for ${noteLabel} was marked complete.`
            : "Issuer disbursement was marked complete.",
        };
      case "REPAYMENT_SUBMITTED":
        return {
          title: "Payment Submitted",
          description: noteLabel
            ? `A repayment for ${noteLabel} was submitted and is awaiting review.`
            : "A repayment was submitted and is awaiting review.",
        };
      case "INVESTMENT_COMMITTED":
        return {
          title: "Investment Committed",
          description: noteLabel
            ? `Your investment in ${noteLabel} was committed successfully.`
            : "Your investment was committed successfully.",
        };
      case "SETTLEMENT_POSTED":
        return {
          title: "Settlement Posted",
          description: noteLabel
            ? `Your returns for ${noteLabel} were posted.`
            : "Your returns for the note were posted.",
        };
      case "NOTE_MARKED_DEFAULT":
        return {
          title: "Note Defaulted",
          description: noteLabel
            ? `${this.capitalize(noteLabel)} was marked in default and requires attention.`
            : "The note was marked in default and requires attention.",
        };
      default:
        return {
          title: "Note Update",
          description: "A note update was recorded for your organization.",
        };
    }
  }

  getEventTypes(): string[] {
    return [...ALL_NOTE_EVENT_TYPES];
  }

  private async collectVisibleRecords(
    userId: string,
    filters: ActivityFilters,
    targetCount?: number
  ): Promise<NoteActivityRecord[]> {
    const { limit } = filters;
    const supportedTypes = this.getPortalEventTypes(filters.portalType);
    const supportedTypeSet = new Set<string>(supportedTypes);
    const filteredTypes = filters.event_types
      ? filters.event_types.filter((eventType) => supportedTypeSet.has(eventType))
      : supportedTypes;

    if (filteredTypes.length === 0) {
      return [];
    }

    const batchSize = Math.max(limit ?? DEFAULT_BATCH_SIZE, DEFAULT_BATCH_SIZE);
    const visible: NoteActivityRecord[] = [];
    let skip = 0;
    const noteLabels = new Map<string, { noteReference: string | null; noteTitle: string | null }>();

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
          select: { id: true, note_reference: true, title: true },
        });
        for (const note of notes) {
          noteLabels.set(note.id, { noteReference: note.note_reference, noteTitle: note.title });
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

      const visibleBatch = this.filterVisibleRecords(hydrated, filters);
      visible.push(...visibleBatch);

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
      const matchingEventTypes = this.buildSearchEventTypes(search, eventTypes);
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

  private filterVisibleRecords(records: NoteActivityRecord[], filters: ActivityFilters) {
    return records.filter((record) => this.isVisibleRecord(record, filters));
  }

  private isVisibleRecord(record: NoteActivityRecord, filters: ActivityFilters) {
    const portalType = filters.portalType;
    const organizationId = filters.organizationId;
    const metadata = (record.metadata as Record<string, unknown> | null) ?? {};

    if (portalType === "issuer") {
      return this.isIssuerVisibleEvent(record.event_type);
    }

    if (portalType === "investor") {
      if (record.event_type === "INVESTMENT_COMMITTED") {
        return (
          organizationId != null &&
          this.getMetadataString(metadata, "investorOrganizationId") === organizationId
        );
      }

      return this.isInvestorVisibleEvent(record.event_type);
    }

    return true;
  }

  private isIssuerVisibleEvent(eventType: string) {
    return (
      SHARED_EVENT_TYPES.includes(eventType as (typeof SHARED_EVENT_TYPES)[number]) ||
      ISSUER_ONLY_EVENT_TYPES.includes(eventType as (typeof ISSUER_ONLY_EVENT_TYPES)[number])
    );
  }

  private isInvestorVisibleEvent(eventType: string) {
    return (
      SHARED_EVENT_TYPES.includes(eventType as (typeof SHARED_EVENT_TYPES)[number]) ||
      INVESTOR_ONLY_EVENT_TYPES.includes(eventType as (typeof INVESTOR_ONLY_EVENT_TYPES)[number])
    );
  }

  private getPortalEventTypes(portalType?: SupportedPortal) {
    if (portalType === "issuer") {
      return [...SHARED_EVENT_TYPES, ...ISSUER_ONLY_EVENT_TYPES];
    }

    if (portalType === "investor") {
      return [...SHARED_EVENT_TYPES, ...INVESTOR_ONLY_EVENT_TYPES];
    }

    return [...ALL_NOTE_EVENT_TYPES];
  }

  private buildSearchEventTypes(search: string, eventTypes: string[]) {
    const searchTerm = search.toLowerCase();

    return eventTypes.filter((eventType) => {
      const presentation = this.buildPresentation(eventType);
      return (
        presentation.title.toLowerCase().includes(searchTerm) ||
        presentation.description.toLowerCase().includes(searchTerm)
      );
    });
  }

  private getNoteLabel(metadata?: Record<string, unknown>) {
    const noteReference = this.getMetadataString(metadata, "noteReference");
    if (noteReference) {
      return `note ${noteReference}`;
    }

    const noteTitle = this.getMetadataString(metadata, "noteTitle");
    if (noteTitle) {
      return `note ${noteTitle}`;
    }

    return undefined;
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

  private capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
