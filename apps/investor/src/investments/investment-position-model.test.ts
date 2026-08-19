import type { NoteListItem, NoteSettlementPoolSummary } from "@cashsouk/types";
import {
  calendarDaysFromToday,
  compareInvestmentMaturity,
  getInvestmentMaturityDisplay,
  getInvestmentRelevanceRank,
  investmentCardHeadline,
  investmentCardMeta,
  investmentCardPayoutResult,
  averageRealizedAnnualReturnRatePercent,
  portfolioPayoutResult,
  isInvestorInvestmentCompleted,
  partitionInvestorInvestments,
} from "./investment-position-model";

jest.mock("@cashsouk/config", () => ({
  formatCurrency: (value: number) => `RM ${value}`,
}));

const NOW = new Date(2026, 7, 19);

function note(overrides: Partial<NoteListItem> = {}): NoteListItem {
  return {
    id: "note_1",
    noteReference: "NOTE-20260819-ABC",
    title: "Acme invoice note",
    productCategory: null,
    productName: "Invoice financing",
    issuerIndustry: "Manufacturing",
    sourceApplicationId: "app_1",
    sourceContractId: null,
    sourceContractDisplayReference: null,
    sourceInvoiceId: "inv_1",
    issuerOrganizationId: "org_1",
    issuerName: "Acme Sdn Bhd",
    paymasterName: "Paymaster Co",
    riskRating: "B",
    status: "ACTIVE" as NoteListItem["status"],
    listingStatus: "CLOSED" as NoteListItem["listingStatus"],
    fundingStatus: "FUNDED" as NoteListItem["fundingStatus"],
    servicingStatus: "CURRENT" as NoteListItem["servicingStatus"],
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    investorCount: 0,
    maturityDate: "2026-09-01",
    listingClosesAt: null,
    activatedAt: "2026-08-01",
    publishedAt: "2026-07-20",
    fundingClosedAt: "2026-07-28",
    repaidAt: null,
    settlementSummary: null,
    createdAt: "2026-07-15",
    updatedAt: "2026-08-10",
    requestedAmount: 50000,
    invoiceAmount: 60000,
    settlementAmount: 50000,
    targetAmount: 50000,
    fundedAmount: 50000,
    fundingPercent: 100,
    minimumFundingPercent: 80,
    profitRatePercent: 12.5,
    platformFeeRatePercent: 1,
    serviceFeeRatePercent: 0,
    investorRepaymentSummary: {
      investedPrincipal: 50000,
      expectedPayoutAmount: 56250,
      expectedProfitAmount: 6250,
      expectedProfitGrossAmount: 6250,
      expectedServiceFeeAmount: 0,
      profitDays: 30,
      profitStartDate: "2026-08-01",
      profitMaturityDate: "2026-09-01",
      receivedPayoutAmount: 0,
      receivedProfitNetAmount: 0,
      receivedProfitGrossAmount: 0,
      receivedServiceFeeAmount: 0,
      receivedTawidhCompensationAmount: 0,
      expectedReturnRatePercent: 12.5,
      actualReturnRatePercent: null,
      progressPercent: 0,
      receivedSettlementEvents: [],
    },
    ...overrides,
  };
}

function postedSettlement(
  overrides: Partial<NoteSettlementPoolSummary> = {}
): NoteSettlementPoolSummary {
  return {
    settlementId: "set_1",
    displayReference: "SET-1",
    status: "POSTED" as NoteSettlementPoolSummary["status"],
    grossReceiptAmount: 56000,
    investorPoolAmount: 55000,
    operatingAccountAmount: 1000,
    totalTawidhAmount: 0,
    tawidhInvestorSharePercent: 0,
    tawidhInvestorAmount: 0,
    tawidhAccountAmount: 0,
    gharamahAccountAmount: 0,
    issuerResidualAmount: 0,
    unappliedAmount: 0,
    profitStartDate: "2026-08-01",
    profitMaturityDate: "2026-09-01",
    profitDays: 30,
    annualProfitRatePercent: 12.5,
    postedAt: "2026-08-18",
    serviceFeeTrusteeStatus: "PENDING_LETTER" as NoteSettlementPoolSummary["serviceFeeTrusteeStatus"],
    serviceFeeTrusteeCreatedAt: "2026-08-18",
    serviceFeeTrusteeLetterGeneratedAt: null,
    serviceFeeTrusteeSubmittedAt: null,
    serviceFeeTrusteeCompletedAt: null,
    ...overrides,
  };
}

describe("calendarDaysFromToday", () => {
  it("counts calendar days, not hours", () => {
    expect(calendarDaysFromToday("2026-08-19", NOW)).toBe(0);
    expect(calendarDaysFromToday("2026-08-26", NOW)).toBe(7);
    expect(calendarDaysFromToday("2026-08-12", NOW)).toBe(-7);
  });
});

describe("completion", () => {
  it("keeps arrears and in-flight payouts in the live list", () => {
    const arrears = note({
      status: "ARREARS" as NoteListItem["status"],
      servicingStatus: "ARREARS" as NoteListItem["servicingStatus"],
    });
    const wrapping = note({
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      settlementSummary: postedSettlement(),
    });
    expect(isInvestorInvestmentCompleted(arrears)).toBe(false);
    expect(isInvestorInvestmentCompleted(wrapping)).toBe(false);
  });

  it("treats posted-and-complete notes as completed", () => {
    const settled = note({
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      settlementSummary: postedSettlement({
        serviceFeeTrusteeStatus: "COMPLETED" as NoteSettlementPoolSummary["serviceFeeTrusteeStatus"],
        serviceFeeTrusteeCompletedAt: "2026-08-18",
      }),
    });
    expect(isInvestorInvestmentCompleted(settled)).toBe(true);
  });
});

