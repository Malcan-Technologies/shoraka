import {
  buildInvestorBalanceStatement,
  buildStatementFilename,
  parseStatementPeriodEnd,
  parseStatementPeriodStart,
  renderStatementCsv,
  type StatementLedgerEntry,
} from "./investor-balance-statement";
import { investorBalanceStatementQuerySchema } from "./schemas";

function makeEntry(
  partial: Partial<StatementLedgerEntry> & Pick<StatementLedgerEntry, "postedAt" | "direction" | "amount">
): StatementLedgerEntry {
  return {
    id: partial.id ?? "tx_1",
    source: partial.source ?? "MANUAL_TOPUP",
    noteId: partial.noteId ?? null,
    metadata: partial.metadata ?? null,
    ...partial,
  };
}

describe("investorBalanceStatementQuerySchema", () => {
  it("accepts a valid date range and format", () => {
    const parsed = investorBalanceStatementQuerySchema.parse({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      format: "pdf",
      investorOrganizationId: "org_1",
    });

    expect(parsed.format).toBe("pdf");
    expect(parsed.startDate).toBe("2026-01-01");
  });

  it("rejects an end date before the start date", () => {
    expect(() =>
      investorBalanceStatementQuerySchema.parse({
        startDate: "2026-02-01",
        endDate: "2026-01-31",
        format: "csv",
      })
    ).toThrow(/Start date must be on or before end date/);
  });
});

describe("buildInvestorBalanceStatement", () => {
  const noteReferenceById = new Map([["note_1", "NOTE-20260101-ABC"]]);

  it("computes opening, closing, totals, and running balances for the selected period", () => {
    const entries: StatementLedgerEntry[] = [
      makeEntry({
        id: "tx_opening",
        postedAt: new Date("2025-12-15T10:00:00+08:00"),
        direction: "IN",
        amount: 1000,
        source: "MANUAL_TOPUP",
      }),
      makeEntry({
        id: "tx_in_period_in",
        postedAt: new Date("2026-01-05T09:00:00+08:00"),
        direction: "IN",
        amount: 200,
        source: "MANUAL_TOPUP",
      }),
      makeEntry({
        id: "tx_in_period_out",
        postedAt: new Date("2026-01-10T11:30:00+08:00"),
        direction: "OUT",
        amount: 150,
        source: "NOTE_INVESTMENT_COMMIT",
        noteId: "note_1",
      }),
      makeEntry({
        id: "tx_after_period",
        postedAt: new Date("2026-02-02T08:00:00+08:00"),
        direction: "IN",
        amount: 50,
        source: "NOTE_INVESTMENT_RELEASE",
        noteId: "note_1",
        metadata: { releaseReason: "SETTLEMENT_PAYOUT" },
      }),
    ];

    const statement = buildInvestorBalanceStatement({
      accountName: "Demo Investor",
      accountId: "org_demo",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      generatedAt: new Date("2026-01-31T16:00:00+08:00"),
      entries,
      noteReferenceById,
    });

    expect(statement.openingBalance).toBe(1000);
    expect(statement.inTotal).toBe(200);
    expect(statement.outTotal).toBe(150);
    expect(statement.netChange).toBe(50);
    expect(statement.closingBalance).toBe(1050);
    expect(statement.rows).toHaveLength(2);
    expect(statement.rows[0]).toMatchObject({
      type: "Deposit",
      description: "Wallet top-up",
      moneyIn: 200,
      moneyOut: null,
      balance: 1200,
    });
    expect(statement.rows[1]).toMatchObject({
      type: "Investment",
      description: "Note 20260101-ABC",
      moneyIn: null,
      moneyOut: 150,
      balance: 1050,
      reference: "NOTE-20260101-ABC",
    });
  });

  it("keeps opening and closing equal when there is no activity in the period", () => {
    const entries: StatementLedgerEntry[] = [
      makeEntry({
        postedAt: new Date("2025-11-01T09:00:00+08:00"),
        direction: "IN",
        amount: 500,
      }),
    ];

    const statement = buildInvestorBalanceStatement({
      accountName: "Quiet Investor",
      accountId: "org_quiet",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      generatedAt: new Date("2026-01-31T16:00:00+08:00"),
      entries,
      noteReferenceById: new Map(),
    });

    expect(statement.openingBalance).toBe(500);
    expect(statement.closingBalance).toBe(500);
    expect(statement.inTotal).toBe(0);
    expect(statement.outTotal).toBe(0);
    expect(statement.rows).toHaveLength(0);
  });
});

describe("statement export helpers", () => {
  it("uses Malaysia timezone boundaries for the selected dates", () => {
    expect(parseStatementPeriodStart("2026-01-01").toISOString()).toBe("2025-12-31T16:00:00.000Z");
    expect(parseStatementPeriodEnd("2026-01-01").toISOString()).toBe("2026-01-01T15:59:59.999Z");
  });

  it("renders CSV with summary headers and transaction rows", () => {
    const statement = buildInvestorBalanceStatement({
      accountName: "Demo Investor",
      accountId: "org_demo",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      generatedAt: new Date("2026-01-31T16:00:00+08:00"),
      entries: [
        makeEntry({
          postedAt: new Date("2026-01-05T09:00:00+08:00"),
          direction: "IN",
          amount: 100,
        }),
      ],
      noteReferenceById: new Map(),
    });

    const csv = renderStatementCsv(statement).toString("utf-8");
    expect(csv).toContain('"Opening balance","0.00"');
    expect(csv).toContain('"Closing balance","100.00"');
    expect(csv).toContain('"Date","Type","Description","Reference","Money in","Money out","Balance"');
    expect(csv).toContain('"Deposit"');
    expect(buildStatementFilename("2026-01-01", "2026-01-31", "csv")).toBe(
      "transaction-statement-2026-01-01-to-2026-01-31.csv"
    );
  });
});
