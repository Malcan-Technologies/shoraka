import { roundNoteMoney, type PortfolioAtRiskMetric, type PortfolioAtRiskSummary } from "@cashsouk/types";

export type ParSourceRow = {
  daysPastDue?: unknown;
  servicingStatus?: unknown;
  outstandingPrincipal?: unknown;
  outstandingProfit?: unknown;
  outstandingTotal?: unknown;
};

function amount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function outstandingOf(row: ParSourceRow): number {
  if (row.outstandingTotal != null) return Math.max(0, amount(row.outstandingTotal));
  return Math.max(0, amount(row.outstandingPrincipal) + amount(row.outstandingProfit));
}

function metric(
  rows: ParSourceRow[],
  bookOutstanding: number,
  match: (row: ParSourceRow, daysPastDue: number) => boolean
): PortfolioAtRiskMetric {
  const matched = rows.filter((row) => match(row, amount(row.daysPastDue)));
  const outstanding = roundNoteMoney(matched.reduce((sum, row) => sum + outstandingOf(row), 0));
  return {
    count: matched.length,
    amount: outstanding,
    percent: bookOutstanding > 0 ? (outstanding / bookOutstanding) * 100 : 0,
  };
}

export function summarizePortfolioAtRisk(
  rows: ParSourceRow[],
  asOf: string
): PortfolioAtRiskSummary {
  const bookOutstanding = roundNoteMoney(rows.reduce((sum, row) => sum + outstandingOf(row), 0));
  return {
    asOf,
    bookCount: rows.length,
    bookOutstanding,
    pastDue: metric(rows, bookOutstanding, (_row, dpd) => dpd > 0),
    par30: metric(rows, bookOutstanding, (_row, dpd) => dpd > 30),
    par60: metric(rows, bookOutstanding, (_row, dpd) => dpd > 60),
    par90: metric(rows, bookOutstanding, (_row, dpd) => dpd > 90),
    defaulted: metric(
      rows,
      bookOutstanding,
      (row) => String(row.servicingStatus ?? "") === "DEFAULTED"
    ),
    exclusive: {
      current: metric(rows, bookOutstanding, (_row, dpd) => dpd <= 0),
      dpd1To30: metric(rows, bookOutstanding, (_row, dpd) => dpd > 0 && dpd <= 30),
      dpd31To60: metric(rows, bookOutstanding, (_row, dpd) => dpd > 30 && dpd <= 60),
      dpd61To90: metric(rows, bookOutstanding, (_row, dpd) => dpd > 60 && dpd <= 90),
      dpd90Plus: metric(rows, bookOutstanding, (_row, dpd) => dpd > 90),
    },
  };
}

export function portfolioAtRiskSummaryRows(summary: PortfolioAtRiskSummary) {
  return [
    { label: "Past due (DPD > 0)", ...summary.pastDue },
    { label: "PAR30 (DPD > 30)", ...summary.par30 },
    { label: "PAR60 (DPD > 60)", ...summary.par60 },
    { label: "PAR90 (DPD > 90)", ...summary.par90 },
    { label: "Defaulted", ...summary.defaulted },
  ];
}
