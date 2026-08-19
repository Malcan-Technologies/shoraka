import { formatCurrency } from "@cashsouk/config";
import type { InvestorBalanceActivityEntry } from "@cashsouk/types";
import {
  formatNoteReferenceDisplay,
  investorActivityDepositDetail,
  investorActivityStatusDetail,
  investorActivityStatusDisplay,
  investorActivityTitle,
  investorActivityTypeLabel,
} from "@cashsouk/types";
import {
  TRANSACTION_TYPE_FILTER_OPTIONS,
  type Transaction,
  type TransactionContext,
  type TransactionType,
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

export function isIncomingDirection(direction: "IN" | "OUT"): boolean {
  return direction === "IN";
}

export function getTransactionAmountToneClassName(direction: "IN" | "OUT"): string {
  return isIncomingDirection(direction) ? "text-emerald-700" : "text-destructive";
}

export function formatSignedTransactionAmount(direction: "IN" | "OUT", amount: number): string {
  const prefix = isIncomingDirection(direction) ? "+" : "-";
  return `${prefix}${formatCurrency(amount)}`;
}

export function splitSignedTransactionAmount(direction: "IN" | "OUT", amount: number) {
  const sign = isIncomingDirection(direction) ? "+" : "-";
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
  const label = investorActivityTypeLabel(source, metadata);
  if ((TRANSACTION_TYPE_FILTER_OPTIONS as readonly string[]).includes(label)) {
    return label as TransactionType;
  }
  return formatEnumLabel(source) as TransactionType;
}

function buildActivityContext(
  entry: InvestorBalanceActivityEntry,
  noteReferenceById: Map<string, string>
): TransactionContext {
  const depositDetail = investorActivityDepositDetail(entry.source);
  if (depositDetail) {
    return { kind: "text", text: depositDetail };
  }

  if (entry.source === "NOTE_INVESTMENT_COMMIT") {
    return buildNoteContext(entry.noteId, noteReferenceById);
  }

  if (entry.source === "NOTE_INVESTMENT_RELEASE") {
    const meta = asRecord(entry.metadata);
    const prefix =
      meta?.releaseReason === "SETTLEMENT_PAYOUT" ? "Repayment · " : "Returned · ";
    return buildNoteContext(entry.noteId, noteReferenceById, prefix);
  }

  if (entry.source === "INVESTOR_WITHDRAWAL_REQUEST") {
    const detail = investorActivityStatusDetail(entry.source, entry.related ?? null);
    return { kind: "text", text: detail ?? "Withdrawal request" };
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
  const status = investorActivityStatusDisplay(entry.source, entry.related ?? null, entry.metadata);
  return {
    id: entry.id,
    type,
    title: investorActivityTitle(entry.source, entry.metadata, entry.related ?? null),
    direction: entry.direction,
    amount: entry.amount,
    context: buildActivityContext(entry, noteReferenceById),
    status,
    balance: runningBalance ?? 0,
    postedAt: entry.postedAt,
  };
}
