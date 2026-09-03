/**
 * Paymaster master-identity application Activity metadata.
 * Create/link/verify store trusted master identity. Use Verified also records the
 * submitted-before overlay on this application.
 */

import type { Prisma } from "@prisma/client";
import { ActivityPortal, ApplicationLogEventType } from "../applications/logs/types";
import { logApplicationActivity } from "../applications/logs/service";
import type { AuditRequestContext } from "../../lib/audit";
import type { PaymasterVerificationStatus } from "@cashsouk/types";
import { prisma } from "../../lib/prisma";

type PaymasterIdentityEventType =
  | typeof ApplicationLogEventType.PAYMASTER_CREATED
  | typeof ApplicationLogEventType.PAYMASTER_LINKED_TO_ISSUER
  | typeof ApplicationLogEventType.PAYMASTER_VERIFIED
  | typeof ApplicationLogEventType.PAYMASTER_IDENTITY_RESOLVED;

export function buildPaymasterIdentityRemark(params: {
  eventType: PaymasterIdentityEventType;
  legalName: string;
  registrationNumber: string;
}): string {
  const identity = `${params.legalName} (${params.registrationNumber})`;
  if (params.eventType === ApplicationLogEventType.PAYMASTER_CREATED) {
    return `${identity} created as Unverified.`;
  }
  if (params.eventType === ApplicationLogEventType.PAYMASTER_LINKED_TO_ISSUER) {
    return `${identity} linked to this issuer.`;
  }
  if (params.eventType === ApplicationLogEventType.PAYMASTER_IDENTITY_RESOLVED) {
    return `Submitted customer identity replaced with verified Paymaster ${identity}.`;
  }
  return `${identity} identity reviewed internally. Unverified → Verified.`;
}

export function buildPaymasterIdentityAuditMetadata(params: {
  paymasterId: string;
  registrationNumber: string;
  legalName: string;
  verificationStatus: PaymasterVerificationStatus | string;
  issuerOrganizationId?: string | null;
  issuerPaymasterLinkId?: string | null;
  applicationId?: string | null;
  contractId?: string | null;
  relatedParty?: boolean | null;
  previousStatus?: string;
  newStatus?: string;
  verifiedByUserId?: string;
  source?: string;
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    paymaster_id: params.paymasterId,
    registrationNumber: params.registrationNumber,
    legalName: params.legalName,
    verification_status: params.verificationStatus,
  };
  if (params.issuerOrganizationId) metadata.issuer_organization_id = params.issuerOrganizationId;
  if (params.issuerPaymasterLinkId) metadata.issuer_paymaster_link_id = params.issuerPaymasterLinkId;
  if (params.applicationId) metadata.application_id = params.applicationId;
  if (params.contractId) metadata.contract_id = params.contractId;
  if (params.relatedParty != null) metadata.related_party = params.relatedParty;
  if (params.previousStatus) metadata.previous_status = params.previousStatus;
  if (params.newStatus) metadata.new_status = params.newStatus;
  if (params.verifiedByUserId) metadata.verified_by_user_id = params.verifiedByUserId;
  if (params.source) metadata.source = params.source;
  return metadata;
}

export async function writePaymasterIdentityApplicationLog(
  params: {
    eventType: PaymasterIdentityEventType;
    actorUserId: string;
    applicationId: string;
    portal: ActivityPortal;
    paymasterId: string;
    metadata: Record<string, unknown>;
    context?: AuditRequestContext | null;
    remark?: string;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  const legalName =
    typeof params.metadata.legalName === "string" ? params.metadata.legalName : "";
  const registrationNumber =
    typeof params.metadata.registrationNumber === "string"
      ? params.metadata.registrationNumber
      : "";
  await logApplicationActivity(
    {
      userId: params.actorUserId,
      applicationId: params.applicationId,
      entityId: params.paymasterId,
      eventType: params.eventType,
      portal: params.portal,
      metadata: params.metadata,
      context: params.context,
      remark:
        params.remark ||
        (legalName && registrationNumber
          ? buildPaymasterIdentityRemark({
              eventType: params.eventType,
              legalName,
              registrationNumber,
            })
          : undefined),
    },
    db
  );
}
