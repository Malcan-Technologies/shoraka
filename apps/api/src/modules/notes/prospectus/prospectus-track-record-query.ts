/**
 * SECTION: Load + freeze Stage 7/8 prospectus track-record data
 * WHY: Shared query for publish-time snapshot and live preview before freeze
 */

import { NotePaymentStatus, NoteStatus, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  PROSPECTUS_FUNDED_HISTORY_STATUS_SET,
  PROSPECTUS_FUNDED_HISTORY_STATUSES,
  computeOnTimePaymentRatePercent,
  computeProspectusSuccessfulRepaymentPercent,
  countProspectusTotalNotesFunded,
  decimalToSerializableString,
  sixMonthsAgoFrom,
  sumProspectusTotalAmountFunded,
} from "../../issuer-dashboard/track-record-aggregates";
import type {
  ProspectusHistoricalNoteStatus,
  ProspectusPage1HistoricalNoteSnapshot,
  ProspectusPage1Snapshot,
  ProspectusSnapshot,
} from "./prospectus-snapshot.types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function productNameFromSnapshot(productSnapshot: unknown): string | null {
  const product = asRecord(productSnapshot);
  const name = product?.product_name;
  return typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toHistoricalStatus(status: NoteStatus | string): ProspectusHistoricalNoteStatus | null {
  const value = String(status);
  if (
    value === NoteStatus.ACTIVE ||
    value === NoteStatus.REPAID ||
    value === NoteStatus.ARREARS ||
    value === NoteStatus.DEFAULTED
  ) {
    return value;
  }
  return null;
}

export async function buildProspectusPage1TrackRecordSnapshot(input: {
  issuerOrganizationId: string;
  currentNoteId: string;
  now?: Date;
}): Promise<ProspectusPage1Snapshot> {
  const now = input.now ?? new Date();
  const windowStart = sixMonthsAgoFrom(now);

  const notes = await prisma.note.findMany({
    where: { issuer_organization_id: input.issuerOrganizationId },
    select: {
      id: true,
      status: true,
      funded_amount: true,
      note_reference: true,
      product_snapshot: true,
      profit_rate_percent: true,
      maturity_date: true,
      repaid_at: true,
      updated_at: true,
      listing: { select: { opens_at: true } },
    },
  });

  const trackRows = notes.map((n) => ({
    id: n.id,
    status: n.status,
    funded_amount: n.funded_amount,
  }));

  const totalNotesFunded = countProspectusTotalNotesFunded(
    trackRows,
    input.currentNoteId
  );
  const totalAmountFunded = sumProspectusTotalAmountFunded(
    trackRows,
    input.currentNoteId
  );
  const successfulRepayment = computeProspectusSuccessfulRepaymentPercent(
    trackRows,
    input.currentNoteId
  );

  const schedules = await prisma.notePaymentSchedule.findMany({
    where: {
      due_date: { gte: windowStart, lte: now },
      note: { issuer_organization_id: input.issuerOrganizationId },
    },
    select: { id: true, note_id: true, due_date: true, expected_total: true },
  });
  const scheduleIds = schedules.map((s) => s.id);
  const payments = scheduleIds.length
    ? await prisma.notePayment.findMany({
        where: {
          schedule_id: { in: scheduleIds },
          status: NotePaymentStatus.RECEIVED,
        },
        select: { schedule_id: true, receipt_date: true, receipt_amount: true },
      })
    : [];

  const onTimePercent = computeOnTimePaymentRatePercent({
    schedules,
    payments,
    now,
    windowStart,
    excludeNoteId: input.currentNoteId,
  });

  const historicalNotes: ProspectusPage1HistoricalNoteSnapshot[] = notes
    .filter(
      (n) =>
        n.id !== input.currentNoteId && PROSPECTUS_FUNDED_HISTORY_STATUS_SET.has(n.status)
    )
    .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
    .slice(0, 4)
    .map((n) => {
      const status = toHistoricalStatus(n.status);
      if (!status) {
        throw new Error(`Unexpected historical status ${n.status}`);
      }
      return {
        note_id: n.id,
        note_reference: n.note_reference ?? null,
        financing_type: productNameFromSnapshot(n.product_snapshot),
        funded_amount: decimalToSerializableString(n.funded_amount),
        listing_opens_at: toIso(n.listing?.opens_at ?? null),
        maturity_date: toIso(n.maturity_date),
        profit_rate_percent: decimalToSerializableString(n.profit_rate_percent),
        status,
        repaid_at: toIso(n.repaid_at),
        updated_at: n.updated_at.toISOString(),
      };
    });

  return {
    issuer_track_record: {
      total_notes_funded: totalNotesFunded,
      total_amount_funded: decimalToSerializableString(totalAmountFunded),
      successful_repayment_percent: successfulRepayment,
      on_time_payment_rate_six_months_percent: onTimePercent,
      calculated_at: now.toISOString(),
    },
    historical_notes: historicalNotes,
  };
}

/**
 * Merge frozen page_1 into prospectus_snapshot.
 * Preserves unknown branches and existing page_2 when not replaced.
 */
export function wrapProspectusSnapshot(
  page1: ProspectusPage1Snapshot,
  existingSnapshot?: unknown
): ProspectusSnapshot {
  const root = asRecord(existingSnapshot) ?? {};
  const merged: Record<string, unknown> = {
    ...root,
    page_1: page1,
  };
  return merged as unknown as ProspectusSnapshot;
}

export function parseProspectusSnapshot(value: unknown): ProspectusSnapshot | null {
  const root = asRecord(value);
  const page1 = asRecord(root?.page_1);
  if (!page1) return null;
  const track = asRecord(page1.issuer_track_record);
  const historical = page1.historical_notes;
  if (!track || !Array.isArray(historical)) return null;
  return value as ProspectusSnapshot;
}

export { PROSPECTUS_FUNDED_HISTORY_STATUSES };

export type PurposeSnapshotInput = Prisma.InputJsonValue;
