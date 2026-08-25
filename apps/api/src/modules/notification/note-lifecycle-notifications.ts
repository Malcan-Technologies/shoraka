import { NoteInvestmentStatus, WithdrawalType, type Notification } from "@prisma/client";
import { logger } from "../../lib/logger";
import { systemNotificationLogKey } from "./delivery-log";
import { NotificationPayloads, NotificationTypeId, NotificationTypeIds } from "./registry";
import { NotificationService } from "./service";
import { sendTypedToUsersSafe } from "./send-typed-safe";
import {
  listDistinctInvestorOrganizationIdsForNote,
  listInvestorOrgMemberUserIds,
  listIssuerOrgMemberUserIds,
} from "./org-member-recipients";

export function resolveNoteNotificationTitle(note: {
  title?: string | null;
  note_reference?: string | null;
}): string {
  const t = note.title?.trim();
  if (t) return t;
  const ref = note.note_reference?.trim();
  if (ref) return ref;
  return "Note";
}

type BasicNotePayload = NotificationPayloads[typeof NotificationTypeIds.NOTE_PUBLISHED];

async function sendToIssuerOrg<T extends NotificationTypeId>(
  svc: NotificationService,
  issuerOrganizationId: string,
  typeId: T,
  payload: NotificationPayloads[T],
  idempotencyPrefix: string
): Promise<Array<Notification | null>> {
  const recipients = await listIssuerOrgMemberUserIds(issuerOrganizationId);
  return sendTypedToUsersSafe(
    svc,
    recipients,
    typeId,
    payload,
    (userId) => `${idempotencyPrefix}:user:${userId}`
  );
}

async function sendToInvestorsOnNote<T extends NotificationTypeId>(
  svc: NotificationService,
  noteId: string,
  investmentStatuses: NoteInvestmentStatus[],
  typeId: T,
  payload: NotificationPayloads[T],
  idempotencyPrefix: string
): Promise<Array<Notification | null>> {
  const orgIds = await listDistinctInvestorOrganizationIdsForNote(noteId, investmentStatuses);
  return sendToInvestorOrganizations(svc, orgIds, typeId, payload, idempotencyPrefix);
}

async function sendToInvestorOrganizations<T extends NotificationTypeId>(
  svc: NotificationService,
  investorOrganizationIds: string[],
  typeId: T,
  payload: NotificationPayloads[T],
  idempotencyPrefix: string
): Promise<Array<Notification | null>> {
  const batches = await Promise.all(
    investorOrganizationIds.map(async (investorOrganizationId) => {
      const recipients = await listInvestorOrgMemberUserIds(investorOrganizationId);
      return sendTypedToUsersSafe(
        svc,
        recipients,
        typeId,
        payload,
        (userId) => `${idempotencyPrefix}:investor-org:${investorOrganizationId}:user:${userId}`
      );
    })
  );
  return batches.flat();
}

function logLifecycleError(stage: string, noteId: string, err: unknown) {
  logger.error({ err, noteId, stage }, "Note lifecycle notification failed");
}

/** After marketplace publish — issuer organisation only. */
export async function notifyNotePublished(args: {
  notificationService: NotificationService;
  noteId: string;
  issuerOrganizationId: string;
  noteTitle: string;
}): Promise<void> {
  const payload: BasicNotePayload = { noteId: args.noteId, noteTitle: args.noteTitle };
  try {
    const results = await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_PUBLISHED,
      payload,
      `note:lifecycle:${args.noteId}:published`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_PUBLISHED,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_PUBLISHED,
          `note:lifecycle:${args.noteId}:published`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("published", args.noteId, err);
  }
}

/** After funding closes successfully — issuer only. */
export async function notifyNoteFundingSucceeded(args: {
  notificationService: NotificationService;
  noteId: string;
  issuerOrganizationId: string;
  noteTitle: string;
}): Promise<void> {
  const payload: BasicNotePayload = { noteId: args.noteId, noteTitle: args.noteTitle };
  try {
    const results = await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_FUNDING_SUCCEEDED,
      payload,
      `note:lifecycle:${args.noteId}:funding_succeeded`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_FUNDING_SUCCEEDED,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_FUNDING_SUCCEEDED,
          `note:lifecycle:${args.noteId}:funding_succeeded`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("funding_succeeded", args.noteId, err);
  }
}

