import { resolveNetExpectedReturnRatePercent, type NoteListItem } from "@cashsouk/types";
import {
  compareCompletedInvestmentLatestFirst,
  compareInvestmentMaturity,
  getInvestmentRelevanceRank,
  isInvestorInvestmentCompleted,
} from "./investment-position-model";

export type InvestmentSortOption =
  | "most_relevant"
  | "newest"
  | "oldest"
  | "highest_amount"
  | "lowest_amount"
  | "highest_return"
  | "maturity_soonest";

export const investmentSortOptions: Array<{ value: InvestmentSortOption; label: string }> = [
  { value: "most_relevant", label: "Most relevant" },
  { value: "newest", label: "Newest activity" },
  { value: "oldest", label: "Oldest activity" },
  { value: "highest_amount", label: "Highest amount" },
  { value: "lowest_amount", label: "Lowest amount" },
  { value: "highest_return", label: "Highest expected return" },
  { value: "maturity_soonest", label: "Maturity soonest" },
];

export function getInvestmentStatusLabel(note: NoteListItem) {
  if (note.servicingStatus === "SETTLED" || note.status === "REPAID") return "Settled";
  if (note.servicingStatus === "CURRENT" || note.status === "ACTIVE") return "Active";
  if (note.fundingStatus === "OPEN") return "Pending confirmation";
  return "In progress";
}

function getInvestedAmount(note: NoteListItem) {
  return Number(note.investorRepaymentSummary?.investedPrincipal ?? note.fundedAmount);
}

function getExpectedReturn(note: NoteListItem) {
  return Number(
    note.investorRepaymentSummary?.expectedReturnRatePercent ??
      resolveNetExpectedReturnRatePercent(note) ??
      0
  );
}

function getUpdatedTimestamp(note: NoteListItem) {
  const timestamp = new Date(note.updatedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getMostRelevantRank(note: NoteListItem) {
  return getInvestmentRelevanceRank(note);
}

function compareBySortOption(
  left: NoteListItem,
  right: NoteListItem,
  sortOption: InvestmentSortOption
) {
  if (sortOption === "newest") return getUpdatedTimestamp(right) - getUpdatedTimestamp(left);
  if (sortOption === "oldest") return getUpdatedTimestamp(left) - getUpdatedTimestamp(right);
  if (sortOption === "highest_amount") return getInvestedAmount(right) - getInvestedAmount(left);
  if (sortOption === "lowest_amount") return getInvestedAmount(left) - getInvestedAmount(right);
  if (sortOption === "highest_return") return getExpectedReturn(right) - getExpectedReturn(left);
  if (sortOption === "maturity_soonest") return compareInvestmentMaturity(left, right);

  const rankDifference = getMostRelevantRank(left) - getMostRelevantRank(right);
  if (rankDifference !== 0) return rankDifference;
  if (isInvestorInvestmentCompleted(left) && isInvestorInvestmentCompleted(right)) {
    const byLatest = compareCompletedInvestmentLatestFirst(left, right);
    if (byLatest !== 0) return byLatest;
    return getUpdatedTimestamp(right) - getUpdatedTimestamp(left);
  }
  const byMaturity = compareInvestmentMaturity(left, right);
  if (byMaturity !== 0) return byMaturity;
  return getUpdatedTimestamp(right) - getUpdatedTimestamp(left);
}

export function sortInvestorInvestments(notes: NoteListItem[], sortOption: InvestmentSortOption) {
  return notes
    .map((note, index) => ({ note, index }))
    .sort((left, right) => {
      const bySelectedSort = compareBySortOption(left.note, right.note, sortOption);
      if (bySelectedSort !== 0) return bySelectedSort;

      const byId = left.note.id.localeCompare(right.note.id);
      if (byId !== 0) return byId;

      return left.index - right.index;
    })
    .map((entry) => entry.note);
}
