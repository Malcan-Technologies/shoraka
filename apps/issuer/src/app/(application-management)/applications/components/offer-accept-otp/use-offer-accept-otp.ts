"use client";

import * as React from "react";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  InvoiceOfferAcceptOtpRequestResponse,
  InvoiceOfferAcceptSignatory,
  OfferAcceptSignatorySource,
} from "@cashsouk/types";
import {
  claimOfferAcceptInFlight,
  isCompleteOfferAcceptOtp,
  offerAcceptOtpErrorCopy,
  orderAcceptSignatories,
  readApiError,
  releaseOfferAcceptInFlight,
  sanitizeOfferAcceptOtpInput,
  secondsUntil,
  shouldApplyOfferAcceptAsyncResult,
} from "./offer-accept-otp-model";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type OfferAcceptOtpVerifyInput = {
  challenge_id: string;
  otp_code: string;
};

type UseOfferAcceptOtpParams = {
  open: boolean;
  applicationId: string;
  invoiceId: string;
  onAccept: (input: OfferAcceptOtpVerifyInput) => Promise<void>;
};

export function useOfferAcceptOtp({
  open,
  applicationId,
  invoiceId,
  onAccept,
}: UseOfferAcceptOtpParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(
    () => createApiClient(API_URL, getAccessToken),
    [getAccessToken]
  );

  const [step, setStep] = React.useState<"signatory" | "code">("signatory");
  const [signatories, setSignatories] = React.useState<InvoiceOfferAcceptSignatory[]>([]);
  const [listSource, setListSource] = React.useState<OfferAcceptSignatorySource | null>(null);
  const [selectedEmail, setSelectedEmail] = React.useState("");
  const [challenge, setChallenge] = React.useState<InvoiceOfferAcceptOtpRequestResponse | null>(
    null
  );
  const [otpCode, setOtpCode] = React.useState("");
  const [signatoriesLoading, setSignatoriesLoading] = React.useState(false);
  const [requesting, setRequesting] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [signatoriesError, setSignatoriesError] = React.useState<string | null>(null);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = React.useState<number | null>(null);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const generationRef = React.useRef(0);
  const openRef = React.useRef(open);
  const verifyInFlightRef = React.useRef(false);
  openRef.current = open;

  const reset = React.useCallback(() => {
    generationRef.current += 1;
    releaseOfferAcceptInFlight(verifyInFlightRef);
    setStep("signatory");
    setSignatories([]);
    setListSource(null);
    setSelectedEmail("");
    setChallenge(null);
    setOtpCode("");
    setSignatoriesLoading(false);
    setRequesting(false);
    setVerifying(false);
    setSignatoriesError(null);
    setRequestError(null);
    setVerifyError(null);
    setRemainingAttempts(null);
  }, []);

  React.useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  React.useEffect(() => {
    reset();
  }, [applicationId, invoiceId, reset]);

  React.useEffect(() => {
    if (!open || !applicationId || !invoiceId) return;
    let cancelled = false;
    setSignatoriesLoading(true);
    setSignatoriesError(null);
    void apiClient
      .getInvoiceAcceptSignatories(applicationId, invoiceId)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          const err = readApiError(res);
          setSignatories([]);
          setSignatoriesError(offerAcceptOtpErrorCopy(err.code, err.message));
          return;
        }
        const ordered = orderAcceptSignatories(res.data.signatories);
        setSignatories(ordered);
        setListSource(res.data.source);
        setSelectedEmail(ordered.length === 1 ? ordered[0]!.email : "");
        if (ordered.length === 0) {
          setSignatoriesError(
            offerAcceptOtpErrorCopy("OTP_NO_SIGNATORIES", "No authorised signatories are available.")
          );
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const err = readApiError(error);
        setSignatoriesError(offerAcceptOtpErrorCopy(err.code, err.message));
      })
      .finally(() => {
        if (!cancelled) setSignatoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiClient, applicationId, invoiceId, open]);

  const resendAvailableAt = challenge?.resend_available_at ?? null;
  const secondsRemaining = secondsUntil(resendAvailableAt, nowMs);

  React.useEffect(() => {
    if (!open || step !== "code" || secondsRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, secondsRemaining, step]);

  const selectedSignatory =
    signatories.find((signatory) => signatory.email === selectedEmail) ?? null;

  const applyChallenge = (next: InvoiceOfferAcceptOtpRequestResponse) => {
    setChallenge(next);
    setRemainingAttempts(next.remaining_attempts);
    setOtpCode("");
    setVerifyError(null);
    setRequestError(null);
    setStep("code");
    setNowMs(Date.now());
  };

  const sendCode = async () => {
    if (!selectedSignatory || requesting) return;
    const generation = generationRef.current;
    const canApply = () =>
      shouldApplyOfferAcceptAsyncResult({
        generation,
        currentGeneration: generationRef.current,
        open: openRef.current,
      });
    setRequesting(true);
    setRequestError(null);
    try {
      const res = await apiClient.requestInvoiceAcceptOtp(applicationId, invoiceId, {
        signatory_email: selectedSignatory.email,
      });
      if (!canApply()) return;
      if (!res.success) {
        const err = readApiError(res);
        setRequestError(offerAcceptOtpErrorCopy(err.code, err.message));
        return;
      }
      applyChallenge(res.data);
    } catch (error) {
      if (!canApply()) return;
      const err = readApiError(error);
      setRequestError(offerAcceptOtpErrorCopy(err.code, err.message));
    } finally {
      if (canApply()) setRequesting(false);
    }
  };

  const verifyAndAccept = async () => {
    if (!challenge || !isCompleteOfferAcceptOtp(otpCode)) return;
    if (!claimOfferAcceptInFlight(verifyInFlightRef)) return;
    const generation = generationRef.current;
    const canApply = () =>
      shouldApplyOfferAcceptAsyncResult({
        generation,
        currentGeneration: generationRef.current,
        open: openRef.current,
      });
    setVerifying(true);
    setVerifyError(null);
    try {
      await onAccept({
        challenge_id: challenge.challenge_id,
        otp_code: otpCode,
      });
    } catch (error) {
      if (!canApply()) return;
      const err = readApiError(error);
      const copy = offerAcceptOtpErrorCopy(err.code, err.message);
      if (err.code === "OTP_INVALID" || copy.includes("incorrect")) {
        setRemainingAttempts((prev) => (prev == null ? prev : Math.max(0, prev - 1)));
      }
      if (err.code === "OTP_ATTEMPTS_EXCEEDED") {
        setRemainingAttempts(0);
      }
      setVerifyError(copy);
    } finally {
      if (generation === generationRef.current) {
        releaseOfferAcceptInFlight(verifyInFlightRef);
      }
      if (canApply()) setVerifying(false);
    }
  };

  const changeSignatory = () => {
    if (requesting || verifying) return;
    setStep("signatory");
    setChallenge(null);
    setOtpCode("");
    setVerifyError(null);
    setRequestError(null);
  };

  return {
    step,
    signatories,
    listSource,
    selectedEmail,
    selectedSignatory,
    otpCode,
    signatoriesLoading,
    requesting,
    verifying,
    signatoriesError,
    requestError,
    verifyError,
    remainingAttempts,
    remainingSends: challenge?.remaining_sends ?? null,
    secondsRemaining,
    canResend:
      secondsRemaining <= 0 &&
      (challenge?.remaining_sends == null || challenge.remaining_sends > 0) &&
      !requesting,
    setSelectedEmail,
    setOtpCode: (value: string) => setOtpCode(sanitizeOfferAcceptOtpInput(value)),
    sendCode,
    resendCode: sendCode,
    verifyAndAccept,
    changeSignatory,
  };
}
