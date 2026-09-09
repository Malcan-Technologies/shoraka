import { NoteServicingStatus, NoteStatus } from "@prisma/client";
import { addMytCalendarDays, mytCalendarParts, mytStartOfDayUtc } from "@cashsouk/types";

export function bookMetricsDueSoonWindow(now: Date, asOfCutoff?: Date) {
  const day = asOfCutoff
    ? mytCalendarParts(new Date(asOfCutoff.getTime() - 1))
    : mytCalendarParts(now);
  return {
    start: mytStartOfDayUtc(day),
    end: mytStartOfDayUtc(addMytCalendarDays(day, 7)),
  };
}

export function bookMetricsAsOfFilters(asOfCutoff?: Date) {
  if (!asOfCutoff) {
    return {
      outstanding: { status: NoteStatus.ACTIVE },
      distressed: { status: { in: [NoteStatus.ARREARS, NoteStatus.DEFAULTED] } },
      arrears: { servicing_status: NoteServicingStatus.ARREARS, default_marked_at: null },
      defaulted: { servicing_status: NoteServicingStatus.DEFAULTED },
    };
  }
  return {
    outstanding: {
      OR: [
        { status: NoteStatus.ACTIVE },
        {
          servicing_status: NoteServicingStatus.ARREARS,
          default_marked_at: null,
          arrears_started_at: { gte: asOfCutoff },
        },
        {
          status: NoteStatus.REPAID,
          repaid_at: { gte: asOfCutoff },
          arrears_started_at: null,
          OR: [{ default_marked_at: null }, { default_marked_at: { gte: asOfCutoff } }],
        },
      ],
    },
    distressed: {
      OR: [
        { status: NoteStatus.ARREARS, arrears_started_at: { lt: asOfCutoff } },
        { status: NoteStatus.DEFAULTED, default_marked_at: { lt: asOfCutoff } },
        {
          status: NoteStatus.REPAID,
          repaid_at: { gte: asOfCutoff },
          OR: [
            { default_marked_at: { lt: asOfCutoff } },
            { arrears_started_at: { not: null, lt: asOfCutoff } },
          ],
        },
      ],
    },
    arrears: {
      OR: [
        {
          servicing_status: NoteServicingStatus.ARREARS,
          default_marked_at: null,
          arrears_started_at: { lt: asOfCutoff },
        },
        {
          servicing_status: NoteServicingStatus.DEFAULTED,
          default_marked_at: { gte: asOfCutoff },
          arrears_started_at: { lt: asOfCutoff },
        },
        {
          status: NoteStatus.REPAID,
          repaid_at: { gte: asOfCutoff },
          arrears_started_at: { not: null, lt: asOfCutoff },
          OR: [{ default_marked_at: null }, { default_marked_at: { gte: asOfCutoff } }],
        },
      ],
    },
    defaulted: {
      OR: [
        { servicing_status: NoteServicingStatus.DEFAULTED, default_marked_at: { lt: asOfCutoff } },
        {
          status: NoteStatus.REPAID,
          repaid_at: { gte: asOfCutoff },
          default_marked_at: { lt: asOfCutoff },
        },
      ],
    },
  };
}
