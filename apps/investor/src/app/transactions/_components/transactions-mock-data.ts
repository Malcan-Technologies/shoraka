export type TransactionType =
  | "Deposit"
  | "Withdrawal"
  | "Investment"
  | "Returns"
  | "Release"
  | "SST";

/** Subtitle content for the Transaction column (line 2). */
export type TransactionContext =
  | { kind: "text"; text: string }
  | { kind: "note-link"; noteId: string; noteReferenceDisplay: string; prefix?: string }
  | { kind: "empty" };

export interface MockTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  context: TransactionContext;
  balance: number;
  postedAt: string;
}

export interface TransactionsSummary {
  totalPortfolioSize: number;
  totalInvestment: number;
  availableBalance: number;
  trendAmount: number;
  trendPercent: number;
}

export interface MockBankDetails {
  bankName: string;
  accountNumber: string;
}

export const MOCK_SUMMARY: TransactionsSummary = {
  totalPortfolioSize: 125_000,
  totalInvestment: 85_000,
  availableBalance: 40_000,
  trendAmount: 10.2,
  trendPercent: 1.01,
};

export const MOCK_BANK_DETAILS: MockBankDetails = {
  bankName: "RHB Islamic Bank Berhad",
  accountNumber: "465874838",
};

export const MOCK_TRANSACTIONS: MockTransaction[] = [
  {
    id: "tx-1",
    type: "Deposit",
    amount: 1_000,
    context: { kind: "text", text: "Wallet top-up" },
    balance: 61_400,
    postedAt: "2026-06-23T13:45:00.000Z",
  },
  {
    id: "tx-2",
    type: "Withdrawal",
    amount: 12_000,
    context: { kind: "text", text: "Bank transfer" },
    balance: 55_900,
    postedAt: "2026-06-23T13:45:00.000Z",
  },
  {
    id: "tx-3",
    type: "Investment",
    amount: 5_000,
    context: {
      kind: "note-link",
      noteId: "mock-note-1",
      noteReferenceDisplay: "Note 20260512-ABC",
    },
    balance: 50_900,
    postedAt: "2026-06-22T10:30:00.000Z",
  },
  {
    id: "tx-4",
    type: "Returns",
    amount: 850,
    context: {
      kind: "note-link",
      noteId: "mock-note-2",
      noteReferenceDisplay: "Note 20260401-XYZ",
      prefix: "Repayment · ",
    },
    balance: 55_900,
    postedAt: "2026-06-21T09:15:00.000Z",
  },
  {
    id: "tx-5",
    type: "SST",
    amount: 42,
    context: { kind: "empty" },
    balance: 55_058,
    postedAt: "2026-06-20T16:00:00.000Z",
  },
  {
    id: "tx-6",
    type: "Withdrawal",
    amount: 3_000,
    context: { kind: "text", text: "Bank transfer" },
    balance: 52_058,
    postedAt: "2026-06-19T11:20:00.000Z",
  },
  {
    id: "tx-7",
    type: "Deposit",
    amount: 10_000,
    context: { kind: "text", text: "Wallet top-up" },
    balance: 55_058,
    postedAt: "2026-06-18T14:00:00.000Z",
  },
  {
    id: "tx-8",
    type: "Investment",
    amount: 15_000,
    context: {
      kind: "note-link",
      noteId: "mock-note-3",
      noteReferenceDisplay: "Note 20260315-DEF",
    },
    balance: 45_058,
    postedAt: "2026-06-17T08:45:00.000Z",
  },
  {
    id: "tx-9",
    type: "Returns",
    amount: 1_200,
    context: {
      kind: "note-link",
      noteId: "mock-note-4",
      noteReferenceDisplay: "Note 20260220-GHI",
      prefix: "Repayment · ",
    },
    balance: 60_058,
    postedAt: "2026-06-16T12:30:00.000Z",
  },
  {
    id: "tx-10",
    type: "Withdrawal",
    amount: 2_500,
    context: { kind: "text", text: "Bank transfer" },
    balance: 58_858,
    postedAt: "2026-06-15T17:10:00.000Z",
  },
];

export const TRANSACTION_TYPE_OPTIONS: TransactionType[] = [
  "Deposit",
  "Withdrawal",
  "Investment",
  "Returns",
  "SST",
];

export const MIN_DEPOSIT_AMOUNT = 100;
export const MIN_WITHDRAWAL_AMOUNT = 100;
