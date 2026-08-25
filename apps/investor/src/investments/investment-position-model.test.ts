import {
  NOTE_TIMING_FROM_DISBURSEMENT_TOOLTIP,
  resolveNoteTimingDisplay,
  type NoteListItem,
  type NoteSettlementPoolSummary,
} from "@cashsouk/types";
import {
  calendarDaysFromToday,
  compareCompletedInvestmentLatestFirst,
  compareInvestmentMaturity,
  getInvestmentMaturityDisplay,
  getInvestmentRelevanceRank,
  investmentMaturityKpiExtra,
  investmentCardHeadline,
  investmentCardMeta,
  investmentCardPayoutResult,
  averageRealizedAnnualReturnRatePercent,
  portfolioPayoutResult,
  realizedAnnualReturnRatePercent,
  isInvestorInvestmentCompleted,
  actualReturnRateTooltip,
  getInvestmentReturnDisplay,
  partitionInvestorInvestments,
  periodProfitRatePercent,
} from "./investment-position-model";
import { sortInvestorInvestments } from "./sort-investments";

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
    settlementTrusteeStatus: "PENDING_LETTER" as NoteSettlementPoolSummary["settlementTrusteeStatus"],
    settlementTrusteeCreatedAt: "2026-08-18",
    settlementTrusteeLetterGeneratedAt: null,
    settlementTrusteeSubmittedAt: null,
    settlementTrusteeCompletedAt: null,
    settlementTrusteeEmailSentAt: null,
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
        settlementTrusteeStatus: "COMPLETED" as NoteSettlementPoolSummary["settlementTrusteeStatus"],
        settlementTrusteeCompletedAt: "2026-08-18",
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

describe("calendarDaysFromToday", () => {
  it("counts Malaysia calendar days from a UTC-midnight stored date", () => {
    expect(calendarDaysFromToday("2026-08-24T00:00:00.000Z", NOW)).toBe(5);
    expect(calendarDaysFromToday("2026-08-19", NOW)).toBe(0);
    expect(calendarDaysFromToday("2026-08-12", NOW)).toBe(-7);
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
      tooltip: null,
    });
  });

  it("labels tenure notes in grace instead of past due", () => {
    expect(
      getInvestmentMaturityDisplay(
        note({ tenureDays: 90, maturityDate: "2026-08-16", gracePeriodDays: 7 }),
        NOW
      )
    ).toMatchObject({
      tone: "grace",
      value: "3",
      unit: "days in grace",
      date: "16 Aug 2026",
    });
    expect(
      getInvestmentMaturityDisplay(
        note({ tenureDays: 90, maturityDate: "2026-08-10", gracePeriodDays: 7 }),
        NOW
      )
    ).toMatchObject({
      tone: "overdue",
      value: "9",
      unit: "days past maturity",
      date: "10 Aug 2026",
    });
  });

  it("keeps tenure next to the portfolio maturity countdown", () => {
    const live = note({ tenureDays: 90, maturityDate: "2026-08-24" });
    const maturity = getInvestmentMaturityDisplay(live, NOW);
    expect(investmentMaturityKpiExtra(maturity, resolveNoteTimingDisplay(live))).toBe(
      "24 Aug 2026 · 90-day tenure"
    );
  });

  it("shows the settlement date on completed notes, not maturity", () => {
    const settledEarly = note({
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      maturityDate: "2026-09-01",
      repaidAt: "2026-08-18T00:00:00.000Z",
      settlementSummary: postedSettlement({
        actualSettlementDate: "2026-08-10T00:00:00.000Z",
        postedAt: "2026-08-18T00:00:00.000Z",
        settlementTrusteeStatus: "COMPLETED" as NoteSettlementPoolSummary["settlementTrusteeStatus"],
        settlementTrusteeCompletedAt: "2026-08-18",
      }),
    });
    expect(getInvestmentMaturityDisplay(settledEarly, NOW)).toEqual({
      tone: "settled",
      value: "10 Aug 2026",
      unit: "Settled",
      date: "",
    });
    expect(
      getInvestmentMaturityDisplay(
        note({
          status: "REPAID" as NoteListItem["status"],
          servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
          maturityDate: "2026-09-01",
          repaidAt: "2026-08-18T00:00:00.000Z",
        }),
        NOW
      )
    ).toEqual({
      tone: "settled",
      value: "18 Aug 2026",
      unit: "Settled",
      date: "",
    });
    expect(
      getInvestmentMaturityDisplay(
        note({
          status: "REPAID" as NoteListItem["status"],
          servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
          maturityDate: "2026-08-01",
        }),
        NOW
      )
    ).toEqual({
      tone: "settled",
      value: "—",
      unit: "Settled",
      date: "",
    });
  });
});

