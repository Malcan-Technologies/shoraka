import {
  NoteFundingStatus,
  NoteServicingLetterType,
  NoteServicingStatus,
  NoteSettlementStatus,
  Prisma,
} from "@prisma/client";
import { createNoteEventRow, systemAuditContext } from "../audit";
import { logger } from "../logger";
import { prisma } from "../prisma";
import { NotificationService } from "../../modules/notification/service";
import {
  expectedDefaultNotificationKeys,
  expectedDueSoonNotificationKeys,
  expectedServicingTransitionNotificationKeys,
  notifyNoteArrears,
  notifyNoteDefaulted,
  notifyNoteLate,
  notifyNoteOverdue,
  notifyNoteRepaymentDueSoon,
  resolveNoteNotificationTitle,
} from "../../modules/notification/note-lifecycle-notifications";
import {
  calendarDateInTimeZone,
  classifyServicing,
  dpdBucketFromDays,
  noteOutstandingAmounts,
  previousMytCalendarDate,
  resolveServicingDueDate,
  shouldAdvanceServicing,
  tenureDaysForNote,
} from "../../modules/notes/servicing-classifier";
import {
  generateAndSendServicingLetter,
  resendServicingLetter,
  ensureServicingLetterAudit,
} from "../../modules/notes/servicing-letters/service";
import { resolveNoteEventTarget } from "../../modules/notes/audit-fields";
import { writeTodayBookMetricsSnapshot } from "../../modules/admin/book-metrics-snapshot";
import {
  activatedAsOfCutoff,
  closedDaySnapshotStatuses,
  fundedAsOfCutoff,
  mytSnapshotCutoff,
  occurredBeforeCutoff,
  settlementsAsOfCutoff,
  waiversAsOfCutoff,
} from "../../modules/notes/closed-day-snapshot";

const CRON_CORRELATION_ID = "cron:note-servicing-status";
const SYSTEM_USER_ID = "SYS";
const notificationService = new NotificationService();

export type NoteServicingStatusJobResult = {
  notesProcessed: number;
  transitions: number;
  remindersSent: number;
  lettersSent: number;
  snapshotsWritten: number;
  bookMetricsSnapshotWritten: boolean;
  errors: number;
};

function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function systemActor() {
  return {
    userId: SYSTEM_USER_ID,
    role: "SYSTEM",
    correlationId: CRON_CORRELATION_ID,
    auditContext: systemAuditContext({
      actorUserId: SYSTEM_USER_ID,
      correlationId: CRON_CORRELATION_ID,
    }),
  };
}

async function retryServicingLetterAudit(input: {
  noteId: string;
  letter: {
    id: string;
    type: NoteServicingLetterType;
    s3_key: string;
    sent_to: Prisma.JsonValue | null;
  } | null;
}) {
  if (!input.letter) return;
  try {
    await ensureServicingLetterAudit({
      noteId: input.noteId,
      letter: input.letter,
      actor: systemActor(),
      triggeredBy: "SYSTEM",
    });
  } catch (error) {
    logger.error(
      { error, noteId: input.noteId, letterId: input.letter.id },
      "Failed to persist servicing letter audit"
    );
  }
}

async function logSystemNoteEvent(
  noteId: string,
  eventType: string,
  metadata: Prisma.InputJsonValue,
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  const target = resolveNoteEventTarget(eventType, metadata);
  await createNoteEventRow(db, {
    noteId,
    eventType,
    actorUserId: SYSTEM_USER_ID,
    actorRole: "SYSTEM",
    correlationId: CRON_CORRELATION_ID,
    context: systemAuditContext({
      actorUserId: SYSTEM_USER_ID,
      correlationId: CRON_CORRELATION_ID,
    }),
    metadata,
    targetType: target.targetType,
    targetId: target.targetId ?? noteId,
  });
}

export const SERVICING_TRANSITION_EVENT_TYPES = [
  "NOTE_OVERDUE",
  "NOTE_LATE",
  "NOTE_ARREARS",
] as const;

export function servicingTransitionEventType(status: NoteServicingStatus) {
  if (status === NoteServicingStatus.OVERDUE) return "NOTE_OVERDUE";
  if (status === NoteServicingStatus.LATE) return "NOTE_LATE";
  if (status === NoteServicingStatus.ARREARS) return "NOTE_ARREARS";
  return null;
}

