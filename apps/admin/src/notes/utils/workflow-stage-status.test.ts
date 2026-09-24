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
  it("case A: keeps disbursement green after settlement when paymaster notice is not generated", () => {
    const note = settledNote({
      assignmentNotice: null,
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

  it("case B: keeps disbursement green after settlement when paymaster acknowledgement is missing", () => {
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

  it("case C: shows action when disbursement payout or certificate is still incomplete (ignores paymaster)", () => {
    const note = settledNote({
      settlements: [],
      withdrawals: [
        {
          id: "wd-1",
          withdrawalType: "ISSUER_DISBURSEMENT",
          status: "DRAFT",
        } as NoteDetail["withdrawals"][number],
      ],
      assignmentNotice: { status: "FAILED" } as any,
      paymasterAcknowledgementSatisfied: false,
    });

    expect(
      resolveDisbursementStageStatusToken({
        note,
        disbursementWithdrawal: note.withdrawals[0],
        investmentNoteCertificate: {
          status: "NONE",
          canGenerate: false,
          reviewVersion: null,
        },
      })
    ).toBe("action");
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

  it("case D: shows success when remaining non-paymaster disbursement requirements are complete", () => {
    const note = settledNote({
      settlements: [],
      withdrawals: [
        {
          id: "wd-1",
          withdrawalType: "ISSUER_DISBURSEMENT",
          status: "COMPLETED",
        } as NoteDetail["withdrawals"][number],
      ],
    });

    expect(
      resolveDisbursementStageStatusToken({
        note,
        disbursementWithdrawal: note.withdrawals[0],
        investmentNoteCertificate: {
          status: "READY",
          canGenerate: false,
          reviewVersion: null,
        },
      })
    ).toBe("success");
  });

  it("case G: tolerates historical Paymaster assignment data on Disbursement stage status calculation", () => {
    const note = settledNote({
      paymasterAcknowledgementSatisfied: true,
      assignmentNotice: {
        status: "ACKNOWLEDGED",
      } as any,
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
