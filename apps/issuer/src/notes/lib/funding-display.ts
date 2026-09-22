type IssuerNoteFundingFields = {
  status?: string | null;
  fundingStatus?: string | null;
};

/** After fail-funding, commitments are released; do not keep showing the pre-fail raise. */
export function isIssuerNoteFundingFailed(note: IssuerNoteFundingFields) {
  return note.status === "FAILED_FUNDING" || note.fundingStatus === "FAILED";
}

export function issuerNoteDisplayFundedAmount(
  note: IssuerNoteFundingFields & { fundedAmount: number }
): number {
  return isIssuerNoteFundingFailed(note) ? 0 : note.fundedAmount;
}

export function issuerNoteDisplayFundingPercent(
  note: IssuerNoteFundingFields & { fundingPercent: number }
): number {
  return isIssuerNoteFundingFailed(note) ? 0 : note.fundingPercent;
}

export function issuerNoteDisplayFundingRatio(
  note: IssuerNoteFundingFields & { fundedAmount: number; targetAmount: number }
): number {
  if (isIssuerNoteFundingFailed(note)) return 0;
  return note.targetAmount > 0 ? (note.fundedAmount / note.targetAmount) * 100 : 0;
}
