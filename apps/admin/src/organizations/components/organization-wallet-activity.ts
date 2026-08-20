import {
  formatNoteReferenceDisplay,
  investorActivityDepositDetail,
  investorActivityStatusDetail,
  investorActivityStatusDisplay,
  investorActivityTitle,
  runningBalancesForActivityEntries,
  type InvestorBalanceActivityEntry,
} from "@cashsouk/types";

export type WalletActivityContext =
  | { kind: "text"; text: string }
  | { kind: "note-link"; noteId: string; noteReferenceDisplay: string; prefix?: string }
  | { kind: "empty" };

export type WalletActivityRow = {
  id: string;
  title: string;
  context: WalletActivityContext;
  status: { label: string; tokenStatus: string } | null;
  direction: "IN" | "OUT";
  amount: number;
  balance: number;
  postedAt: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildNoteContext(
  noteId: string | null,
  noteReference: string | null | undefined,
  prefix?: string
): WalletActivityContext {
  if (!noteId) return { kind: "empty" };
  const display = formatNoteReferenceDisplay(noteReference);
  if (display) {
    return { kind: "note-link", noteId, noteReferenceDisplay: display, prefix };
  }
  return { kind: "text", text: "Note" };
}

export function mapWalletActivityEntry(
  entry: InvestorBalanceActivityEntry,
  runningBalance: number
): WalletActivityRow {
  const depositDetail = investorActivityDepositDetail(entry.source, entry.related ?? null);
  let context: WalletActivityContext = { kind: "empty" };
  if (depositDetail) {
    context = { kind: "text", text: depositDetail };
  } else if (entry.source === "NOTE_INVESTMENT_COMMIT") {
    context = buildNoteContext(entry.noteId, entry.noteReference);
  } else if (entry.source === "NOTE_INVESTMENT_RELEASE") {
    const prefix =
      asRecord(entry.metadata)?.releaseReason === "SETTLEMENT_PAYOUT"
        ? "Repayment · "
        : "Returned · ";
    context = buildNoteContext(entry.noteId, entry.noteReference, prefix);
  } else if (entry.source === "INVESTOR_WITHDRAWAL_REQUEST") {
    context = {
      kind: "text",
      text: investorActivityStatusDetail(entry.source, entry.related ?? null) ?? "Withdrawal request",
    };
  } else if (entry.noteId) {
    context = buildNoteContext(entry.noteId, entry.noteReference);
  }

  return {
    id: entry.id,
    title: investorActivityTitle(entry.source, entry.metadata, entry.related ?? null),
    context,
    status: investorActivityStatusDisplay(entry.source, entry.related ?? null, entry.metadata),
    direction: entry.direction,
    amount: entry.amount,
    balance: runningBalance,
    postedAt: entry.postedAt,
  };
}

export function mapWalletActivityRows(
  entries: InvestorBalanceActivityEntry[],
  availableBalance: number
): WalletActivityRow[] {
  const sorted = [...entries].sort(
    (left, right) => new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime()
  );
  const runningBalances = runningBalancesForActivityEntries(sorted, availableBalance);
  return sorted.map((entry, index) => mapWalletActivityEntry(entry, runningBalances[index] ?? 0));
}
