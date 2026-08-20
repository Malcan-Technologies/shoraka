import type { InvestorBalanceActivityEntry } from "@cashsouk/types";
import { mapActivityEntryToTransaction, mapActivitySourceToType } from "./transaction-utils";

jest.mock("@cashsouk/config", () => ({
  formatCurrency: (value: number) => `RM ${value}`,
}));

function entry(
  partial: Partial<InvestorBalanceActivityEntry> & Pick<InvestorBalanceActivityEntry, "id" | "source">
): InvestorBalanceActivityEntry {
  return {
    investorOrganizationId: "org_1",
    direction: "OUT",
    amount: 250,
    noteId: null,
    noteInvestmentId: null,
    idempotencyKey: `key-${partial.id}`,
    metadata: null,
    postedAt: "2026-08-01T10:00:00.000Z",
    createdAt: "2026-08-01T10:00:00.000Z",
    related: null,
    ...partial,
  };
}

describe("mapActivitySourceToType", () => {
  it("maps wallet sources to table types", () => {
    expect(mapActivitySourceToType("GATEWAY_DEPOSIT", null)).toBe("Deposit");
    expect(mapActivitySourceToType("NOTE_INVESTMENT_COMMIT", null)).toBe("Investment");
    expect(mapActivitySourceToType("INVESTOR_WITHDRAWAL_REQUEST", null)).toBe("Withdrawal");
  });
});

describe("mapActivityEntryToTransaction", () => {
  const notes = new Map([["note_1", "NOTE-20260801-ABC"]]);

  it("labels a reserved investment and a confirmed one", () => {
    const reserved = mapActivityEntryToTransaction(
      entry({
        id: "tx_reserved",
        source: "NOTE_INVESTMENT_COMMIT",
        noteId: "note_1",
        noteInvestmentId: "inv_1",
        related: { kind: "investment", status: "COMMITTED", settledAt: null },
      }),
      1000,
      notes
    );
    const confirmed = mapActivityEntryToTransaction(
      entry({
        id: "tx_confirmed",
        source: "NOTE_INVESTMENT_COMMIT",
        noteId: "note_1",
        noteInvestmentId: "inv_1",
        related: {
          kind: "investment",
          status: "CONFIRMED",
          settledAt: "2026-08-10T00:00:00.000Z",
        },
      }),
      1000,
      notes
    );

    expect(reserved.type).toBe("Investment");
    expect(reserved.title).toBe("Investment committed");
    expect(reserved.status).toEqual({ label: "Committed", tokenStatus: "COMMITTED" });
    expect(confirmed.title).toBe("Investment confirmed");
    expect(confirmed.status).toEqual({ label: "Confirmed", tokenStatus: "CONFIRMED" });
  });

  it("explains withdrawal approval stages", () => {
    const pending = mapActivityEntryToTransaction(
      entry({ id: "tx_pending", source: "INVESTOR_WITHDRAWAL_REQUEST" }),
      500,
      notes
    );
    const paid = mapActivityEntryToTransaction(
      entry({
        id: "tx_paid",
        source: "INVESTOR_WITHDRAWAL_REQUEST",
        related: {
          kind: "withdrawal",
          status: "COMPLETED",
          settledAt: "2026-08-04T00:00:00.000Z",
        },
      }),
      500,
      notes
    );

    expect(pending.status?.label).toBe("Awaiting approval");
    expect(pending.context).toEqual({ kind: "text", text: "Pending CashSouk approval" });
    expect(paid.status?.label).toBe("Paid");
    expect(paid.context).toEqual({ kind: "text", text: "Paid to your bank" });
  });

  it("shows a name-check deposit as received but not yet in cash", () => {
    const pending = mapActivityEntryToTransaction(
      entry({
        id: "gateway:pay_1",
        source: "GATEWAY_DEPOSIT",
        direction: "IN",
        amount: 500,
        related: { kind: "deposit", status: "NAME_CHECK_PENDING", settledAt: null },
        affectsAvailableBalance: false,
      }),
      1000,
      notes
    );

    expect(pending.title).toBe("Deposit received");
    expect(pending.status).toEqual({ label: "Verifying", tokenStatus: "NAME_CHECK_PENDING" });
    expect(pending.context).toEqual({
      kind: "text",
      text: "Online payment · name verification in progress",
    });
    expect(pending.balance).toBe(1000);
  });

  it("keeps a later-released commitment as a debit, and the return as a credit", () => {
    const committed = mapActivityEntryToTransaction(
      entry({
        id: "tx_commit",
        source: "NOTE_INVESTMENT_COMMIT",
        noteId: "note_1",
        noteInvestmentId: "inv_1",
        related: { kind: "investment", status: "RELEASED", settledAt: null },
      }),
      500,
      notes
    );
    const returned = mapActivityEntryToTransaction(
      entry({
        id: "tx_release",
        source: "NOTE_INVESTMENT_RELEASE",
        direction: "IN",
        noteId: "note_1",
        metadata: { releaseReason: "FAILED_FUNDING" },
      }),
      1250,
      notes
    );
    expect(committed.title).toBe("Investment committed");
    expect(committed.status).toEqual({ label: "Released", tokenStatus: "RELEASED" });
    expect(returned.type).toBe("Release");
    expect(returned.title).toBe("Investment returned");
    expect(returned.status).toEqual({ label: "Returned", tokenStatus: "RELEASED" });
  });
});