export async function notifyNoteFundingFailed(args: {
  notificationService: NotificationService;
  noteId: string;
  issuerOrganizationId: string;
  noteTitle: string;
  failedInvestorOrganizationIds: string[];
}): Promise<void> {
  const issuerPayload: NotificationPayloads[typeof NotificationTypeIds.NOTE_FUNDING_FAILED_ISSUER] =
    { noteId: args.noteId, noteTitle: args.noteTitle };
  const investorPayload: NotificationPayloads[typeof NotificationTypeIds.NOTE_FUNDING_FAILED_INVESTOR] =
    { noteId: args.noteId, noteTitle: args.noteTitle };
  const prefixBase = `note:lifecycle:${args.noteId}:funding_failed`;
  try {
    const issuerResults = await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_FUNDING_FAILED_ISSUER,
      issuerPayload,
      `${prefixBase}:issuer`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_FUNDING_FAILED_ISSUER,
      issuerPayload,
      issuerResults,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_FUNDING_FAILED_ISSUER,
          `${prefixBase}:issuer`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("funding_failed_issuer", args.noteId, err);
  }

  const investorResults: Array<Notification | null> = [];
  await Promise.all(
    args.failedInvestorOrganizationIds.map(async (investorOrganizationId) => {
      try {
        const results = await sendToInvestorOrganizations(
          args.notificationService,
          [investorOrganizationId],
          NotificationTypeIds.NOTE_FUNDING_FAILED_INVESTOR,
          investorPayload,
          `${prefixBase}:investor:org:${investorOrganizationId}`
        );
        investorResults.push(...results);
      } catch (err) {
        logLifecycleError("funding_failed_investor", args.noteId, err);
      }
    })
  );
  await args.notificationService.logTypedSystemBatch(
    NotificationTypeIds.NOTE_FUNDING_FAILED_INVESTOR,
    investorPayload,
    investorResults,
    {
      idempotencyKey: systemNotificationLogKey(
        NotificationTypeIds.NOTE_FUNDING_FAILED_INVESTOR,
        `${prefixBase}:investor`
      ),
    }
  );
}

