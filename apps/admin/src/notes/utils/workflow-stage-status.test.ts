import { NoteFundingStatus, NoteListingStatus, NoteServicingStatus, NoteStatus, type NoteDetail } from "@cashsouk/types";
import {
  resolveDisbursementStageStatusToken,
  resolveServicingStageStatusToken,
} from "./workflow-stage-status";

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function postedSettlement(): NoteDetail["settlements"][number] {
  return {
    status: "POSTED",
    investorPrincipal: 0,
    investorProfitNet: 0,
    tawidhInvestorAmount: 0,
    serviceFeeAmount: 0,
    tawidhAccountAmount: 0,
    gharamahAmount: 0,
    issuerResidualAmount: 0,
  } as NoteDetail["settlements"][number];
}

function settledNote(overrides: Partial<NoteDetail> = {}): NoteDetail {
  return {
    id: "note-1",
    status: NoteStatus.ACTIVE,
    listingStatus: NoteListingStatus.CLOSED,
    fundingStatus: NoteFundingStatus.FUNDED,
    servicingStatus: NoteServicingStatus.CURRENT,
    withdrawals: [
      {
        id: "wd-1",
        withdrawalType: "ISSUER_DISBURSEMENT",
        status: "COMPLETED",
      } as NoteDetail["withdrawals"][number],
    ],
    settlements: [postedSettlement()],
    payments: [],
    investments: [],
    events: [],
    paymentSchedules: [],
    maturityDate: daysFromNow(-1),
    ...overrides,
  } as NoteDetail;
}

describe("settled note workflow chips", () => {
  it("keeps disbursement green after settlement even if paymaster or certificate still look open", () => {
    const note = settledNote({
      assignmentNotice: { status: "SENT" },
      paymasterAcknowledgementSatisfied: false,
    } as Partial<NoteDetail>);
    expect(
      resolveDisbursementStageStatusToken({
        note,
        disbursementWithdrawal: note.withdrawals[0],
        investmentNoteCertificate: {
          status: "NONE",
          canGenerate: true,
          reviewVersion: null,
        },
      })
    ).toBe("success");
  });

  it("keeps disbursement red when the certificate failed after settlement", () => {
    const note = settledNote();
    expect(
      resolveDisbursementStageStatusToken({
        note,
        disbursementWithdrawal: note.withdrawals[0],
        investmentNoteCertificate: {
          status: "FAILED",
          canGenerate: true,
          reviewVersion: { status: "FAILED" },
        },
      })
    ).toBe("rejected");
  });

  it("keeps servicing green after settlement even if Hibah receipt can still generate", () => {
    const note = settledNote();
    expect(
      resolveServicingStageStatusToken({
        note,
        settlementHibahReceipt: {
          status: "NONE",
          canGenerate: true,
          reviewVersion: null,
        } as never,
        investmentSettlementConfirmations: {
          failedCount: 0,
          confirmations: [],
        } as never,
      })
    ).toBe("success");
  });

  it("keeps servicing red when Hibah receipt generation failed after settlement", () => {
    const note = settledNote();
    expect(
      resolveServicingStageStatusToken({
        note,
        settlementHibahReceipt: {
          status: "FAILED",
          canGenerate: false,
          reviewVersion: { status: "FAILED" },
        } as never,
        investmentSettlementConfirmations: undefined,
      })
    ).toBe("rejected");
  });
});
