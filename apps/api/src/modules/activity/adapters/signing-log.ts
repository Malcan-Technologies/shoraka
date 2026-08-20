import { prisma } from "../../../lib/prisma";
import { Prisma, SigningAuditLog } from "@prisma/client";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  buildDateFilter,
} from "./base";
import type { ActivityAudience, ActivityReferences } from "@cashsouk/types";
import {
  audienceFromPortal,
  formatApplicationReference,
  formatSigningActivity,
  getSigningActivityEventTypes,
  isSigningActivityVisible,
} from "@cashsouk/types";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import { collectVisibleRecords } from "./visible-query";

export class SigningLogAdapter implements AuditLogAdapter<SigningAuditLog> {
  public readonly name = "SigningLogAdapter";
  public readonly category = "organization";
  public readonly domain = "signing" as const;

  async query(userId: string, filters: ActivityFilters): Promise<SigningAuditLog[]> {
    const eventTypes = this.resolveEventTypes(filters);
    if (eventTypes.length === 0) return [];

    return collectVisibleRecords(
      async (skip, take) =>
        prisma.signingAuditLog.findMany({
          where: await this.buildWhere(userId, filters, eventTypes),
          orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
          skip,
          take,
        }),
      (record) => isSigningActivityVisible(this.audienceOf(filters), record.event_type),
      { offset: filters.offset, limit: filters.limit }
    );
  }

  async count(userId: string, filters: ActivityFilters): Promise<number> {
    const records = await this.query(userId, { ...filters, limit: undefined, offset: 0 });
    return records.length;
  }

  transform(record: SigningAuditLog, filters?: ActivityFilters): UnifiedActivity {
    const metadata = (record.metadata as Record<string, unknown> | null) || {};
    const presentation = this.buildPresentation(
      record.event_type,
      metadata,
      filters ? this.audienceOf(filters) : "issuer"
    );
    const references = this.buildReferences(record, metadata);

    return {
      id: record.id,
      user_id: record.actor_user_id ?? "",
      category: this.category,
      domain: this.domain,
      event_type: record.event_type,
      activity: presentation.title,
      title: presentation.title,
      description: presentation.description,
      metadata,
      ip_address: record.ip_address,
      user_agent: record.user_agent,
      device_info: formatDeviceInfoFromUserAgent(record.user_agent),
      created_at: record.occurred_at,
      source_table: "signing_audit_logs",
      references,
    };
  }

  private buildReferences(
    record: SigningAuditLog,
    metadata: Record<string, unknown>
  ): ActivityReferences | null {
    const applicationId =
      record.application_id ??
      (typeof metadata.applicationId === "string" ? metadata.applicationId : undefined);
    if (!applicationId) return null;
    return {
      applicationId,
      applicationReference: formatApplicationReference({ id: applicationId }),
      ...(typeof metadata.contractId === "string" ? { contractId: metadata.contractId } : {}),
      ...(typeof metadata.invoiceId === "string" ? { invoiceId: metadata.invoiceId } : {}),
    };
  }

  private async getScopedApplicationIds(organizationId: string, portalType: "investor" | "issuer") {
    if (portalType === "investor") {
      return ["__none__"];
    }
    const apps = await prisma.application.findMany({
      where: { issuer_organization_id: organizationId },
      select: { id: true },
    });
    return apps.length > 0 ? apps.map((app) => app.id) : ["__none__"];
  }

  buildPresentation(
    eventType: string,
    metadata?: Record<string, unknown>,
    audience: ActivityAudience = "issuer"
  ) {
    return formatSigningActivity(audience, eventType, metadata);
  }

  getEventTypes(): string[] {
    return getSigningActivityEventTypes("issuer");
  }

  private resolveEventTypes(filters: ActivityFilters): string[] {
    const supported = getSigningActivityEventTypes(this.audienceOf(filters));
    if (!filters.event_types?.length) return supported;
    return filters.event_types.filter((eventType) => supported.includes(eventType));
  }

  private audienceOf(filters: ActivityFilters): ActivityAudience {
    return audienceFromPortal(filters.portalType);
  }

  private async buildWhere(
    userId: string,
    filters: ActivityFilters,
    eventTypes: string[]
  ): Promise<Prisma.SigningAuditLogWhereInput> {
    const { search, startDate, endDate, organizationId, portalType } = filters;
    const where: Prisma.SigningAuditLogWhereInput = {
      event_type: { in: eventTypes },
      occurred_at: buildDateFilter(startDate, endDate),
    };

    if (organizationId && portalType) {
      where.application_id = { in: await this.getScopedApplicationIds(organizationId, portalType) };
    } else {
      where.actor_user_id = userId;
    }

    if (search) {
      const matchingEventTypes = eventTypes.filter((eventType) => {
        const presentation = this.buildPresentation(eventType, {}, this.audienceOf(filters));
        const searchTerm = search.toLowerCase();
        return (
          presentation.title.toLowerCase().includes(searchTerm) ||
          presentation.description.toLowerCase().includes(searchTerm)
        );
      });
      where.OR = [
        { event_type: { contains: search, mode: "insensitive" } },
        { event_type: { in: matchingEventTypes } },
      ];
    }

    return where;
  }
}
