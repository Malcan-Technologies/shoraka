import { prisma } from "../../../lib/prisma";
import { ApplicationLog, Prisma } from "@prisma/client";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  buildDateFilter,
} from "./base";

export class ApplicationLogAdapter implements AuditLogAdapter<ApplicationLog> {
  public readonly name = "ApplicationLogAdapter";
  public readonly category = "organization";

  async query(userId: string, filters: ActivityFilters): Promise<ApplicationLog[]> {
    const { search, event_types, startDate, endDate, limit, offset, organizationId, portalType } = filters;
    const supportedTypes = this.getEventTypes();
    const finalEventTypes = event_types
      ? event_types.filter((et) => supportedTypes.includes(et))
      : supportedTypes;

    const where: Prisma.ApplicationLogWhereInput = {
      event_type: { in: finalEventTypes },
      created_at: buildDateFilter(startDate, endDate),
    };

    // If organization-scoped filter provided, resolve application ids for the organization
    if (organizationId && portalType) {
      // For issuer portal, applications have issuer_organization_id
      const appWhere: Prisma.ApplicationWhereInput =
        portalType === "issuer"
          ? { issuer_organization_id: organizationId }
          : {}; // investor-side application org linkage not modeled here

      const apps = await prisma.application.findMany({
        where: appWhere,
        select: { id: true },
      });
      const appIds = apps.map((a) => a.id);
      where.application_id = { in: appIds.length > 0 ? appIds : ["__none__"] };
    } else {
      where.user_id = userId;
    }

    if (search) {
      where.OR = [
        { event_type: { contains: search, mode: "insensitive" } },
        {
          metadata: {
            path: ["remark"],
            string_contains: search,
          },
        },
      ];
    }

    return prisma.applicationLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async count(userId: string, filters: ActivityFilters): Promise<number> {
    const { search, event_types, startDate, endDate, organizationId, portalType } = filters;
    const supportedTypes = this.getEventTypes();
    const finalEventTypes = event_types
      ? event_types.filter((et) => supportedTypes.includes(et))
      : supportedTypes;

    const where: Prisma.ApplicationLogWhereInput = {
      event_type: { in: finalEventTypes },
      created_at: buildDateFilter(startDate, endDate),
    };

    if (organizationId && portalType) {
      const appWhere: Prisma.ApplicationWhereInput =
        portalType === "issuer"
          ? { issuer_organization_id: organizationId }
          : {};

      const apps = await prisma.application.findMany({
        where: appWhere,
        select: { id: true },
      });
      const appIds = apps.map((a) => a.id);
      where.application_id = { in: appIds.length > 0 ? appIds : ["__none__"] };
    } else {
      where.user_id = userId;
    }

    if (search) {
      where.OR = [
        { event_type: { contains: search, mode: "insensitive" } },
        {
          metadata: {
            path: ["remark"],
            string_contains: search,
          },
        },
      ];
    }

    return prisma.applicationLog.count({ where });
  }

  transform(record: ApplicationLog): UnifiedActivity {
    return {
      id: record.id,
      user_id: record.user_id,
      category: this.category,
      event_type: record.event_type,
      activity: this.buildDescription(record.event_type, record.metadata as Record<string, unknown>),
      metadata: record.metadata as Record<string, unknown>,
      ip_address: record.ip_address,
      user_agent: record.user_agent,
      device_info: record.device_info,
      created_at: record.created_at,
      source_table: "application_logs",
    };
  }

  buildDescription(eventType: string, metadata?: Record<string, unknown>): string {
    const parts = eventType.split("_");
    const action = parts[parts.length - 1];
    switch (action) {
      case "CREATED":
        return "Created an application";
      case "SUBMITTED":
        return "Submitted the application";
      case "RESUBMITTED":
        return "Resubmitted the application";
      case "APPROVED":
        return "Application approved";
      case "REJECTED":
        return `Application rejected: ${metadata?.remark || "See reviewer remarks"}`;
      default:
        return parts
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
    }
  }

  getEventTypes(): string[] {
    return [
      "APPLICATION_APPLICATION_CREATED",
      "APPLICATION_APPLICATION_SUBMITTED",
      "APPLICATION_APPLICATION_RESUBMITTED",
      "APPLICATION_APPLICATION_APPROVED",
      "APPLICATION_APPLICATION_REJECTED",
    ];
  }
}