export function servicingStatusForTransitionEvent(
  eventType: string
): NoteServicingStatus | null {
  if (eventType === "NOTE_OVERDUE") return NoteServicingStatus.OVERDUE;
  if (eventType === "NOTE_LATE") return NoteServicingStatus.LATE;
  if (eventType === "NOTE_ARREARS") return NoteServicingStatus.ARREARS;
  return null;
}

export function shouldRetryServicingTransitionSideEffects(input: {
  canTransition: boolean;
  currentStatus: NoteServicingStatus;
  classifiedStatus: NoteServicingStatus;
}) {
  if (input.canTransition) return false;
  if (input.currentStatus !== input.classifiedStatus) return false;
  return servicingTransitionEventType(input.classifiedStatus) != null;
}

export function servicingTransitionTimestampUpdate(
  current: {
    overdueStartedAt: Date | null;
    lateStartedAt: Date | null;
    arrearsStartedAt: Date | null;
  },
  status: NoteServicingStatus,
  occurredAt: Date
) {
  const isOverdue =
    status === NoteServicingStatus.OVERDUE ||
    status === NoteServicingStatus.LATE ||
    status === NoteServicingStatus.ARREARS;
  const isLate =
    status === NoteServicingStatus.LATE || status === NoteServicingStatus.ARREARS;
  return {
    overdue_started_at: !current.overdueStartedAt && isOverdue ? occurredAt : undefined,
    late_started_at: !current.lateStartedAt && isLate ? occurredAt : undefined,
    arrears_started_at:
      !current.arrearsStartedAt && status === NoteServicingStatus.ARREARS
        ? occurredAt
        : undefined,
  };
}

/** Matches the per-user idempotency prefixes written by notifyNoteOverdue / Late / Arrears. */
export function servicingTransitionNotificationKeyPrefixes(
  status: NoteServicingStatus,
  noteId: string
): string[] {
  if (status === NoteServicingStatus.OVERDUE) {
    return [`note:servicing:${noteId}:overdue`];
  }
  if (status === NoteServicingStatus.LATE) {
    return [`note:servicing:${noteId}:late`, `note:servicing:${noteId}:late:investor`];
  }
  if (status === NoteServicingStatus.ARREARS) {
    return [
      `note:lifecycle:${noteId}:arrears:issuer`,
      `note:lifecycle:${noteId}:arrears:investor`,
    ];
  }
  return [];
}

export function servicingTransitionNotificationsDelivered(
  notifications: Array<{
    idempotency_key: string | null;
    send_to_email: boolean;
    email_sent_at: Date | null;
  }>,
  expectedKeys: string[]
): boolean {
  if (expectedKeys.length === 0) return true;
  const byKey = new Map(
    notifications.flatMap((row) => (row.idempotency_key ? [[row.idempotency_key, row] as const] : []))
  );
  return expectedKeys.every((key) => {
    const row = byKey.get(key);
    if (!row) return false;
    return !row.send_to_email || row.email_sent_at != null;
  });
}

async function retryNotificationsIfNeeded(input: {
  expectedKeys: string[];
  notify: () => Promise<void>;
}): Promise<boolean> {
  if (input.expectedKeys.length === 0) return false;
  const deliveryRows = await prisma.notification.findMany({
    where: { idempotency_key: { in: input.expectedKeys } },
    select: {
      idempotency_key: true,
      send_to_email: true,
      email_sent_at: true,
    },
  });
  if (servicingTransitionNotificationsDelivered(deliveryRows, input.expectedKeys)) {
    return false;
  }
  await input.notify();
  return true;
}

export function dueSoonReminderKinds(daysUntilDue: number | null): Array<"t7" | "t1"> {
  if (daysUntilDue == null) return [];
  const kinds: Array<"t7" | "t1"> = [];
  if (daysUntilDue <= 7) kinds.push("t7");
  if (daysUntilDue <= 1) kinds.push("t1");
  return kinds;
}

async function notifyServicingTransition(input: {
  status: NoteServicingStatus;
  noteId: string;
  issuerOrganizationId: string;
  noteTitle: string;
}) {
  if (input.status === NoteServicingStatus.OVERDUE) {
    await notifyNoteOverdue({
      notificationService,
      noteId: input.noteId,
      issuerOrganizationId: input.issuerOrganizationId,
      noteTitle: input.noteTitle,
    });
    return;
  }
  if (input.status === NoteServicingStatus.LATE) {
    await notifyNoteLate({
      notificationService,
      noteId: input.noteId,
      issuerOrganizationId: input.issuerOrganizationId,
      noteTitle: input.noteTitle,
    });
    return;
  }
  if (input.status === NoteServicingStatus.ARREARS) {
    await notifyNoteArrears({
      notificationService,
      noteId: input.noteId,
      issuerOrganizationId: input.issuerOrganizationId,
      noteTitle: input.noteTitle,
    });
  }
}

