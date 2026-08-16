import { prisma } from "../../../lib/prisma";
import { PaymentAuditLog, Prisma } from "@prisma/client";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import {
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

  transform(record: PaymentAuditLog): UnifiedActivity {
    const metadata = (record.metadata as Record<string, unknown> | null) ?? {};
    const presentation = this.buildPresentation(record.event_type, metadata);

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

  buildPresentation(eventType: string, _metadata?: Record<string, unknown>) {
    switch (eventType) {
      case "PAYMENT_FAILED":
        return {
          title: "Payment Failed",
          description: "A payment attempt did not complete.",
        };
      case "PAYMENT_EXPIRED":
        return {
          title: "Payment Expired",
          description: "A payment attempt expired before it was completed.",
        };
      case "PAYMENT_NAME_CHECK_REJECTED":
        return {
          title: "Payment Name Check Rejected",
          description: "A payment name check was rejected.",
        };
      case "INVESTOR_DEPOSIT_RECEIVED":
        return {
          title: "Deposit Received",
          description: "A deposit was received in your account.",
        };
      case "INVESTOR_WITHDRAWAL_REQUESTED":
        return {
          title: "Withdrawal Requested",
          description: "A withdrawal request was submitted.",
        };
      case "INVESTOR_WITHDRAWAL_SUBMITTED_TO_TRUSTEE":
        return {
          title: "Withdrawal Processing",
          description: "Your withdrawal request is being processed.",
        };
      case "INVESTOR_WITHDRAWAL_COMPLETED":
        return {
          title: "Withdrawal Completed",
          description: "A withdrawal was completed.",
        };
      case "PAYMENT_REFUND_INITIATED":
        return {
          title: "Refund Started",
          description: "A refund was started for one of your payments.",
        };
      case "PAYMENT_REFUNDED":
        return {
          title: "Payment Refunded",
          description: "A payment was refunded.",
        };
      default:
        return {
          title: eventType
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" "),
          description: "A payment update was recorded for your account.",
        };
    }
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
    return filters.portalType === "investor" ? "investor" : "issuer";
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
        const presentation = this.buildPresentation(eventType, {});
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
