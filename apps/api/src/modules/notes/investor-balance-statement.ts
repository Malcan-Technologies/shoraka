import PDFDocument from "pdfkit";
import { formatNoteReferenceDisplay, roundNoteMoney } from "@cashsouk/types";

export interface InvestorBalanceStatementRow {
  postedAt: string;
  type: string;
  description: string;
  moneyIn: number | null;
  moneyOut: number | null;
  balance: number;
  reference: string;
}

export interface InvestorBalanceStatementData {
  title: string;
  accountName: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  openingBalance: number;
  closingBalance: number;
  inTotal: number;
  outTotal: number;
  netChange: number;
  rows: InvestorBalanceStatementRow[];
}

export interface StatementLedgerEntry {
  id: string;
  direction: "IN" | "OUT";
  amount: number;
  source: string;
  noteId: string | null;
  metadata: Record<string, unknown> | null;
  postedAt: Date;
}

const STATEMENT_TIMEZONE_OFFSET = "+08:00";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatEnumLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function mapSourceToType(source: string, metadata: Record<string, unknown> | null): string {
  if (source === "MANUAL_TOPUP") return "Deposit";
  if (source === "NOTE_INVESTMENT_COMMIT") return "Investment";
  if (source === "NOTE_INVESTMENT_RELEASE") {
    return metadata?.releaseReason === "SETTLEMENT_PAYOUT" ? "Returns" : "Release";
  }
  return formatEnumLabel(source);
}

function buildDescription(
  entry: StatementLedgerEntry,
  noteReferenceById: Map<string, string>
): string {
  if (entry.source === "MANUAL_TOPUP") return "Wallet top-up";

  const noteReference = entry.noteId ? noteReferenceById.get(entry.noteId) : undefined;
  const noteLabel = noteReference ? formatNoteReferenceDisplay(noteReference) : entry.noteId ? "Note" : "";

  if (entry.source === "NOTE_INVESTMENT_COMMIT") {
    return noteLabel || "Investment";
  }

  if (entry.source === "NOTE_INVESTMENT_RELEASE") {
    const meta = asRecord(entry.metadata);
    const prefix = meta?.releaseReason === "SETTLEMENT_PAYOUT" ? "Repayment · " : "";
    return `${prefix}${noteLabel || "Release"}`.trim();
  }

  return noteLabel || formatEnumLabel(entry.source);
}

function buildReference(entry: StatementLedgerEntry, noteReferenceById: Map<string, string>): string {
  if (entry.noteId) {
    const noteReference = noteReferenceById.get(entry.noteId);
    if (noteReference) return noteReference;
  }
  return entry.id.slice(0, 8).toUpperCase();
}

export function parseStatementPeriodStart(startDate: string): Date {
  return new Date(`${startDate}T00:00:00.000${STATEMENT_TIMEZONE_OFFSET}`);
}

export function parseStatementPeriodEnd(endDate: string): Date {
  return new Date(`${endDate}T23:59:59.999${STATEMENT_TIMEZONE_OFFSET}`);
}

function applyLedgerDelta(balance: number, direction: "IN" | "OUT", amount: number): number {
  return roundNoteMoney(direction === "IN" ? balance + amount : balance - amount, 2);
}

function sumLedgerDelta(entries: StatementLedgerEntry[]): number {
  return roundNoteMoney(
    entries.reduce((sum, entry) => {
      return entry.direction === "IN" ? sum + entry.amount : sum - entry.amount;
    }, 0),
    2
  );
}

