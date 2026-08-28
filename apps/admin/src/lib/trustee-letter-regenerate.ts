export type TrusteeRegenerateCopy = {
  button: string;
  confirmLabel: string;
  confirmTitle: string;
  description: string;
  success: string;
};

export function getTrusteeRegenerateCopy(): TrusteeRegenerateCopy {
  return {
    button: "Regenerate Letter",
    confirmLabel: "Regenerate Letter",
    confirmTitle: "Regenerate trustee letter?",
    description:
      "Replace the current PDF with a new letter using the latest Trustee Letter and Money Flow Account settings. Review the new file before submitting it to the trustee.",
    success: "Trustee letter regenerated",
  };
}
