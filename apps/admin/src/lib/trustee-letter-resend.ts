export type TrusteeResendCopy = {
  button: string;
  confirmLabel: string;
  confirmTitle: string;
  description: string;
  success: string;
};

export const TRUSTEE_RESEND_BUTTON = "Resend Email to Trustee";
export const TRUSTEE_RESEND_SUCCESS = "Email redelivered to Trustee";

export function getTrusteeResendCopy(): TrusteeResendCopy {
  return {
    button: TRUSTEE_RESEND_BUTTON,
    confirmLabel: TRUSTEE_RESEND_BUTTON,
    confirmTitle: "Resend email to Trustee?",
    description:
      "The current signed PDF will be emailed again to the latest configured trustee recipients. This does not mark the instruction disbursed or completed.",
    success: TRUSTEE_RESEND_SUCCESS,
  };
}

export function canResendWithdrawalTrusteeEmail(
  sentAt: string | null | undefined,
  status: string | null | undefined
): boolean {
  if (!sentAt) return false;
  return status === "LETTER_GENERATED" || status === "SUBMITTED_TO_TRUSTEE";
}

export function canResendSettlementTrusteeEmail(
  sentAt: string | null | undefined,
  trusteeStatus: string | null | undefined
): boolean {
  if (!sentAt) return false;
  return trusteeStatus === "LETTER_GENERATED" || trusteeStatus === "SUBMITTED_TO_TRUSTEE";
}
