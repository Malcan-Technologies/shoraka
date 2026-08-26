import { WithdrawalType } from "@prisma/client";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { resolveNoteNotificationTitle } from "./note-lifecycle-notifications";
import { listInvestorOrgMemberUserIds, listIssuerOrgMemberUserIds } from "./org-member-recipients";
import { systemNotificationLogKey } from "./delivery-log";
import { NotificationPayloads, NotificationTypeIds } from "./registry";
import { NotificationService } from "./service";
import { sendTypedSafe } from "./send-typed-safe";

export type WithdrawalNotificationPortal = "investor" | "issuer";

export type WithdrawalNotificationTarget = {
  portal: WithdrawalNotificationPortal;
  organizationId: string;
};

export type WithdrawalNotificationDelivery = {
  userId: string;
  portal: WithdrawalNotificationPortal;
  notificationId: string | null;
};

export type WithdrawalNotificationSummary = {
  withdrawalId: string;
  skipped: boolean;
  skipReason?: string;
  attempted: number;
  delivered: number;
  deliveries: WithdrawalNotificationDelivery[];
};

type WithdrawalNotificationInput = {
  id: string;
  note_id?: string | null;
  withdrawal_type: WithdrawalType;
  display_reference?: string | null;
  investor_organization_id?: string | null;
  issuer_organization_id?: string | null;
};

export function withdrawalSubmittedToTrusteeIdempotencyKey(
  withdrawalId: string,
  portal: WithdrawalNotificationPortal,
  userId: string
): string {
  return `withdrawal:${withdrawalId}:notif:${NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE}:${portal}:user:${userId}`;
}

export function resolveWithdrawalNotificationTargets(
  withdrawal: Pick<
    WithdrawalNotificationInput,
    "withdrawal_type" | "investor_organization_id" | "issuer_organization_id"
  >
): WithdrawalNotificationTarget[] {
  const investorOrgId = withdrawal.investor_organization_id?.trim() || null;
  const issuerOrgId = withdrawal.issuer_organization_id?.trim() || null;
  const targets: WithdrawalNotificationTarget[] = [];

  const includeInvestor =
    withdrawal.withdrawal_type === WithdrawalType.INVESTOR_WITHDRAWAL ||
    withdrawal.withdrawal_type === WithdrawalType.ADMIN_ADJUSTMENT;
  const includeIssuer =
    withdrawal.withdrawal_type === WithdrawalType.ISSUER_DISBURSEMENT ||
    withdrawal.withdrawal_type === WithdrawalType.ISSUER_RESIDUAL_RETURN ||
    withdrawal.withdrawal_type === WithdrawalType.ADMIN_ADJUSTMENT;

  if (includeInvestor && investorOrgId) {
    targets.push({ portal: "investor", organizationId: investorOrgId });
  }
  if (includeIssuer && issuerOrgId) {
    targets.push({ portal: "issuer", organizationId: issuerOrgId });
  }
  return targets;
}

function emptySummary(
  withdrawalId: string,
  skipped: boolean,
  skipReason?: string
): WithdrawalNotificationSummary {
  return {
    withdrawalId,
    skipped,
    skipReason,
    attempted: 0,
    delivered: 0,
    deliveries: [],
  };
}

async function listRecipientsForTarget(target: WithdrawalNotificationTarget): Promise<string[]> {
  return target.portal === "investor"
    ? listInvestorOrgMemberUserIds(target.organizationId)
    : listIssuerOrgMemberUserIds(target.organizationId);
}

export async function notifyWithdrawalSubmittedToTrustee(input: {
  notificationService?: NotificationService;
  withdrawal: WithdrawalNotificationInput;
}): Promise<WithdrawalNotificationSummary> {
  const { withdrawal } = input;
  try {
    const targets = resolveWithdrawalNotificationTargets(withdrawal);
    if (targets.length === 0) {
      logger.warn(
        {
          withdrawalId: withdrawal.id,
          withdrawalType: withdrawal.withdrawal_type,
          investorOrganizationId: withdrawal.investor_organization_id ?? null,
          issuerOrganizationId: withdrawal.issuer_organization_id ?? null,
        },
        "Skipping withdrawal submitted notification: no investor or issuer org target"
      );
      return emptySummary(withdrawal.id, true, "no_org_target");
    }

    const note = withdrawal.note_id
      ? await prisma.note.findUnique({
          where: { id: withdrawal.note_id },
          select: { title: true, note_reference: true },
        })
      : null;
    const noteTitle = resolveNoteNotificationTitle({
      title: note?.title,
      note_reference: note?.note_reference ?? withdrawal.display_reference,
    });

    const svc = input.notificationService ?? new NotificationService();
    const deliveries: WithdrawalNotificationDelivery[] = [];

    for (const target of targets) {
      const payload: NotificationPayloads[typeof NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE] =
        {
          withdrawalId: withdrawal.id,
          noteId: withdrawal.note_id ?? "",
          noteTitle,
          noteReference: note?.note_reference ?? null,
          displayReference: withdrawal.display_reference ?? null,
          withdrawalType: withdrawal.withdrawal_type,
          portalType: target.portal,
        };
      const recipients = await listRecipientsForTarget(target);
      const results = await Promise.all(
        recipients.map(async (userId) => {
          const notification = await sendTypedSafe(
            svc,
            userId,
            NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE,
            payload,
            withdrawalSubmittedToTrusteeIdempotencyKey(withdrawal.id, target.portal, userId)
          );
          return {
            userId,
            portal: target.portal,
            notificationId: notification?.id ?? null,
            notification,
          };
        })
      );
      deliveries.push(
        ...results.map(({ userId, portal, notificationId }) => ({ userId, portal, notificationId }))
      );
      await svc.logTypedSystemBatch(
        NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE,
        payload,
        results.map((row) => row.notification),
        {
          idempotencyKey: systemNotificationLogKey(
            NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE,
            `withdrawal:${withdrawal.id}:${target.portal}`
          ),
        }
      );
    }

    return {
      withdrawalId: withdrawal.id,
      skipped: false,
      attempted: deliveries.length,
      delivered: deliveries.filter((row) => row.notificationId).length,
      deliveries,
    };
  } catch (error) {
    logger.error(
      { error, withdrawalId: withdrawal.id, noteId: withdrawal.note_id ?? null },
      "Failed to send withdrawal submitted to trustee notification"
    );
    return emptySummary(withdrawal.id, true, "delivery_failed");
  }
}
