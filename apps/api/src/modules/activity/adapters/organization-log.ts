import { prisma } from "../../../lib/prisma";
import { OnboardingLog, Prisma } from "@prisma/client";
import activityEvents from "@cashsouk/types/src/activity-events.json";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  ActivityCategory,
  buildDateFilter,
} from "./base";

const ACTIVITY_EVENT_CONFIG = activityEvents as Record<string, { label: string; dotColor: string }>;

export class OrganizationLogAdapter implements AuditLogAdapter<OnboardingLog> {
  public readonly name = "OrganizationLogAdapter";
  public readonly category: ActivityCategory = "organization";

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
        const config = ACTIVITY_EVENT_CONFIG[et];
        const label = config?.label.toLowerCase() || "";
        const description = this.buildDescription(et, {}).toLowerCase();
        const searchTerm = search.toLowerCase();

        return label.includes(searchTerm) || description.includes(searchTerm);
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
        const config = ACTIVITY_EVENT_CONFIG[et];
        const label = config?.label.toLowerCase() || "";
        const description = this.buildDescription(et, {}).toLowerCase();
        const searchTerm = search.toLowerCase();

        return label.includes(searchTerm) || description.includes(searchTerm);
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
    return {
      id: record.id,
      user_id: record.user_id,
      category: this.category,
      event_type: record.event_type,
      activity: this.buildDescription(
        record.event_type,
        record.metadata as Record<string, unknown>
      ),
      metadata: record.metadata as Record<string, unknown>,
      ip_address: record.ip_address,
      user_agent: record.user_agent,
      device_info: record.device_info,
      created_at: record.created_at,
      source_table: "onboarding_logs",
    };
  }

  buildDescription(
    eventType: string,
    metadata?: Record<string, unknown>
  ): string {
    switch (eventType) {
      case "ONBOARDING_STARTED":
        return "Started the onboarding process";
      case "ONBOARDING_RESUMED":
        return "Resumed the onboarding process";
      case "ONBOARDING_STATUS_UPDATED":
        return `Onboarding status updated to: ${metadata?.status || "Processing"}`;
      case "ONBOARDING_CANCELLED":
        return "Cancelled the onboarding process";
      case "ONBOARDING_REJECTED":
        return `Onboarding was rejected: ${metadata?.reason || "Check your documents"}`;
      case "SOPHISTICATED_STATUS_UPDATED":
        return `Sophisticated investor status: ${metadata?.isSophisticated ? "Approved" : "Rejected"}`;
      case "FINAL_APPROVAL_COMPLETED":
        return "Final onboarding approval completed";
      case "FORM_FILLED":
        return `Completed onboarding section: ${metadata?.section || "Profile"}`;
      case "ONBOARDING_APPROVED":
        return "Onboarding application was approved";
      case "AML_APPROVED":
        return "AML verification was approved";
      case "TNC_APPROVED":
        return "T&C documents were approved";
      case "SSM_APPROVED":
        return "SSM document verification was approved";
      case "TNC_ACCEPTED":
        return "Accepted the Terms & Conditions";
      case "USER_COMPLETED":
        return "Successfully completed the onboarding process";
      case "KYC_APPROVED":
        return "KYC verification was approved";
      case "KYB_APPROVED":
        return "KYB verification was approved";
      default:
        return eventType
          .split("_")
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");
    }
  }

  getEventTypes(): string[] {
    return [
      "ONBOARDING_STARTED",
      "ONBOARDING_RESUMED",
      "ONBOARDING_STATUS_UPDATED",
      "ONBOARDING_CANCELLED",
      "ONBOARDING_REJECTED",
      "SOPHISTICATED_STATUS_UPDATED",
      "FINAL_APPROVAL_COMPLETED",
      "FORM_FILLED",
      "ONBOARDING_APPROVED",
      "AML_APPROVED",
      "TNC_APPROVED",
      "SSM_APPROVED",
      "TNC_ACCEPTED",
      "USER_COMPLETED",
      "KYC_APPROVED",
      "KYB_APPROVED"
    ];
  }
}
