import { formatCurrency } from "@cashsouk/config";
import type { InvestorBalanceActivityEntry } from "@cashsouk/types";
import { formatNoteReferenceDisplay } from "@cashsouk/types";
import type {
  Transaction,
  TransactionContext,
  TransactionType,
} from "./transactions.types";

export function parseMoneyAmount(value: string): number {
  return Number(value.replaceAll(",", "").replaceAll(" ", "")) || 0;
}

export function formatTransactionDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isCreditTransaction(type: TransactionType): boolean {
  return type === "Deposit" || type === "Returns" || type === "Release";
}

export function formatSignedTransactionAmount(type: TransactionType, amount: number): string {
  const prefix = isCreditTransaction(type) ? "+" : "-";
  return `${prefix}${formatCurrency(amount)}`;
}

export function splitSignedTransactionAmount(type: TransactionType, amount: number) {
  const sign = isCreditTransaction(type) ? "+" : "-";
  return {
    prefix: `${sign}RM `,
    digits: formatCurrency(amount, { includeSymbol: false }),
  };
}

export function splitBalanceAmount(amount: number) {
  return {
    prefix: "RM ",
    digits: formatCurrency(amount, { includeSymbol: false }),
  };
}

function formatEnumLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildNoteContext(
  noteId: string | null,
  noteReferenceById: Map<string, string>,
  prefix?: string
): TransactionContext {
  if (!noteId) return { kind: "empty" };

  const rawReference = noteReferenceById.get(noteId);
  if (rawReference) {
    const display = formatNoteReferenceDisplay(rawReference);
    if (display) {
      return { kind: "note-link", noteId, noteReferenceDisplay: display, prefix };
    }
  }

  return { kind: "text", text: "Note" };
}

export function mapActivitySourceToType(
  source: string,
  metadata: Record<string, unknown> | null
): TransactionType {
  if (source === "MANUAL_TOPUP") return "Deposit";
  if (source === "NOTE_INVESTMENT_COMMIT") return "Investment";
  if (source === "NOTE_INVESTMENT_RELEASE") {
    const meta = asRecord(metadata);
    if (meta?.releaseReason === "SETTLEMENT_PAYOUT") return "Returns";
    return "Release";
  }
  return formatEnumLabel(source) as TransactionType;
}

function buildActivityContext(
  entry: InvestorBalanceActivityEntry,
  noteReferenceById: Map<string, string>
): TransactionContext {
  if (entry.source === "MANUAL_TOPUP") {
    return { kind: "text", text: "Wallet top-up" };
  }

  if (entry.source === "NOTE_INVESTMENT_COMMIT") {
    return buildNoteContext(entry.noteId, noteReferenceById);
  }

  if (entry.source === "NOTE_INVESTMENT_RELEASE") {
    const meta = asRecord(entry.metadata);
    const prefix = meta?.releaseReason === "SETTLEMENT_PAYOUT" ? "Repayment · " : undefined;
    return buildNoteContext(entry.noteId, noteReferenceById, prefix);
  }

  if (entry.noteId) {
    return buildNoteContext(entry.noteId, noteReferenceById);
  }

  return { kind: "empty" };
}

export function mapActivityEntryToTransaction(
  entry: InvestorBalanceActivityEntry,
  runningBalance: number | undefined,
  noteReferenceById: Map<string, string>
): Transaction {
  const type = mapActivitySourceToType(entry.source, entry.metadata);
  return {
    id: entry.id,
    type,
    amount: entry.amount,
    context: buildActivityContext(entry, noteReferenceById),
    balance: runningBalance ?? 0,
    postedAt: entry.postedAt,
  };
}