export async function notifyNoteActivated(args: {
  notificationService: NotificationService;
  noteId: string;
  issuerOrganizationId: string;
  noteTitle: string;
}): Promise<void> {
  const payload: BasicNotePayload = { noteId: args.noteId, noteTitle: args.noteTitle };
  try {
    const results = await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_ACTIVE_ISSUER,
      payload,
      `note:lifecycle:${args.noteId}:active:issuer`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_ACTIVE_ISSUER,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_ACTIVE_ISSUER,
          `note:lifecycle:${args.noteId}:active:issuer`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("active_issuer", args.noteId, err);
  }
  try {
    const results = await sendToInvestorsOnNote(
      args.notificationService,
      args.noteId,
      [NoteInvestmentStatus.CONFIRMED],
      NotificationTypeIds.NOTE_ACTIVE_INVESTOR,
      payload,
      `note:lifecycle:${args.noteId}:active:investor`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_ACTIVE_INVESTOR,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_ACTIVE_INVESTOR,
          `note:lifecycle:${args.noteId}:active:investor`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("active_investor", args.noteId, err);
  }
}

/** Full payoff — issuer organisation only (investors use settlement posted). */
export async function notifyNoteIssuerRepaid(args: {
  notificationService: NotificationService;
  noteId: string;
  issuerOrganizationId: string;
  noteTitle: string;
}): Promise<void> {
  const payload: BasicNotePayload = { noteId: args.noteId, noteTitle: args.noteTitle };
  try {
    const results = await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_REPAID_ISSUER,
      payload,
      `note:lifecycle:${args.noteId}:repaid:issuer`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_REPAID_ISSUER,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_REPAID_ISSUER,
          `note:lifecycle:${args.noteId}:repaid:issuer`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("repaid_issuer", args.noteId, err);
  }
}

/** After repayment is booked — confirmed investors on the note only. */
export async function notifyNotePaymentReceived(args: {
  notificationService: NotificationService;
  noteId: string;
  noteTitle: string;
  paymentId: string;
}): Promise<void> {
  const payload: NotificationPayloads[typeof NotificationTypeIds.NOTE_PAYMENT_RECEIVED] = {
    noteId: args.noteId,
    noteTitle: args.noteTitle,
  };
  try {
    const results = await sendToInvestorsOnNote(
      args.notificationService,
      args.noteId,
      [NoteInvestmentStatus.CONFIRMED],
      NotificationTypeIds.NOTE_PAYMENT_RECEIVED,
      payload,
      `note:lifecycle:${args.noteId}:payment_received:${args.paymentId}`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_PAYMENT_RECEIVED,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_PAYMENT_RECEIVED,
          `note:lifecycle:${args.noteId}:payment_received:${args.paymentId}`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("payment_received", args.noteId, err);
  }
}

/** After settlement posted — investors credited for this settlement (org ids captured before SETTLED). */
export async function notifyNoteSettlementPosted(args: {
  notificationService: NotificationService;
  noteId: string;
  noteTitle: string;
  settlementId: string;
  investorOrganizationIds: string[];
}): Promise<void> {
  const payload: NotificationPayloads[typeof NotificationTypeIds.NOTE_SETTLEMENT_POSTED] = {
    noteId: args.noteId,
    noteTitle: args.noteTitle,
  };
  try {
    const results = await sendToInvestorOrganizations(
      args.notificationService,
      args.investorOrganizationIds,
      NotificationTypeIds.NOTE_SETTLEMENT_POSTED,
      payload,
      `note:lifecycle:${args.noteId}:settlement_posted:${args.settlementId}`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_SETTLEMENT_POSTED,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_SETTLEMENT_POSTED,
          `note:lifecycle:${args.noteId}:settlement_posted:${args.settlementId}`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("settlement_posted", args.noteId, err);
  }
}

export async function notifyNoteArrears(args: {
  notificationService: NotificationService;
  noteId: string;
  issuerOrganizationId: string;
  noteTitle: string;
}): Promise<void> {
  const payload: BasicNotePayload = { noteId: args.noteId, noteTitle: args.noteTitle };
  try {
    const results = await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_ARREARS,
      payload,
      `note:lifecycle:${args.noteId}:arrears:issuer`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_ARREARS,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_ARREARS,
          `note:lifecycle:${args.noteId}:arrears:issuer`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("arrears_issuer", args.noteId, err);
  }
  try {
    const results = await sendToInvestorsOnNote(
      args.notificationService,
      args.noteId,
      [NoteInvestmentStatus.CONFIRMED],
      NotificationTypeIds.NOTE_ARREARS_INVESTOR,
      payload,
      `note:lifecycle:${args.noteId}:arrears:investor`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_ARREARS_INVESTOR,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_ARREARS_INVESTOR,
          `note:lifecycle:${args.noteId}:arrears:investor`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("arrears_investor", args.noteId, err);
  }
}

export async function notifyNoteDefaulted(args: {
  notificationService: NotificationService;
  noteId: string;
  issuerOrganizationId: string;
  noteTitle: string;
}): Promise<void> {
  const payload: BasicNotePayload = { noteId: args.noteId, noteTitle: args.noteTitle };
  try {
    const results = await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_DEFAULTED,
      payload,
      `note:lifecycle:${args.noteId}:defaulted:issuer`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_DEFAULTED,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_DEFAULTED,
          `note:lifecycle:${args.noteId}:defaulted:issuer`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("defaulted_issuer", args.noteId, err);
  }
  try {
    const results = await sendToInvestorsOnNote(
      args.notificationService,
      args.noteId,
      [NoteInvestmentStatus.CONFIRMED],
      NotificationTypeIds.NOTE_DEFAULTED_INVESTOR,
      payload,
      `note:lifecycle:${args.noteId}:defaulted:investor`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_DEFAULTED_INVESTOR,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_DEFAULTED_INVESTOR,
          `note:lifecycle:${args.noteId}:defaulted:investor`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("defaulted_investor", args.noteId, err);
  }
}

/** After a repayment is rejected by admin review — issuer organisation only. */
export async function notifyNotePaymentRejected(args: {
  notificationService: NotificationService;
  noteId: string;
  noteTitle: string;
  issuerOrganizationId: string;
  paymentId: string;
}): Promise<void> {
  const payload: NotificationPayloads[typeof NotificationTypeIds.NOTE_PAYMENT_REJECTED] = {
    noteId: args.noteId,
    noteTitle: args.noteTitle,
  };
  try {
    const results = await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_PAYMENT_REJECTED,
      payload,
      `note:lifecycle:${args.noteId}:payment_rejected:${args.paymentId}`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.NOTE_PAYMENT_REJECTED,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.NOTE_PAYMENT_REJECTED,
          `note:lifecycle:${args.noteId}:payment_rejected:${args.paymentId}`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("payment_rejected", args.noteId, err);
  }
}

/** True only for the issuer financing disbursement withdrawal type.
 * Residual return, investor withdrawal, and admin adjustment are not user-facing disbursement. */
export function isIssuerFinancingDisbursement(
  withdrawalType: string | null | undefined
): boolean {
  return withdrawalType === WithdrawalType.ISSUER_DISBURSEMENT;
}

/** After the issuer financing disbursement withdrawal completes — issuer organisation only.
 * Only call when `isIssuerFinancingDisbursement` is true. */
export async function notifyIssuerDisbursementCompleted(args: {
  notificationService: NotificationService;
  noteId: string;
  noteTitle: string;
  issuerOrganizationId: string;
  withdrawalId: string;
}): Promise<void> {
  const payload: NotificationPayloads[typeof NotificationTypeIds.WITHDRAWAL_COMPLETED] = {
    noteId: args.noteId,
    noteTitle: args.noteTitle,
  };
  try {
    const results = await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.WITHDRAWAL_COMPLETED,
      payload,
      `withdrawal:lifecycle:${args.withdrawalId}:issuer_disbursement_completed`
    );
    await args.notificationService.logTypedSystemBatch(
      NotificationTypeIds.WITHDRAWAL_COMPLETED,
      payload,
      results,
      {
        idempotencyKey: systemNotificationLogKey(
          NotificationTypeIds.WITHDRAWAL_COMPLETED,
          `withdrawal:lifecycle:${args.withdrawalId}:issuer_disbursement_completed`
        ),
      }
    );
  } catch (err) {
    logLifecycleError("issuer_disbursement_completed", args.noteId, err);
  }
}
