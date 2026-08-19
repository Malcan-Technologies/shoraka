import {
  buildActivityRelatedMap,
  matchWithdrawalsToActivityEntries,
  type ActivityJoinEntry,
} from "./investor-balance-activity";

function entry(partial: Partial<ActivityJoinEntry> & Pick<ActivityJoinEntry, "id" | "source">): ActivityJoinEntry {
  return {
    investorOrganizationId: "org_1",
    amount: 250,
    postedAt: "2026-08-01T10:00:00.000Z",
    noteInvestmentId: null,
    metadata: null,
    ...partial,
  };
}

describe("matchWithdrawalsToActivityEntries", () => {
  it("prefers an explicit withdrawal id on metadata", () => {
    const matched = matchWithdrawalsToActivityEntries(
      [
        entry({
          id: "tx_1",
          source: "INVESTOR_WITHDRAWAL_REQUEST",
          metadata: { withdrawalId: "wd_2" },
        }),
      ],
      [
        {
          id: "wd_1",
          investorOrganizationId: "org_1",
          amount: 250,
          createdAt: "2026-08-01T10:00:00.000Z",
          status: "DRAFT",
          completedAt: null,
        },
        {
          id: "wd_2",
          investorOrganizationId: "org_1",
          amount: 250,
          createdAt: "2026-08-02T10:00:00.000Z",
          status: "COMPLETED",
          completedAt: "2026-08-03T10:00:00.000Z",
        },
      ]
    );

    expect(matched.get("tx_1")?.id).toBe("wd_2");
  });

  it("matches historical withdrawals by org, amount, and closest time", () => {
    const matched = matchWithdrawalsToActivityEntries(
      [
        entry({
          id: "tx_old",
          source: "INVESTOR_WITHDRAWAL_REQUEST",
          postedAt: "2026-07-01T09:00:00.000Z",
        }),
        entry({
          id: "tx_new",
          source: "INVESTOR_WITHDRAWAL_REQUEST",
          postedAt: "2026-08-01T10:00:00.000Z",
        }),
      ],
      [
        {
          id: "wd_old",
          investorOrganizationId: "org_1",
          amount: 250,
          createdAt: "2026-07-01T09:00:02.000Z",
          status: "COMPLETED",
          completedAt: "2026-07-03T00:00:00.000Z",
        },
        {
          id: "wd_new",
          investorOrganizationId: "org_1",
          amount: 250,
          createdAt: "2026-08-01T10:00:01.000Z",
          status: "DRAFT",
          completedAt: null,
        },
      ]
    );

    expect(matched.get("tx_old")?.id).toBe("wd_old");
    expect(matched.get("tx_new")?.id).toBe("wd_new");
  });
});

describe("buildActivityRelatedMap", () => {
  it("joins investment confirmation onto the reserve debit", () => {
    const related = buildActivityRelatedMap({
      entries: [
        entry({
          id: "tx_invest",
          source: "NOTE_INVESTMENT_COMMIT",
          noteInvestmentId: "inv_1",
        }),
      ],
      investments: [
        { id: "inv_1", status: "CONFIRMED", confirmedAt: "2026-08-10T00:00:00.000Z" },
      ],
      withdrawals: [],
    });

    expect(related.get("tx_invest")).toEqual({
      kind: "investment",
      status: "CONFIRMED",
      settledAt: "2026-08-10T00:00:00.000Z",
    });
  });

  it("defaults a withdrawal request to draft when no instruction is found", () => {
    const related = buildActivityRelatedMap({
      entries: [entry({ id: "tx_wd", source: "INVESTOR_WITHDRAWAL_REQUEST" })],
      investments: [],
      withdrawals: [],
    });

    expect(related.get("tx_wd")).toEqual({
      kind: "withdrawal",
      status: "DRAFT",
      settledAt: null,
    });
  });
});
