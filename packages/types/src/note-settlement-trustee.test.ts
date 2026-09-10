import {
  NoteSettlementStatus,
  SettlementTrusteeInstructionStatus,
  type NoteSettlementPoolSummary,
} from "./notes";
import { resolveIssuerResidualPayoutFromPoolSummary } from "./note-settlement-trustee";

function postedSummary(
  overrides: Partial<NoteSettlementPoolSummary> = {}
): NoteSettlementPoolSummary {
  return {
    settlementId: "set-1",
    displayReference: "SET-1",
    status: NoteSettlementStatus.POSTED,
    grossReceiptAmount: 30_000,
    investorPoolAmount: 22_000,
    operatingAccountAmount: 0,
    totalTawidhAmount: 0,
    tawidhInvestorSharePercent: 0,
    tawidhInvestorAmount: 0,
    tawidhAccountAmount: 0,
    gharamahAccountAmount: 0,
    issuerResidualAmount: 8_000,
    unappliedAmount: 0,
    profitStartDate: null,
    profitMaturityDate: null,
    profitDays: 0,
    annualProfitRatePercent: 0,
    postedAt: "2026-09-08T00:00:00.000Z",
    settlementTrusteeStatus: SettlementTrusteeInstructionStatus.PENDING_LETTER,
    settlementTrusteeCreatedAt: "2026-09-08T00:00:00.000Z",
    settlementTrusteeLetterGeneratedAt: null,
    settlementTrusteeSubmittedAt: null,
    settlementTrusteeCompletedAt: null,
    settlementTrusteeEmailSentAt: null,
    ...overrides,
  };
}

describe("resolveIssuerResidualPayoutFromPoolSummary", () => {
  it("returns undefined until settlement is posted", () => {
    expect(
      resolveIssuerResidualPayoutFromPoolSummary(
        postedSummary({ status: NoteSettlementStatus.APPROVED })
      )
    ).toBeUndefined();
  });

  it("returns none when residual is zero", () => {
    expect(
      resolveIssuerResidualPayoutFromPoolSummary(postedSummary({ issuerResidualAmount: 0 }))
    ).toEqual({ kind: "none" });
  });

  it("treats posted residual as pending until trustee completes", () => {
    expect(resolveIssuerResidualPayoutFromPoolSummary(postedSummary())).toEqual({
      kind: "pending",
      withTrustee: false,
    });
    expect(
      resolveIssuerResidualPayoutFromPoolSummary(
        postedSummary({
          settlementTrusteeStatus: SettlementTrusteeInstructionStatus.LETTER_GENERATED,
        })
      )
    ).toEqual({ kind: "pending", withTrustee: false });
  });

  it("marks residual with trustee after submit and paid after completion", () => {
    expect(
      resolveIssuerResidualPayoutFromPoolSummary(
        postedSummary({
          settlementTrusteeStatus: SettlementTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE,
        })
      )
    ).toEqual({ kind: "pending", withTrustee: true });
    expect(
      resolveIssuerResidualPayoutFromPoolSummary(
        postedSummary({
          settlementTrusteeStatus: SettlementTrusteeInstructionStatus.COMPLETED,
          settlementTrusteeCompletedAt: "2026-09-09T03:40:00.000Z",
        })
      )
    ).toEqual({ kind: "paid" });
  });
});
