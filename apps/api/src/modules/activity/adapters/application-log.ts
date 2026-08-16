/**
 * Guide: docs/guides/admin/activity-timeline.md — Adapter uses top-level record.remark for activity text
 */

import { prisma } from "../../../lib/prisma";
import { ApplicationAuditLog, Prisma } from "@prisma/client";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  buildDateFilter,
} from "./base";
import type { ActivityAudience } from "@cashsouk/types";
import {
  audienceFromPortal,
  formatApplicationActivity,
  formatApplicationReference,
  getApplicationActivityEventTypes,
  isApplicationActivityVisible,
} from "@cashsouk/types";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import { collectVisibleRecords } from "./visible-query";

const CONTRACT_EVENT_TYPES = new Set<string>([
  "CONTRACT_OFFER_SENT",
  "CONTRACT_ACCEPTANCE_SUBMITTED",
  "CONTRACT_ACCEPTANCE_RESUBMITTED",
  "CONTRACT_ACCEPTANCE_CHANGES_REQUESTED",
  "CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING",
  "CONTRACT_OFFER_ACCEPTED",
  "CONTRACT_OFFER_REJECTED",
  "CONTRACT_OFFER_RETRACTED",
  "CONTRACT_OFFER_EXPIRED",
  "CONTRACT_SIGNING_DEADLINE_EXTENDED",
  "CONTRACT_WITHDRAWN",
  "CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED",
]);

const INVOICE_EVENT_TYPES = new Set<string>([
  "INVOICE_OFFER_SENT",
  "INVOICE_ACCEPTANCE_SUBMITTED",
  "INVOICE_ACCEPTANCE_RESUBMITTED",
  "INVOICE_ACCEPTANCE_CHANGES_REQUESTED",
  "INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING",
  "INVOICE_OFFER_ACCEPTED",
  "INVOICE_OFFER_REJECTED",
  "INVOICE_OFFER_RETRACTED",
  "INVOICE_OFFER_EXPIRED",
  "INVOICE_SIGNING_DEADLINE_EXTENDED",
  "INVOICE_WITHDRAWN",
]);

export class ApplicationLogAdapter implements AuditLogAdapter<ApplicationAuditLog> {
  public readonly name = "ApplicationLogAdapter";
  public readonly category = "organization";
  public readonly domain = "application" as const;

  async query(userId: string, filters: ActivityFilters): Promise<ApplicationAuditLog[]> {
    const eventTypes = this.resolveEventTypes(filters);
    if (eventTypes.length === 0) return [];

    const records = await collectVisibleRecords(
      async (skip, take) =>
        prisma.applicationAuditLog.findMany({
          where: await this.buildWhere(userId, filters, eventTypes),
          orderBy: { occurred_at: "desc" },
          skip,
          take,
        }),
      (record) =>
        isApplicationActivityVisible(
          this.audienceOf(filters),
          record.event_type,
          (record.metadata as Record<string, unknown> | null) ?? {}
        ),
      { offset: filters.offset, limit: filters.limit }
    );

    await this.enrichRecordReferences(records);
    return records;
  }

  async count(userId: string, filters: ActivityFilters): Promise<number> {
    const records = await this.query(userId, { ...filters, limit: undefined, offset: 0 });
    return records.length;
  }

  private async getScopedApplicationIds(organizationId: string, portalType: "investor" | "issuer") {
    if (portalType === "investor") {
      // Applications belong to issuers only, so investor activity must never query this domain.
      return ["__none__"];
    }

    const apps = await prisma.application.findMany({
      where: { issuer_organization_id: organizationId },
      select: { id: true },
    });

    return apps.length > 0 ? apps.map((app) => app.id) : ["__none__"];
  }

