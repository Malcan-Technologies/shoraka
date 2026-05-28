import { Prisma, WithdrawalType } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  AuditLogAdapter,
  ActivityFilters,
  UnifiedActivity,
  buildDateFilter,
} from "./base";

type NoteActivityRecord = Prisma.NoteEventGetPayload<{
  include: {
    note: {
      select: {
        id: true;
        issuer_organization_id: true;
        note_reference: true;
        title: true;
      };
    };
  };
}>;

type SupportedPortal = "investor" | "issuer";

const SHARED_EVENT_TYPES = ["FAIL_FUNDING", "ACTIVATE", "WITHDRAWAL_COMPLETED", "NOTE_DEFAULT_MARKED"] as const;
const ISSUER_ONLY_EVENT_TYPES = [
  "NOTE_CREATED_FROM_INVOICE",
  "PUBLISH",
  "CLOSE_FUNDING",
  "ISSUER_PAYMENT_SUBMITTED",
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
      noteReference: record.note.note_reference,
      noteTitle: record.note.title,
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
      created_at: record.created_at,
      source_table: "note_events",
    };
  }

  buildPresentation(eventType: string, metadata?: Record<string, unknown>) {
    const noteLabel = this.getNoteLabel(metadata);

    switch (eventType) {
      case "NOTE_CREATED_FROM_INVOICE":
        return {
          title: "Note Created",
          description: noteLabel
            ? `${this.capitalize(noteLabel)} was created from an approved invoice and can now be prepared for listing.`
            : "A new note was created from an approved invoice and can now be prepared for listing.",
        };
      case "PUBLISH":
        return {
          title: "Note Published",
          description: noteLabel
            ? `${this.capitalize(noteLabel)} is now live and open for investment.`
            : "The note is now live and open for investment.",
        };
      case "CLOSE_FUNDING":
        return {
          title: "Funding Closed",
          description: noteLabel
            ? `${this.capitalize(noteLabel)} completed funding and disbursement can proceed.`
            : "Funding completed and disbursement can proceed.",
        };
      case "FAIL_FUNDING":
        return {
          title: "Funding Unsuccessful",
          description: noteLabel
            ? `${this.capitalize(noteLabel)} did not meet the minimum funding threshold and committed funds were released.`
            : "The note did not meet the minimum funding threshold and committed funds were released.",
        };
      case "ACTIVATE":
      case "WITHDRAWAL_COMPLETED":
        return {
          title: "Note Active",
          description: noteLabel
            ? `${this.capitalize(noteLabel)} is now active and servicing has started.`
            : "The note is now active and servicing has started.",
        };
      case "ISSUER_PAYMENT_SUBMITTED":
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
      case "NOTE_DEFAULT_MARKED":
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

    // Records are post-filtered in memory because visibility depends on withdrawal type
    // and investor-specific commit metadata, which are not fully expressible in one query.
    while (targetCount == null || visible.length < targetCount) {
      const records = await prisma.noteEvent.findMany({
        where: this.buildWhereClause(userId, filters, filteredTypes),
        include: {
          note: {
            select: {
              id: true,
              issuer_organization_id: true,
              note_reference: true,
              title: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: batchSize,
      });

      if (records.length === 0) {
        break;
      }

      const visibleBatch = await this.filterVisibleRecords(records, filters);
      visible.push(...visibleBatch);

      if (records.length < batchSize) {
        break;
      }

      skip += records.length;
    }

    return visible;
  }

  private buildWhereClause(userId: string, filters: ActivityFilters, eventTypes: string[]): Prisma.NoteEventWhereInput {
    const { search, startDate, endDate, organizationId, portalType } = filters;
    const where: Prisma.NoteEventWhereInput = {
      event_type: { in: eventTypes },
      created_at: buildDateFilter(startDate, endDate),
    };

    if (organizationId && portalType === "issuer") {
      where.note = {
        is: {
          issuer_organization_id: organizationId,
        },
      };
    } else if (organizationId && portalType === "investor") {
      where.note = {
        is: {
          investments: {
            some: {
              investor_organization_id: organizationId,
            },
          },
        },
      };
    } else {
      where.actor_user_id = userId;
    }

    if (search) {
      const matchingEventTypes = this.buildSearchEventTypes(search, eventTypes);
      where.OR = [
        { event_type: { contains: search, mode: "insensitive" } },
        { event_type: { in: matchingEventTypes } },
        { note: { is: { note_reference: { contains: search, mode: "insensitive" } } } },
        { note: { is: { title: { contains: search, mode: "insensitive" } } } },
      ];
    }

    return where;
  }

  private async filterVisibleRecords(records: NoteActivityRecord[], filters: ActivityFilters) {
    const withdrawalTypeById = await this.getWithdrawalTypeById(records);

    return records.filter((record) => this.isVisibleRecord(record, filters, withdrawalTypeById));
  }

  private async getWithdrawalTypeById(records: NoteActivityRecord[]) {
    const withdrawalIds = Array.from(
      new Set(
        records
          .map((record) => this.getMetadataString(record.metadata, "withdrawalId"))
          .filter((withdrawalId): withdrawalId is string => Boolean(withdrawalId))
      )
    );

    if (withdrawalIds.length === 0) {
      return new Map<string, WithdrawalType>();
    }

    const withdrawals = await prisma.withdrawalInstruction.findMany({
      where: { id: { in: withdrawalIds } },
      select: {
        id: true,
        withdrawal_type: true,
      },
    });

    return new Map(withdrawals.map((withdrawal) => [withdrawal.id, withdrawal.withdrawal_type]));
  }

  private isVisibleRecord(
    record: NoteActivityRecord,
    filters: ActivityFilters,
    withdrawalTypeById: Map<string, WithdrawalType>
  ) {
    const portalType = filters.portalType;
    const organizationId = filters.organizationId;
    const metadata = (record.metadata as Record<string, unknown> | null) ?? {};

    if (record.event_type === "WITHDRAWAL_COMPLETED") {
      const withdrawalId = this.getMetadataString(metadata, "withdrawalId");
      return withdrawalId != null && withdrawalTypeById.get(withdrawalId) === WithdrawalType.ISSUER_DISBURSEMENT;
    }

    if (portalType === "issuer") {
      return this.isIssuerVisibleEvent(record.event_type);
    }

    if (portalType === "investor") {
      if (record.event_type === "INVESTMENT_COMMITTED") {
        return organizationId != null && this.getMetadataString(metadata, "investorOrganizationId") === organizationId;
      }

      return this.isInvestorVisibleEvent(record.event_type);
    }

    return true;
  }

  private isIssuerVisibleEvent(eventType: string) {
    return SHARED_EVENT_TYPES.includes(eventType as (typeof SHARED_EVENT_TYPES)[number]) ||
      ISSUER_ONLY_EVENT_TYPES.includes(eventType as (typeof ISSUER_ONLY_EVENT_TYPES)[number]);
  }

  private isInvestorVisibleEvent(eventType: string) {
    return SHARED_EVENT_TYPES.includes(eventType as (typeof SHARED_EVENT_TYPES)[number]) ||
      INVESTOR_ONLY_EVENT_TYPES.includes(eventType as (typeof INVESTOR_ONLY_EVENT_TYPES)[number]);
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
      const metadata =
        eventType === "WITHDRAWAL_COMPLETED" ? { withdrawalType: WithdrawalType.ISSUER_DISBURSEMENT } : undefined;
      const presentation = this.buildPresentation(eventType, metadata);

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
