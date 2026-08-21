export type TransactionType =
  | "Deposit"
  | "Withdrawal"
  | "Investment"
  | "Returns"
  | "Release";

/** Subtitle content for the Transaction column (line 2). */
export type TransactionContext =
  | { kind: "text"; text: string }
  | { kind: "note-link"; noteId: string; noteReferenceDisplay: string; prefix?: string }
  | { kind: "empty" };

export interface TransactionStatus {
  label: string;
  tokenStatus: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  /** First-glance label, e.g. "Investment committed". */
  title: string;
  direction: "IN" | "OUT";
  amount: number;
  context: TransactionContext;
  status: TransactionStatus | null;
  balance: number;
  postedAt: string;
}

export interface SummaryTrend {
  trendAmount: number;
  trendPercent: number;
}

export interface TransactionsSummary {
  totalPortfolioSize: number;
  totalInvestment: number;
  availableBalance: number;
  portfolioTrend: SummaryTrend;
  investmentTrend: SummaryTrend;
  balanceTrend: SummaryTrend;
}

export const TRANSACTION_TYPE_FILTER_OPTIONS = [
  "Deposit",
  "Withdrawal",
  "Investment",
  "Returns",
  "Release",
] as const satisfies readonly TransactionType[];

export const TRANSACTION_TYPE_FILTER_LABELS: Record<TransactionType, string> = {
  Deposit: "Deposit",
  Withdrawal: "Withdrawal",
  Investment: "Investment",
  Returns: "Investment returns",
  Release: "Investment returned",
};

export const MIN_WITHDRAWAL_AMOUNT = 100;
