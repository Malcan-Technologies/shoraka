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
    expect(label).toBe("In Progress");
  });

  it("COMPLETED + KYC... → Approved (kyc_only)", () => {
    const label = getFinalStatusLabel(
      { onboarding: { status: "COMPLETED", id: "KYC00185" } },
      { displayMode: "kyc_only" }
    ).label;
    expect(label).toBe("Approved");
  });

  it("COMPLETED without KYC ref → In Progress (kyc_only)", () => {
    const label = getFinalStatusLabel(
      { onboarding: { status: "COMPLETED", id: null } },
      { displayMode: "kyc_only" }
    ).label;
    expect(label).toBe("In Progress");
  });

  it("WAIT_FOR_APPROVAL + any KYC ref → Pending Review (kyc_only)", () => {
    const label = getFinalStatusLabel(
      { onboarding: { status: "WAIT_FOR_APPROVAL", id: "DJKYC08238" } },
      { displayMode: "kyc_only" }
    ).label;
    expect(label).toBe("Pending Review");
  });

  it("WAIT_FOR_APPROVAL + KYC... → Pending Review (kyc_only)", () => {
    const label = getFinalStatusLabel(
      { onboarding: { status: "WAIT_FOR_APPROVAL", id: "KYC00185" } },
      { displayMode: "kyc_only" }
    ).label;
    expect(label).toBe("Pending Review");
  });
});