export function buildInvestorBalanceStatement(input: {
  accountName: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: Date;
  entries: StatementLedgerEntry[];
  noteReferenceById: Map<string, string>;
}): InvestorBalanceStatementData {
  const periodStartAt = parseStatementPeriodStart(input.periodStart);
  const periodEndAt = parseStatementPeriodEnd(input.periodEnd);

  const beforePeriod = input.entries.filter((entry) => entry.postedAt < periodStartAt);
  const inPeriod = input.entries.filter(
    (entry) => entry.postedAt >= periodStartAt && entry.postedAt <= periodEndAt
  );

  const openingBalance = sumLedgerDelta(beforePeriod);
  let runningBalance = openingBalance;

  const rows: InvestorBalanceStatementRow[] = inPeriod.map((entry) => {
    runningBalance = applyLedgerDelta(runningBalance, entry.direction, entry.amount);
    return {
      postedAt: entry.postedAt.toISOString(),
      type: mapSourceToType(entry.source, asRecord(entry.metadata)),
      description: buildDescription(entry, input.noteReferenceById),
      moneyIn: entry.direction === "IN" ? entry.amount : null,
      moneyOut: entry.direction === "OUT" ? entry.amount : null,
      balance: runningBalance,
      reference: buildReference(entry, input.noteReferenceById),
    };
  });

  const inTotal = roundNoteMoney(
    inPeriod.filter((entry) => entry.direction === "IN").reduce((sum, entry) => sum + entry.amount, 0),
    2
  );
  const outTotal = roundNoteMoney(
    inPeriod.filter((entry) => entry.direction === "OUT").reduce((sum, entry) => sum + entry.amount, 0),
    2
  );
  const closingBalance = rows.length > 0 ? rows[rows.length - 1]!.balance : openingBalance;

  return {
    title: "Transaction Statement",
    accountName: input.accountName,
    accountId: input.accountId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    generatedAt: input.generatedAt.toISOString(),
    openingBalance,
    closingBalance,
    inTotal,
    outTotal,
    netChange: roundNoteMoney(inTotal - outTotal, 2),
    rows,
  };
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatStatementMoney(amount: number | null): string {
  if (amount === null) return "";
  return roundNoteMoney(amount, 2).toFixed(2);
}

function formatStatementDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

export function renderStatementCsv(statement: InvestorBalanceStatementData): Buffer {
  const headerRows = [
    ["Statement", statement.title],
    ["Account", statement.accountName],
    ["Account ID", statement.accountId],
    ["Period start", statement.periodStart],
    ["Period end", statement.periodEnd],
    ["Generated at", formatStatementDateTime(statement.generatedAt)],
    ["Opening balance", formatStatementMoney(statement.openingBalance)],
    ["Closing balance", formatStatementMoney(statement.closingBalance)],
    ["Total in", formatStatementMoney(statement.inTotal)],
    ["Total out", formatStatementMoney(statement.outTotal)],
    ["Net change", formatStatementMoney(statement.netChange)],
    [],
    ["Date", "Type", "Description", "Reference", "Money in", "Money out", "Balance"],
  ];

  const dataRows = statement.rows.map((row) => [
    formatStatementDateTime(row.postedAt),
    row.type,
    row.description,
    row.reference,
    formatStatementMoney(row.moneyIn),
    formatStatementMoney(row.moneyOut),
    formatStatementMoney(row.balance),
  ]);

  const lines = [...headerRows, ...dataRows].map((row) => row.map(escapeCsvCell).join(","));
  return Buffer.from(lines.join("\n"), "utf-8");
}

function formatPdfMoney(amount: number): string {
  return `RM ${roundNoteMoney(amount, 2).toFixed(2)}`;
}

export async function renderStatementPdf(statement: InvestorBalanceStatementData): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(20).fillColor("#8A0304").text(statement.title, { underline: true });
  doc.moveDown(0.75);

  const summaryRows: Array<[string, string]> = [
    ["Account", statement.accountName],
    ["Account ID", statement.accountId],
    ["Period", `${statement.periodStart} to ${statement.periodEnd}`],
    ["Generated", formatStatementDateTime(statement.generatedAt)],
    ["Opening balance", formatPdfMoney(statement.openingBalance)],
    ["Closing balance", formatPdfMoney(statement.closingBalance)],
    ["Total in", formatPdfMoney(statement.inTotal)],
    ["Total out", formatPdfMoney(statement.outTotal)],
    ["Net change", formatPdfMoney(statement.netChange)],
  ];

  for (const [label, value] of summaryRows) {
    doc.fontSize(9).fillColor("#666").text(label);
    doc.fontSize(11).fillColor("#111").text(value || "-");
    doc.moveDown(0.35);
  }

  doc.moveDown(0.5);
  doc.fontSize(12).fillColor("#111").text("Transactions");
  doc.moveDown(0.5);

  const columns = [
    { label: "Date", width: 95 },
    { label: "Type", width: 70 },
    { label: "Description", width: 145 },
    { label: "In", width: 55, align: "right" as const },
    { label: "Out", width: 55, align: "right" as const },
    { label: "Balance", width: 65, align: "right" as const },
  ];

  const tableLeft = doc.page.margins.left;
  let y = doc.y;

  doc.fontSize(8).fillColor("#666");
  let x = tableLeft;
  for (const column of columns) {
    doc.text(column.label, x, y, { width: column.width, align: column.align ?? "left" });
    x += column.width;
  }
  y += 14;
  doc.moveTo(tableLeft, y).lineTo(tableLeft + 485, y).strokeColor("#ddd").stroke();
  y += 6;

  doc.fontSize(8).fillColor("#111");
  if (statement.rows.length === 0) {
    doc.text("No transactions in this period.", tableLeft, y);
  } else {
    for (const row of statement.rows) {
      if (y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      const cells = [
        formatStatementDateTime(row.postedAt),
        row.type,
        row.description,
        row.moneyIn === null ? "" : formatPdfMoney(row.moneyIn).replace("RM ", ""),
        row.moneyOut === null ? "" : formatPdfMoney(row.moneyOut).replace("RM ", ""),
        formatPdfMoney(row.balance).replace("RM ", ""),
      ];

      x = tableLeft;
      let rowHeight = 12;
      for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index]!;
        const height = doc.heightOfString(cells[index] ?? "", {
          width: column.width,
          align: column.align ?? "left",
        });
        rowHeight = Math.max(rowHeight, height);
        doc.text(cells[index] ?? "", x, y, { width: column.width, align: column.align ?? "left" });
        x += column.width;
      }
      y += rowHeight + 4;
    }
  }

  doc.moveDown(2);
  doc.fontSize(8).fillColor("#666").text("Generated from Shoraka investor portal.", {
    align: "left",
  });

  doc.end();
  return done;
}

export function buildStatementFilename(
  periodStart: string,
  periodEnd: string,
  format: "csv" | "pdf"
): string {
  return `transaction-statement-${periodStart}-to-${periodEnd}.${format}`;
}
