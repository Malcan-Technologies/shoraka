import type {
  InvoiceOfferAcceptSignatory,
  OfferAcceptSignatorySource,
} from "@cashsouk/types";

export const OFFER_ACCEPT_OTP_LENGTH = 6;

export type OfferAcceptOtpStep = "signatory" | "code";

export function maskSignatoryEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return "••••";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const localMasked = `${local[0] ?? ""}***`;
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  const hostMasked = `${host[0] ?? ""}***`;
  return `${localMasked}@${hostMasked}${tld}`;
}

export function signatorySourceLabel(source: OfferAcceptSignatorySource): string {
  return source === "FACILITY_ENVELOPE" ? "Facility agreement" : "Organisation director";
}

export function orderAcceptSignatories(
  signatories: InvoiceOfferAcceptSignatory[]
): InvoiceOfferAcceptSignatory[] {
  return [...signatories].sort((left, right) => {
    if (left.source === right.source) return 0;
    return left.source === "FACILITY_ENVELOPE" ? -1 : 1;
  });
}

export function sanitizeOfferAcceptOtpInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, OFFER_ACCEPT_OTP_LENGTH);
}

export function isCompleteOfferAcceptOtp(value: string): boolean {
  return new RegExp(`^\\d{${OFFER_ACCEPT_OTP_LENGTH}}$`).test(value);
}

export function shouldApplyOfferAcceptAsyncResult(params: {
  generation: number;
  currentGeneration: number;
  open: boolean;
}): boolean {
  return params.open && params.generation === params.currentGeneration;
}

export function shouldIgnoreOfferAcceptDialogDismiss(params: {
  nextOpen: boolean;
  busy: boolean;
}): boolean {
  return params.busy && params.nextOpen === false;
}

export function claimOfferAcceptInFlight(inFlight: { current: boolean }): boolean {
  if (inFlight.current) return false;
  inFlight.current = true;
  return true;
}

export function releaseOfferAcceptInFlight(inFlight: { current: boolean }): void {
  inFlight.current = false;
}

export function secondsUntil(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return 0;
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

export function offerAcceptOtpErrorCopy(code: string | undefined, fallback: string): string {
  switch (code) {
    case "OTP_NO_SIGNATORIES":
      return "No authorised signatory emails are available for this facility offer. Contact CashSouk if this looks wrong.";
    case "OTP_SIGNATORY_NOT_ELIGIBLE":
      return "Choose an authorised signatory from the list.";
    case "OTP_RESEND_COOLDOWN":
      return "Wait before requesting another verification code.";
    case "OTP_RESEND_LIMIT":
      return "This verification challenge has reached the send limit. Try again after it expires, or choose a different signatory.";
    case "OTP_EXPIRED":
      return "This verification code has expired. Request a new code.";
    case "OTP_ATTEMPTS_EXCEEDED":
      return "Too many incorrect codes. Request a new verification code.";
    case "OTP_INVALID":
      return "The verification code is incorrect.";
    case "OTP_CHALLENGE_CONSUMED":
      return "This verification code has already been used.";
    case "OTP_CHALLENGE_NOT_FOUND":
    case "OTP_CHALLENGE_MISMATCH":
      return "This verification session is no longer valid. Go back and request a new code.";
    case "OTP_EMAIL_FAILED":
      return "Could not send the verification code. Please try again.";
    case "CONSENTS_REQUIRED":
      return "Tick both confirmations and confirm the full authorisation before accepting.";
    default:
      return fallback;
  }
}

export function remainingAttemptsCopy(remainingAttempts: number | null): string | null {
  if (remainingAttempts == null) return null;
  if (remainingAttempts <= 0) return "No attempts remaining. Request a new code.";
  if (remainingAttempts === 1) return "1 attempt remaining.";
  return `${remainingAttempts} attempts remaining.`;
}

export function resendButtonLabel(params: {
  secondsRemaining: number;
  remainingSends: number | null;
}): string {
  if (params.secondsRemaining > 0) return `Resend in ${params.secondsRemaining}s`;
  if (params.remainingSends === 0) return "Send limit reached";
  return "Resend code";
}

export function step1Description(offeredValue: string): string {
  const amount =
    offeredValue !== "—"
      ? `Accept ${offeredValue} of financing for this invoice.`
      : "Accept this invoice offer.";
  return `${amount} Choose who should receive the verification code. Accepting confirms the offer under your existing facility.`;
}

export function step2Description(signatory: InvoiceOfferAcceptSignatory | null): string {
  if (!signatory) {
    return "Enter the 6-digit code to confirm acceptance of this invoice offer under your facility.";
  }
  return `Enter the 6-digit code sent to ${signatory.name} (${maskSignatoryEmail(signatory.email)}). This confirms acceptance of the invoice offer under your facility.`;
}

export function readApiError(
  response: { success: false; error?: { code?: string; message?: string } } | unknown
): { code?: string; message: string } {
  if (
    response &&
    typeof response === "object" &&
    "success" in response &&
    (response as { success: unknown }).success === false
  ) {
    const error = (response as { error?: { code?: string; message?: string } }).error;
    return {
      code: typeof error?.code === "string" ? error.code : undefined,
      message: error?.message?.trim() || "Something went wrong. Please try again.",
    };
  }
  if (response instanceof Error) {
    const code =
      "code" in response && typeof response.code === "string" ? response.code : undefined;
    return {
      code,
      message: response.message.trim() || "Something went wrong. Please try again.",
    };
  }
  return { message: "Something went wrong. Please try again." };
}
