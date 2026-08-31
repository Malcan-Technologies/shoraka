/**
 * Read-only Paymaster identity Activity. Reuses `application_logs` rows written by
 * identity-audit; does not create events or send notifications.
 */

import {
  isPaymasterIdentityActivityEventType,
  PAYMASTER_IDENTITY_ACTIVITY_EVENT_TYPES,
  type PaymasterActivityEvent,
  type PaymasterIdentityActivityEventType,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { loadUserDisplayNameMap } from "../../lib/user-display-name";

type ApplicationLogRow = {
  id: string;
  event_type: string;
  created_at: Date;
  remark: string | null;
  user_id: string | null;
  portal: string | null;
  entity_id: string | null;
  application_id: string | null;
  metadata: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))];
}

function productIdFromFinancingType(value: unknown): string | null {
  return asString(asRecord(value)?.product_id);
}

export function paymasterIdFromApplicationLog(log: {
  entity_id: string | null;
  metadata: unknown;
}): string | null {
  const fromEntity = asString(log.entity_id);
  const fromMetadata = asString(asRecord(log.metadata)?.paymaster_id);
  return fromMetadata ?? fromEntity;
}

export function applicationLogBelongsToPaymaster(
  log: { event_type: string; entity_id: string | null; metadata: unknown },
  paymasterId: string
): boolean {
  if (!isPaymasterIdentityActivityEventType(log.event_type)) return false;
  return paymasterIdFromApplicationLog(log) === paymasterId;
}

export function selectPaymasterIdentityActivityLogs<T extends ApplicationLogRow>(
  logs: T[],
  paymasterId: string
): T[] {
  return logs
    .filter((log) => applicationLogBelongsToPaymaster(log, paymasterId))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

export async function listAdminPaymasterActivity(
  paymasterId: string
): Promise<{ events: PaymasterActivityEvent[] }> {
  const exists = await prisma.paymaster.findUnique({
    where: { id: paymasterId },
    select: { id: true },
  });
  if (!exists) throw new AppError(404, "PAYMASTER_NOT_FOUND", "Paymaster not found");

  const logs = await prisma.applicationLog.findMany({
    where: {
      event_type: { in: [...PAYMASTER_IDENTITY_ACTIVITY_EVENT_TYPES] },
      OR: [
        { entity_id: paymasterId },
        { metadata: { path: ["paymaster_id"], equals: paymasterId } },
      ],
    },
    orderBy: { created_at: "desc" },
  });

  const matched = selectPaymasterIdentityActivityLogs(logs, paymasterId);
  if (matched.length === 0) return { events: [] };

  const metadataRecords = matched.map((log) => asRecord(log.metadata));
  const issuerIds = uniqueIds(metadataRecords.map((meta) => asString(meta?.issuer_organization_id)));
  const applicationIds = uniqueIds([
    ...matched.map((log) => log.application_id),
    ...metadataRecords.map((meta) => asString(meta?.application_id)),
  ]);
  const actorIds = matched.map((log) => log.user_id);

  const [actorNames, issuers, applications] = await Promise.all([
    loadUserDisplayNameMap(prisma, actorIds),
    issuerIds.length
      ? prisma.issuerOrganization.findMany({
          where: { id: { in: issuerIds } },
          select: { id: true, name: true, display_reference: true },
        })
      : Promise.resolve([]),
    applicationIds.length
      ? prisma.application.findMany({
          where: { id: { in: applicationIds } },
          select: { id: true, display_reference: true, financing_type: true },
        })
      : Promise.resolve([]),
  ]);

  const issuerById = new Map(
    issuers.map((issuer) => [
      issuer.id,
      { name: issuer.name, displayReference: issuer.display_reference },
    ])
  );
  const applicationById = new Map(
    applications.map((application) => [
      application.id,
      {
        displayReference: application.display_reference,
        productId: productIdFromFinancingType(application.financing_type),
      },
    ])
  );

  return {
    events: matched.map((log) => {
      const metadata = asRecord(log.metadata);
      const eventType = log.event_type as PaymasterIdentityActivityEventType;
      const issuerOrganizationId = asString(metadata?.issuer_organization_id);
      const applicationId = log.application_id ?? asString(metadata?.application_id);
      const issuer = issuerOrganizationId ? issuerById.get(issuerOrganizationId) : undefined;
      const application = applicationId ? applicationById.get(applicationId) : undefined;
      const applicationDisplayReference =
        application?.displayReference ?? asString(metadata?.applicationReference);

      return {
        id: log.id,
        eventType,
        createdAt: log.created_at.toISOString(),
        remark: log.remark,
        actorUserId: log.user_id,
        actorName: log.user_id ? (actorNames.get(log.user_id) ?? null) : null,
        portal: log.portal,
        paymasterId: paymasterIdFromApplicationLog(log) ?? paymasterId,
        issuerOrganizationId,
        issuerName: issuer?.name ?? null,
        issuerDisplayReference: issuer?.displayReference ?? null,
        applicationId,
        applicationDisplayReference,
        applicationProductId: application?.productId ?? null,
        relatedParty: asBoolean(metadata?.related_party),
        verificationStatus: asString(metadata?.verification_status),
        previousStatus: asString(metadata?.previous_status),
        newStatus: asString(metadata?.new_status),
        metadata,
      };
    }),
  };
}
