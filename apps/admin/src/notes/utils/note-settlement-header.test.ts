jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import {
  NoteServicingStatus,
  NoteSettlementStatus,
  NoteStatus,
  SettlementTrusteeInstructionStatus,
  type NoteDetail,
  type NoteSettlement,
} from "@cashsouk/types";
import {
  getNoteInvestorReturnSummary,
  getNoteSettlementDateSummary,
  getNoteSettlementPayoutHeader,
  resolveAdminNoteInvestorReturnPercent,
  resolveAdminNoteSettlementDate,
} from "./note-settlement-header";

function settlement(overrides: Partial<NoteSettlement> = {}): NoteSettlement {
  return {
    id: "set_1",
    displayReference: "SET-1",
    noteId: "note_1",
    paymentId: "pay_1",
    status: NoteSettlementStatus.POSTED,
    settlementType: "STANDARD" as NoteSettlement["settlementType"],
    grossReceiptAmount: 56_000,
    investorPrincipal: 50_000,
    profitStartDate: "2026-07-01T00:00:00.000Z",
    profitMaturityDate: "2026-09-01T00:00:00.000Z",
    profitDays: 45,
    annualProfitRatePercent: 12,
    investorProfitGross: 740,
    serviceFeeAmount: 111,
    investorProfitNet: 629,
    tawidhAmount: 0,
    tawidhInvestorSharePercent: 0,
    tawidhInvestorAmount: 0,
    tawidhAccountAmount: 0,
    gharamahAmount: 0,
    issuerResidualAmount: 5_260,
    unappliedAmount: 0,
    actualSettlementDate: "2026-08-10T00:00:00.000Z",
    previewSnapshot: {},
    approvedAt: "2026-08-10T00:00:00.000Z",
    postedAt: "2026-08-18T00:00:00.000Z",
    serviceFeeTrusteeStatus: SettlementTrusteeInstructionStatus.COMPLETED,
    serviceFeeTrusteeCreatedAt: null,
    serviceFeeTrusteeLetterGeneratedAt: null,
    serviceFeeTrusteeSubmittedAt: null,
    serviceFeeTrusteeCompletedAt: "2026-08-18T00:00:00.000Z",
    serviceFeeTrusteeEmailSentAt: null,
    ...overrides,
  };
}

function note(overrides: Partial<NoteDetail> = {}): NoteDetail {
  return {
    id: "note_1",
    status: NoteStatus.REPAID,
    servicingStatus: NoteServicingStatus.SETTLED,
    fundedAmount: 50_000,
    repaidAt: "2026-08-18T00:00:00.000Z",
    maturityDate: "2026-09-01T00:00:00.000Z",
    settlements: [settlement()],
    settlementSummary: {
      settlementId: "set_1",
      displayReference: "SET-1",
      status: NoteSettlementStatus.POSTED,
      grossReceiptAmount: 56_000,
      investorPoolAmount: 50_629,
      operatingAccountAmount: 111,
      totalTawidhAmount: 0,
      tawidhInvestorSharePercent: 0,
      tawidhInvestorAmount: 0,
      tawidhAccountAmount: 0,
      gharamahAccountAmount: 0,
      issuerResidualAmount: 5_260,
      unappliedAmount: 0,
      actualSettlementDate: "2026-08-10T00:00:00.000Z",
      profitStartDate: "2026-07-01T00:00:00.000Z",
      profitMaturityDate: "2026-09-01T00:00:00.000Z",
      profitDays: 45,
      annualProfitRatePercent: 12,
      postedAt: "2026-08-18T00:00:00.000Z",
      serviceFeeTrusteeStatus: SettlementTrusteeInstructionStatus.COMPLETED,
      serviceFeeTrusteeCreatedAt: null,
      serviceFeeTrusteeLetterGeneratedAt: null,
      serviceFeeTrusteeSubmittedAt: null,
      serviceFeeTrusteeCompletedAt: "2026-08-18T00:00:00.000Z",
      serviceFeeTrusteeEmailSentAt: null,
    },
    ...overrides,
  } as NoteDetail;
}

describe("note settlement header", () => {
  it("uses the actual settlement date, not maturity", () => {
    expect(resolveAdminNoteSettlementDate(note())).toBe("10 Aug 2026");
    expect(getNoteSettlementDateSummary(note()).value).toBe("10 Aug 2026");
    expect(
      resolveAdminNoteSettlementDate(
        note({
          settlements: [settlement({ actualSettlementDate: null })],
          settlementSummary: {
            ...note().settlementSummary!,
            actualSettlementDate: null,
          },
        })
      )
    ).toBe("18 Aug 2026");
  });

  it("annualises investor return from net profit and profit days", () => {
    const rate = resolveAdminNoteInvestorReturnPercent(note());
    expect(rate).toBeCloseTo((629 / 50_000) * (365 / 45) * 100, 5);
    expect(getNoteInvestorReturnSummary(note())).toMatchObject({
      label: "Investor return",
      hint: "p.a. actual · 45 days",
    });
    expect(getNoteInvestorReturnSummary(note()).value).toMatch(/%$/);
  });

  it("includes investor Ta'widh in the earned return", () => {
    const withTawidh = note({
      settlements: [settlement({ tawidhInvestorAmount: 100, investorProfitNet: 500 })],
    });
    expect(resolveAdminNoteInvestorReturnPercent(withTawidh)).toBeCloseTo(
      (600 / 50_000) * (365 / 45) * 100,
      5
    );
  });

  it("summarises posted payout buckets", () => {
    const header = getNoteSettlementPayoutHeader(note());
    expect(header).toMatchObject({
      totalLabel: "Total received",
      totalValue: "RM 56,000.00",
      returnLabel: "Investor return",
      returnHint: "p.a. actual · 45 days",
      rows: [
        { label: "Investors", value: "RM 50,629.00" },
        { label: "Service fee", value: "RM 111.00" },
        { label: "Ta'widh", value: "RM 0.00" },
        { label: "Gharamah", value: "RM 0.00" },
        { label: "Issuer residual", value: "RM 5,260.00" },
      ],
    });
    expect(header?.returnValue).toMatch(/%$/);
  });

  it("hides the payout header until settlement is posted", () => {
    expect(
      getNoteSettlementPayoutHeader(
        note({
          status: NoteStatus.ACTIVE,
          servicingStatus: NoteServicingStatus.CURRENT,
          settlements: [],
          settlementSummary: null,
        })
      )
    ).toBeNull();
  });
});
