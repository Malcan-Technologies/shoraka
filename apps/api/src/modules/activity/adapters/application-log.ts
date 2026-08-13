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
import type { ActivityReferences } from "@cashsouk/types";
import { formatApplicationReference } from "@cashsouk/types";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import { APPLICATION_AUDIT_EVENTS } from "../../applications/audit/events";

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
    const { search, event_types, startDate, endDate, limit, offset, organizationId, portalType } = filters;
    const supportedTypes = this.getEventTypes();
    const finalEventTypes = event_types
      ? event_types.filter((et) => supportedTypes.includes(et))
      : supportedTypes;

    const where: Prisma.ApplicationAuditLogWhereInput = {
      event_type: { in: finalEventTypes },
      occurred_at: buildDateFilter(startDate, endDate),
    };

    if (organizationId && portalType) {
      where.application_id = { in: await this.getScopedApplicationIds(organizationId, portalType) };
    } else {
      where.actor_user_id = userId;
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

    const records = await prisma.applicationAuditLog.findMany({
      where,
      orderBy: { occurred_at: "desc" },
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

    const where: Prisma.ApplicationAuditLogWhereInput = {
      event_type: { in: finalEventTypes },
      occurred_at: buildDateFilter(startDate, endDate),
    };

    if (organizationId && portalType) {
      where.application_id = { in: await this.getScopedApplicationIds(organizationId, portalType) };
    } else {
      where.actor_user_id = userId;
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

    return prisma.applicationAuditLog.count({ where });
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

  transform(record: ApplicationAuditLog): UnifiedActivity {
    const baseMetadata = (record.metadata as Record<string, unknown> | null) || {};
    const remark =
      typeof baseMetadata.remarks === "string"
        ? baseMetadata.remarks
        : typeof baseMetadata.remark === "string"
          ? baseMetadata.remark
          : null;
    const presentation = this.buildPresentation(record.event_type, {
      ...baseMetadata,
      ...(remark ? { remark } : {}),
    });
    const references = this.buildReferences(record, baseMetadata);
    const description = this.buildDescription(record.event_type, presentation.description, references);

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
      case "APPLICATION_CREATED":
        return applicationRef
          ? `You created ${applicationRef} and can continue it before submitting.`
          : fallbackDescription;
      case "APPLICATION_SUBMITTED":
        return applicationRef
          ? `${this.capitalize(applicationRef)} was submitted and is now under review.`
          : fallbackDescription;
      case "APPLICATION_RESUBMITTED":
        return applicationRef
          ? `You resubmitted ${applicationRef} after making the requested updates.`
          : fallbackDescription;
      case "APPLICATION_APPROVED":
        return applicationRef
          ? `${this.capitalize(applicationRef)} was approved and no further action is needed.`
          : fallbackDescription;
      case "APPLICATION_REJECTED":
        return applicationRef
          ? `${this.capitalize(applicationRef)} was rejected and will not continue.`
          : fallbackDescription;
      case "APPLICATION_WITHDRAWN":
        return applicationRef
          ? `${this.capitalize(applicationRef)} was withdrawn and is no longer active.`
          : fallbackDescription;
      case "APPLICATION_COMPLETED":
        return applicationRef ? `${this.capitalize(applicationRef)} completed successfully.` : fallbackDescription;
      case "APPLICATION_AMENDMENTS_REQUESTED":
      case "AMENDMENTS_SUBMITTED":
        return applicationRef
          ? `We need updates to ${applicationRef} before it can continue.`
          : fallbackDescription;
      case "CONTRACT_OFFER_SENT":
        return contractRef
          ? `A contract offer for ${contractRef} is ready for your review and response.`
          : fallbackDescription;
      case "CONTRACT_ACCEPTANCE_SUBMITTED":
      case "CONTRACT_OFFER_ACCEPTANCE_SUBMITTED":
        return contractRef
          ? `You submitted acceptance for ${contractRef} and CashSouk is reviewing your documents.`
          : fallbackDescription;
      case "CONTRACT_ACCEPTANCE_RESUBMITTED":
      case "CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED":
        return contractRef
          ? `You resubmitted acceptance documents for ${contractRef} after requested changes.`
          : fallbackDescription;
      case "CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING":
        return contractRef
          ? `Acceptance for ${contractRef} was approved. You can configure and send the signing package.`
          : fallbackDescription;
      case "CONTRACT_OFFER_ACCEPTED":
        return contractRef
          ? `All signers completed the package for ${contractRef} and the offer is signed.`
          : fallbackDescription;
      case "CONTRACT_OFFER_REJECTED":
        return contractRef
          ? `The offer for ${contractRef} was declined and this application is now closed.`
          : fallbackDescription;
      case "CONTRACT_OFFER_RETRACTED":
        return contractRef
          ? `The offer for ${contractRef} was withdrawn before it was accepted.`
          : fallbackDescription;
      case "CONTRACT_WITHDRAWN":
        if (contractRef && applicationRef) {
          return `${this.capitalize(contractRef)} linked to ${applicationRef} was withdrawn.`;
        }
        return contractRef
          ? `${this.capitalize(contractRef)} was withdrawn.`
          : fallbackDescription;
      case "INVOICE_OFFER_SENT":
        return invoiceRef
          ? `An invoice offer for ${invoiceRef} is ready for your review and response.`
          : fallbackDescription;
      case "INVOICE_ACCEPTANCE_SUBMITTED":
      case "INVOICE_OFFER_ACCEPTANCE_SUBMITTED":
        return invoiceRef
          ? `You submitted acceptance for ${invoiceRef} and CashSouk is reviewing your documents.`
          : fallbackDescription;
      case "INVOICE_ACCEPTANCE_RESUBMITTED":
      case "INVOICE_OFFER_ACCEPTANCE_RESUBMITTED":
        return invoiceRef
          ? `You resubmitted acceptance documents for ${invoiceRef} after requested changes.`
          : fallbackDescription;
      case "INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING":
        return invoiceRef
          ? `Acceptance for ${invoiceRef} was approved. You can configure and send the signing package.`
          : fallbackDescription;
      case "INVOICE_OFFER_ACCEPTED":
        return invoiceRef
          ? `All signers completed the package for ${invoiceRef} and the offer is signed.`
          : fallbackDescription;
      case "INVOICE_OFFER_REJECTED":
        return invoiceRef
          ? `The offer for ${invoiceRef} was declined and this application has stopped moving forward.`
          : fallbackDescription;
      case "INVOICE_OFFER_RETRACTED":
        return invoiceRef
          ? `The offer for ${invoiceRef} was withdrawn before it was accepted.`
          : fallbackDescription;
      case "INVOICE_WITHDRAWN":
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

  buildPresentation(eventType: string, metadata?: Record<string, unknown>) {
    if (eventType === "APPLICATION_RESUBMITTED") {
      const summary =
        (typeof metadata?.activitySummary === "string" && metadata.activitySummary) ||
        (metadata?.resubmit_changes as { activity_summary?: string } | undefined)?.activity_summary;
      if (typeof summary === "string" && summary.length > 0) {
        return {
          title: "Application Resubmitted",
          description: "You resubmitted your application after updating the requested information.",
        };
      }
    }
    const presentations: Record<string, { title: string; description: string }> = {
      ["APPLICATION_CREATED"]: {
        title: "Application Started",
        description: "You created a financing application and can continue it before submitting.",
      },
      ["APPLICATION_SUBMITTED"]: {
        title: "Application Submitted",
        description: "Your financing application was submitted and is now under review.",
      },
      ["APPLICATION_RESUBMITTED"]: {
        title: "Application Resubmitted",
        description: "You resubmitted your application after making the requested updates.",
      },
      ["APPLICATION_APPROVED"]: {
        title: "Application Approved",
        description: "Your financing application was approved and no further action is needed.",
      },
      ["APPLICATION_REJECTED"]: {
        title: "Application Rejected",
        description: "Your financing application was rejected and will not continue.",
      },
      ["APPLICATION_WITHDRAWN"]: {
        title: "Application Closed",
        description: "Your financing application was withdrawn and is no longer active.",
      },
      ["APPLICATION_COMPLETED"]: {
        title: "Application Completed",
        description: "Your financing application completed successfully.",
      },
      ["CONTRACT_OFFER_SENT"]: {
        title: "Contract Offer Sent",
        description: "A contract offer is ready for your review and response.",
      },
      ["CONTRACT_ACCEPTANCE_SUBMITTED"]: {
        title: "Contract Acceptance Submitted",
        description: "You submitted offer acceptance documents for CashSouk review.",
      },
      ["CONTRACT_OFFER_ACCEPTANCE_SUBMITTED"]: {
        title: "Contract Acceptance Submitted",
        description: "You submitted offer acceptance documents for CashSouk review.",
      },
      ["CONTRACT_ACCEPTANCE_RESUBMITTED"]: {
        title: "Contract Acceptance Resubmitted",
        description: "You resubmitted offer acceptance documents after CashSouk requested changes.",
      },
      ["CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED"]: {
        title: "Contract Acceptance Resubmitted",
        description: "You resubmitted offer acceptance documents after CashSouk requested changes.",
      },
      ["CONTRACT_OFFER_ACCEPTED"]: {
        title: "Contract Offer Signed",
        description: "All signers completed the contract offer signing package.",
      },
      ["CONTRACT_OFFER_REJECTED"]: {
        title: "Contract Offer Declined",
        description: "The contract offer was declined and this application is now closed.",
      },
      ["CONTRACT_OFFER_RETRACTED"]: {
        title: "Contract Offer Retracted",
        description: "The contract offer was withdrawn before it was accepted.",
      },
      ["CONTRACT_OFFER_EXPIRED"]: {
        title: "Contract Offer Expired",
        description: "The contract offer expired. A new offer can be sent from the Contract tab.",
      },
      ["CONTRACT_SIGNING_DEADLINE_EXTENDED"]: {
        title: "Signing Deadline Extended",
        description: "CashSouk extended the signing deadline so you can complete the signing package.",
      },
      ["CONTRACT_WITHDRAWN"]: {
        title: "Contract Withdrawn",
        description: "The contract linked to this application was withdrawn.",
      },
      ["INVOICE_OFFER_SENT"]: {
        title: "Invoice Offer Sent",
        description: "An invoice offer is ready for your review and response.",
      },
      ["INVOICE_ACCEPTANCE_SUBMITTED"]: {
        title: "Invoice Acceptance Submitted",
        description: "You submitted offer acceptance documents for CashSouk review.",
      },
      ["INVOICE_OFFER_ACCEPTANCE_SUBMITTED"]: {
        title: "Invoice Acceptance Submitted",
        description: "You submitted offer acceptance documents for CashSouk review.",
      },
      ["INVOICE_ACCEPTANCE_RESUBMITTED"]: {
        title: "Invoice Acceptance Resubmitted",
        description: "You resubmitted offer acceptance documents after CashSouk requested changes.",
      },
      ["INVOICE_OFFER_ACCEPTANCE_RESUBMITTED"]: {
        title: "Invoice Acceptance Resubmitted",
        description: "You resubmitted offer acceptance documents after CashSouk requested changes.",
      },
      ["INVOICE_OFFER_ACCEPTED"]: {
        title: "Invoice Offer Signed",
        description: "All signers completed the invoice offer signing package.",
      },
      ["INVOICE_OFFER_REJECTED"]: {
        title: "Invoice Offer Declined",
        description: "The invoice offer was declined and this application has stopped moving forward.",
      },
      ["INVOICE_OFFER_RETRACTED"]: {
        title: "Invoice Offer Retracted",
        description: "The invoice offer was withdrawn before it was accepted.",
      },
      ["INVOICE_OFFER_EXPIRED"]: {
        title: "Invoice Offer Expired",
        description: "The invoice offer expired. A new offer can be sent from the Invoice tab.",
      },
      ["INVOICE_SIGNING_DEADLINE_EXTENDED"]: {
        title: "Signing Deadline Extended",
        description: "CashSouk extended the signing deadline so you can complete the signing package.",
      },
      ["INVOICE_WITHDRAWN"]: {
        title: "Invoice Withdrawn",
        description: "An invoice linked to this application was withdrawn.",
      },
      ["APPLICATION_AMENDMENTS_REQUESTED"]: {
        title: "Changes Requested",
        description: "We need updates to your application before it can continue.",
      },
      ["AMENDMENTS_SUBMITTED"]: {
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
    return [...APPLICATION_AUDIT_EVENTS];
  }
}