  private async enrichRecordReferences(records: ApplicationAuditLog[]) {
    const applicationIds = Array.from(
      new Set(
        records
          .map((record) => record.application_id)
          .filter((applicationId): applicationId is string => Boolean(applicationId))
      )
    );

    if (applicationIds.length === 0) {
      return;
    }

    const applications = await prisma.application.findMany({
      where: { id: { in: applicationIds } },
      select: {
        id: true,
        display_reference: true,
        contract_id: true,
        contract: {
          select: {
            display_reference: true,
            contract_details: true,
          },
        },
      },
    });

    const applicationMap = new Map(applications.map((application) => [application.id, application]));

    for (const record of records) {
      if (!record.application_id) {
        continue;
      }

      const application = applicationMap.get(record.application_id);
      if (!application) {
        continue;
      }

      const metadata = ((record.metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      const nextMetadata: Record<string, unknown> = { ...metadata };
      const contractNumber = this.readDisplayString(
        (application.contract?.contract_details as Record<string, unknown> | null)?.number
      );

      if (!this.readDisplayString(nextMetadata.application_reference)) {
        nextMetadata.application_reference =
          this.readDisplayString(application.display_reference) ??
          formatApplicationReference({ id: application.id });
      }

      if (CONTRACT_EVENT_TYPES.has(record.event_type)) {
        if (!this.readDisplayString(nextMetadata.contract_id) && application.contract_id) {
          nextMetadata.contract_id = application.contract_id;
        }
        if (!this.readDisplayString(nextMetadata.contract_number) && contractNumber) {
          nextMetadata.contract_number = contractNumber;
        }
        if (!this.readDisplayString(nextMetadata.contract_reference)) {
          const contractReference = this.readDisplayString(application.contract?.display_reference);
          if (contractReference) {
            nextMetadata.contract_reference = contractReference;
          }
        }
      }

      record.metadata = nextMetadata as Prisma.JsonObject;
    }
  }

  transform(record: ApplicationAuditLog, filters?: ActivityFilters): UnifiedActivity {
    const baseMetadata = (record.metadata as Record<string, unknown> | null) || {};
    const remark =
      typeof baseMetadata.remarks === "string"
        ? baseMetadata.remarks
        : typeof baseMetadata.remark === "string"
          ? baseMetadata.remark
          : null;
    const presentation = this.buildPresentation(
      record.event_type,
      {
        ...baseMetadata,
        ...(remark ? { remark } : {}),
      },
      filters ? this.audienceOf(filters) : "issuer"
    );
    const references = this.buildReferences(record, baseMetadata);
    const description = presentation.description;

    const unified: Record<string, unknown> = {
      id: record.id,
      user_id: record.actor_user_id,
      category: this.category,
      domain: this.domain,
      event_type: record.event_type,
      activity: presentation.title,
      title: presentation.title,
      description,
      metadata: baseMetadata,
      ip_address: record.ip_address,
      user_agent: record.user_agent,
      device_info: formatDeviceInfoFromUserAgent(record.user_agent),
      created_at: record.occurred_at,
      source_table: "application_audit_logs",
      references,
    };

    if (remark) unified.remark = remark;
    if (record.target_id) unified.entityId = record.target_id;

    return unified as unknown as UnifiedActivity;
  }

  private buildReferences(record: ApplicationAuditLog, metadata: Record<string, unknown>) {
    const references: Record<string, string> = {};
    const entityId = this.readEntityId(record.target_id);
    const applicationReference = this.readDisplayString(metadata.application_reference);

    if (record.application_id) {
      references.applicationId = record.application_id;
      references.applicationReference =
        applicationReference ?? formatApplicationReference({ id: record.application_id });
    }

    if (CONTRACT_EVENT_TYPES.has(record.event_type)) {
      const contractId = this.readDisplayString(metadata.contract_id) ?? entityId;
      const contractNumber =
        this.readDisplayString(metadata.contract_reference) ??
        this.readDisplayString(metadata.contract_number);

      if (contractId) {
        references.contractId = contractId;
      }
      if (contractNumber) {
        references.contractNumber = contractNumber;
      }
    }

    if (INVOICE_EVENT_TYPES.has(record.event_type)) {
      const invoiceId = this.readDisplayString(metadata.invoice_id) ?? entityId;
      const invoiceNumber =
        this.readDisplayString(metadata.invoice_reference) ??
        this.readDisplayString(metadata.invoice_number);

      if (invoiceId) {
        references.invoiceId = invoiceId;
      }
      if (invoiceNumber) {
        references.invoiceNumber = invoiceNumber;
      }
    }

    return Object.keys(references).length > 0 ? references : null;
  }

  private readString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private readDisplayString(value: unknown): string | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return this.readString(value);
  }

  private readEntityId(value: string | null): string | undefined {
    const trimmed = this.readString(value);
    if (!trimmed || trimmed.includes(":")) {
      return undefined;
    }
    return trimmed;
  }

  buildPresentation(
    eventType: string,
    metadata?: Record<string, unknown>,
    audience: ActivityAudience = "issuer"
  ) {
    return formatApplicationActivity(audience, eventType, metadata);
  }

  getEventTypes(): string[] {
    return getApplicationActivityEventTypes("issuer");
  }

  private resolveEventTypes(filters: ActivityFilters): string[] {
    const supported = getApplicationActivityEventTypes(this.audienceOf(filters));
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
  ): Promise<Prisma.ApplicationAuditLogWhereInput> {
    const { search, startDate, endDate, organizationId, portalType } = filters;
    const where: Prisma.ApplicationAuditLogWhereInput = {
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
        {
          metadata: {
            path: ["remark"],
            string_contains: search,
          },
        },
      ];
    }

    return where;
  }
}
