import { prisma } from "../../../lib/prisma";
import { AccessLog } from "@prisma/client";
import { ACTIVITY_EVENT_CONFIG } from "@cashsouk/types";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  ActivityCategory,
  buildDateFilter,
} from "./base";

export class AccessLogAdapter implements AuditLogAdapter<AccessLog> {
  public readonly name = "AccessLogAdapter";
  public readonly category: ActivityCategory = "access";

  async query(userId: string, filters: ActivityFilters): Promise<AccessLog[]> {
    const { search, event_types, startDate, endDate, limit, offset } = filters;
    const supportedTypes = this.getEventTypes();

    const finalEventTypes = event_types
      ? event_types.filter(et => supportedTypes.includes(et))
      : supportedTypes;

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

    return prisma.accessLog.findMany({
      where: {
        user_id: userId,
        event_type: { in: finalEventTypes },
        created_at: buildDateFilter(startDate, endDate),
        OR: search
          ? [
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
                  path: ["portal"],
                  string_contains: search,
                },
              },
            ]
          : undefined,
      },
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async count(userId: string, filters: ActivityFilters): Promise<number> {
    const { search, event_types, startDate, endDate } = filters;
    const supportedTypes = this.getEventTypes();

    const finalEventTypes = event_types
      ? event_types.filter((et) => supportedTypes.includes(et))
      : supportedTypes;

    const matchingEventTypes = search
      ? finalEventTypes.filter((et) => {
          const config = ACTIVITY_EVENT_CONFIG[et];
          const label = config?.label.toLowerCase() || "";
          const description = this.buildDescription(et, {}).toLowerCase();
          const searchTerm = search.toLowerCase();

          return label.includes(searchTerm) || description.includes(searchTerm);
        })
      : [];

    return prisma.accessLog.count({
      where: {
        user_id: userId,
        event_type: { in: finalEventTypes },
        created_at: buildDateFilter(startDate, endDate),
        OR: search
          ? [
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
                  path: ["portal"],
                  string_contains: search,
                },
              },
            ]
          : undefined,
      },
    });
  }

  transform(record: AccessLog): UnifiedActivity {
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
      source_table: "access_logs",
    };
  }

  buildDescription(
    eventType: string,
    metadata?: Record<string, unknown>
  ): string {
    switch (eventType) {
      // KYC_STATUS_UPDATED NOT IMPLEMENTED YET
      case "KYC_STATUS_UPDATED":
        return `KYC status updated to ${metadata?.status || "unknown"}`;
      default:
        return "Unknown activity";
    }
  }

  getEventTypes(): string[] {
    return [
      "KYC_STATUS_UPDATED"
    ];
  }
}
