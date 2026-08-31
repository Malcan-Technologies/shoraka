import { prisma } from "../../../lib/prisma";
import { OnboardingLog, Prisma } from "@prisma/client";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  ActivityCategory,
  buildDateFilter,
} from "./base";
import { userVisibleOrganizationEventTypes } from "../../../lib/audit/visibility-matrix";

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
      case "ONBOARDING_FEE_PAID":
        return {
          title: "Onboarding Fee Paid",
          description: "The issuer registration fee was paid successfully.",
        };
      case "ONBOARDING_AMENDMENT_REQUIRED":
        return {
          title: "Additional onboarding information is required",
          description: "Please provide the additional onboarding information requested.",
        };
      case "ONBOARDING_CANCELLED":
        // The stored event_type name is historical/forensic (an admin restart cancels the
        // previous RegTank request and issues a new one) — the portal-facing copy describes
        // the actual business action (restart), not a permanent termination.
        return {
          title: "Onboarding Restarted",
          description:
            "Your previous onboarding request was cancelled and a new onboarding request has been started.",
        };
      case "ONBOARDING_REJECTED":
        return {
          title: "Onboarding Rejected",
          description: `Your organization onboarding was rejected${metadata?.reason ? `: ${metadata.reason}` : "."}`,
        };
      case "COD_REJECTED":
        return {
          title: "Onboarding Rejected",
          description: "Your organization onboarding was rejected.",
        };
      case "ONBOARDING_APPROVED":
        return {
          title: "Onboarding Submission Approved",
          description: "Your onboarding submission was approved. We'll notify you when your onboarding is fully complete.",
        };
      case "FINAL_APPROVAL_COMPLETED":
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
    return userVisibleOrganizationEventTypes();
  }
}
