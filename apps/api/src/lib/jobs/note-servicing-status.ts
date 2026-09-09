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
  notifyNoteArrears,
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
  resolveServicingDueDate,
  shouldAdvanceServicing,
  tenureDaysForNote,
} from "../../modules/notes/servicing-classifier";
import { generateAndSendServicingLetter } from "../../modules/notes/servicing-letters/service";
import { resolveNoteEventTarget } from "../../modules/notes/audit-fields";
import { writeTodayBookMetricsSnapshot } from "../../modules/admin/book-metrics-snapshot";

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

async function logSystemNoteEvent(
  noteId: string,
  eventType: string,
  metadata: Prisma.InputJsonValue
) {
  const target = resolveNoteEventTarget(eventType, metadata);
  await createNoteEventRow(prisma, {
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

export async function runNoteServicingStatusJob(now = new Date()): Promise<NoteServicingStatusJobResult> {
  const today = calendarDateInTimeZone(now);
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
    where: {
      funding_status: NoteFundingStatus.FUNDED,
      servicing_status: { not: NoteServicingStatus.SETTLED },
    },
    include: {
      payment_schedules: { select: { due_date: true, sequence: true } },
      settlements: {
        select: {
          status: true,
          tawidh_amount: true,
          gharamah_amount: true,
          investor_principal: true,
          investor_profit_gross: true,
        },
      },
      late_charge_waivers: {
        select: { tawidh_waived_amount: true, gharamah_waived_amount: true },
      },
    },
  });

  for (const note of notes) {
    result.notesProcessed += 1;
    try {
      const applied = note.settlements.filter(
        (settlement) =>
          settlement.status === NoteSettlementStatus.APPROVED ||
          settlement.status === NoteSettlementStatus.POSTED
      );
      const posted = note.settlements.filter(
        (settlement) => settlement.status === NoteSettlementStatus.POSTED
      );
      const appliedTawidh = applied.reduce((sum, row) => sum + toNumber(row.tawidh_amount), 0);
      const appliedGharamah = applied.reduce((sum, row) => sum + toNumber(row.gharamah_amount), 0);
      const waivedTawidh = note.late_charge_waivers.reduce(
        (sum, row) => sum + toNumber(row.tawidh_waived_amount),
        0
      );
      const waivedGharamah = note.late_charge_waivers.reduce(
        (sum, row) => sum + toNumber(row.gharamah_waived_amount),
        0
      );
      const classification = classifyServicing(
        {
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
        },
        today
      );

      const hasPostedSettlement = posted.length > 0;
      const canTransition =
        !hasPostedSettlement &&
        shouldAdvanceServicing(note.servicing_status, classification.servicingStatus);
      const recoveredPrincipal = posted.reduce(
        (sum, row) => sum + toNumber(row.investor_principal),
        0
      );
      const recoveredProfit = posted.reduce(
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

      await prisma.note.update({
        where: { id: note.id },
        data: hasPostedSettlement
          ? {
              days_past_due: 0,
              indicative_tawidh_amount: 0,
              indicative_gharamah_amount: 0,
              indicative_as_of: today,
            }
          : {
              days_past_due: classification.daysPastDue,
              indicative_tawidh_amount: classification.indicativeTawidhAmount,
              indicative_gharamah_amount: classification.indicativeGharamahAmount,
              indicative_as_of: today,
              ...(canTransition
                ? {
                    servicing_status: classification.servicingStatus,
                    status: classification.noteStatus ?? note.status,
                    overdue_started_at:
                      !note.overdue_started_at &&
                      (classification.servicingStatus === NoteServicingStatus.OVERDUE ||
                        classification.servicingStatus === NoteServicingStatus.LATE ||
                        classification.servicingStatus === NoteServicingStatus.ARREARS)
                        ? today
                        : undefined,
                    late_started_at:
                      !note.late_started_at &&
                      (classification.servicingStatus === NoteServicingStatus.LATE ||
                        classification.servicingStatus === NoteServicingStatus.ARREARS)
                        ? today
                        : undefined,
                    arrears_started_at:
                      !note.arrears_started_at &&
                      classification.servicingStatus === NoteServicingStatus.ARREARS
                        ? today
                        : undefined,
                  }
                : {}),
            },
      });

      const title = resolveNoteNotificationTitle(note);
      if (
        !hasPostedSettlement &&
        (classification.daysUntilDue === 7 || classification.daysUntilDue === 1)
      ) {
        await notifyNoteRepaymentDueSoon({
          notificationService,
          noteId: note.id,
          issuerOrganizationId: note.issuer_organization_id,
          noteTitle: title,
          daysUntilDue: classification.daysUntilDue,
        });
        result.remindersSent += 1;
      }

      if (canTransition) {
        result.transitions += 1;
        const eventType =
          classification.servicingStatus === NoteServicingStatus.OVERDUE
            ? "NOTE_OVERDUE"
            : classification.servicingStatus === NoteServicingStatus.LATE
              ? "NOTE_LATE"
              : "NOTE_ARREARS";
        await logSystemNoteEvent(note.id, eventType, {
          daysPastDue: classification.daysPastDue,
          daysAfterGrace: classification.daysAfterGrace,
          servicingStatus: classification.servicingStatus,
        });

        if (classification.servicingStatus === NoteServicingStatus.OVERDUE) {
          await notifyNoteOverdue({
            notificationService,
            noteId: note.id,
            issuerOrganizationId: note.issuer_organization_id,
            noteTitle: title,
          });
        } else if (classification.servicingStatus === NoteServicingStatus.LATE) {
          await notifyNoteLate({
            notificationService,
            noteId: note.id,
            issuerOrganizationId: note.issuer_organization_id,
            noteTitle: title,
          });
        } else if (classification.servicingStatus === NoteServicingStatus.ARREARS) {
          await notifyNoteArrears({
            notificationService,
            noteId: note.id,
            issuerOrganizationId: note.issuer_organization_id,
            noteTitle: title,
          });
        }
      }

      const arrearsNow =
        (canTransition ? classification.servicingStatus : note.servicing_status) ===
        NoteServicingStatus.ARREARS;
      if (!hasPostedSettlement && arrearsNow) {
        const existingArrearsLetter = await prisma.noteServicingLetter.findFirst({
          where: { note_id: note.id, type: NoteServicingLetterType.ARREARS },
          select: { id: true },
        });
        if (!existingArrearsLetter) {
          try {
            await generateAndSendServicingLetter({
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
            result.lettersSent += 1;
          } catch (error) {
            result.errors += 1;
            logger.error(
              { error, noteId: note.id },
              "Failed to send arrears servicing letter"
            );
          }
        }
      }

      const snapshotDpd = hasPostedSettlement ? 0 : classification.daysPastDue;
      const persistedStatus = canTransition ? classification.servicingStatus : note.servicing_status;
      const persistedNoteStatus = canTransition
        ? (classification.noteStatus ?? note.status)
        : note.status;

      await prisma.notePositionSnapshot.upsert({
        where: {
          note_id_snapshot_date: {
            note_id: note.id,
            snapshot_date: today,
          },
        },
        create: {
          note_id: note.id,
          snapshot_date: today,
          days_past_due: snapshotDpd,
          dpd_bucket: dpdBucketFromDays(snapshotDpd),
          note_status: persistedNoteStatus,
          servicing_status: persistedStatus,
          outstanding_principal: outstanding.outstandingPrincipal,
          outstanding_profit: outstanding.outstandingProfit,
          outstanding_total: outstanding.outstandingTotal,
          recovered_principal: recoveredPrincipal,
          recovered_profit: recoveredProfit,
          applied_tawidh: appliedTawidh,
          applied_gharamah: appliedGharamah,
          indicative_tawidh: hasPostedSettlement ? 0 : classification.indicativeTawidhAmount,
          indicative_gharamah: hasPostedSettlement ? 0 : classification.indicativeGharamahAmount,
          waived_tawidh: waivedTawidh,
          waived_gharamah: waivedGharamah,
          is_sc_default: !hasPostedSettlement && classification.isScDefault,
        },
        update: {
          days_past_due: snapshotDpd,
          dpd_bucket: dpdBucketFromDays(snapshotDpd),
          note_status: persistedNoteStatus,
          servicing_status: persistedStatus,
          outstanding_principal: outstanding.outstandingPrincipal,
          outstanding_profit: outstanding.outstandingProfit,
          outstanding_total: outstanding.outstandingTotal,
          recovered_principal: recoveredPrincipal,
          recovered_profit: recoveredProfit,
          applied_tawidh: appliedTawidh,
          applied_gharamah: appliedGharamah,
          indicative_tawidh: hasPostedSettlement ? 0 : classification.indicativeTawidhAmount,
          indicative_gharamah: hasPostedSettlement ? 0 : classification.indicativeGharamahAmount,
          waived_tawidh: waivedTawidh,
          waived_gharamah: waivedGharamah,
          is_sc_default: !hasPostedSettlement && classification.isScDefault,
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
    await writeTodayBookMetricsSnapshot(today);
    result.bookMetricsSnapshotWritten = true;
  } catch (error) {
    result.errors += 1;
    logger.error({ error }, "Failed to write book metrics daily snapshot");
  }

  return result;
}
