import { resolveFacilityFeeUpfront } from "@cashsouk/types";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { listIssuerOrgMemberUserIds } from "./org-member-recipients";
import { systemNotificationLogKey } from "./delivery-log";
import { NotificationPayloads, NotificationTypeIds } from "./registry";
import { NotificationService } from "./service";
import { sendTypedToUsersSafe } from "./send-typed-safe";

export function facilityFeePaymentRequestedIdempotencyKey(
  contractId: string,
  userId: string
): string {
  return `contract:${contractId}:notif:${NotificationTypeIds.FACILITY_FEE_PAYMENT_REQUESTED}:user:${userId}`;
}

export function facilityFeeUpfrontPaidIdempotencyKey(contractId: string, userId: string): string {
  return `contract:${contractId}:notif:${NotificationTypeIds.FACILITY_FEE_UPFRONT_PAID}:user:${userId}`;
}

export function shouldNotifyFacilityFeePaymentRequested(upfrontAmount: number): boolean {
  return upfrontAmount > 0;
}

export function shouldNotifyFacilityFeeUpfrontPaid(details: unknown): boolean {
  const { outstanding } = resolveFacilityFeeUpfront(details);
  return outstanding <= 0;
}

export async function notifyFacilityFeeUpfrontPaidIfSettled(input: {
  notificationService?: NotificationService;
  contractId: string;
  issuerOrganizationId?: string | null;
}): Promise<void> {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: input.contractId },
      select: { contract_details: true, issuer_organization_id: true },
    });
    if (!contract || !shouldNotifyFacilityFeeUpfrontPaid(contract.contract_details)) {
      return;
    }
    const orgId = input.issuerOrganizationId ?? contract.issuer_organization_id;
    if (!orgId) return;

    const { upfrontAmount } = resolveFacilityFeeUpfront(contract.contract_details);
    const payload: NotificationPayloads[typeof NotificationTypeIds.FACILITY_FEE_UPFRONT_PAID] = {
      contractId: input.contractId,
      upfrontAmount,
    };
    const svc = input.notificationService ?? new NotificationService();
    const recipients = await listIssuerOrgMemberUserIds(orgId);
    const results = await sendTypedToUsersSafe(
      svc,
      recipients,
      NotificationTypeIds.FACILITY_FEE_UPFRONT_PAID,
      payload,
      (userId) => facilityFeeUpfrontPaidIdempotencyKey(input.contractId, userId)
    );
    await svc.logTypedSystemBatch(NotificationTypeIds.FACILITY_FEE_UPFRONT_PAID, payload, results, {
      idempotencyKey: systemNotificationLogKey(
        NotificationTypeIds.FACILITY_FEE_UPFRONT_PAID,
        `contract:${input.contractId}`
      ),
    });
  } catch (error) {
    logger.error(
      { error, contractId: input.contractId },
      "Failed to send facility fee upfront paid notification"
    );
  }
}
