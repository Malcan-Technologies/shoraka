import type { Transaction } from "@/app/transactions/components/transactions.types";
import {
  filterTransactions,
  paginateTransactions,
  transactionTypeFromSearchParam,
} from "./portfolio-transactions-model";

function tx(overrides: Partial<Transaction> & Pick<Transaction, "id" | "type" | "postedAt">): Transaction {
  return {
    title: overrides.title ?? overrides.type,
    direction: "IN",
    amount: 100,
    context: { kind: "empty" },
    status: null,
    balance: 100,
    ...overrides,
  };
}

describe("filterTransactions", () => {
  const now = Date.parse("2026-08-19T12:00:00.000Z");
  const rows = [
    tx({ id: "1", type: "Deposit", postedAt: "2026-08-18T12:00:00.000Z" }),
    tx({ id: "2", type: "Withdrawal", postedAt: "2026-07-01T12:00:00.000Z" }),
    tx({ id: "3", type: "Deposit", postedAt: "2026-08-01T12:00:00.000Z" }),
  ];

  it("filters by type", () => {
    expect(
      filterTransactions(rows, { type: "Withdrawal", timeRange: "all" }, "", now).map((row) => row.id)
    ).toEqual(["2"]);
  });

  it("filters by time range", () => {
    expect(filterTransactions(rows, { type: "all", timeRange: "7d" }, "", now).map((row) => row.id)).toEqual([
      "1",
    ]);
  });

  it("filters by search across type and note reference", () => {
    const withNote = [
      ...rows,
      tx({
        id: "4",
        type: "Investment",
        postedAt: "2026-08-18T10:00:00.000Z",
        context: { kind: "note-link", noteId: "n1", noteReferenceDisplay: "NOTE-42" },
      }),
    ];
    expect(
      filterTransactions(withNote, { type: "all", timeRange: "all" }, "note-42", now).map((row) => row.id)
    ).toEqual(["4"]);
    expect(
      filterTransactions(withNote, { type: "all", timeRange: "all" }, "deposit", now).map((row) => row.id)
    ).toEqual(["1", "3"]);
  });

  it("filters by committed or approval status copy", () => {
    const withStatus = [
      tx({
        id: "committed",
        type: "Investment",
        title: "Investment committed",
        postedAt: "2026-08-18T12:00:00.000Z",
        status: { label: "Committed", tokenStatus: "COMMITTED" },
      }),
      tx({
        id: "pending",
        type: "Withdrawal",
        postedAt: "2026-08-18T11:00:00.000Z",
        status: { label: "Awaiting approval", tokenStatus: "PENDING_APPROVAL" },
      }),
    ];
    expect(
      filterTransactions(withStatus, { type: "all", timeRange: "all" }, "committed", now).map((row) => row.id)
    ).toEqual(["committed"]);
    expect(
      filterTransactions(withStatus, { type: "all", timeRange: "all" }, "approval", now).map((row) => row.id)
    ).toEqual(["pending"]);
  });
});

describe("transactionTypeFromSearchParam", () => {
  it("accepts known ledger types and otherwise returns all", () => {
    expect(transactionTypeFromSearchParam("Withdrawal")).toBe("Withdrawal");
    expect(transactionTypeFromSearchParam("unknown")).toBe("all");
    expect(transactionTypeFromSearchParam(null)).toBe("all");
  });
});

describe("paginateTransactions", () => {
  const rows = [
    tx({ id: "1", type: "Deposit", postedAt: "2026-08-18T12:00:00.000Z" }),
    tx({ id: "2", type: "Deposit", postedAt: "2026-08-17T12:00:00.000Z" }),
    tx({ id: "3", type: "Deposit", postedAt: "2026-08-16T12:00:00.000Z" }),
  ];

  it("returns the requested page", () => {
    expect(paginateTransactions(rows, 2, 2).map((row) => row.id)).toEqual(["3"]);
  });
});
