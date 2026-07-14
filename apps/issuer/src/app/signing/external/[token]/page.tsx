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
  CheckCircleIcon,
  DocumentTextIcon,
  IdentificationIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ISSUER_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_ISSUER_URL ?? "";

/** Marks that this tab just left for SigningCloud; cleared after return handling. */
function pendingConfirmStorageKey(accessToken: string): string {
  return `signing:pendingConfirm:${accessToken}`;
}

type Step = "access-code" | "ekyc" | "sign" | "done" | "closed";

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
  /** Document just signed (optimistic return); excluded from "more to sign" until webhook catches up. */
  const [justSigned, setJustSigned] = React.useState<{
    documentId: string;
    documentName: string;
  } | null>(null);
  const [isPollingReturn, setIsPollingReturn] = React.useState(false);
  const returnHandledRef = React.useRef(false);

  const applySession = React.useCallback(
    (
      data: ExternalSigningSessionDto,
      opts?: { preferDone?: boolean; signedDoc?: { documentId: string; documentName: string } | null }
    ) => {
      setSession(data);
      setError(null);

      if (data.package_closed) {
        setJustSigned(null);
        setStep("closed");
        return;
      }

      if (!data.access_verified) {
        setStep("access-code");
        return;
      }

      if (data.kyc_required && data.kyc_status !== "VERIFIED") {
        setStep("ekyc");
        return;
      }

      const pending = findUnsignedSigningAssignmentForRecipient(data.envelope, data.recipient_id);
      if (opts?.preferDone || !pending) {
        if (opts?.signedDoc) setJustSigned(opts.signedDoc);
        setStep("done");
        return;
      }

      setJustSigned(null);
      setStep("sign");
    },
    []
  );

  const fetchSession = React.useCallback(async (): Promise<ExternalSigningSessionDto | null> => {
    const response = await apiClient.getExternalSigningEnvelope(token);
    if (!response.success) {
      setError(getErrorMessage(response, "This signing link is not available."));
      setSession(null);
      return null;
    }
    return response.data;
  }, [apiClient, token]);

  const loadSession = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchSession();
      if (!data) return;
      applySession(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load signing package.");
    } finally {
      setIsLoading(false);
    }
  }, [applySession, fetchSession]);

  // On mount: return from SigningCloud → confirm-signed; otherwise sync from provider then load.
  React.useEffect(() => {
    if (returnHandledRef.current) return;
    returnHandledRef.current = true;

    const storageKey = pendingConfirmStorageKey(token);
    let pendingDoc: { documentId: string; documentName: string } | null = null;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { documentId?: string; documentName?: string };
        if (parsed.documentId) {
          pendingDoc = {
            documentId: parsed.documentId,
            documentName: parsed.documentName?.trim() || "Document",
          };
        }
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }

    if (!pendingDoc) {
      // Revisit: pull live SigningCloud statuses so progress catches up without sessionStorage.
      setIsLoading(true);
      apiClient
        .syncExternalSigningFromProvider(token)
        .then((response) => {
          if (response.success) {
            applySession(response.data);
            return null;
          }
          return fetchSession();
        })
        .then((data) => {
          if (data) applySession(data);
        })
        .catch(() => {
          setError("This signing link is not available.");
        })
        .finally(() => setIsLoading(false));
      return;
    }

    setJustSigned(pendingDoc);
    setIsLoading(true);
    setIsPollingReturn(true);

    const finish = (data: ExternalSigningSessionDto | null) => {
      setIsPollingReturn(false);
      setIsLoading(false);
      if (!data) {
        setStep("done");
        return;
      }
      applySession(data, { preferDone: true, signedDoc: pendingDoc });
    };

    // Sync from SigningCloud Get Document Detail (per-signer signstate), then show terminal.
    apiClient
      .confirmExternalEnvelopeSigned(token, { documentId: pendingDoc.documentId })
      .then((response) => {
        if (response.success) {
          finish(response.data);
          return;
        }
        // Confirm/sync failed — still show terminal; fall back to session read.
        fetchSession()
          .then((data) => finish(data))
          .catch(() => finish(null));
      })
      .catch(() => {
        fetchSession()
          .then((data) => finish(data))
          .catch(() => finish(null));
      });
  }, [apiClient, applySession, fetchSession, loadSession, token]);

  const recipient = session?.envelope.recipients.find(
    (item) => item.id === session.recipient_id
  );

  const pendingAssignment =
    session && session.recipient_id
      ? findUnsignedSigningAssignmentForRecipient(session.envelope, session.recipient_id)
      : null;

  // While webhook lags, the doc we just signed still looks unsigned — ignore it for Continue.
  const hasMoreToSign = Boolean(
    session && justSigned
      ? session.envelope.assignments.some(
          (a) =>
            a.action === "SIGN" &&
            a.status !== "SIGNED" &&
            a.recipient_id === session.recipient_id &&
            a.document_id !== justSigned.documentId
        )
      : pendingAssignment
  );

  const isGuarantor = recipient?.role_key === "guarantor";

  const verifyAccessCode = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await apiClient.verifyExternalSigningAccessCode(token, {
        ic_number: icNumber,
      });
      if (!response.success) {
        setError(getErrorMessage(response, "Could not verify MyKad number."));
        return;
      }
      applySession(response.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify MyKad number.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBackToAccessCode = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await apiClient.resetExternalSigningAccessGate(token);
      if (!response.success) {
        setError(getErrorMessage(response, "Could not go back."));
        return;
      }
      setEkycCaptureUrl(null);
      setEkycStatus("pending");
      setIcNumber("");
      applySession(response.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not go back.");
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
            fetchSession()
              .then((data) => {
                if (data) applySession(data);
              })
              .catch(() => undefined);
          }
          if (response.data.status === "failed" || response.data.status === "error") {
            window.clearInterval(interval);
            setError(response.data.last_error ?? "Identity verification failed.");
          }
        })
        .catch(() => undefined);
    }, 2500);

    return () => window.clearInterval(interval);
  }, [apiClient, applySession, ekycCaptureUrl, fetchSession, step]);

  const startSigning = async () => {
    if (!pendingAssignment) return;
    setIsSubmitting(true);
    setError(null);
    try {
      try {
        sessionStorage.setItem(
          pendingConfirmStorageKey(token),
          JSON.stringify({
            documentId: pendingAssignment.document.id,
            documentName: pendingAssignment.document.name,
          })
        );
      } catch {
        // sessionStorage may be unavailable; return UX falls back to normal load.
      }

      const response = await apiClient.startExternalEnvelopeSigning(token, {
        documentId: pendingAssignment.document.id,
        redirectUrl: window.location.href,
      });
      if (response.success && response.data.signingUrl) {
        window.location.assign(response.data.signingUrl);
        return;
      }
      try {
        sessionStorage.removeItem(pendingConfirmStorageKey(token));
      } catch {
        // ignore
      }
      setError(getErrorMessage(response, "Could not start signing."));
    } catch (e) {
      try {
        sessionStorage.removeItem(pendingConfirmStorageKey(token));
      } catch {
        // ignore
      }
      setError(e instanceof Error ? e.message : "Could not start signing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueAfterSigned = () => {
    setJustSigned(null);
    fetchSession()
      .then((data) => {
        if (data) applySession(data);
        else loadSession().catch(() => undefined);
      })
      .catch(() => {
        loadSession().catch(() => undefined);
      });
  };

  const stepIcon =
    step === "access-code" ? (
      <IdentificationIcon className="h-6 w-6 text-primary" />
    ) : step === "ekyc" ? (
      <ShieldCheckIcon className="h-6 w-6 text-primary" />
    ) : step === "done" || step === "closed" ? (
      <CheckCircleIcon className="h-6 w-6 text-primary" />
    ) : (
      <DocumentTextIcon className="h-6 w-6 text-primary" />
    );

  const stepTitle =
    step === "access-code"
      ? "Verify your identity"
      : step === "ekyc"
        ? "Identity verification"
        : step === "closed"
          ? "Signing package closed"
          : step === "done"
            ? "You've signed"
            : pendingAssignment
              ? "Ready to sign"
              : "Signing complete";

  const stepDescription =
    step === "access-code"
      ? isGuarantor
        ? "Enter your MyKad number. This will be used for identity verification."
        : "Enter your MyKad number to verify your identity before signing."
      : step === "ekyc"
        ? "Scan the QR code with your phone to complete MyKad verification."
        : step === "closed"
          ? "This signing package is complete or no longer available."
          : step === "done"
            ? justSigned
              ? `${justSigned.documentName} has been signed.`
              : "There are no pending documents for you to sign."
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
                  {step === "done" || step === "closed"
                    ? stepTitle
                    : (session?.envelope.title ?? stepTitle)}
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
          ) : !session && error ? (
            <>
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl"
                disabled={isSubmitting}
                onClick={() => {
                  setError(null);
                  loadSession().catch(() => undefined);
                }}
              >
                Try again
              </Button>
            </>
          ) : (
            <>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {step === "access-code" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {isGuarantor
                      ? "Use the MyKad number of the person who will complete identity verification and sign."
                      : "This must match the person named on this signing request."}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="access-ic">MyKad number</Label>
                    <Input
                      id="access-ic"
                      value={icNumber}
                      onChange={(event) => {
                        setIcNumber(event.target.value);
                        if (error) setError(null);
                      }}
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
                  ) : !error ? (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <p className="text-sm text-muted-foreground">Preparing verification...</p>
                    </div>
                  ) : null}
                  {ekycStatus === "pending" && ekycCaptureUrl ? (
                    <p className="text-center text-sm text-muted-foreground">
                      Waiting for verification...
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl sm:flex-1"
                      disabled={isSubmitting}
                      onClick={() => {
                        goBackToAccessCode().catch(() => undefined);
                      }}
                    >
                      Go back
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl sm:flex-1"
                      disabled={isSubmitting}
                      onClick={() => {
                        setError(null);
                        setEkycCaptureUrl(null);
                        startEkyc(true).catch(() => undefined);
                      }}
                    >
                      New QR code
                    </Button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Entered the wrong MyKad number? Choose Go back to enter it again before
                    verifying.
                  </p>
                </>
              ) : step === "closed" ? (
                <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  You can close this page.
                </div>
              ) : step === "done" ? (
                <>
                  <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    {hasMoreToSign
                      ? "You still have another document to sign in this package."
                      : "You can close this page."}
                  </div>
                  {isPollingReturn ? (
                    <p className="text-center text-xs text-muted-foreground">Updating status…</p>
                  ) : null}
                  {hasMoreToSign ? (
                    <Button
                      type="button"
                      className="h-11 w-full rounded-xl"
                      onClick={continueAfterSigned}
                    >
                      Continue
                    </Button>
                  ) : null}
                </>
              ) : !pendingAssignment ? (
                <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  There are no pending documents for you to sign. You can close this page.
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="font-medium text-foreground">{pendingAssignment.document.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {/* Document stays PENDING until every required signer finishes; show this recipient's assignment. */}
                      Your status:{" "}
                      {(
                        session?.envelope.assignments.find(
                          (a) =>
                            a.document_id === pendingAssignment.document.id &&
                            a.recipient_id === session.recipient_id &&
                            a.action === "SIGN"
                        )?.status ?? "PENDING"
                      ).replace(/_/g, " ")}
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
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
