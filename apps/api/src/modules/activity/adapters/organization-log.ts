import { prisma } from "../../../lib/prisma";
import { OnboardingLog, Prisma } from "@prisma/client";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  ActivityCategory,
  buildDateFilter,
} from "./base";

export class OrganizationLogAdapter implements AuditLogAdapter<OnboardingLog> {
  public readonly name = "OrganizationLogAdapter";
  public readonly category: ActivityCategory = "organization";
  public readonly domain = "onboarding" as const;

  async query(
    userId: string,
    filters: ActivityFilters
  ): Promise<OnboardingLog[]> {
    const { search, event_types, startDate, endDate, limit, offset, organizationId, portalType } = filters;
    const supportedTypes = this.getEventTypes();

    const finalEventTypes = event_types
      ? event_types.filter(et => supportedTypes.includes(et))
      : supportedTypes;

    // Build the where clause
    const where: Prisma.OnboardingLogWhereInput = {
      event_type: { in: finalEventTypes },
      created_at: buildDateFilter(startDate, endDate),
    };

    // Filter by organization if provided, otherwise filter by user_id
    if (organizationId && portalType) {
      if (portalType === "investor") {
        where.investor_organization_id = organizationId;
      } else {
        where.issuer_organization_id = organizationId;
      }
    } else {
      where.user_id = userId;
    }

    // Pre-calculate which event types match the search string via their shared labels
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
        {
          metadata: {
            path: ["status"],
            string_contains: search,
          },
        },
        {
          metadata: {
            path: ["reason"],
            string_contains: search,
          },
        },
        {
          metadata: {
            path: ["section"],
            string_contains: search,
          },
        },
        {
          metadata: {
            path: ["form_name"],
            string_contains: search,
          },
        },
      ];
    }

    return prisma.onboardingLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async count(
    userId: string,
    filters: ActivityFilters
  ): Promise<number> {
    const { search, event_types, startDate, endDate, organizationId, portalType } = filters;
    const supportedTypes = this.getEventTypes();

    const finalEventTypes = event_types
      ? event_types.filter((et) => supportedTypes.includes(et))
      : supportedTypes;

    // Build the where clause
    const where: Prisma.OnboardingLogWhereInput = {
      event_type: { in: finalEventTypes },
      created_at: buildDateFilter(startDate, endDate),
    };

    // Filter by organization if provided, otherwise filter by user_id
    if (organizationId && portalType) {
      if (portalType === "investor") {
        where.investor_organization_id = organizationId;
      } else {
        where.issuer_organization_id = organizationId;
      }
    } else {
      where.user_id = userId;
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
        {
          metadata: {
            path: ["status"],
            string_contains: search,
          },
        },
        {
          metadata: {
            path: ["reason"],
            string_contains: search,
          },
        },
        {
          metadata: {
            path: ["section"],
            string_contains: search,
          },
        },
        {
          metadata: {
            path: ["form_name"],
            string_contains: search,
          },
        },
      ];
    }

    return prisma.onboardingLog.count({
      where,
    });
  }

  transform(record: OnboardingLog): UnifiedActivity {
    const metadata = record.metadata as Record<string, unknown>;
    const presentation = this.buildPresentation(record.event_type, metadata);

    return {
      id: record.id,
      user_id: record.user_id,
      category: this.category,
      domain: this.domain,
      event_type: record.event_type,
      activity: presentation.title,
      title: presentation.title,
      description: presentation.description,
      metadata,
      ip_address: record.ip_address,
      user_agent: record.user_agent,
      device_info: record.device_info,
      created_at: record.created_at,
      source_table: "onboarding_logs",
    };
  }

  buildPresentation(eventType: string, metadata?: Record<string, unknown>) {
    switch (eventType) {
      case "ONBOARDING_STARTED":
        return {
          title: "Onboarding Started",
          description: "Your organization onboarding has started and you can continue it at any time.",
        };
      case "ONBOARDING_CANCELLED":
        return {
          title: "Onboarding Closed",
          description: "Your organization onboarding was cancelled and will not continue.",
        };
      case "ONBOARDING_REJECTED":
        return {
          title: "Onboarding Rejected",
          description: `Your organization onboarding was rejected${metadata?.reason ? `: ${metadata.reason}` : "."}`,
        };
      case "FINAL_APPROVAL_COMPLETED":
      case "ONBOARDING_APPROVED":
        return {
          title: "Onboarding Approved",
          description: "Your organization onboarding was approved and no further action is needed.",
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
    return [
      "ONBOARDING_STARTED",
      "ONBOARDING_CANCELLED",
      "ONBOARDING_REJECTED",
      "FINAL_APPROVAL_COMPLETED",
      "ONBOARDING_APPROVED",
    ];
  }
}