describe("card copy", () => {
  it("leads with invested amount and expected return", () => {
    expect(investmentCardHeadline(note())).toBe("RM 50000 invested · 12.5% p.a.");
  });

  it("labels pre-settlement tenure profit as an upper-bound estimate", () => {
    expect(
      investmentCardHeadline(note({ tenureDays: 90, maturityDate: null }))
    ).toBe("RM 50000 invested · Up to RM 6250");
    expect(
      investmentCardHeadline(
        note({
          tenureDays: 90,
          status: "REPAID" as NoteListItem["status"],
          servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
          investorRepaymentSummary: {
            ...note().investorRepaymentSummary!,
            actualReturnRatePercent: 10,
            receivedPayoutAmount: 56250,
            receivedProfitNetAmount: 6250,
          },
        })
      )
    ).toBe("RM 50000 invested · 10% p.a. actual");
  });

  it("labels completed notes as actual even when no profit was received", () => {
    const settledAtPar = note({
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        actualReturnRatePercent: null,
        receivedPayoutAmount: 50000,
        receivedProfitNetAmount: 0,
      },
    });
    expect(getInvestmentReturnDisplay(settledAtPar)).toEqual({
      ratePercent: 0,
      label: "p.a. actual",
      tooltip: actualReturnRateTooltip(settledAtPar),
    });
    expect(investmentCardHeadline(settledAtPar)).toBe("RM 50000 invested · 0% p.a. actual");
  });

  it("explains that p.a. is annualized and shows the period profit rate", () => {
    const settled = note({
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        actualReturnRatePercent: 12,
        receivedPayoutAmount: 50821.92,
        receivedProfitNetAmount: 821.92,
      },
    });
    expect(periodProfitRatePercent(settled)).toBeCloseTo(1.64384, 4);
    expect(actualReturnRateTooltip(settled)).toBe(
      "p.a. means per annum (annualized). Actual profit on this note was 1.6%."
    );
    expect(getInvestmentReturnDisplay(settled).tooltip).toBe(actualReturnRateTooltip(settled));
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

  it("annualizes completed returns from settlement days instead of tenure", () => {
    const earlyProfit = 10000 * 0.12 * (60 / 365);
    const early = note({
      id: "early",
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      investorRepaymentSummary: {
        ...note().investorRepaymentSummary!,
        investedPrincipal: 10000,
        receivedPayoutAmount: 10000 + earlyProfit,
        receivedProfitNetAmount: earlyProfit,
        profitDays: 90,
        actualProfitDays: 60,
        actualReturnRatePercent: 12,
      },
    });
    expect(realizedAnnualReturnRatePercent(early)).toBe(12);
    expect(
      realizedAnnualReturnRatePercent({
        ...early,
        investorRepaymentSummary: {
          ...early.investorRepaymentSummary!,
          actualReturnRatePercent: null,
        },
      })
    ).toBeCloseTo(12, 8);
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
    expect(compareInvestmentMaturity(note({ maturityDate: null }), sooner, NOW)).toBeGreaterThan(0);
    expect(
      getInvestmentMaturityDisplay(note({ maturityDate: null, tenureDays: 90 }), NOW)
    ).toEqual({
      tone: "upcoming",
      value: "90",
      unit: "days",
      date: "",
      tooltip: NOTE_TIMING_FROM_DISBURSEMENT_TOOLTIP,
    });
    expect(getInvestmentMaturityDisplay(note({ maturityDate: "not-a-date" }), NOW)).toMatchObject({
      tone: "unknown",
      value: "—",
    });
  });

  it("sorts maturity soonest with pending tenure notes after dated notes", () => {
    const pending = note({ id: "pending", tenureDays: 90, maturityDate: null });
    const later = note({ id: "later", maturityDate: "2026-10-01T00:00:00.000Z" });
    const sooner = note({ id: "sooner", maturityDate: "2026-08-21T00:00:00.000Z" });
    expect(sortInvestorInvestments([pending, later, sooner], "maturity_soonest").map((item) => item.id)).toEqual([
      "sooner",
      "later",
      "pending",
    ]);
  });

  it("orders completed notes from latest maturity first", () => {
    const older = note({
      id: "older",
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      maturityDate: "2026-06-01",
    });
    const newer = note({
      id: "newer",
      status: "REPAID" as NoteListItem["status"],
      servicingStatus: "SETTLED" as NoteListItem["servicingStatus"],
      maturityDate: "2026-08-01",
    });
    expect(compareCompletedInvestmentLatestFirst(newer, older)).toBeLessThan(0);
    expect(
      sortInvestorInvestments([older, newer], "most_relevant").map((item) => item.id)
    ).toEqual(["newer", "older"]);
  });
});
