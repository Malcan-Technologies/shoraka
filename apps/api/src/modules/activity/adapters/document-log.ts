import { prisma } from "../../../lib/prisma";
import { DocumentLog } from "@prisma/client";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  ActivityCategory,
  buildDateFilter,
} from "./base";

export class DocumentLogAdapter implements AuditLogAdapter<DocumentLog> {
  public readonly name = "DocumentLogAdapter";
  public readonly category: ActivityCategory = "document";

  async query(userId: string, filters: ActivityFilters): Promise<DocumentLog[]> {
    const { search, event_types, startDate, endDate, limit, offset } = filters;

    return prisma.documentLog.findMany({
      where: {
        user_id: userId,
        event_type: event_types ? { in: event_types } : undefined,
        created_at: buildDateFilter(startDate, endDate),
        OR: search
          ? [
              { event_type: { contains: search, mode: "insensitive" } },
              {
                metadata: {
                  path: ["fileName"],
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

  transform(record: DocumentLog): UnifiedActivity {
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
      source_table: "document_logs",
    };
  }

  buildDescription(
    eventType: string,
    metadata?: Record<string, unknown>
  ): string {
    const fileName = metadata?.fileName || metadata?.title || "document";
    switch (eventType) {
      case "DOCUMENT_CREATED":
        return `Uploaded document: ${fileName}`;
      case "DOCUMENT_UPDATED":
        return `Updated document details: ${fileName}`;
      case "DOCUMENT_REPLACED":
        return `Replaced document: ${fileName}`;
      case "DOCUMENT_DELETED":
        return `Deleted document: ${fileName}`;
      case "DOCUMENT_RESTORED":
        return `Restored document: ${fileName}`;
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
      "DOCUMENT_CREATED",
      "DOCUMENT_UPDATED",
      "DOCUMENT_REPLACED",
      "DOCUMENT_DELETED",
      "DOCUMENT_RESTORED",
    ];
  }
}
