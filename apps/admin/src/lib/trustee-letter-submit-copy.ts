export type TrusteeSubmitNoun = "letter" | "instruction";

export type TrusteeSubmitCopy = {
  button: string;
  confirmLabel: string;
  confirmTitle: string;
  description: string;
  success: string;
};

export function getTrusteeSubmitCopy(
  autoSendEnabled: boolean,
  noun: TrusteeSubmitNoun = "letter"
): TrusteeSubmitCopy {
  if (autoSendEnabled) {
    return {
      button: "Email to Trustee",
      confirmLabel: "Email to Trustee",
      confirmTitle: `Email ${noun} to Trustee?`,
      description:
        "The signed PDF will be emailed to the configured trustee and marked submitted. If sending fails, it stays unsubmitted.",
      success: "Email delivered to Trustee",
    };
  }

  return {
    button: "Mark submitted to trustee",
    confirmLabel: "Mark submitted to trustee",
    confirmTitle: "Mark as submitted to trustee?",
    description: `Confirm the ${noun} was delivered to the trustee manually. This only records submission.`,
    success: "Marked as submitted to trustee",
  };
}
