import {
  NoteSettlementStatus,
  SettlementTrusteeInstructionStatus,
  isNoteSettlementPosted,
  resolveSettlementTrusteeRegistryState,
  settlementTrusteeRegistryLabel,
  settlementTrusteeRegistryNeedsAdminAction,
  type NoteSettlementPoolSummary,
} from "@cashsouk/types";

function postedSummary(
  overrides: Partial<NoteSettlementPoolSummary> = {}
): NoteSettlementPoolSummary {
  return {
    settlementId: "stl-1",
    displayReference: "STL-1",
    status: NoteSettlementStatus.POSTED,
    grossReceiptAmount: 100_000,
    investorPoolAmount: 80_000,
    operatingAccountAmount: 5_000,
    totalTawidhAmount: 0,
    tawidhInvestorSharePercent: 0,
    tawidhInvestorAmount: 0,
    tawidhAccountAmount: 0,
    gharamahAccountAmount: 0,
    issuerResidualAmount: 0,
    unappliedAmount: 0,
    profitStartDate: null,
    profitMaturityDate: null,
    profitDays: 0,
    annualProfitRatePercent: 10,
    postedAt: "2026-08-01T00:00:00.000Z",
    settlementTrusteeStatus: SettlementTrusteeInstructionStatus.PENDING_LETTER,
    settlementTrusteeCreatedAt: "2026-08-01T00:00:00.000Z",
    settlementTrusteeLetterGeneratedAt: null,
    settlementTrusteeSubmittedAt: null,
    settlementTrusteeCompletedAt: null,
    settlementTrusteeEmailSentAt: null,
    ...overrides,
  };
}

describe("isNoteSettlementPosted", () => {
  it("treats a posted waterfall as settled even while the trustee letter is pending", () => {
    expect(
      isNoteSettlementPosted({
        status: "ACTIVE",
        servicingStatus: "CURRENT",
        settlementSummary: postedSummary(),
      })
    ).toBe(true);
    expect(
      isNoteSettlementPosted({
        status: "ACTIVE",
        servicingStatus: "CURRENT",
        settlements: [{ status: "POSTED" }],
      })
    ).toBe(true);
  });

  it("does not treat an unposted note as settled", () => {
    expect(
      isNoteSettlementPosted({
        status: "ACTIVE",
        servicingStatus: "CURRENT",
        settlementSummary: null,
      })
    ).toBe(false);
  });

  it("treats repaid or servicing SETTLED as posted", () => {
    expect(isNoteSettlementPosted({ status: "REPAID", servicingStatus: "SETTLED" })).toBe(true);
  });
});

describe("resolveSettlementTrusteeRegistryState", () => {
  it("is independent of the note Settled badge and tracks letter progress", () => {
    expect(resolveSettlementTrusteeRegistryState(null)).toBe("none");
    expect(
      resolveSettlementTrusteeRegistryState(
        postedSummary({
          investorPoolAmount: 0,
          operatingAccountAmount: 0,
          settlementTrusteeStatus: null,
        })
      )
    ).toBe("none");
    expect(resolveSettlementTrusteeRegistryState(postedSummary())).toBe("pending_letter");
    expect(
      resolveSettlementTrusteeRegistryState(
        postedSummary({ settlementTrusteeStatus: SettlementTrusteeInstructionStatus.LETTER_GENERATED })
      )
    ).toBe("letter_generated");
    expect(
      resolveSettlementTrusteeRegistryState(
        postedSummary({ settlementTrusteeStatus: SettlementTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE })
      )
    ).toBe("submitted");
    expect(
      resolveSettlementTrusteeRegistryState(
        postedSummary({ settlementTrusteeStatus: SettlementTrusteeInstructionStatus.COMPLETED })
      )
    ).toBe("complete");
  });

  it("still shows trustee workflow when status is set even if pool amounts round to zero", () => {
    expect(
      resolveSettlementTrusteeRegistryState(
        postedSummary({
          investorPoolAmount: 0,
          operatingAccountAmount: 0,
          settlementTrusteeStatus: SettlementTrusteeInstructionStatus.PENDING_LETTER,
        })
      )
    ).toBe("pending_letter");
  });

  it("uses operator-facing labels for the notes-table trustee column", () => {
    expect(settlementTrusteeRegistryLabel("none")).toBeNull();
    expect(settlementTrusteeRegistryLabel("pending_letter")).toBe("Generate letter");
    expect(settlementTrusteeRegistryLabel("letter_generated")).toBe("Submit to trustee");
    expect(settlementTrusteeRegistryLabel("submitted")).toBe("Await trustee");
    expect(settlementTrusteeRegistryLabel("complete")).toBe("Completed");
  });

  it("flags generate-letter and submit-to-trustee as admin work, not await-trustee or complete", () => {
    expect(settlementTrusteeRegistryNeedsAdminAction(postedSummary())).toBe(true);
    expect(
      settlementTrusteeRegistryNeedsAdminAction(
        postedSummary({ settlementTrusteeStatus: SettlementTrusteeInstructionStatus.LETTER_GENERATED })
      )
    ).toBe(true);
    expect(
      settlementTrusteeRegistryNeedsAdminAction(
        postedSummary({ settlementTrusteeStatus: SettlementTrusteeInstructionStatus.SUBMITTED_TO_TRUSTEE })
      )
    ).toBe(false);
    expect(
      settlementTrusteeRegistryNeedsAdminAction(
        postedSummary({ settlementTrusteeStatus: SettlementTrusteeInstructionStatus.COMPLETED })
      )
    ).toBe(false);
  });
});