function resolveIssuerName(issuerSnapshot: Prisma.JsonValue | null): string {
  if (!issuerSnapshot || typeof issuerSnapshot !== "object" || Array.isArray(issuerSnapshot)) {
    return "Issuer";
  }
  const record = issuerSnapshot as Record<string, unknown>;
  const company = record.companyName ?? record.legal_name ?? record.name;
  return typeof company === "string" && company.trim() ? company : "Issuer";
}

function resolveSettlementAmount(note: {
  invoice_snapshot?: Prisma.JsonValue | null;
  requested_amount: Prisma.Decimal;
}): number {
  const snapshot =
    note.invoice_snapshot && typeof note.invoice_snapshot === "object" && !Array.isArray(note.invoice_snapshot)
      ? (note.invoice_snapshot as Record<string, unknown>)
      : null;
  const details =
    snapshot?.details && typeof snapshot.details === "object" && !Array.isArray(snapshot.details)
      ? (snapshot.details as Record<string, unknown>)
      : null;
  const offer =
    snapshot?.offer_details && typeof snapshot.offer_details === "object" && !Array.isArray(snapshot.offer_details)
      ? (snapshot.offer_details as Record<string, unknown>)
      : null;
  return (
    toNumber(details?.value as number | string | null | undefined) ||
    toNumber(details?.invoice_value as number | string | null | undefined) ||
    toNumber(details?.invoiceAmount as number | string | null | undefined) ||
    toNumber(offer?.invoice_value as number | string | null | undefined) ||
    toNumber(note.requested_amount)
  );
}

export function shouldSendServicingLetter(
  existing: { sent_at: Date | null } | null
): "generate" | "retry" | "skip" {
  if (!existing) return "generate";
  if (!existing.sent_at) return "retry";
  return "skip";
}

export const shouldSendArrearsLetter = shouldSendServicingLetter;

export function shouldAttemptArrearsLetter(input: {
  arrearsNow: boolean;
  arrearsStartedAt: Date | null;
  existingLetter: { sent_at: Date | null } | null;
}): boolean {
  if (input.existingLetter) return shouldSendServicingLetter(input.existingLetter) !== "skip";
  return input.arrearsNow || input.arrearsStartedAt != null;
}

export function shouldProcessServicingNote(status: NoteServicingStatus): boolean {
  return status !== NoteServicingStatus.NOT_STARTED;
}

export function servicingJobNoteWhere(cutoff: Date): Prisma.NoteWhereInput {
  return {
    funding_status: NoteFundingStatus.FUNDED,
    OR: [
      {
        servicing_status: {
          notIn: [NoteServicingStatus.NOT_STARTED, NoteServicingStatus.SETTLED],
        },
      },
      { repaid_at: { gte: cutoff } },
      { default_marked_at: { not: null } },
      { overdue_started_at: { not: null } },
      { servicing_letters: { some: { sent_at: null } } },
    ],
  };
}

