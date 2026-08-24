import type { InvoiceOfferAcceptSignatory } from "@cashsouk/types";
import fs from "node:fs";
import path from "node:path";
import {
  claimOfferAcceptInFlight,
  isCompleteOfferAcceptOtp,
  maskSignatoryEmail,
  offerAcceptOtpErrorCopy,
  orderAcceptSignatories,
  readApiError,
  releaseOfferAcceptInFlight,
  remainingAttemptsCopy,
  resendButtonLabel,
  sanitizeOfferAcceptOtpInput,
  secondsUntil,
  shouldApplyOfferAcceptAsyncResult,
  shouldIgnoreOfferAcceptDialogDismiss,
  signatorySourceLabel,
  step2Description,
} from "./offer-accept-otp-model";

const envelope: InvoiceOfferAcceptSignatory = {
  name: "Ali Director",
  email: "ali@cashsouk.com",
  source: "FACILITY_ENVELOPE",
};

const org: InvoiceOfferAcceptSignatory = {
  name: "Bee Director",
  email: "bee@issuer.my",
  source: "ORG_DIRECTOR",
};

describe("maskSignatoryEmail", () => {
  it("masks local and host while keeping the TLD", () => {
    expect(maskSignatoryEmail("ali@cashsouk.com")).toBe("a***@c***.com");
  });

  it("returns a placeholder for invalid values", () => {
    expect(maskSignatoryEmail("not-an-email")).toBe("••••");
  });
});

describe("orderAcceptSignatories", () => {
  it("keeps facility agreement signatories first without reordering peers", () => {
    expect(orderAcceptSignatories([org, envelope, { ...org, email: "cee@issuer.my" }])).toEqual([
      envelope,
      org,
      { ...org, email: "cee@issuer.my" },
    ]);
  });
});

describe("OTP input helpers", () => {
  it("keeps only 6 digits", () => {
    expect(sanitizeOfferAcceptOtpInput("12a34-56b78")).toBe("123456");
    expect(isCompleteOfferAcceptOtp("123456")).toBe(true);
    expect(isCompleteOfferAcceptOtp("12345")).toBe(false);
  });
});

describe("OTP copy", () => {
  it("maps known API codes", () => {
    expect(offerAcceptOtpErrorCopy("OTP_EXPIRED", "fallback")).toMatch(/expired/i);
    expect(offerAcceptOtpErrorCopy("OTP_ATTEMPTS_EXCEEDED", "fallback")).toMatch(/incorrect codes/i);
    expect(offerAcceptOtpErrorCopy("CONSENTS_REQUIRED", "fallback")).toMatch(/confirmation/i);
    expect(offerAcceptOtpErrorCopy("UNKNOWN", "Use this")).toBe("Use this");
  });

  it("names the selected signatory with a masked email", () => {
    expect(step2Description(envelope)).toContain("Ali Director");
    expect(step2Description(envelope)).toContain("a***@c***.com");
    expect(step2Description(envelope)).not.toContain("ali@cashsouk.com");
  });

  it("labels sources and remaining attempts", () => {
    expect(signatorySourceLabel("FACILITY_ENVELOPE")).toBe("Facility agreement");
    expect(remainingAttemptsCopy(2)).toBe("2 attempts remaining.");
    expect(remainingAttemptsCopy(0)).toMatch(/No attempts/);
  });

  it("uses a live countdown label", () => {
    expect(resendButtonLabel({ secondsRemaining: 45, remainingSends: 4 })).toBe("Resend in 45s");
    expect(resendButtonLabel({ secondsRemaining: 0, remainingSends: 0 })).toBe("Send limit reached");
    expect(resendButtonLabel({ secondsRemaining: 0, remainingSends: 3 })).toBe("Resend code");
  });
});

describe("readApiError", () => {
  it("keeps the API error code for dialog copy", () => {
    expect(
      readApiError({
        success: false,
        error: { code: "OTP_EXPIRED", message: "This verification code has expired. Request a new code." },
      })
    ).toEqual({
      code: "OTP_EXPIRED",
      message: "This verification code has expired. Request a new code.",
    });
  });

  it("reads a code property from thrown Error objects", () => {
    const error = new Error("The verification code is incorrect.") as Error & { code?: string };
    error.code = "OTP_INVALID";
    expect(readApiError(error)).toEqual({
      code: "OTP_INVALID",
      message: "The verification code is incorrect.",
    });
  });
});

describe("secondsUntil", () => {
  it("returns remaining whole seconds and never goes negative", () => {
    expect(secondsUntil("2026-08-24T00:01:00.000Z", Date.parse("2026-08-24T00:00:12.000Z"))).toBe(48);
    expect(secondsUntil("2026-08-24T00:00:00.000Z", Date.parse("2026-08-24T00:01:00.000Z"))).toBe(0);
  });
});

