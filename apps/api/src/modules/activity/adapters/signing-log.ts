import { prisma } from "../../../lib/prisma";
import { Prisma, SigningAuditLog } from "@prisma/client";
import {
  AuditLogAdapter,
  UnifiedActivity,
  ActivityFilters,
  buildDateFilter,
} from "./base";
import type { ActivityReferences } from "@cashsouk/types";
import { formatApplicationReference } from "@cashsouk/types";
import { formatDeviceInfoFromUserAgent } from "../../../lib/http/request-utils";
import { SIGNING_AUDIT_EVENTS } from "../../signing/audit/events";

export class SigningLogAdapter implements AuditLogAdapter<SigningAuditLog> {
  public readonly name = "SigningLogAdapter";
  public readonly category = "organization";
  public readonly domain = "signing" as const;

  async query(userId: string, filters: ActivityFilters): Promise<SigningAuditLog[]> {
    const { search, event_types, startDate, endDate, limit, offset, organizationId, portalType } = filters;
    const supportedTypes = this.getEventTypes();
    const finalEventTypes = event_types
      ? event_types.filter((et) => supportedTypes.includes(et))
      : supportedTypes;

    const where: Prisma.SigningAuditLogWhereInput = {
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
      ];
    }

    return prisma.signingAuditLog.findMany({
      where,
      orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
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

    const where: Prisma.SigningAuditLogWhereInput = {
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
      ];
    }

    return prisma.signingAuditLog.count({ where });
  }

  transform(record: SigningAuditLog): UnifiedActivity {
    const metadata = (record.metadata as Record<string, unknown> | null) || {};
    const presentation = this.buildPresentation(record.event_type, metadata);
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

  buildPresentation(eventType: string, _metadata?: Record<string, unknown>) {
    const presentations: Record<string, { title: string; description: string }> = {
      SIGNING_PACKAGE_CREATED: {
        title: "Signing Package Created",
        description: "A draft signing package was created for this offer.",
      },
      SIGNING_PACKAGE_SENT: {
        title: "Signing Package Sent",
        description: "Signers were invited to complete the signing package.",
      },
      SIGNING_PACKAGE_COMPLETED: {
        title: "Signing Package Completed",
        description: "All required signers completed the signing package.",
      },
      SIGNING_PACKAGE_VOIDED: {
        title: "Signing Package Voided",
        description: "The signing package was voided.",
      },
      SIGNING_PACKAGE_DECLINED: {
        title: "Signing Package Declined",
        description: "A signer declined the signing package.",
      },
      SIGNING_PACKAGE_EXPIRED: {
        title: "Signing Package Expired",
        description: "The signing package expired before it was completed.",
      },
      SIGNING_RECIPIENT_COMPLETED: {
        title: "Signer Completed",
        description: "A signer finished signing their assigned documents.",
      },
      SIGNING_RECIPIENT_DECLINED: {
        title: "Signer Declined",
        description: "A signer declined to sign.",
      },
      SIGNING_EKYC_STARTED: {
        title: "Signing Identity Check Started",
        description: "Identity verification was started for a signer.",
      },
      SIGNING_EKYC_VERIFIED: {
        title: "Signing Identity Verified",
        description: "A signer completed identity verification.",
      },
      SIGNING_EKYC_FAILED: {
        title: "Signing Identity Check Failed",
        description: "Identity verification for a signer did not succeed.",
      },
      SIGNING_REMINDER_SENT: {
        title: "Signing Reminder Sent",
        description: "A manual reminder was sent to a signer.",
      },
    };

    return (
      presentations[eventType] || {
        title: "Signing Update",
        description: "A signing update was recorded.",
      }
    );
  }

  getEventTypes(): string[] {
    return [...SIGNING_AUDIT_EVENTS];
  }
}
