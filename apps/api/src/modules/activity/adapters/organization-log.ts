import { prisma } from "../../../lib/prisma";
import { OnboardingAuditLog, Prisma } from "@prisma/client";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import {
  audienceFromPortal,
  formatOnboardingActivity,
  getOnboardingActivityEventTypes,
  isOnboardingActivityVisible,
  type ActivityAudience,
} from "@cashsouk/types";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  ActivityCategory,
  buildDateFilter,
} from "./base";
import { collectVisibleRecords } from "./visible-query";

export class OrganizationLogAdapter implements AuditLogAdapter<OnboardingAuditLog> {
  public readonly name = "OrganizationLogAdapter";
  public readonly category: ActivityCategory = "organization";
  public readonly domain = "onboarding" as const;

  async query(userId: string, filters: ActivityFilters): Promise<OnboardingAuditLog[]> {
    const eventTypes = this.resolveEventTypes(filters);
    if (eventTypes.length === 0) return [];

    return collectVisibleRecords(
      (skip, take) =>
        prisma.onboardingAuditLog.findMany({
          where: this.buildWhere(userId, filters, eventTypes),
          orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
          skip,
          take,
        }),
      (record) => this.isVisible(record, filters),
      { offset: filters.offset, limit: filters.limit }
    );
  }

  async count(userId: string, filters: ActivityFilters): Promise<number> {
    const records = await this.query(userId, { ...filters, limit: undefined, offset: 0 });
    return records.length;
  }

  transform(record: OnboardingAuditLog, filters?: ActivityFilters): UnifiedActivity {
    const metadata = record.metadata as Record<string, unknown>;
    const presentation = this.buildPresentation(
      record.event_type,
      metadata,
      filters ? this.audienceOf(filters) : "issuer"
    );

    return {
      id: record.id,
      user_id: record.subject_user_id ?? "",
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
      source_table: "onboarding_audit_logs",
    };
  }

  buildPresentation(
    eventType: string,
    metadata?: Record<string, unknown>,
    audience: ActivityAudience = "issuer"
  ) {
    return formatOnboardingActivity(audience, eventType, metadata);
  }

  getEventTypes(): string[] {
    return Array.from(
      new Set([
        ...getOnboardingActivityEventTypes("issuer"),
        ...getOnboardingActivityEventTypes("investor"),
      ])
    );
  }

  private resolveEventTypes(filters: ActivityFilters): string[] {
    const audience = this.audienceOf(filters);
    const supported = getOnboardingActivityEventTypes(audience);
    if (!filters.event_types?.length) return supported;
    return filters.event_types.filter((eventType) => supported.includes(eventType));
  }

  private audienceOf(filters: ActivityFilters): ActivityAudience {
    return audienceFromPortal(filters.portalType);
  }

  private buildWhere(
    userId: string,
    filters: ActivityFilters,
    eventTypes: string[]
  ): Prisma.OnboardingAuditLogWhereInput {
    const { search, startDate, endDate, organizationId } = filters;
    const where: Prisma.OnboardingAuditLogWhereInput = {
      event_type: { in: eventTypes },
      occurred_at: buildDateFilter(startDate, endDate),
    };

    if (organizationId) {
      where.organization_id = organizationId;
    } else {
      where.subject_user_id = userId;
    }

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

  private isVisible(record: OnboardingAuditLog, filters: ActivityFilters): boolean {
    return isOnboardingActivityVisible(
      this.audienceOf(filters),
      record.event_type,
      (record.metadata as Record<string, unknown> | null) ?? {},
      {
        organizationKind: record.organization_kind,
        organizationType: record.organization_type,
      }
    );
  }
}
