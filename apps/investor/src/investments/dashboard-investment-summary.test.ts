import type { NoteListItem } from "@cashsouk/types";
import { buildDashboardInvestmentSummary } from "./dashboard-investment-summary";

jest.mock("@cashsouk/config", () => ({
  formatCurrency: (value: number) => `RM ${value}`,
}));

function note(overrides: Partial<NoteListItem> = {}): NoteListItem {
  return {
    id: "note_1",
    noteReference: "NOTE-1",
    title: "Note",
    productCategory: null,
    productName: "Invoice financing",
    issuerIndustry: null,
    sourceApplicationId: "app_1",
    sourceApplicationDisplayReference: null,
    sourceContractId: null,
    sourceContractDisplayReference: null,
    sourceInvoiceId: "inv_1",
    sourceInvoiceDisplayReference: null,
    issuerOrganizationId: "org_1",
    issuerOrganizationDisplayReference: null,
    issuerName: "Acme",
    paymasterName: null,
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
    investorCount: 1,
    maturityDate: "2026-04-01",
    listingClosesAt: null,
    activatedAt: "2026-01-01",
    publishedAt: "2025-12-01",
    fundingClosedAt: "2025-12-15",
    repaidAt: null,
    settlementSummary: null,
    createdAt: "2025-12-01",
    updatedAt: "2026-01-01",
    requestedAmount: 10000,
    invoiceAmount: 12000,
    settlementAmount: 10000,
    targetAmount: 10000,
    fundedAmount: 10000,
    fundingPercent: 100,
    minimumFundingPercent: 80,
    profitRatePercent: 12,
    platformFeeRatePercent: 1,
    serviceFeeRatePercent: 0,
    investorRepaymentSummary: {
      investedPrincipal: 10000,
      expectedPayoutAmount: 10295.89,
      expectedProfitAmount: 295.89,
      expectedProfitGrossAmount: 295.89,
      expectedServiceFeeAmount: 0,
      profitDays: 90,
      profitStartDate: "2026-01-01",
      profitMaturityDate: "2026-04-01",
      receivedPayoutAmount: 0,
      receivedProfitNetAmount: 0,
      receivedProfitGrossAmount: 0,
      receivedServiceFeeAmount: 0,
      receivedTawidhCompensationAmount: 0,
      expectedReturnRatePercent: 12,
      actualReturnRatePercent: null,
      progressPercent: 0,
      receivedSettlementEvents: [],
    },
    ...overrides,
  };
}

describe("buildDashboardInvestmentSummary", () => {
  it("annualizes successful-note performance from settlement days, not tenure", () => {
    const earlyProfit = 10000 * 0.12 * (60 / 365);
    const live = note({ id: "live" });
    const early = note({
      id: "early",
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        receivedPayoutAmount: 10000 + earlyProfit,
        receivedProfitNetAmount: earlyProfit,
        profitDays: 90,
        actualProfitDays: 60,
        actualReturnRatePercent: 12,
      },
    });

    const summary = buildDashboardInvestmentSummary([live, early]);
    expect(summary.activeInvestments).toBe(1);
    expect(summary.successfulInvestments).toBe(1);
    expect(summary.realizedPerformance).toBe(12);
  });

  it("does not let contractual tenure deflate an early settlement", () => {
    const earlyProfit = 10000 * 0.12 * (60 / 365);
    const early = note({
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        receivedPayoutAmount: 10000 + earlyProfit,
        receivedProfitNetAmount: earlyProfit,
        profitDays: 90,
        actualProfitDays: 60,
        actualReturnRatePercent: null,
      },
    });

    expect(buildDashboardInvestmentSummary([early]).realizedPerformance).toBeCloseTo(12, 8);
  });

  it("weights the dashboard rate the same way as the portfolio average", () => {
    const smaller = note({
      id: "smaller",
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        investedPrincipal: 10000,
        receivedPayoutAmount: 10100,
        receivedProfitNetAmount: 100,
        actualReturnRatePercent: 10,
      },
    });
    const larger = note({
      id: "larger",
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        investedPrincipal: 30000,
        receivedPayoutAmount: 30450,
        receivedProfitNetAmount: 450,
        actualReturnRatePercent: 14,
      },
    });

    expect(buildDashboardInvestmentSummary([smaller, larger]).realizedPerformance).toBe(13);
  });
});
