"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { createApiClient } from "@cashsouk/config";
import {
  findUnsignedSigningAssignmentForRecipient,
  type ExternalSigningSessionDto,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DocumentTextIcon,
  IdentificationIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ISSUER_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_ISSUER_URL ?? "";

type Step = "access-code" | "ekyc" | "sign";

function getErrorMessage(response: unknown, fallback: string): string {
  if (
    response &&
    typeof response === "object" &&
    "success" in response &&
    response.success === false &&
    "error" in response &&
    response.error &&
    typeof response.error === "object"
  ) {
    const message = (response.error as { message?: unknown }).message;
    return typeof message === "string" ? message : fallback;
  }
  return fallback;
}

export default function ExternalSigningPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const apiClient = React.useMemo(() => createApiClient(API_URL), []);
  const [session, setSession] = React.useState<ExternalSigningSessionDto | null>(null);
  const [step, setStep] = React.useState<Step>("access-code");
  const [icNumber, setIcNumber] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [ekycCaptureUrl, setEkycCaptureUrl] = React.useState<string | null>(null);
  const [ekycStatus, setEkycStatus] = React.useState<string>("pending");

  const loadSession = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getExternalSigningEnvelope(token);
      if (!response.success) {
        setError(getErrorMessage(response, "This signing link is not available."));
        setSession(null);
        return;
      }
      setSession(response.data);
      setError(null);
      if (response.data.access_verified) {
        if (
          response.data.kyc_required &&
          response.data.kyc_status !== "VERIFIED"
        ) {
          setStep("ekyc");
        } else {
          setStep("sign");
        }
      } else {
        setStep("access-code");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load signing package.");
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, token]);

  React.useEffect(() => {
    loadSession().catch(() => undefined);
  }, [loadSession]);

  const recipient = session?.envelope.recipients.find(
    (item) => item.id === session.recipient_id
  );

  const pendingAssignment =
    session && session.recipient_id
      ? findUnsignedSigningAssignmentForRecipient(session.envelope, session.recipient_id)
      : null;

  const verifyAccessCode = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await apiClient.verifyExternalSigningAccessCode(token, {
        ic_number: icNumber,
      });
      if (!response.success) {
        setError(getErrorMessage(response, "Could not verify IC number."));
        return;
      }
      setSession(response.data);
      if (response.data.kyc_required && response.data.kyc_status !== "VERIFIED") {
        setStep("ekyc");
      } else {
        setStep("sign");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify IC number.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEkyc = async (force = false) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await apiClient.createExternalRecipientEkycSession(token, {
        confirmedName: recipient?.name,
        force,
      });
      if (!response.success) {
        setError(getErrorMessage(response, "Could not start identity verification."));
        return;
      }
      const captureUrl = `${ISSUER_ORIGIN}/ekyc/capture.html?token=${encodeURIComponent(response.data.token)}&endpoint=${encodeURIComponent(response.data.sdk_endpoint)}&api=${encodeURIComponent(API_URL)}`;
      setEkycCaptureUrl(captureUrl);
      setEkycStatus("pending");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start identity verification.");
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (step !== "ekyc" || ekycCaptureUrl || isSubmitting) return;
    startEkyc().catch(() => undefined);
  }, [step, ekycCaptureUrl, isSubmitting]);

  React.useEffect(() => {
    if (step !== "ekyc" || !ekycCaptureUrl) return;
    const match = ekycCaptureUrl.match(/[?&]token=([^&]+)/);
    const ekycToken = match?.[1];
    if (!ekycToken) return;

    const interval = window.setInterval(() => {
      apiClient
        .getRecipientEkycSessionStatus(decodeURIComponent(ekycToken))
        .then((response) => {
          if (!response.success) return;
          setEkycStatus(response.data.status);
          if (response.data.status === "verified") {
            window.clearInterval(interval);
            loadSession().catch(() => undefined);
            setStep("sign");
          }
          if (response.data.status === "failed" || response.data.status === "error") {
            window.clearInterval(interval);
            setError(response.data.last_error ?? "Identity verification failed.");
          }
        })
        .catch(() => undefined);
    }, 2500);

    return () => window.clearInterval(interval);
  }, [apiClient, ekycCaptureUrl, loadSession, step]);

  const startSigning = async () => {
    if (!pendingAssignment) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await apiClient.startExternalEnvelopeSigning(token, {
        documentId: pendingAssignment.document.id,
        redirectUrl: window.location.href,
      });
      if (response.success && response.data.signingUrl) {
        window.location.assign(response.data.signingUrl);
        return;
      }
      setError(getErrorMessage(response, "Could not start signing."));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start signing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIcon =
    step === "access-code" ? (
      <IdentificationIcon className="h-6 w-6 text-primary" />
    ) : step === "ekyc" ? (
      <ShieldCheckIcon className="h-6 w-6 text-primary" />
    ) : (
      <DocumentTextIcon className="h-6 w-6 text-primary" />
    );

  const stepTitle =
    step === "access-code"
      ? "Verify your identity"
      : step === "ekyc"
        ? "Identity verification"
        : pendingAssignment
          ? "Ready to sign"
          : "Signing complete";

  const stepDescription =
    step === "access-code"
      ? "Enter your MyKad number to verify your identity before signing."
      : step === "ekyc"
        ? "Scan the QR code with your phone to complete MyKad verification."
        : recipient
          ? `You are signing as ${recipient.name} (${recipient.email}).`
          : "Secure signing link";

  return (
    <main className="flex min-h-screen items-start justify-center bg-background px-4 py-10 sm:items-center">
      <Card className="mx-auto w-full max-w-md rounded-2xl shadow-sm">
        <CardHeader>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            CashSouk signing
          </p>
          {isLoading ? (
            <div className="space-y-2 pt-2">
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <div className="flex items-start gap-3 pt-2">
              <div className="rounded-lg bg-primary/10 p-2">{stepIcon}</div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl">
                  {session?.envelope.title ?? stepTitle}
                </CardTitle>
                <CardDescription className="mt-1">{stepDescription}</CardDescription>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : step === "access-code" ? (
            <>
              <p className="text-sm text-muted-foreground">
                This must match the person named on this signing request.
              </p>
              <div className="space-y-2">
                <Label htmlFor="access-ic">IC number</Label>
                <Input
                  id="access-ic"
                  value={icNumber}
                  onChange={(event) => setIcNumber(event.target.value)}
                  inputMode="numeric"
                  placeholder="901212101234"
                  className="h-11 rounded-xl"
                />
              </div>
              <Button
                type="button"
                className="h-11 w-full rounded-xl"
                disabled={isSubmitting || icNumber.replace(/\D/g, "").length !== 12}
                onClick={() => {
                  verifyAccessCode().catch(() => undefined);
                }}
              >
                {isSubmitting ? "Verifying..." : "Continue"}
              </Button>
            </>
          ) : step === "ekyc" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Complete MyKad identity verification on your phone before signing.
              </p>
              {ekycCaptureUrl ? (
                <div className="flex justify-center rounded-xl border border-border bg-muted/20 p-6">
                  <QRCodeSVG value={ekycCaptureUrl} size={220} />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">Preparing verification...</p>
                </div>
              )}
              {ekycStatus === "pending" && ekycCaptureUrl ? (
                <p className="text-center text-sm text-muted-foreground">
                  Waiting for verification...
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl"
                disabled={isSubmitting}
                onClick={() => {
                  setEkycCaptureUrl(null);
                  startEkyc(true).catch(() => undefined);
                }}
              >
                New QR
              </Button>
            </>
          ) : !pendingAssignment ? (
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              There are no pending documents for you to sign. If you just completed signing, you
              can close this page.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="font-medium text-foreground">{pendingAssignment.document.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Status: {pendingAssignment.document.status.replace(/_/g, " ")}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                When you continue, we will open the signing portal to complete your signature.
              </p>
              <Button
                type="button"
                className="h-11 w-full rounded-xl"
                disabled={isSubmitting}
                onClick={() => {
                  startSigning().catch(() => undefined);
                }}
              >
                {isSubmitting ? "Opening signing portal..." : "Sign document"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
