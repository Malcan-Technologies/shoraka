import { getTrusteeSubmitCopy } from "./trustee-letter-submit-copy";

describe("getTrusteeSubmitCopy", () => {
  it("uses Email to Trustee copy when auto-send is enabled", () => {
    expect(getTrusteeSubmitCopy(true)).toEqual({
      button: "Email to Trustee",
      confirmLabel: "Email to Trustee",
      confirmTitle: "Email letter to Trustee?",
      description:
        "The signed PDF will be emailed to the configured trustee and marked submitted. If sending fails, it stays unsubmitted.",
      success: "Email delivered to Trustee",
    });
    expect(getTrusteeSubmitCopy(true, "instruction").confirmTitle).toBe(
      "Email instruction to Trustee?"
    );
  });

  it("keeps mark-submitted copy when auto-send is disabled", () => {
    expect(getTrusteeSubmitCopy(false)).toEqual({
      button: "Mark submitted to trustee",
      confirmLabel: "Mark submitted to trustee",
      confirmTitle: "Mark as submitted to trustee?",
      description:
        "Confirm the letter was delivered to the trustee manually. This only records submission.",
      success: "Marked as submitted to trustee",
    });
    expect(getTrusteeSubmitCopy(false, "instruction").description).toBe(
      "Confirm the instruction was delivered to the trustee manually. This only records submission."
    );
  });
});
