import { WithdrawalType } from "@prisma/client";
import { logger } from "../../lib/logger";
import { NotificationPayloads, NotificationTypeIds } from "./registry";
import { NotificationService } from "./service";

function isInvestorCashWithdrawal(withdrawalType: string | null | undefined): boolean {
  return withdrawalType === WithdrawalType.INVESTOR_WITHDRAWAL;
}

async function notifyInvestorOwner(
  notificationService: NotificationService,
  recipientUserId: string | null | undefined,
  typeId:
    | typeof NotificationTypeIds.INVESTOR_WITHDRAWAL_SUBMITTED
    | typeof NotificationTypeIds.INVESTOR_WITHDRAWAL_COMPLETED,
  payload: NotificationPayloads[typeof NotificationTypeIds.INVESTOR_WITHDRAWAL_SUBMITTED],
  idempotencyKey: string,
  stage: string,
  withdrawalId: string
): Promise<void> {
  if (!recipientUserId) return;
  try {
    await notificationService.sendTypedPlatformOnly(
      recipientUserId,
      typeId,
      payload,
      idempotencyKey
    );
  } catch (err) {
    logger.error({ err, withdrawalId, stage }, "Investor withdrawal notification failed");
  }
}

/** After the investor cash-withdrawal request is created and the wallet debit succeeds. */
export async function notifyInvestorCashWithdrawalSubmitted(args: {
  notificationService: NotificationService;
  withdrawalId: string;
  requestedByUserId: string | null | undefined;
  amount: number;
  withdrawalType: string | null | undefined;
}): Promise<void> {
  if (!isInvestorCashWithdrawal(args.withdrawalType)) return;
  await notifyInvestorOwner(
    args.notificationService,
    args.requestedByUserId,
    NotificationTypeIds.INVESTOR_WITHDRAWAL_SUBMITTED,
    { amount: args.amount },
    `withdrawal:${args.withdrawalId}:notif:investor_withdrawal_submitted:user:${args.requestedByUserId}`,
    "investor_withdrawal_submitted",
    args.withdrawalId
  );
}

/** After an INVESTOR_WITHDRAWAL instruction is marked COMPLETED. */
export async function notifyInvestorCashWithdrawalCompleted(args: {
  notificationService: NotificationService;
  withdrawalId: string;
  requestedByUserId: string | null | undefined;
  amount: number;
  withdrawalType: string | null | undefined;
}): Promise<void> {
  if (!isInvestorCashWithdrawal(args.withdrawalType)) return;
  await notifyInvestorOwner(
    args.notificationService,
    args.requestedByUserId,
    NotificationTypeIds.INVESTOR_WITHDRAWAL_COMPLETED,
    { amount: args.amount },
    `withdrawal:${args.withdrawalId}:notif:investor_withdrawal_completed:user:${args.requestedByUserId}`,
    "investor_withdrawal_completed",
    args.withdrawalId
  );
}
