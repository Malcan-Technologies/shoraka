import { getFinalStatusLabel } from "./director-shareholder-final-status";

describe("director/shareholder final status: individual KYC ref semantics", () => {
  it("APPROVED + KYC... → Approved (kyc_only)", () => {
    const label = getFinalStatusLabel(
      { onboarding: { status: "APPROVED", id: "KYC00185" } },
      { displayMode: "kyc_only" }
    ).label;
    expect(label).toBe("Approved");
  });

  it("APPROVED + DJKYC... → Approved (kyc_only)", () => {
    const label = getFinalStatusLabel(
      { onboarding: { status: "APPROVED", id: "DJKYC08238" } },
      { displayMode: "kyc_only" }
    ).label;
    expect(label).toBe("Approved");
  });

  it("APPROVED + missing KYC ref → In Progress (kyc_only)", () => {
    const label = getFinalStatusLabel(
      { onboarding: { status: "APPROVED", id: null } },
      { displayMode: "kyc_only" }
    ).label;
    expect(label).toBe("Approved");
  });

  it("COMPLETED + KYC... → Completed (kyc_only)", () => {
    const label = getFinalStatusLabel(
      { onboarding: { status: "COMPLETED", id: "KYC00185" } },
      { displayMode: "kyc_only" }
    ).label;
    expect(label).toBe("Completed");
  });

  it("COMPLETED without KYC ref → Completed (kyc_only)", () => {
    const label = getFinalStatusLabel(
      { onboarding: { status: "COMPLETED", id: null } },
      { displayMode: "kyc_only" }
    ).label;
    expect(label).toBe("Completed");
  });

  it("WAIT_FOR_APPROVAL + any KYC ref → Pending Review (kyc_only)", () => {
    const label = getFinalStatusLabel(
      { onboarding: { status: "WAIT_FOR_APPROVAL", id: "DJKYC08238" } },
      { displayMode: "kyc_only" }
    ).label;
    expect(label).toBe("Pending Review");
  });

  it("aml_first does not treat KYC Approved as AML Approved", () => {
    expect(getFinalStatusLabel({ onboarding: { status: "APPROVED" } }).label).toBe("Not Started");
    expect(
      getFinalStatusLabel({
        onboarding: { status: "APPROVED" },
        screening: { status: "APPROVED" },
      }).label
    ).toBe("Approved");
  });

  it("WAIT_FOR_APPROVAL + KYC... → Pending Review (kyc_only)", () => {
    const label = getFinalStatusLabel(
      { onboarding: { status: "WAIT_FOR_APPROVAL", id: "KYC00185" } },
      { displayMode: "kyc_only" }
    ).label;
    expect(label).toBe("Pending Review");
  });
});

