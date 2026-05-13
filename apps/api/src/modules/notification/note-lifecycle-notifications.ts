import { NoteInvestmentStatus } from "@prisma/client";
import { logger } from "../../lib/logger";
import { NotificationPayloads, NotificationTypeId, NotificationTypeIds } from "./registry";
import { NotificationService } from "./service";
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
): Promise<void> {
  const recipients = await listIssuerOrgMemberUserIds(issuerOrganizationId);
  await Promise.all(
    recipients.map((userId) =>
      svc.sendTypedPlatformOnly(userId, typeId, payload, `${idempotencyPrefix}:user:${userId}`)
    )
  );
}

async function sendToInvestorsOnNote<T extends NotificationTypeId>(
  svc: NotificationService,
  noteId: string,
  investmentStatuses: NoteInvestmentStatus[],
  typeId: T,
  payload: NotificationPayloads[T],
  idempotencyPrefix: string
): Promise<void> {
  const orgIds = await listDistinctInvestorOrganizationIdsForNote(noteId, investmentStatuses);
  await sendToInvestorOrganizations(svc, orgIds, typeId, payload, idempotencyPrefix);
}

async function sendToInvestorOrganizations<T extends NotificationTypeId>(
  svc: NotificationService,
  investorOrganizationIds: string[],
  typeId: T,
  payload: NotificationPayloads[T],
  idempotencyPrefix: string
): Promise<void> {
  await Promise.all(
    investorOrganizationIds.map(async (investorOrganizationId) => {
      const recipients = await listInvestorOrgMemberUserIds(investorOrganizationId);
      await Promise.all(
        recipients.map((userId) =>
          svc.sendTypedPlatformOnly(
            userId,
            typeId,
            payload,
            `${idempotencyPrefix}:investor-org:${investorOrganizationId}:user:${userId}`
          )
        )
      );
    })
  );
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
    await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_PUBLISHED,
      payload,
      `note:lifecycle:${args.noteId}:published`
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
    await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_FUNDING_SUCCEEDED,
      payload,
      `note:lifecycle:${args.noteId}:funding_succeeded`
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
    await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_FUNDING_FAILED_ISSUER,
      issuerPayload,
      `${prefixBase}:issuer`
    );
  } catch (err) {
    logLifecycleError("funding_failed_issuer", args.noteId, err);
  }

  await Promise.all(
    args.failedInvestorOrganizationIds.map(async (investorOrganizationId) => {
      try {
        await sendToInvestorOrganizations(
          args.notificationService,
          [investorOrganizationId],
          NotificationTypeIds.NOTE_FUNDING_FAILED_INVESTOR,
          investorPayload,
          `${prefixBase}:investor:org:${investorOrganizationId}`
        );
      } catch (err) {
        logLifecycleError("funding_failed_investor", args.noteId, err);
      }
    })
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
    await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_ACTIVE_ISSUER,
      payload,
      `note:lifecycle:${args.noteId}:active:issuer`
    );
  } catch (err) {
    logLifecycleError("active_issuer", args.noteId, err);
  }
  try {
    await sendToInvestorsOnNote(
      args.notificationService,
      args.noteId,
      [NoteInvestmentStatus.CONFIRMED],
      NotificationTypeIds.NOTE_ACTIVE_INVESTOR,
      payload,
      `note:lifecycle:${args.noteId}:active:investor`
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
    await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_REPAID_ISSUER,
      payload,
      `note:lifecycle:${args.noteId}:repaid:issuer`
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
    await sendToInvestorsOnNote(
      args.notificationService,
      args.noteId,
      [NoteInvestmentStatus.CONFIRMED],
      NotificationTypeIds.NOTE_PAYMENT_RECEIVED,
      payload,
      `note:lifecycle:${args.noteId}:payment_received:${args.paymentId}`
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
    await sendToInvestorOrganizations(
      args.notificationService,
      args.investorOrganizationIds,
      NotificationTypeIds.NOTE_SETTLEMENT_POSTED,
      payload,
      `note:lifecycle:${args.noteId}:settlement_posted:${args.settlementId}`
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
    await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_ARREARS,
      payload,
      `note:lifecycle:${args.noteId}:arrears:issuer`
    );
  } catch (err) {
    logLifecycleError("arrears_issuer", args.noteId, err);
  }
  try {
    await sendToInvestorsOnNote(
      args.notificationService,
      args.noteId,
      [NoteInvestmentStatus.CONFIRMED],
      NotificationTypeIds.NOTE_ARREARS_INVESTOR,
      payload,
      `note:lifecycle:${args.noteId}:arrears:investor`
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
    await sendToIssuerOrg(
      args.notificationService,
      args.issuerOrganizationId,
      NotificationTypeIds.NOTE_DEFAULTED,
      payload,
      `note:lifecycle:${args.noteId}:defaulted:issuer`
    );
  } catch (err) {
    logLifecycleError("defaulted_issuer", args.noteId, err);
  }
  try {
    await sendToInvestorsOnNote(
      args.notificationService,
      args.noteId,
      [NoteInvestmentStatus.CONFIRMED],
      NotificationTypeIds.NOTE_DEFAULTED_INVESTOR,
      payload,
      `note:lifecycle:${args.noteId}:defaulted:investor`
    );
  } catch (err) {
    logLifecycleError("defaulted_investor", args.noteId, err);
  }
}
