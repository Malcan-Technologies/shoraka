import { GatewayPayment, GatewayPaymentPurpose } from "@prisma/client";
import { logger } from "../../lib/logger";
import { systemNotificationLogKey } from "./delivery-log";
import { listInvestorOrgMemberUserIds } from "./org-member-recipients";
import { NotificationTypeIds } from "./registry";
import { NotificationService } from "./service";
import { sendTypedToUsersSafe } from "./send-typed-safe";

/**
 * Investor deposit gateway-event notifications. All four fire only for
 * GatewayPaymentPurpose.INVESTOR_DEPOSIT — onboarding-fee and processing-fee
 * gateway payments (issuer-side) never notify from here.
 *
 * A deposit gateway payment has no individual user id; ownership is at the
 * investor organization level (investor_organization_id), so recipients are
 * every member of that organization — the same resolution already used for
 * other investor-organization-scoped notifications (see
 * note-lifecycle-notifications.ts / listInvestorOrgMemberUserIds).
 *
 * Idempotency key is deterministic per gateway payment + notification type,
 * so repeated webhook/admin-retry calls for the same payment never create a
 * duplicate notification or duplicate email (NotificationService.create()
 * dedupes on idempotencyKey).
 */
const notificationService = new NotificationService();

function logDepositNotificationError(stage: string, gatewayPaymentId: string, err: unknown) {
  logger.error({ err, gatewayPaymentId, stage }, "Deposit notification failed");
}

async function sendToInvestorOrgForPayment(
  payment: GatewayPayment,
  typeId:
    | typeof NotificationTypeIds.DEPOSIT_NAME_CHECK_REJECTED
    | typeof NotificationTypeIds.DEPOSIT_REFUND_INITIATED
    | typeof NotificationTypeIds.DEPOSIT_REFUNDED
    | typeof NotificationTypeIds.DEPOSIT_SUCCESSFUL,
  idempotencySuffix: string
): Promise<void> {
  if (payment.purpose !== GatewayPaymentPurpose.INVESTOR_DEPOSIT || !payment.investor_organization_id) {
    return;
  }
  const recipients = await listInvestorOrgMemberUserIds(payment.investor_organization_id);
  const payload = { amount: payment.amount.toNumber() };
  const results = await sendTypedToUsersSafe(
    notificationService,
    recipients,
    typeId,
    payload,
    (userId) => `gateway-payment:${payment.id}:notif:${typeId}:user:${userId}:${idempotencySuffix}`
  );
  await notificationService.logTypedSystemBatch(typeId, payload, results, {
    idempotencyKey: systemNotificationLogKey(
      typeId,
      `gateway-payment:${payment.id}:${idempotencySuffix}`
    ),
  });
}

/** After an admin rejects bank-name verification on a deposit (refund follows separately). */
export async function notifyDepositNameCheckRejected(payment: GatewayPayment): Promise<void> {
  try {
    await sendToInvestorOrgForPayment(
      payment,
      NotificationTypeIds.DEPOSIT_NAME_CHECK_REJECTED,
      "name_check_rejected"
    );
  } catch (err) {
    logDepositNotificationError("name_check_rejected", payment.id, err);
  }
}

/** After a Curlec refund is successfully requested for a deposit (status → REFUND_INITIATED). */
export async function notifyDepositRefundInitiated(payment: GatewayPayment): Promise<void> {
  try {
    await sendToInvestorOrgForPayment(
      payment,
      NotificationTypeIds.DEPOSIT_REFUND_INITIATED,
      "refund_initiated"
    );
  } catch (err) {
    logDepositNotificationError("refund_initiated", payment.id, err);
  }
}

/** After a deposit refund is confirmed and the wallet reversal completes (status → REFUNDED). */
export async function notifyDepositRefunded(payment: GatewayPayment): Promise<void> {
  try {
    await sendToInvestorOrgForPayment(payment, NotificationTypeIds.DEPOSIT_REFUNDED, "refunded");
  } catch (err) {
    logDepositNotificationError("refunded", payment.id, err);
  }
}

/** After an investor deposit is credited to the wallet (status → COMPLETED). */
export async function notifyDepositSuccessful(payment: GatewayPayment): Promise<void> {
  try {
    await sendToInvestorOrgForPayment(
      payment,
      NotificationTypeIds.DEPOSIT_SUCCESSFUL,
      "successful"
    );
  } catch (err) {
    logDepositNotificationError("successful", payment.id, err);
  }
}
