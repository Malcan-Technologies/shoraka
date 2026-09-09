import { NoteServicingStatus, NoteStatus } from "@prisma/client";

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
          status: NoteStatus.REPAID,
          repaid_at: { gte: asOfCutoff },
          arrears_started_at: null,
          OR: [{ default_marked_at: null }, { default_marked_at: { gte: asOfCutoff } }],
        },
      ],
    },
    distressed: {
      OR: [
        { status: { in: [NoteStatus.ARREARS, NoteStatus.DEFAULTED] } },
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
        { servicing_status: NoteServicingStatus.ARREARS, default_marked_at: null },
        { servicing_status: NoteServicingStatus.DEFAULTED, default_marked_at: { gte: asOfCutoff } },
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
