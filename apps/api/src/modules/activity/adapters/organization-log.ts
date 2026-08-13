import { prisma } from "../../../lib/prisma";
import { OnboardingAuditLog, Prisma } from "@prisma/client";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  ActivityCategory,
  buildDateFilter,
} from "./base";

const CURATED_ORGANIZATION_ACTIVITY_EVENTS = [
  "ONBOARDING_STARTED",
  "ONBOARDING_RESUMED",
  "ONBOARDING_RESTARTED",
  "ONBOARDING_REJECTED",
  "ONBOARDING_APPROVED",
  "ONBOARDING_FINAL_APPROVAL_COMPLETED",
  "ONBOARDING_COMPLETED",
] as const;

export class OrganizationLogAdapter implements AuditLogAdapter<OnboardingAuditLog> {
  public readonly name = "OrganizationLogAdapter";
  public readonly category: ActivityCategory = "organization";
  public readonly domain = "onboarding" as const;

  async query(
    userId: string,
    filters: ActivityFilters
  ): Promise<OnboardingAuditLog[]> {
    const { search, event_types, startDate, endDate, limit, offset, organizationId } = filters;
    const supportedTypes = this.getEventTypes();

    const finalEventTypes = event_types
      ? event_types.filter((et) => supportedTypes.includes(et))
      : supportedTypes;

    const where: Prisma.OnboardingAuditLogWhereInput = {
      event_type: { in: finalEventTypes },
      occurred_at: buildDateFilter(startDate, endDate),
    };

    if (organizationId) {
      where.organization_id = organizationId;
    } else {
      where.subject_user_id = userId;
    }

    const matchingEventTypes = search
      ? finalEventTypes.filter((et) => {
          const presentation = this.buildPresentation(et, {});
          const searchTerm = search.toLowerCase();
          return (
            presentation.title.toLowerCase().includes(searchTerm) ||
            presentation.description.toLowerCase().includes(searchTerm)
          );
        })
      : [];

    if (search) {
      where.OR = [
        { event_type: { contains: search, mode: "insensitive" } },
        { event_type: { in: matchingEventTypes } },
      ];
    }

    return prisma.onboardingAuditLog.findMany({
      where,
      orderBy: { occurred_at: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async count(userId: string, filters: ActivityFilters): Promise<number> {
    const { search, event_types, startDate, endDate, organizationId } = filters;
    const supportedTypes = this.getEventTypes();

    const finalEventTypes = event_types
      ? event_types.filter((et) => supportedTypes.includes(et))
      : supportedTypes;

    const where: Prisma.OnboardingAuditLogWhereInput = {
      event_type: { in: finalEventTypes },
      occurred_at: buildDateFilter(startDate, endDate),
    };

    if (organizationId) {
      where.organization_id = organizationId;
    } else {
      where.subject_user_id = userId;
    }

    const matchingEventTypes = search
      ? finalEventTypes.filter((et) => {
          const presentation = this.buildPresentation(et, {});
          const searchTerm = search.toLowerCase();
          return (
            presentation.title.toLowerCase().includes(searchTerm) ||
            presentation.description.toLowerCase().includes(searchTerm)
          );
        })
      : [];

    if (search) {
      where.OR = [
        { event_type: { contains: search, mode: "insensitive" } },
        { event_type: { in: matchingEventTypes } },
      ];
    }

    return prisma.onboardingAuditLog.count({ where });
  }

  transform(record: OnboardingAuditLog): UnifiedActivity {
    const metadata = record.metadata as Record<string, unknown>;
    const presentation = this.buildPresentation(record.event_type, metadata);

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

  buildPresentation(eventType: string, metadata?: Record<string, unknown>) {
    switch (eventType) {
      case "ONBOARDING_STARTED":
        return {
          title: "Onboarding Started",
          description: "Your organization onboarding has started and you can continue it at any time.",
        };
      case "ONBOARDING_RESUMED":
        return {
          title: "Onboarding Resumed",
          description: "Your organization onboarding session was resumed.",
        };
      case "ONBOARDING_RESTARTED":
        return {
          title: "Onboarding Restarted",
          description: "Your organization onboarding session was restarted.",
        };
      case "ONBOARDING_REJECTED":
        return {
          title: "Onboarding Rejected",
          description: `Your organization onboarding was rejected${metadata?.reasonCode ? `: ${metadata.reasonCode}` : "."}`,
        };
      case "ONBOARDING_APPROVED":
        return {
          title: "Onboarding Approved",
          description: "Your organization onboarding was approved and no further action is needed.",
        };
      case "ONBOARDING_FINAL_APPROVAL_COMPLETED":
        return {
          title: "Final Approval Completed",
          description: "Your organization onboarding received final approval.",
        };
      case "ONBOARDING_COMPLETED":
        return {
          title: "Onboarding Completed",
          description: "Your organization onboarding was marked completed.",
        };
      default:
        return {
          title: eventType
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" "),
          description: "This onboarding update was recorded for your organization.",
        };
    }
  }

  getEventTypes(): string[] {
    return [...CURATED_ORGANIZATION_ACTIVITY_EVENTS];
  }
}
