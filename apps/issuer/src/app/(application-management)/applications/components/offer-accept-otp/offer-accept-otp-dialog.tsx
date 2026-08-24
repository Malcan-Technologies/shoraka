"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import {
  isCompleteOfferAcceptOtp,
  maskSignatoryEmail,
  remainingAttemptsCopy,
  resendButtonLabel,
  shouldIgnoreOfferAcceptDialogDismiss,
  signatorySourceLabel,
  step1Description,
  step2Description,
} from "./offer-accept-otp-model";
import { useOfferAcceptOtp, type OfferAcceptOtpVerifyInput } from "./use-offer-accept-otp";

type OfferAcceptOtpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  invoiceId: string;
  offeredValue: string;
  accepting?: boolean;
  onAccept: (input: OfferAcceptOtpVerifyInput) => Promise<void>;
};

export function OfferAcceptOtpDialog({
  open,
  onOpenChange,
  applicationId,
  invoiceId,
  offeredValue,
  accepting = false,
  onAccept,
}: OfferAcceptOtpDialogProps) {
  const otp = useOfferAcceptOtp({
    open,
    applicationId,
    invoiceId,
    onAccept,
  });
  const busy = otp.requesting || otp.verifying || accepting;
  const handleDialogOpenChange = (next: boolean) => {
    if (shouldIgnoreOfferAcceptDialogDismiss({ nextOpen: next, busy })) return;
    onOpenChange(next);
  };
  const attemptsCopy = remainingAttemptsCopy(otp.remainingAttempts);
  const resendLabel = resendButtonLabel({
    secondsRemaining: otp.secondsRemaining,
    remainingSends: otp.remainingSends,
  });

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        aria-describedby="offer-accept-otp-description"
        aria-busy={busy}
        hideClose={busy}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <EnvelopeIcon className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <DialogTitle>
              {otp.step === "signatory" ? "Verify to accept offer" : "Enter verification code"}
            </DialogTitle>
          </div>
          <DialogDescription id="offer-accept-otp-description">
            {otp.step === "signatory"
              ? step1Description(offeredValue)
              : step2Description(otp.selectedSignatory)}
          </DialogDescription>
        </DialogHeader>

        {otp.step === "signatory" ? (
          <div className="space-y-4">
            {otp.signatoriesLoading ? (
              <p className="text-ui text-muted-foreground">Loading authorised signatories…</p>
            ) : null}
            {otp.signatoriesError ? (
              <Alert variant="destructive">
                <AlertDescription>{otp.signatoriesError}</AlertDescription>
              </Alert>
            ) : null}
            {otp.requestError ? (
              <Alert variant="destructive">
                <AlertDescription>{otp.requestError}</AlertDescription>
              </Alert>
            ) : null}
            {!otp.signatoriesLoading && otp.signatories.length > 0 ? (
              <>
                {otp.listSource ? (
                  <p className="text-ui text-muted-foreground">
                    {otp.listSource === "FACILITY_ENVELOPE"
                      ? "Signatories from the completed facility agreement."
                      : "No facility-agreement emails were available, so organisation directors are shown."}
                  </p>
                ) : null}
                <RadioGroup
                  value={otp.selectedEmail}
                  onValueChange={otp.setSelectedEmail}
                  className="gap-3"
                  aria-label="Authorised signatory"
                >
                  {otp.signatories.map((signatory) => {
                    const id = `offer-accept-signatory-${signatory.email}`;
                    return (
                      <label
                        key={signatory.email}
                        htmlFor={id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 focus-within:ring-1 focus-within:ring-ring"
                      >
                        <RadioGroupItem id={id} value={signatory.email} className="mt-1" />
                        <span className="min-w-0 space-y-0.5">
                          <span className="block text-ui font-medium text-foreground">
                            {signatory.name}
                          </span>
                          <span className="block text-ui text-muted-foreground">
                            {maskSignatoryEmail(signatory.email)}
                          </span>
                          <span className="block text-meta text-muted-foreground">
                            {signatorySourceLabel(signatory.source)}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              </>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {otp.verifyError ? (
              <Alert variant="destructive">
                <AlertDescription>{otp.verifyError}</AlertDescription>
              </Alert>
            ) : null}
            {otp.requestError ? (
              <Alert variant="destructive">
                <AlertDescription>{otp.requestError}</AlertDescription>
              </Alert>
            ) : null}
            {attemptsCopy ? <p className="text-ui text-muted-foreground">{attemptsCopy}</p> : null}
            <div className="space-y-2">
              <Label htmlFor="offer-accept-otp-code">Verification code</Label>
              <Input
                id="offer-accept-otp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp.otpCode}
                onChange={(event) => otp.setOtpCode(event.target.value)}
                aria-invalid={otp.verifyError ? true : undefined}
                className="h-11 tracking-[0.4em]"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {otp.step === "signatory" ? (
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => handleDialogOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => void otp.sendCode()}
                disabled={busy || !otp.selectedEmail || otp.signatories.length === 0}
              >
                {otp.requesting ? "Sending code…" : "Send verification code"}
              </Button>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2">
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => handleDialogOpenChange(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={otp.changeSignatory}
                  disabled={busy}
                >
                  Change signatory
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={() => void otp.verifyAndAccept()}
                  disabled={busy || !isCompleteOfferAcceptOtp(otp.otpCode)}
                >
                  {otp.verifying || accepting ? "Verifying…" : "Verify and accept"}
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={() => void otp.resendCode()}
                disabled={busy || !otp.canResend}
              >
                {otp.requesting ? "Sending code…" : resendLabel}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
