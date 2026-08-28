import { logger } from "../../lib/logger";
import { NotificationTypeIds } from "./registry";
import { NotificationService } from "./service";

/** After a marketplace commitment persists and the wallet hold succeeds. */
export async function notifyInvestmentCommitted(args: {
  notificationService: NotificationService;
  investmentId: string;
  recipientUserId: string | null | undefined;
  amount: number;
  noteId: string;
  noteTitle: string;
}): Promise<void> {
  if (!args.recipientUserId) return;
  try {
    await args.notificationService.sendTypedAndLogSystem(
      args.recipientUserId,
      NotificationTypeIds.INVESTMENT_COMMITTED,
      {
        amount: args.amount,
        noteId: args.noteId,
        noteTitle: args.noteTitle,
      },
      `investment:${args.investmentId}:notif:investment_committed:user:${args.recipientUserId}`,
      { targetType: "INVESTORS" }
    );
  } catch (err) {
    logger.error(
      { err, investmentId: args.investmentId, noteId: args.noteId },
      "Investment committed notification failed"
    );
  }
}
