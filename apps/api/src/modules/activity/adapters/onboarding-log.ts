import { prisma } from "../../../lib/prisma";
import { OnboardingLog } from "@prisma/client";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  ActivityCategory,
  buildDateFilter,
} from "./base";

export class OnboardingLogAdapter implements AuditLogAdapter<OnboardingLog> {
  public readonly name = "OnboardingLogAdapter";
  public readonly category: ActivityCategory = "onboarding";

  async query(
    userId: string,
    filters: ActivityFilters
  ): Promise<OnboardingLog[]> {
    const { search, event_types, startDate, endDate, limit, offset } = filters;

    return prisma.onboardingLog.findMany({
      where: {
        user_id: userId,
        event_type: event_types ? { in: event_types } : undefined,
        created_at: buildDateFilter(startDate, endDate),
        OR: search
          ? [{ event_type: { contains: search, mode: "insensitive" } }]
          : undefined,
      },
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
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
      case "FORM_FILLED":
        return `Completed onboarding section: ${metadata?.section || "Profile"}`;
      case "KYC_SUBMITTED":
        return "Submitted KYC documents for verification";
      case "ONBOARDING_STATUS_UPDATED":
        return `Onboarding status updated to: ${metadata?.status || "Processing"}`;
      case "ONBOARDING_REJECTED":
        return `Onboarding was rejected: ${metadata?.reason || "Check your documents"}`;
      case "USER_COMPLETED":
        return "Successfully completed the onboarding process";
      case "AML_APPROVED":
        return "AML verification was approved";
      case "SSM_APPROVED":
        return "SSM document verification was approved";
      case "SOPHISTICATED_STATUS_UPDATED":
        return `Sophisticated investor status: ${metadata?.isSophisticated ? "Approved" : "Rejected"}`;
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
      "FORM_FILLED",
      "KYC_SUBMITTED",
      "ONBOARDING_STATUS_UPDATED",
      "ONBOARDING_REJECTED",
      "USER_COMPLETED",
      "AML_APPROVED",
      "SSM_APPROVED",
      "SOPHISTICATED_STATUS_UPDATED",
    ];
  }
}