describe("partitionInvestorInvestments", () => {
  it("splits live notes from completed notes only", () => {
    const arrears = note({
      id: "a",
      status: "ARREARS" as NoteListItem["status"],
      servicingStatus: "ARREARS" as NoteListItem["servicingStatus"],
    });
    const active = note({ id: "b", maturityDate: "2026-10-01" });
    const settled = note({
      id: "c",
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
    });
    const partitioned = partitionInvestorInvestments([settled, active, arrears]);
    expect(partitioned.active.map((item) => item.id)).toEqual(["b", "a"]);
    expect(partitioned.completed.map((item) => item.id)).toEqual(["c"]);
  });
});

describe("maturity display", () => {
  it("gives countdown weight to upcoming notes", () => {
    expect(getInvestmentMaturityDisplay(note({ maturityDate: "2026-08-24" }), NOW)).toEqual({
      tone: "soon",
      value: "5",
      unit: "days left",
      date: "24 Aug 2026",
    });
    expect(getInvestmentMaturityDisplay(note({ maturityDate: "2026-09-19" }), NOW)).toMatchObject({
      tone: "upcoming",
      value: "31",
      unit: "days left",
    });
  });

  it("labels today and past-due without turning them into tasks", () => {
    expect(getInvestmentMaturityDisplay(note({ maturityDate: "2026-08-19" }), NOW)).toMatchObject({
      tone: "today",
      value: "Today",
      unit: "Matures",
    });
    expect(getInvestmentMaturityDisplay(note({ maturityDate: "2026-08-12" }), NOW)).toEqual({
      tone: "overdue",
      value: "7",
      unit: "days past due",
      date: "12 Aug 2026",
    });
  });

  it("shows the matured date on completed notes", () => {
    const settled = note({
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      maturityDate: "2026-08-01",
    });
    expect(getInvestmentMaturityDisplay(settled, NOW)).toEqual({
      tone: "settled",
      value: "1 Aug 2026",
      unit: "Matured",
      date: "",
    });
  });
});

describe("card copy", () => {
  it("leads with invested amount and expected return", () => {
    expect(investmentCardHeadline(note())).toBe("RM 50000 invested · 12.5% p.a.");
  });

  it("keeps received amounts on the meta line, not the countdown", () => {
    const withReceipt = note({
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        receivedPayoutAmount: 2000,
      },
    });
    expect(investmentCardMeta(withReceipt)).toBe("Received RM 2000");
  });

  it("exposes net profit only after money has been received", () => {
    expect(investmentCardPayoutResult(note())).toBeNull();
    const withProfit = note({
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        receivedPayoutAmount: 56250,
        receivedProfitNetAmount: 6250,
      },
    });
    expect(investmentCardPayoutResult(withProfit)).toEqual({ kind: "profit", amount: 6250 });
  });

  it("exposes a realized loss when received is below invested", () => {
    const withLoss = note({
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        receivedPayoutAmount: 40000,
        receivedProfitNetAmount: 0,
      },
    });
    expect(investmentCardPayoutResult(withLoss)).toEqual({ kind: "loss", amount: 10000 });
  });

  it("nets realized profit and loss across the book", () => {
    const withProfit = note({
      id: "profit",
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        receivedPayoutAmount: 56250,
        receivedProfitNetAmount: 6250,
      },
    });
    const withLoss = note({
      id: "loss",
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        receivedPayoutAmount: 40000,
        receivedProfitNetAmount: 0,
      },
    });
    expect(portfolioPayoutResult([note(), withProfit, withLoss])).toEqual({
      kind: "loss",
      amount: 3750,
    });
    expect(portfolioPayoutResult([withProfit])).toEqual({ kind: "profit", amount: 6250 });
    expect(portfolioPayoutResult([note()])).toEqual({ kind: "flat", amount: 0 });
  });

  it("averages realized p.a. returns only for notes that have received payouts", () => {
    const unpaid = note();
    const repaid = note({
      id: "repaid",
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        investedPrincipal: 10000,
        receivedPayoutAmount: 10082.19,
        receivedProfitNetAmount: 82.19,
        profitDays: 30,
      },
    });
    const biggerRepaid = note({
      id: "bigger",
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        investedPrincipal: 20000,
        receivedPayoutAmount: 20328.77,
        receivedProfitNetAmount: 328.77,
        profitDays: 30,
      },
    });
    expect(averageRealizedAnnualReturnRatePercent([unpaid])).toBeNull();
    expect(averageRealizedAnnualReturnRatePercent([repaid])).toBeCloseTo(10, 1);
    expect(averageRealizedAnnualReturnRatePercent([repaid, biggerRepaid])).toBeCloseTo(16.67, 1);
  });
});

describe("ordering", () => {
  it("ranks live notes above completed, then sooner maturity first", () => {
    const later = note({ id: "later", maturityDate: "2026-10-01" });
    const sooner = note({ id: "sooner", maturityDate: "2026-08-21" });
    const settled = note({
      id: "settled",
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
    });
    expect(getInvestmentRelevanceRank(sooner)).toBe(0);
    expect(getInvestmentRelevanceRank(settled)).toBe(1);
    expect(compareInvestmentMaturity(sooner, later, NOW)).toBeLessThan(0);
  });
});