export async function runNoteServicingStatusJob(now = new Date()): Promise<NoteServicingStatusJobResult> {
  const today = calendarDateInTimeZone(now);
  const snapshotDate = previousMytCalendarDate(now);
  const cutoff = mytSnapshotCutoff(now);
  const result: NoteServicingStatusJobResult = {
    notesProcessed: 0,
    transitions: 0,
    remindersSent: 0,
    lettersSent: 0,
    snapshotsWritten: 0,
    bookMetricsSnapshotWritten: false,
    errors: 0,
  };

  const notes = await prisma.note.findMany({
    where: servicingJobNoteWhere(cutoff),
    include: {
      payment_schedules: { select: { due_date: true, sequence: true } },
      settlements: {
        select: {
          status: true,
          posted_at: true,
          approved_at: true,
          tawidh_amount: true,
          gharamah_amount: true,
          investor_principal: true,
          investor_profit_gross: true,
        },
      },
      late_charge_waivers: {
        select: { created_at: true, tawidh_waived_amount: true, gharamah_waived_amount: true },
      },
    },
  });

  for (const note of notes) {
    if (!shouldProcessServicingNote(note.servicing_status)) continue;
    result.notesProcessed += 1;
    try {
      const liveApplied = note.settlements.filter(
        (settlement) =>
          settlement.status === NoteSettlementStatus.APPROVED ||
          settlement.status === NoteSettlementStatus.POSTED
      );
      const livePosted = note.settlements.filter(
        (settlement) => settlement.status === NoteSettlementStatus.POSTED
      );
      const asOfSettlements = settlementsAsOfCutoff(note.settlements, cutoff);
      const asOfWaivers = waiversAsOfCutoff(note.late_charge_waivers, cutoff);
      const appliedTawidh = liveApplied.reduce((sum, row) => sum + toNumber(row.tawidh_amount), 0);
      const appliedGharamah = liveApplied.reduce((sum, row) => sum + toNumber(row.gharamah_amount), 0);
      const waivedTawidh = note.late_charge_waivers.reduce(
        (sum, row) => sum + toNumber(row.tawidh_waived_amount),
        0
      );
      const waivedGharamah = note.late_charge_waivers.reduce(
        (sum, row) => sum + toNumber(row.gharamah_waived_amount),
        0
      );
      const snapshotAppliedTawidh = asOfSettlements.applied.reduce(
        (sum, row) => sum + toNumber(row.tawidh_amount),
        0
      );
      const snapshotAppliedGharamah = asOfSettlements.applied.reduce(
        (sum, row) => sum + toNumber(row.gharamah_amount),
        0
      );
      const snapshotWaivedTawidh = asOfWaivers.reduce(
        (sum, row) => sum + toNumber(row.tawidh_waived_amount),
        0
      );
      const snapshotWaivedGharamah = asOfWaivers.reduce(
        (sum, row) => sum + toNumber(row.gharamah_waived_amount),
        0
      );
      const servicingInput = {
        servicing_status: note.servicing_status,
        status: note.status,
        grace_period_days: note.grace_period_days,
        arrears_threshold_days: note.arrears_threshold_days,
        tawidh_rate_cap_percent: toNumber(note.tawidh_rate_cap_percent),
        gharamah_rate_cap_percent: toNumber(note.gharamah_rate_cap_percent),
        due_date: resolveServicingDueDate(note),
        receipt_amount: resolveSettlementAmount(note),
        applied_tawidh_amount: appliedTawidh,
        applied_gharamah_amount: appliedGharamah,
        waived_tawidh_amount: waivedTawidh,
        waived_gharamah_amount: waivedGharamah,
      };
      const classification = classifyServicing(servicingInput, today);
      const closedClassification = classifyServicing(
        {
          ...servicingInput,
          applied_tawidh_amount: snapshotAppliedTawidh,
          applied_gharamah_amount: snapshotAppliedGharamah,
          waived_tawidh_amount: snapshotWaivedTawidh,
          waived_gharamah_amount: snapshotWaivedGharamah,
        },
        snapshotDate
      );

      const hasPostedSettlement = livePosted.length > 0;
      const canTransition =
        !hasPostedSettlement &&
        shouldAdvanceServicing(note.servicing_status, classification.servicingStatus);
      const recoveredPrincipal = livePosted.reduce(
        (sum, row) => sum + toNumber(row.investor_principal),
        0
      );
      const recoveredProfit = livePosted.reduce(
        (sum, row) => sum + toNumber(row.investor_profit_gross),
        0
      );
      const outstanding = noteOutstandingAmounts({
        fundedAmount: toNumber(note.funded_amount),
        recoveredPrincipal,
        recoveredProfit,
        profitRatePercent: toNumber(note.profit_rate_percent),
        tenureDays: tenureDaysForNote(note),
      });

      const transitionEventType = servicingTransitionEventType(classification.servicingStatus);
      const transitionMetadata = {
        daysPastDue: classification.daysPastDue,
        daysAfterGrace: classification.daysAfterGrace,
        servicingStatus: classification.servicingStatus,
      };
      const liveUpdate = hasPostedSettlement
        ? {
            days_past_due: 0,
            indicative_tawidh_amount: 0,
            indicative_gharamah_amount: 0,
            indicative_as_of: now,
          }
        : {
            days_past_due: classification.daysPastDue,
            indicative_tawidh_amount: classification.indicativeTawidhAmount,
            indicative_gharamah_amount: classification.indicativeGharamahAmount,
            indicative_as_of: now,
            ...(canTransition
              ? {
                  servicing_status: classification.servicingStatus,
                  status: classification.noteStatus ?? note.status,
                  ...servicingTransitionTimestampUpdate(
                    {
                      overdueStartedAt: note.overdue_started_at,
                      lateStartedAt: note.late_started_at,
                      arrearsStartedAt: note.arrears_started_at,
                    },
                    classification.servicingStatus,
                    now
                  ),
                }
              : {}),
          };

      if (note.servicing_status !== NoteServicingStatus.SETTLED) {
        if (canTransition && transitionEventType) {
          await prisma.$transaction(async (tx) => {
            await tx.note.update({
              where: { id: note.id },
              data: liveUpdate,
            });
            await logSystemNoteEvent(note.id, transitionEventType, transitionMetadata, tx);
          });
        } else {
          await prisma.note.update({
            where: { id: note.id },
            data: liveUpdate,
          });
        }
      }

      const title = resolveNoteNotificationTitle(note);
      if (!hasPostedSettlement) {
        let reminderAttempted = false;
        for (const kind of dueSoonReminderKinds(classification.daysUntilDue)) {
          const attempted = await retryNotificationsIfNeeded({
            expectedKeys: await expectedDueSoonNotificationKeys({
              noteId: note.id,
              issuerOrganizationId: note.issuer_organization_id,
              kind,
            }),
            notify: () =>
              notifyNoteRepaymentDueSoon({
                notificationService,
                noteId: note.id,
                issuerOrganizationId: note.issuer_organization_id,
                noteTitle: title,
                daysUntilDue: kind === "t1" ? 1 : 7,
              }),
          });
          if (attempted) reminderAttempted = true;
        }
        if (reminderAttempted) result.remindersSent += 1;
      }

      if (canTransition && transitionEventType) {
        result.transitions += 1;
      }

      const loggedTransitionEvents = await prisma.noteEvent.findMany({
        where: {
          note_id: note.id,
          event_type: { in: [...SERVICING_TRANSITION_EVENT_TYPES] },
        },
        select: { event_type: true },
      });
      const statusesToNotify = new Set<NoteServicingStatus>();
      if (canTransition && transitionEventType) {
        statusesToNotify.add(classification.servicingStatus);
      }
      for (const row of loggedTransitionEvents) {
        const status = servicingStatusForTransitionEvent(row.event_type);
        if (status) statusesToNotify.add(status);
      }
      if (
        shouldRetryServicingTransitionSideEffects({
          canTransition,
          currentStatus: note.servicing_status,
          classifiedStatus: classification.servicingStatus,
        })
      ) {
        const retryEventType = servicingTransitionEventType(classification.servicingStatus);
        if (
          retryEventType &&
          !loggedTransitionEvents.some((row) => row.event_type === retryEventType)
        ) {
          await logSystemNoteEvent(note.id, retryEventType, transitionMetadata);
          result.transitions += 1;
        }
        statusesToNotify.add(classification.servicingStatus);
      }
      for (const status of statusesToNotify) {
        await retryNotificationsIfNeeded({
          expectedKeys: await expectedServicingTransitionNotificationKeys({
            status,
            noteId: note.id,
            issuerOrganizationId: note.issuer_organization_id,
          }),
          notify: () =>
            notifyServicingTransition({
              status,
              noteId: note.id,
              issuerOrganizationId: note.issuer_organization_id,
              noteTitle: title,
            }),
        });
      }

      const arrearsNow =
        (canTransition ? classification.servicingStatus : note.servicing_status) ===
        NoteServicingStatus.ARREARS;
      const existingArrearsLetter = await prisma.noteServicingLetter.findFirst({
        where: { note_id: note.id, type: NoteServicingLetterType.ARREARS },
        select: { id: true, sent_at: true, sent_to: true, type: true },
      });
      const letterAction = shouldSendArrearsLetter(existingArrearsLetter);
      const attemptArrearsLetter = shouldAttemptArrearsLetter({
        arrearsNow,
        arrearsStartedAt: note.arrears_started_at,
        existingLetter: existingArrearsLetter,
      });
      if (attemptArrearsLetter && letterAction !== "skip") {
        try {
          if (letterAction === "retry" && existingArrearsLetter) {
            const resent = await resendServicingLetter({
              letterId: existingArrearsLetter.id,
              noteId: note.id,
              actor: systemActor(),
              triggeredBy: "SYSTEM",
            });
            if (resent.sentTo.length > 0) result.lettersSent += 1;
          } else {
            const created = await generateAndSendServicingLetter({
              noteId: note.id,
              kind: "ARREARS",
              triggeredBy: "SYSTEM",
              actor: systemActor(),
              issuerName: resolveIssuerName(note.issuer_snapshot),
              noteReference: note.note_reference,
              issuerOrganizationId: note.issuer_organization_id,
              dueDate: classification.dueDate,
              daysPastDue: classification.daysPastDue,
              outstandingTotal: outstanding.outstandingTotal,
              indicativeTawidhAmount: classification.indicativeTawidhAmount,
              indicativeGharamahAmount: classification.indicativeGharamahAmount,
              gracePeriodDays: note.grace_period_days,
              arrearsThresholdDays: note.arrears_threshold_days,
            });
            if (created.sentTo.length > 0) result.lettersSent += 1;
          }
        } catch (error) {
          result.errors += 1;
          logger.error(
            { error, noteId: note.id },
            "Failed to send arrears servicing letter"
          );
        }
      }
      if (existingArrearsLetter || attemptArrearsLetter) {
        const arrearsLetter = await prisma.noteServicingLetter.findFirst({
          where: { note_id: note.id, type: NoteServicingLetterType.ARREARS },
          select: { id: true, type: true, sent_to: true, s3_key: true },
        });
        await retryServicingLetterAudit({ noteId: note.id, letter: arrearsLetter });
      }

      const wasDefaulted = note.default_marked_at != null;
      if (wasDefaulted) {
        await retryNotificationsIfNeeded({
          expectedKeys: await expectedDefaultNotificationKeys({
            noteId: note.id,
            issuerOrganizationId: note.issuer_organization_id,
          }),
          notify: () =>
            notifyNoteDefaulted({
              notificationService,
              noteId: note.id,
              issuerOrganizationId: note.issuer_organization_id,
              noteTitle: title,
            }),
        });
        const existingDefaultLetter = await prisma.noteServicingLetter.findFirst({
          where: { note_id: note.id, type: NoteServicingLetterType.DEFAULT },
          select: { id: true, sent_at: true, sent_to: true, type: true },
        });
        const letterAction = shouldSendServicingLetter(existingDefaultLetter);
        if (letterAction !== "skip") {
          try {
            if (letterAction === "retry" && existingDefaultLetter) {
              const resent = await resendServicingLetter({
                letterId: existingDefaultLetter.id,
                noteId: note.id,
                actor: systemActor(),
                triggeredBy: "SYSTEM",
              });
              if (resent.sentTo.length > 0) result.lettersSent += 1;
            } else {
              const created = await generateAndSendServicingLetter({
                noteId: note.id,
                kind: "DEFAULT",
                triggeredBy: "SYSTEM",
                actor: systemActor(),
                issuerName: resolveIssuerName(note.issuer_snapshot),
                noteReference: note.note_reference,
                issuerOrganizationId: note.issuer_organization_id,
                dueDate: classification.dueDate,
                daysPastDue: classification.daysPastDue,
                outstandingTotal: outstanding.outstandingTotal,
                indicativeTawidhAmount: classification.indicativeTawidhAmount,
                indicativeGharamahAmount: classification.indicativeGharamahAmount,
                gracePeriodDays: note.grace_period_days,
                arrearsThresholdDays: note.arrears_threshold_days,
                defaultDate: note.default_marked_at,
                defaultReason: note.default_reason,
              });
              if (created.sentTo.length > 0) result.lettersSent += 1;
            }
          } catch (error) {
            result.errors += 1;
            logger.error({ error, noteId: note.id }, "Failed to send default servicing letter");
          }
        }
        const defaultLetter = await prisma.noteServicingLetter.findFirst({
          where: { note_id: note.id, type: NoteServicingLetterType.DEFAULT },
          select: { id: true, type: true, sent_to: true, s3_key: true },
        });
        await retryServicingLetterAudit({ noteId: note.id, letter: defaultLetter });
      }

      const snapshotRecoveredPrincipal = asOfSettlements.posted.reduce(
        (sum, row) => sum + toNumber(row.investor_principal),
        0
      );
      const snapshotRecoveredProfit = asOfSettlements.posted.reduce(
        (sum, row) => sum + toNumber(row.investor_profit_gross),
        0
      );
      const snapshotOutstanding = noteOutstandingAmounts({
        fundedAmount: toNumber(note.funded_amount),
        recoveredPrincipal: snapshotRecoveredPrincipal,
        recoveredProfit: snapshotRecoveredProfit,
        profitRatePercent: toNumber(note.profit_rate_percent),
        tenureDays: tenureDaysForNote(note),
      });
      const postedAsOfCutoff = asOfSettlements.posted.length > 0;
      const repaidAsOfCutoff = occurredBeforeCutoff(note.repaid_at, cutoff);
      const snapshotStatuses = closedDaySnapshotStatuses({
        repaidAsOfCutoff,
        postedAsOfCutoff,
        defaultedAsOfCutoff: occurredBeforeCutoff(note.default_marked_at, cutoff),
        classification: closedClassification,
        liveNoteStatus: note.status,
      });
      const closedChargesCleared = repaidAsOfCutoff || postedAsOfCutoff;

      if (
        !fundedAsOfCutoff(note.funding_closed_at, cutoff) ||
        !activatedAsOfCutoff(note.activated_at, cutoff)
      ) {
        continue;
      }

      await prisma.notePositionSnapshot.upsert({
        where: {
          note_id_snapshot_date: {
            note_id: note.id,
            snapshot_date: snapshotDate,
          },
        },
        create: {
          note_id: note.id,
          snapshot_date: snapshotDate,
          days_past_due: snapshotStatuses.daysPastDue,
          dpd_bucket: dpdBucketFromDays(snapshotStatuses.daysPastDue),
          note_status: snapshotStatuses.noteStatus,
          servicing_status: snapshotStatuses.servicingStatus,
          outstanding_principal: snapshotOutstanding.outstandingPrincipal,
          outstanding_profit: snapshotOutstanding.outstandingProfit,
          outstanding_total: snapshotOutstanding.outstandingTotal,
          recovered_principal: snapshotRecoveredPrincipal,
          recovered_profit: snapshotRecoveredProfit,
          applied_tawidh: snapshotAppliedTawidh,
          applied_gharamah: snapshotAppliedGharamah,
          indicative_tawidh: closedChargesCleared ? 0 : closedClassification.indicativeTawidhAmount,
          indicative_gharamah: closedChargesCleared
            ? 0
            : closedClassification.indicativeGharamahAmount,
          waived_tawidh: snapshotWaivedTawidh,
          waived_gharamah: snapshotWaivedGharamah,
          is_sc_default: !closedChargesCleared && closedClassification.isScDefault,
        },
        update: {
          days_past_due: snapshotStatuses.daysPastDue,
          dpd_bucket: dpdBucketFromDays(snapshotStatuses.daysPastDue),
          note_status: snapshotStatuses.noteStatus,
          servicing_status: snapshotStatuses.servicingStatus,
          outstanding_principal: snapshotOutstanding.outstandingPrincipal,
          outstanding_profit: snapshotOutstanding.outstandingProfit,
          outstanding_total: snapshotOutstanding.outstandingTotal,
          recovered_principal: snapshotRecoveredPrincipal,
          recovered_profit: snapshotRecoveredProfit,
          applied_tawidh: snapshotAppliedTawidh,
          applied_gharamah: snapshotAppliedGharamah,
          indicative_tawidh: closedChargesCleared ? 0 : closedClassification.indicativeTawidhAmount,
          indicative_gharamah: closedChargesCleared
            ? 0
            : closedClassification.indicativeGharamahAmount,
          waived_tawidh: snapshotWaivedTawidh,
          waived_gharamah: snapshotWaivedGharamah,
          is_sc_default: !closedChargesCleared && closedClassification.isScDefault,
        },
      });
      result.snapshotsWritten += 1;
    } catch (error) {
      result.errors += 1;
      logger.error(
        { error, noteId: note.id },
        "Note servicing status job failed for note"
      );
    }
  }

  try {
    await writeTodayBookMetricsSnapshot(snapshotDate, undefined, cutoff);
    result.bookMetricsSnapshotWritten = true;
  } catch (error) {
    result.errors += 1;
    logger.error({ error }, "Failed to write book metrics daily snapshot");
  }

  return result;
}
