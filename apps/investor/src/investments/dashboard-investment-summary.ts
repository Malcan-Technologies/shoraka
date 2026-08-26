import { NoteServicingStatus, NoteStatus, type NoteListItem } from "@cashsouk/types";
import { averageRealizedAnnualReturnRatePercent } from "./investment-position-model";

export function isDashboardSettledInvestment(note: NoteListItem) {
  return note.servicingStatus === NoteServicingStatus.SETTLED || note.status === NoteStatus.REPAID;
}

export function isDashboardDefaultedInvestment(note: NoteListItem) {
  return (
    note.servicingStatus === NoteServicingStatus.DEFAULTED || note.status === NoteStatus.DEFAULTED
  );
}

export function isDashboardUnderPerformingInvestment(note: NoteListItem) {
  return (
    isDashboardDefaultedInvestment(note) ||
    note.servicingStatus === NoteServicingStatus.LATE ||
    note.servicingStatus === NoteServicingStatus.ARREARS ||
    note.status === NoteStatus.ARREARS
  );
}

export function buildDashboardInvestmentSummary(notes: readonly NoteListItem[]) {
  let activeInvestments = 0;
  let successfulInvestments = 0;
  let underPerformingInvestments = 0;
  let defaultedInvestments = 0;
  const settled: NoteListItem[] = [];

  for (const note of notes) {
    if (isDashboardSettledInvestment(note)) {
      successfulInvestments += 1;
      settled.push(note);
    } else if (isDashboardUnderPerformingInvestment(note)) {
      underPerformingInvestments += 1;
      if (isDashboardDefaultedInvestment(note)) {
        defaultedInvestments += 1;
      }
    } else {
      activeInvestments += 1;
    }
  }

  return {
    totalInvestments: notes.length,
    activeInvestments,
    successfulInvestments,
    underPerformingInvestments,
    defaultedInvestments,
    realizedPerformance: averageRealizedAnnualReturnRatePercent(settled) ?? 0,
  };
}
