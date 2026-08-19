import type { InvestorBalanceActivityEntry } from "@cashsouk/types";
import { mapWalletActivityRows } from "./organization-wallet-activity";

function entry(
  partial: Partial<InvestorBalanceActivityEntry> & Pick<InvestorBalanceActivityEntry, "id" | "source">
): InvestorBalanceActivityEntry {
  return {
    investorOrganizationId: "org_1",
    direction: "IN",
    amount: 500,
    noteId: null,
    noteInvestmentId: null,
    idempotencyKey: `key-${partial.id}`,
    metadata: null,
    postedAt: "2026-08-19T10:00:00.000Z",
    createdAt: "2026-08-19T10:00:00.000Z",
    related: null,
    ...partial,
  };
}

describe("mapWalletActivityRows", () => {
  it("mirrors investor deposit statuses without changing available cash", () => {
    const rows = mapWalletActivityRows(
      [
        entry({
          id: "gateway:pay_1",
          source: "GATEWAY_DEPOSIT",
          related: { kind: "deposit", status: "NAME_CHECK_PENDING", settledAt: null },
          affectsAvailableBalance: false,
        }),
        entry({
          id: "tx_invest",
          source: "NOTE_INVESTMENT_COMMIT",
          direction: "OUT",
          amount: 200,
          noteId: "note_1",
          noteReference: "NOTE-20260819-ABC",
          postedAt: "2026-08-18T10:00:00.000Z",
          related: { kind: "investment", status: "COMMITTED", settledAt: null },
        }),
      ],
      1000
    );

    expect(rows[0]?.title).toBe("Deposit received");
    expect(rows[0]?.status).toEqual({ label: "Verifying", tokenStatus: "NAME_CHECK_PENDING" });
    expect(rows[0]?.balance).toBe(1000);
    expect(rows[1]?.title).toBe("Investment committed");
    expect(rows[1]?.context).toEqual({
      kind: "note-link",
      noteId: "note_1",
      noteReferenceDisplay: "Note 20260819-ABC",
    });
    expect(rows[1]?.balance).toBe(1000);
  });
});
