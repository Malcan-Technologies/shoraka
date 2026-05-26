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
import type { ActivityReferences } from "@cashsouk/types";
import { ApplicationLogEventType } from "../../applications/logs/types";

const CONTRACT_EVENT_TYPES = new Set<string>([
  ApplicationLogEventType.CONTRACT_OFFER_SENT,
  ApplicationLogEventType.CONTRACT_OFFER_ACCEPTED,
  ApplicationLogEventType.CONTRACT_OFFER_REJECTED,
  ApplicationLogEventType.CONTRACT_OFFER_RETRACTED,
  ApplicationLogEventType.CONTRACT_WITHDRAWN,
]);

const INVOICE_EVENT_TYPES = new Set<string>([
  ApplicationLogEventType.INVOICE_OFFER_SENT,
  ApplicationLogEventType.INVOICE_OFFER_ACCEPTED,
  ApplicationLogEventType.INVOICE_OFFER_REJECTED,
  ApplicationLogEventType.INVOICE_OFFER_RETRACTED,
  ApplicationLogEventType.INVOICE_WITHDRAWN,
]);

export class ApplicationLogAdapter implements AuditLogAdapter<ApplicationLog> {
  public readonly name = "ApplicationLogAdapter";
  public readonly category = "organization";
  public readonly domain = "application" as const;

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
      const matchingEventTypes = finalEventTypes.filter((eventType) => {
        const presentation = this.buildPresentation(eventType, {});
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

    const records = await prisma.applicationLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
    });

