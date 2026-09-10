export type LateFeeReportRow = {
  noteId: string;
  noteReference: string;
  settlementReference: string;
  postedAt: string | null;
  tawidhApplied: number;
  gharamahApplied: number;
  tawidhInvestor: number;
  tawidhPlatform: number;
  gharamahCharity: number;
  waivedTotal: number;
  excessOwed: number;
  excessPaid: number;
};

/** Applied fees stay on the settlement's posted period; later collections are separate rows. */
export function lateFeeSettlementAppliedRow(input: {
  noteId: string;
  noteReference: string;
  settlementReference: string;
  postedAt: string | null;
  tawidhApplied: number;
  gharamahApplied: number;
  tawidhInvestor: number;
  tawidhPlatform: number;
  excessLateChargeAmount: number;
}): LateFeeReportRow {
  return {
    noteId: input.noteId,
    noteReference: input.noteReference,
    settlementReference: input.settlementReference,
    postedAt: input.postedAt,
    tawidhApplied: input.tawidhApplied,
    gharamahApplied: input.gharamahApplied,
    tawidhInvestor: input.tawidhInvestor,
    tawidhPlatform: input.tawidhPlatform,
    gharamahCharity: input.gharamahApplied,
    waivedTotal: 0,
    excessOwed: input.excessLateChargeAmount,
    excessPaid: 0,
  };
}

export function lateFeeWaiverMovementRow(input: {
  noteId: string;
  noteReference: string;
  createdAt: string;
  waivedTotal: number;
}): LateFeeReportRow {
  return {
    noteId: input.noteId,
    noteReference: input.noteReference,
    settlementReference: "Waiver",
    postedAt: input.createdAt,
    tawidhApplied: 0,
    gharamahApplied: 0,
    tawidhInvestor: 0,
    tawidhPlatform: 0,
    gharamahCharity: 0,
    waivedTotal: input.waivedTotal,
    excessOwed: 0,
    excessPaid: 0,
  };
}

export function lateFeeExcessPaymentRow(input: {
  noteId: string;
  noteReference: string;
  completedAt: string;
  excessPaid: number;
}): LateFeeReportRow {
  return {
    noteId: input.noteId,
    noteReference: input.noteReference,
    settlementReference: "Excess paid",
    postedAt: input.completedAt,
    tawidhApplied: 0,
    gharamahApplied: 0,
    tawidhInvestor: 0,
    tawidhPlatform: 0,
    gharamahCharity: 0,
    waivedTotal: 0,
    excessOwed: 0,
    excessPaid: input.excessPaid,
  };
}
