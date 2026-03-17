/**
 * Guide: docs/guides/admin/activity-timeline.md — Adapter uses top-level record.remark for activity text
 */

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
    const baseMetadata = (record.metadata as Record<string, unknown> | null) || {};
    // Create a temporary metadata object for description that includes top-level remark/entity_id.
    const mdForDescription: Record<string, unknown> = {
      ...baseMetadata,
      ...(record.remark ? { remark: record.remark } : {}),
      ...(record.entity_id ? { entityId: record.entity_id } : {}),
    };

    const activityText = this.buildDescription(record.event_type, mdForDescription);

    // Return metadata as stored (do not copy top-level fields into metadata).
    const unified: any = {
      id: record.id,
      user_id: record.user_id,
      category: this.category,
      event_type: record.event_type,
      activity: activityText,
      metadata: baseMetadata,
      ip_address: record.ip_address,
      user_agent: record.user_agent,
      device_info: record.device_info,
      created_at: record.created_at,
      source_table: "application_logs",
    };

    // Expose canonical top-level fields so frontend reads remark/entityId easily.
    if (record.remark) unified.remark = record.remark;
    if (record.entity_id) unified.entityId = record.entity_id;

    return unified as UnifiedActivity;
  }

  buildDescription(eventType: string, metadata?: Record<string, unknown>): string {
    if (eventType === "AMENDMENTS_SUBMITTED") {
      return "Amendment request sent to issuer";
    }
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
        return "Application rejected";
      default:
        return parts
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
    }
  }

  getEventTypes(): string[] {
    return [
      "APPLICATION_CREATED",
      "APPLICATION_SUBMITTED",
      "APPLICATION_RESUBMITTED",
      "APPLICATION_WITHDRAWN",
      "APPLICATION_COMPLETED",
      "INVOICE_WITHDRAWN",
      "CONTRACT_WITHDRAWN",
      "CONTRACT_OFFER_ACCEPTED",
      "INVOICE_OFFER_ACCEPTED",
      "CONTRACT_OFFER_REJECTED",
      "INVOICE_OFFER_REJECTED",
      "OFFER_EXPIRED",
    ];
  }
}
