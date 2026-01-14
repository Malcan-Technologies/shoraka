import { prisma } from "../../../lib/prisma";
import { SecurityLog } from "@prisma/client";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  ActivityCategory,
  buildDateFilter,
} from "./base";

export class SecurityLogAdapter implements AuditLogAdapter<SecurityLog> {
  public readonly name = "SecurityLogAdapter";
  public readonly category: ActivityCategory = "security";

  async query(userId: string, filters: ActivityFilters): Promise<SecurityLog[]> {
    const { search, event_types, startDate, endDate, limit, offset } = filters;

    return prisma.securityLog.findMany({
      where: {
        user_id: userId,
        event_type: event_types ? { in: event_types } : undefined,
        created_at: buildDateFilter(startDate, endDate),
        OR: search
          ? [
              { event_type: { contains: search, mode: "insensitive" } },
              {
                metadata: {
                  path: ["reason"],
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

  transform(record: SecurityLog): UnifiedActivity {
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
      source_table: "security_logs",
    };
  }

  buildDescription(
    eventType: string,
    metadata?: Record<string, unknown>
  ): string {
    switch (eventType) {
      case "PASSWORD_CHANGED":
        return metadata?.success === false
          ? `Failed password change attempt: ${metadata?.error || "Unknown error"}`
          : "Changed password successfully";
      case "EMAIL_CHANGED":
        return metadata?.success === false
          ? `Failed email change attempt: ${metadata?.error || "Unknown error"}`
          : `Changed email to ${metadata?.newEmail || "new email"}`;
      case "ROLE_ADDED":
        return `Added new role: ${metadata?.role || "unknown"}`;
      case "ROLE_SWITCHED":
        return `Switched active role to ${metadata?.newRole || "unknown"}`;
      case "PROFILE_UPDATED":
        return "Updated profile information";
      case "EMAIL_VERIFIED":
        return metadata?.success === false
          ? "Failed email verification attempt"
          : "Email verified successfully";
      case "SECURITY_ALERT":
        return `Security alert: ${metadata?.alert_type || "Unknown alert"}`;
      case "LOGIN_FAILURE":
        return `Failed login attempt: ${metadata?.reason || "Unknown reason"}`;
      case "NEW_DEVICE_LOGIN":
        return "Logged in from a new device";
      default:
        // Default mapping if not explicitly handled
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
      "PASSWORD_CHANGED",
      "EMAIL_CHANGED",
      "ROLE_ADDED",
      "ROLE_SWITCHED",
      "PROFILE_UPDATED",
      "EMAIL_VERIFIED",
      "SECURITY_ALERT",
      "LOGIN_FAILURE",
      "NEW_DEVICE_LOGIN",
    ];
  }
}
