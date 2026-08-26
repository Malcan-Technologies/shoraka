import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { listIssuerOrgMemberUserIds } from "./org-member-recipients";
import { systemNotificationLogKey } from "./delivery-log";
import { NotificationPayloads, NotificationTypeIds } from "./registry";
import { NotificationService } from "./service";
import { sendTypedToUsersSafe } from "./send-typed-safe";

export function excessLateChargesDueIdempotencyKey(settlementId: string, userId: string): string {
  return `settlement:${settlementId}:notif:${NotificationTypeIds.EXCESS_LATE_CHARGES_DUE}:user:${userId}`;
}

export function excessLateChargesPaidIdempotencyKey(noteId: string, userId: string): string {
  return `note:${noteId}:notif:${NotificationTypeIds.EXCESS_LATE_CHARGES_PAID}:user:${userId}`;
}

export function shouldNotifyExcessLateChargesDue(outstandingAmount: number): boolean {
  return outstandingAmount > 0;
}

export async function notifyExcessLateChargesDue(input: {
  notificationService?: NotificationService;
  noteId: string;
  settlementId: string;
  issuerOrganizationId?: string | null;
  noteReference: string;
  outstandingAmount: number;
}): Promise<void> {
  if (!shouldNotifyExcessLateChargesDue(input.outstandingAmount)) return;
  try {
    const orgId = input.issuerOrganizationId;
    if (!orgId) return;
    const payload: NotificationPayloads[typeof NotificationTypeIds.EXCESS_LATE_CHARGES_DUE] = {
      noteId: input.noteId,
      noteReference: input.noteReference,
      outstandingAmount: input.outstandingAmount,
    };
    const svc = input.notificationService ?? new NotificationService();
    const recipients = await listIssuerOrgMemberUserIds(orgId);
    const results = await sendTypedToUsersSafe(
      svc,
      recipients,
      NotificationTypeIds.EXCESS_LATE_CHARGES_DUE,
      payload,
      (userId) => excessLateChargesDueIdempotencyKey(input.settlementId, userId)
    );
    await svc.logTypedSystemBatch(NotificationTypeIds.EXCESS_LATE_CHARGES_DUE, payload, results, {
      idempotencyKey: systemNotificationLogKey(
        NotificationTypeIds.EXCESS_LATE_CHARGES_DUE,
        `settlement:${input.settlementId}`
      ),
    });
  } catch (error) {
    logger.error(
      { error, noteId: input.noteId, settlementId: input.settlementId },
      "Failed to send excess late charges due notification"
    );
  }
}

export async function notifyExcessLateChargesPaidIfSettled(input: {
  notificationService?: NotificationService;
  noteId: string;
  issuerOrganizationId?: string | null;
  noteReference: string;
}): Promise<void> {
  try {
    const settlement = await prisma.noteSettlement.findFirst({
      where: { note_id: input.noteId, status: "POSTED" },
      orderBy: { posted_at: "desc" },
      select: {
        excess_late_charge_amount: true,
        excess_late_charge_paid_amount: true,
      },
    });
    if (!settlement) return;
    const owed = settlement.excess_late_charge_amount.toNumber();
    const paid = settlement.excess_late_charge_paid_amount.toNumber();
    if (owed <= 0 || paid + 0.005 < owed) return;
    const orgId = input.issuerOrganizationId;
    if (!orgId) return;

    const payload: NotificationPayloads[typeof NotificationTypeIds.EXCESS_LATE_CHARGES_PAID] = {
      noteId: input.noteId,
      noteReference: input.noteReference,
      paidAmount: owed,
    };
    const svc = input.notificationService ?? new NotificationService();
    const recipients = await listIssuerOrgMemberUserIds(orgId);
    const results = await sendTypedToUsersSafe(
      svc,
      recipients,
      NotificationTypeIds.EXCESS_LATE_CHARGES_PAID,
      payload,
      (userId) => excessLateChargesPaidIdempotencyKey(input.noteId, userId)
    );
    await svc.logTypedSystemBatch(NotificationTypeIds.EXCESS_LATE_CHARGES_PAID, payload, results, {
      idempotencyKey: systemNotificationLogKey(
        NotificationTypeIds.EXCESS_LATE_CHARGES_PAID,
        `note:${input.noteId}`
      ),
    });
  } catch (error) {
    logger.error(
      { error, noteId: input.noteId },
      "Failed to send excess late charges paid notification"
    );
  }
}
