jest.mock("../../lib/prisma", () => ({ prisma: {} }));
jest.mock("../payment/deposit-service", () => ({ resolveInvestorExpectedName: jest.fn() }));

import {
  InvestorBalanceTransactionDirection,
  InvestorBalanceTransactionSource,
} from "@prisma/client";
import {
  isCompletedRefund,
  isExternalCashAdded,
  isWithdrawalSource,
  distinctActiveNoteCount,
  weightedExpectedNetRate,
} from "./investor-book";
import { parseSettlementAllocations } from "../notes/investment-settlement-confirmation/snapshot";

describe("investor book cash sources", () => {
  it("counts deposits and top-ups as cash added", () => {
    expect(isExternalCashAdded(InvestorBalanceTransactionSource.GATEWAY_DEPOSIT)).toBe(true);
    expect(isExternalCashAdded(InvestorBalanceTransactionSource.MANUAL_TOPUP)).toBe(true);
    expect(isExternalCashAdded(InvestorBalanceTransactionSource.NOTE_INVESTMENT_COMMIT)).toBe(false);
  });

  it("excludes hold movements and counts completed refunds", () => {
    expect(
      isCompletedRefund(
        InvestorBalanceTransactionSource.GATEWAY_DEPOSIT_REFUND,
        InvestorBalanceTransactionDirection.OUT
      )
    ).toBe(true);
    expect(
      isCompletedRefund(
        InvestorBalanceTransactionSource.GATEWAY_DEPOSIT_REFUND_HOLD,
        InvestorBalanceTransactionDirection.OUT
      )
    ).toBe(false);
    expect(isWithdrawalSource(InvestorBalanceTransactionSource.INVESTOR_WITHDRAWAL_REQUEST)).toBe(true);
  });
});

describe("investor book realised allocations", () => {
  it("reads frozen snapshot allocations instead of reconstructing splits", () => {
    const rows = parseSettlementAllocations({
      allocations: [
        {
          investmentId: "inv-1",
          investorOrganizationId: "org-1",
          principal: 1000,
          profitNet: 80,
          tawidhInvestorShare: 5,
        },
      ],
    });
    expect(rows).toEqual([
      {
        investmentId: "inv-1",
        investorOrganizationId: "org-1",
        principal: 1000,
        profitNet: 80,
        tawidhInvestorShare: 5,
      },
    ]);
  });

  it("weights expected net rate by confirmed amount", () => {
    expect(
      weightedExpectedNetRate([
        { amount: 100, profitRatePercent: 10, serviceFeeRatePercent: 0 },
        { amount: 300, profitRatePercent: 20, serviceFeeRatePercent: 0 },
      ])
    ).toBe(17.5);
  });

  it("counts distinct notes when an organization has multiple investments in one note", () => {
    expect(
      distinctActiveNoteCount([
        { noteId: "note-1" },
        { noteId: "note-1" },
        { noteId: "note-2" },
      ])
    ).toBe(2);
  });
});