    await this.enrichRecordReferences(records);
    return records;
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
      const matchingEventTypes = finalEventTypes.filter((eventType) => {
        const presentation = this.buildPresentation(eventType, {});
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

    return prisma.applicationLog.count({ where });
  }

  private async enrichRecordReferences(records: ApplicationLog[]) {
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
        contract_id: true,
        contract: {
          select: {
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
        nextMetadata.application_reference = this.formatApplicationReference(application.id);
      }

      if (CONTRACT_EVENT_TYPES.has(record.event_type)) {
        if (!this.readDisplayString(nextMetadata.contract_id) && application.contract_id) {
          nextMetadata.contract_id = application.contract_id;
        }
        if (!this.readDisplayString(nextMetadata.contract_number) && contractNumber) {
          nextMetadata.contract_number = contractNumber;
        }
      }

      record.metadata = nextMetadata as Prisma.JsonObject;
    }
  }

  transform(record: ApplicationLog): UnifiedActivity {
    const baseMetadata = (record.metadata as Record<string, unknown> | null) || {};
    const presentation = this.buildPresentation(record.event_type, {
      ...baseMetadata,
      ...(record.remark ? { remark: record.remark } : {}),
      ...(record.entity_id ? { entityId: record.entity_id } : {}),
    });
    const references = this.buildReferences(record, baseMetadata);
    const description = this.buildDescription(record.event_type, presentation.description, references);

    // Create a temporary metadata object for description that includes top-level remark/entity_id.
    // Return metadata as stored (do not copy top-level fields into metadata).
    const unified: any = {
      id: record.id,
      user_id: record.user_id,
      category: this.category,
      domain: this.domain,
      event_type: record.event_type,
      activity: presentation.title,
      title: presentation.title,
      description,
      metadata: baseMetadata,
      ip_address: record.ip_address,
      user_agent: record.user_agent,
      device_info: record.device_info,
      created_at: record.created_at,
      source_table: "application_logs",
      references,
    };

    // Expose canonical top-level fields so frontend reads remark/entityId easily.
    if (record.remark) unified.remark = record.remark;
    if (record.entity_id) unified.entityId = record.entity_id;

    return unified as UnifiedActivity;
  }

  private buildDescription(
    eventType: string,
    fallbackDescription: string,
    references: ActivityReferences | null
  ): string {
    const applicationRef = this.asApplicationReference(
      references?.applicationReference ?? references?.applicationId
    );
    const contractRef = this.asContractReference(references);
    const invoiceRef = this.asInvoiceReference(references);

    switch (eventType) {
      case ApplicationLogEventType.APPLICATION_CREATED:
        return applicationRef
          ? `You created ${applicationRef} and can continue it before submitting.`
          : fallbackDescription;
      case ApplicationLogEventType.APPLICATION_SUBMITTED:
        return applicationRef
          ? `${this.capitalize(applicationRef)} was submitted and is now under review.`
          : fallbackDescription;
      case ApplicationLogEventType.APPLICATION_RESUBMITTED:
        return applicationRef
          ? `You resubmitted ${applicationRef} after making the requested updates.`
          : fallbackDescription;
      case ApplicationLogEventType.APPLICATION_APPROVED:
        return applicationRef
          ? `${this.capitalize(applicationRef)} was approved and no further action is needed.`
          : fallbackDescription;
      case ApplicationLogEventType.APPLICATION_REJECTED:
        return applicationRef
          ? `${this.capitalize(applicationRef)} was rejected and will not continue.`
          : fallbackDescription;
      case ApplicationLogEventType.APPLICATION_WITHDRAWN:
        return applicationRef
          ? `${this.capitalize(applicationRef)} was withdrawn and is no longer active.`
          : fallbackDescription;
      case ApplicationLogEventType.APPLICATION_COMPLETED:
        return applicationRef ? `${this.capitalize(applicationRef)} completed successfully.` : fallbackDescription;
      case ApplicationLogEventType.AMENDMENTS_SUBMITTED:
        return applicationRef
          ? `We need updates to ${applicationRef} before it can continue.`
          : fallbackDescription;
      case ApplicationLogEventType.CONTRACT_OFFER_SENT:
        return contractRef
          ? `A contract offer for ${contractRef} is ready for your review and response.`
          : fallbackDescription;
      case ApplicationLogEventType.CONTRACT_OFFER_ACCEPTED:
        return contractRef
          ? `The offer for ${contractRef} was accepted and your application can move forward.`
          : fallbackDescription;
      case ApplicationLogEventType.CONTRACT_OFFER_REJECTED:
        return contractRef
          ? `The offer for ${contractRef} was declined and this application is now closed.`
          : fallbackDescription;
      case ApplicationLogEventType.CONTRACT_OFFER_RETRACTED:
        return contractRef
          ? `The offer for ${contractRef} was withdrawn before it was accepted.`
          : fallbackDescription;
      case ApplicationLogEventType.CONTRACT_WITHDRAWN:
        if (contractRef && applicationRef) {
          return `${this.capitalize(contractRef)} linked to ${applicationRef} was withdrawn.`;
        }
        return contractRef
          ? `${this.capitalize(contractRef)} was withdrawn.`
          : fallbackDescription;
      case ApplicationLogEventType.INVOICE_OFFER_SENT:
        return invoiceRef
          ? `An invoice offer for ${invoiceRef} is ready for your review and response.`
          : fallbackDescription;
      case ApplicationLogEventType.INVOICE_OFFER_ACCEPTED:
        return invoiceRef
          ? `The offer for ${invoiceRef} was accepted and funding can continue.`
          : fallbackDescription;
      case ApplicationLogEventType.INVOICE_OFFER_REJECTED:
        return invoiceRef
          ? `The offer for ${invoiceRef} was declined and this application has stopped moving forward.`
          : fallbackDescription;
      case ApplicationLogEventType.INVOICE_OFFER_RETRACTED:
        return invoiceRef
          ? `The offer for ${invoiceRef} was withdrawn before it was accepted.`
          : fallbackDescription;
      case ApplicationLogEventType.INVOICE_WITHDRAWN:
        if (invoiceRef && applicationRef) {
          return `${this.capitalize(invoiceRef)} linked to ${applicationRef} was withdrawn.`;
        }
        return invoiceRef
          ? `${this.capitalize(invoiceRef)} was withdrawn.`
          : fallbackDescription;
      default:
        return fallbackDescription;
    }
  }

  private buildReferences(record: ApplicationLog, metadata: Record<string, unknown>) {
    const references: Record<string, string> = {};
    const entityId = this.readEntityId(record.entity_id);
    const applicationReference = this.readDisplayString(metadata.application_reference);

    if (record.application_id) {
      references.applicationId = record.application_id;
      references.applicationReference =
        applicationReference ?? this.formatApplicationReference(record.application_id);
    }

    if (CONTRACT_EVENT_TYPES.has(record.event_type)) {
      const contractId = this.readDisplayString(metadata.contract_id) ?? entityId;
      const contractNumber = this.readDisplayString(metadata.contract_number);

      if (contractId) {
        references.contractId = contractId;
      }
      if (contractNumber) {
        references.contractNumber = contractNumber;
      }
    }

    if (INVOICE_EVENT_TYPES.has(record.event_type)) {
      const invoiceId = this.readDisplayString(metadata.invoice_id) ?? entityId;
      const invoiceNumber = this.readDisplayString(metadata.invoice_number);

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

  private asApplicationReference(applicationId?: string) {
    return applicationId ? `application ${applicationId}` : undefined;
  }

  private asContractReference(references?: ActivityReferences | null) {
    const contract = references?.contractNumber ?? references?.contractId;
    return contract ? `contract ${contract}` : undefined;
  }

  private asInvoiceReference(references?: ActivityReferences | null) {
    const invoice = references?.invoiceNumber ?? references?.invoiceId;
    return invoice ? `invoice ${invoice}` : undefined;
  }

  private capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private formatApplicationReference(applicationId: string) {
    return `#${applicationId.slice(-8).toUpperCase()}`;
  }

  buildPresentation(eventType: string, metadata?: Record<string, unknown>) {
    if (eventType === ApplicationLogEventType.APPLICATION_RESUBMITTED && metadata?.resubmit_changes) {
      const rc = metadata.resubmit_changes as { activity_summary?: string };
      if (typeof rc.activity_summary === "string" && rc.activity_summary.length > 0) {
        return {
          title: "Application Resubmitted",
          description: "You resubmitted your application after updating the requested information.",
        };
      }
    }
    const presentations: Record<string, { title: string; description: string }> = {
      [ApplicationLogEventType.APPLICATION_CREATED]: {
        title: "Application Started",
        description: "You created a financing application and can continue it before submitting.",
      },
      [ApplicationLogEventType.APPLICATION_SUBMITTED]: {
        title: "Application Submitted",
        description: "Your financing application was submitted and is now under review.",
      },
      [ApplicationLogEventType.APPLICATION_RESUBMITTED]: {
        title: "Application Resubmitted",
        description: "You resubmitted your application after making the requested updates.",
      },
      [ApplicationLogEventType.APPLICATION_APPROVED]: {
        title: "Application Approved",
        description: "Your financing application was approved and no further action is needed.",
      },
      [ApplicationLogEventType.APPLICATION_REJECTED]: {
        title: "Application Rejected",
        description: "Your financing application was rejected and will not continue.",
      },
      [ApplicationLogEventType.APPLICATION_WITHDRAWN]: {
        title: "Application Closed",
        description: "Your financing application was withdrawn and is no longer active.",
      },
      [ApplicationLogEventType.APPLICATION_COMPLETED]: {
        title: "Application Completed",
        description: "Your financing application completed successfully.",
      },
      [ApplicationLogEventType.CONTRACT_OFFER_SENT]: {
        title: "Contract Offer Sent",
        description: "A contract offer is ready for your review and response.",
      },
      [ApplicationLogEventType.CONTRACT_OFFER_ACCEPTED]: {
        title: "Contract Offer Accepted",
        description: "The contract offer was accepted and your application can move forward.",
      },
      [ApplicationLogEventType.CONTRACT_OFFER_REJECTED]: {
        title: "Contract Offer Declined",
        description: "The contract offer was declined and this application is now closed.",
      },
      [ApplicationLogEventType.CONTRACT_OFFER_RETRACTED]: {
        title: "Contract Offer Retracted",
        description: "The contract offer was withdrawn before it was accepted.",
      },
      [ApplicationLogEventType.CONTRACT_WITHDRAWN]: {
        title: "Contract Withdrawn",
        description: "The contract linked to this application was withdrawn.",
      },
      [ApplicationLogEventType.INVOICE_OFFER_SENT]: {
        title: "Invoice Offer Sent",
        description: "An invoice offer is ready for your review and response.",
      },
      [ApplicationLogEventType.INVOICE_OFFER_ACCEPTED]: {
        title: "Invoice Offer Accepted",
        description: "The invoice offer was accepted and funding can continue.",
      },
      [ApplicationLogEventType.INVOICE_OFFER_REJECTED]: {
        title: "Invoice Offer Declined",
        description: "The invoice offer was declined and this application has stopped moving forward.",
      },
      [ApplicationLogEventType.INVOICE_OFFER_RETRACTED]: {
        title: "Invoice Offer Retracted",
        description: "The invoice offer was withdrawn before it was accepted.",
      },
      [ApplicationLogEventType.INVOICE_WITHDRAWN]: {
        title: "Invoice Withdrawn",
        description: "An invoice linked to this application was withdrawn.",
      },
      [ApplicationLogEventType.OFFER_EXPIRED]: {
        title: "Offer Expired",
        description: "An outstanding offer expired before it was accepted.",
      },
      [ApplicationLogEventType.AMENDMENTS_SUBMITTED]: {
        title: "Changes Requested",
        description: "We need updates to your application before it can continue.",
      },
    };

    return (
      presentations[eventType] || {
        title: "Application Update",
        description: "An application update was recorded for your account.",
      }
    );
  }

  getEventTypes(): string[] {
    return [
      ApplicationLogEventType.APPLICATION_CREATED,
      ApplicationLogEventType.APPLICATION_SUBMITTED,
      ApplicationLogEventType.APPLICATION_RESUBMITTED,
      ApplicationLogEventType.APPLICATION_APPROVED,
      ApplicationLogEventType.APPLICATION_REJECTED,
      ApplicationLogEventType.APPLICATION_WITHDRAWN,
      ApplicationLogEventType.APPLICATION_COMPLETED,
      ApplicationLogEventType.CONTRACT_OFFER_SENT,
      ApplicationLogEventType.CONTRACT_OFFER_ACCEPTED,
      ApplicationLogEventType.CONTRACT_OFFER_REJECTED,
      ApplicationLogEventType.CONTRACT_OFFER_RETRACTED,
      ApplicationLogEventType.CONTRACT_WITHDRAWN,
      ApplicationLogEventType.INVOICE_OFFER_SENT,
      ApplicationLogEventType.INVOICE_OFFER_ACCEPTED,
      ApplicationLogEventType.INVOICE_OFFER_REJECTED,
      ApplicationLogEventType.INVOICE_OFFER_RETRACTED,
      ApplicationLogEventType.INVOICE_WITHDRAWN,
      ApplicationLogEventType.OFFER_EXPIRED,
      ApplicationLogEventType.AMENDMENTS_SUBMITTED,
    ];
  }
}