describe("offer accept async generation guard", () => {
  it("applies a result only when the dialog is still open on the same generation", () => {
    expect(
      shouldApplyOfferAcceptAsyncResult({ generation: 2, currentGeneration: 2, open: true })
    ).toBe(true);
    expect(
      shouldApplyOfferAcceptAsyncResult({ generation: 2, currentGeneration: 3, open: true })
    ).toBe(false);
    expect(
      shouldApplyOfferAcceptAsyncResult({ generation: 2, currentGeneration: 2, open: false })
    ).toBe(false);
  });

  it("ignores every dismiss while busy, including explicit close", () => {
    expect(shouldIgnoreOfferAcceptDialogDismiss({ nextOpen: false, busy: true })).toBe(true);
    expect(shouldIgnoreOfferAcceptDialogDismiss({ nextOpen: false, busy: false })).toBe(false);
    expect(shouldIgnoreOfferAcceptDialogDismiss({ nextOpen: true, busy: true })).toBe(false);
  });

  it("routes cancel and chrome close through the busy dismiss guard", () => {
    const dialogSource = fs.readFileSync(
      path.join(__dirname, "offer-accept-otp-dialog.tsx"),
      "utf8"
    );
    expect(dialogSource).toContain("onClick={() => handleDialogOpenChange(false)}");
    expect(dialogSource).not.toContain("onClick={() => onOpenChange(false)}");
    expect(dialogSource).toMatch(/onClick=\{\(\) => handleDialogOpenChange\(false\)\}[\s\S]*disabled=\{busy\}/);
    expect(dialogSource).toContain("hideClose={busy}");
    expect(dialogSource).toContain("aria-busy={busy}");
    expect(dialogSource).toContain("onEscapeKeyDown");
    expect(dialogSource).toContain("onInteractOutside");
    expect(dialogSource).toContain("if (busy) event.preventDefault()");
    expect(dialogSource).toContain('{otp.requesting ? "Sending code…" : "Send verification code"}');
    expect(dialogSource).toContain('{otp.verifying || accepting ? "Verifying…" : "Verify and accept"}');
  });

  it("does not reset to another signatory while a request is in flight", () => {
    const hookSource = fs.readFileSync(path.join(__dirname, "use-offer-accept-otp.ts"), "utf8");
    expect(hookSource).toContain("if (requesting || verifying) return;");
    expect(hookSource).toContain("if (canApply()) setRequesting(false);");
    expect(hookSource).toContain("if (canApply()) setVerifying(false);");
    expect(hookSource).not.toMatch(/abort[A-Za-z]*\(/);
  });
});

describe("offer accept in-flight verify guard", () => {
  it("rejects a duplicate claim until the first submit is released", () => {
    const inFlight = { current: false };
    expect(claimOfferAcceptInFlight(inFlight)).toBe(true);
    expect(claimOfferAcceptInFlight(inFlight)).toBe(false);
    expect(claimOfferAcceptInFlight(inFlight)).toBe(false);
    releaseOfferAcceptInFlight(inFlight);
    expect(claimOfferAcceptInFlight(inFlight)).toBe(true);
  });

  it("uses a synchronous ref in the hook so React state cannot admit a second accept", () => {
    const hookSource = fs.readFileSync(path.join(__dirname, "use-offer-accept-otp.ts"), "utf8");
    expect(hookSource).toContain("verifyInFlightRef");
    expect(hookSource).toContain("claimOfferAcceptInFlight(verifyInFlightRef)");
    expect(hookSource).toContain("releaseOfferAcceptInFlight(verifyInFlightRef)");
    expect(hookSource).toContain("if (generation === generationRef.current)");
    expect(hookSource).not.toMatch(
      /if \(!challenge \|\| !isCompleteOfferAcceptOtp\(otpCode\) \|\| verifying\) return;/
    );
  });
});

describe("invoice offer accept error surface", () => {
  it("keeps accept failures inline and still toasts success from the review panel", () => {
    const hookSource = fs.readFileSync(
      path.join(__dirname, "../../../../../hooks/use-applications.ts"),
      "utf8"
    );
    const acceptHook = hookSource.slice(
      hookSource.indexOf("export function useAcceptInvoiceOffer"),
      hookSource.indexOf("export function useRejectInvoiceOffer")
    );
    expect(acceptHook).toContain("invalidateQueries");
    expect(acceptHook).not.toContain("toast.error");
    expect(acceptHook).not.toContain("Failed to accept offer");

    const panelSource = fs.readFileSync(
      path.join(__dirname, "../OfferReviewPanel.tsx"),
      "utf8"
    );
    expect(panelSource).toContain('toast.success("Offer accepted")');
    expect(panelSource).toContain("frozenUtilisationConsentsRef");
    expect(panelSource).toContain("consentsLocked={acceptOfferConfirmOpen}");
    expect(panelSource).toContain("setAcceptOfferConfirmOpen(false)");
  });
});

describe("utilisation consent checkboxes", () => {
  it("does not pair htmlFor with a wrapping label, which double-toggles Radix checkboxes", () => {
    const termsSource = fs.readFileSync(
      path.join(__dirname, "../utilisation-offer-terms.tsx"),
      "utf8"
    );
    expect(termsSource).not.toMatch(/htmlFor=\{inputId\}/);
    expect(termsSource).toContain("consentsLocked");
  });
});
