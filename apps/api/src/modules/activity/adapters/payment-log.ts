import { prisma } from "../../../lib/prisma";
import { PaymentAuditLog, Prisma } from "@prisma/client";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import {
  audienceFromPortal,
  formatPaymentActivity,
  getPaymentActivityEventTypes,
  isPaymentActivityVisible,
  type ActivityAudience,
} from "@cashsouk/types";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  buildDateFilter,
} from "./base";
import { collectVisibleRecords } from "./visible-query";

export class PaymentLogAdapter implements AuditLogAdapter<PaymentAuditLog> {
  public readonly name = "PaymentLogAdapter";
  public readonly category = "organization" as const;
  public readonly domain = "payment" as const;

  async query(_userId: string, filters: ActivityFilters): Promise<PaymentAuditLog[]> {
    const eventTypes = this.resolveEventTypes(filters);
    if (eventTypes.length === 0 || !filters.organizationId) return [];

    return collectVisibleRecords(
      (skip, take) =>
        prisma.paymentAuditLog.findMany({
          where: this.buildWhere(filters, eventTypes),
          orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
          skip,
          take,
        }),
      (record) => this.isVisible(record, filters),
      { offset: filters.offset, limit: filters.limit }
    );
  }

  async count(_userId: string, filters: ActivityFilters): Promise<number> {
    const records = await this.query(_userId, { ...filters, limit: undefined, offset: 0 });
    return records.length;
  }

  transform(record: PaymentAuditLog, filters?: ActivityFilters): UnifiedActivity {
    const metadata = (record.metadata as Record<string, unknown> | null) ?? {};
    const presentation = this.buildPresentation(
      record.event_type,
      metadata,
      filters ? this.audienceOf(filters) : "investor"
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
      device_info: formatDeviceInfoFromUserAgent(record.user_agent),
      created_at: record.occurred_at,
      source_table: "payment_audit_logs",
    };
  }

  buildPresentation(
    eventType: string,
    metadata?: Record<string, unknown>,
    audience: ActivityAudience = "investor"
  ) {
    return formatPaymentActivity(audience, eventType, metadata);
  }

  getEventTypes(): string[] {
    return getPaymentActivityEventTypes("investor");
  }

  private resolveEventTypes(filters: ActivityFilters): string[] {
    const supported = getPaymentActivityEventTypes(this.audienceOf(filters));
    if (!filters.event_types?.length) return supported;
    return filters.event_types.filter((eventType) => supported.includes(eventType));
  }

  private audienceOf(filters: ActivityFilters): ActivityAudience {
    return audienceFromPortal(filters.portalType);
  }

  private buildWhere(
    filters: ActivityFilters,
    eventTypes: string[]
  ): Prisma.PaymentAuditLogWhereInput {
    const { search, startDate, endDate, organizationId } = filters;
    const where: Prisma.PaymentAuditLogWhereInput = {
      event_type: { in: eventTypes },
      organization_id: organizationId,
      organization_kind: "INVESTOR",
      occurred_at: buildDateFilter(startDate, endDate),
    };

    if (search) {
      const matchingEventTypes = eventTypes.filter((eventType) => {
        const presentation = this.buildPresentation(eventType, {}, this.audienceOf(filters));
        const searchTerm = search.toLowerCase();
        return (
          presentation.title.toLowerCase().includes(searchTerm) ||
          presentation.description.toLowerCase().includes(searchTerm)
        );
      });
      where.OR = [
        { event_type: { contains: search, mode: "insensitive" } },
        { event_type: { in: matchingEventTypes } },
      ];
    }

    return where;
  }

  private isVisible(record: PaymentAuditLog, filters: ActivityFilters): boolean {
    return isPaymentActivityVisible(this.audienceOf(filters), record.event_type, {
      organizationId: filters.organizationId,
      ownerOrganizationId: record.organization_id,
    });
  }
}
