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
import { ApplicationLogEventType } from "../../applications/logs/types";

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
    if (eventType === ApplicationLogEventType.APPLICATION_RESUBMITTED && metadata?.resubmit_changes) {
      const rc = metadata.resubmit_changes as { activity_summary?: string };
      if (typeof rc.activity_summary === "string" && rc.activity_summary.length > 0) {
        return rc.activity_summary;
      }
    }
    const labels: Record<string, string> = {
      [ApplicationLogEventType.APPLICATION_CREATED]: "Created an application",
      [ApplicationLogEventType.APPLICATION_SUBMITTED]: "Submitted the application",
      [ApplicationLogEventType.APPLICATION_RESUBMITTED]: "Resubmitted the application",
      [ApplicationLogEventType.APPLICATION_APPROVED]: "Application approved",
      [ApplicationLogEventType.APPLICATION_REJECTED]: "Application rejected",
      [ApplicationLogEventType.APPLICATION_WITHDRAWN]: "Application withdrawn",
      [ApplicationLogEventType.APPLICATION_COMPLETED]: "Application completed",
      [ApplicationLogEventType.APPLICATION_RESET_TO_UNDER_REVIEW]: "Application reset to under review",
      [ApplicationLogEventType.SECTION_REVIEWED_APPROVED]: "Section approved",
      [ApplicationLogEventType.SECTION_REVIEWED_REJECTED]: "Section rejected",
      [ApplicationLogEventType.SECTION_REVIEWED_AMENDMENT_REQUESTED]: "Section amendment requested",
      [ApplicationLogEventType.SECTION_REVIEWED_PENDING]: "Section reset to pending",
      [ApplicationLogEventType.ITEM_REVIEWED_APPROVED]: "Item approved",
      [ApplicationLogEventType.ITEM_REVIEWED_REJECTED]: "Item rejected",
      [ApplicationLogEventType.ITEM_REVIEWED_AMENDMENT_REQUESTED]: "Item amendment requested",
      [ApplicationLogEventType.ITEM_REVIEWED_PENDING]: "Item reset to pending",
      [ApplicationLogEventType.CONTRACT_OFFER_SENT]: "Contract offer sent",
      [ApplicationLogEventType.CONTRACT_OFFER_ACCEPTED]: "Contract offer accepted",
      [ApplicationLogEventType.CONTRACT_OFFER_REJECTED]: "Contract offer withdrawn",
      [ApplicationLogEventType.CONTRACT_OFFER_RETRACTED]: "Contract offer retracted",
      [ApplicationLogEventType.CONTRACT_WITHDRAWN]: "Contract offer withdrawn",
      [ApplicationLogEventType.INVOICE_OFFER_SENT]: "Invoice offer sent",
      [ApplicationLogEventType.INVOICE_OFFER_ACCEPTED]: "Invoice offer accepted",
      [ApplicationLogEventType.INVOICE_OFFER_REJECTED]: "Invoice offer rejected",
      [ApplicationLogEventType.INVOICE_OFFER_RETRACTED]: "Invoice offer retracted",
      [ApplicationLogEventType.INVOICE_WITHDRAWN]: "Invoice withdrawn",
      [ApplicationLogEventType.OFFER_EXPIRED]: "Offer expired",
      [ApplicationLogEventType.AMENDMENTS_SUBMITTED]: "Amendment request sent to issuer",
    };
    return labels[eventType] ?? "Activity";
  }

  getEventTypes(): string[] {
    return Object.values(ApplicationLogEventType);
  }
}
