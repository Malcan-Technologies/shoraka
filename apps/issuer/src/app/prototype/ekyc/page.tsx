"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { createApiClient } from "@cashsouk/config";
import type { ApiError, EkycPrototypeDocType, EkycPrototypeSession } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const DEFAULT_EMAIL = "p2p.dev@shorakagroup.com";

type SessionState = {
  session: EkycPrototypeSession;
  captureUrl: string;
};

function getErrorMessage(response: ApiError | Error | unknown, fallback: string): string {
  if (response instanceof Error) {
    return response.message;
  }

  if (
    response &&
    typeof response === "object" &&
    "success" in response &&
    response.success === false &&
    "error" in response &&
    response.error &&
    typeof response.error === "object" &&
    "message" in response.error &&
    typeof response.error.message === "string"
  ) {
    return response.error.message;
  }

  return fallback;
}

export default function PrototypeEkycPage() {
  const apiClient = React.useMemo(() => createApiClient(API_URL), []);
  const [email, setEmail] = React.useState(DEFAULT_EMAIL);
  const [docType, setDocType] = React.useState<EkycPrototypeDocType>("mykad");
  const [isLoading, setIsLoading] = React.useState(false);
  const [sessionState, setSessionState] = React.useState<SessionState | null>(null);
  const [status, setStatus] = React.useState<"idle" | "pending" | "submitted" | "error">("idle");
  const [statusMessage, setStatusMessage] = React.useState(
    "Generate a session to display the desktop QR handoff."
  );
  const [decryptedResult, setDecryptedResult] = React.useState<unknown | null>(null);
  const [submitResponse, setSubmitResponse] = React.useState<unknown | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sessionState?.session.token || status !== "pending") {
      return undefined;
    }

    let active = true;

    const pollStatus = async () => {
      const response = await apiClient.getPrototypeEkycStatus(sessionState.session.token);
      if (!active) {
        return;
      }

      if (!response.success) {
        const message = getErrorMessage(response, "Failed to poll eKYC status");
        setStatus("error");
        setError(message);
        setStatusMessage(message);
        return;
      }

      setDecryptedResult(response.data.decrypted);
      setSubmitResponse(response.data.submitResponse);
      setError(response.data.error);

      if (response.data.status === "submitted") {
        setStatus("submitted");
        setStatusMessage("eKYC completed and the result was submitted to SigningCloud.");
        return;
      }

      if (response.data.status === "error") {
        setStatus("error");
        setStatusMessage(response.data.error || "The eKYC session failed.");
        return;
      }

      setStatus("pending");
      setStatusMessage("Waiting for the phone to finish the WiseAI capture flow.");
    };

    pollStatus().catch((pollError) => {
      if (!active) {
        return;
      }
      const message = getErrorMessage(pollError, "Failed to poll eKYC status");
      setStatus("error");
      setError(message);
      setStatusMessage(message);
    });

    const timer = window.setInterval(() => {
      pollStatus().catch((pollError) => {
        if (!active) {
          return;
        }
        const message = getErrorMessage(pollError, "Failed to poll eKYC status");
        setStatus("error");
        setError(message);
        setStatusMessage(message);
      });
    }, 2500);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [apiClient, sessionState, status]);

  const handleGenerateQr = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatus("error");
      setError("Email is required.");
      setStatusMessage("Email is required.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setDecryptedResult(null);
    setSubmitResponse(null);

    try {
      const response = await apiClient.createPrototypeEkycSession({
        email: trimmedEmail,
        docType,
      });

      if (!response.success) {
        throw new Error(getErrorMessage(response, "Failed to create eKYC session"));
      }

      const captureParams = new URLSearchParams({
        token: response.data.token,
        endpoint: response.data.url,
        docType: response.data.docType,
        api: API_URL,
      });
      const captureUrl = `${window.location.origin}/prototype/ekyc/capture.html?${captureParams.toString()}`;

      setSessionState({
        session: response.data,
        captureUrl,
      });
      setStatus("pending");
      setStatusMessage("QR generated. Scan it with your phone to continue the WiseAI flow.");
    } catch (sessionError) {
      const message = getErrorMessage(sessionError, "Failed to create eKYC session");
      setStatus("error");
      setError(message);
      setStatusMessage(message);
      setSessionState(null);
    } finally {
      setIsLoading(false);
    }
  };

  const statusTone =
    status === "submitted" ? "attention" : status === "error" ? "destructive" : "default";

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Prototype Route
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            WiseAI eKYC before offer signing
          </h1>
          <p className="mt-3 text-[17px] leading-7 text-muted-foreground">
            This standalone demo shows the desktop-to-mobile QR handoff that would happen before
            the issuer signs an offer in SigningCloud. It does not change the live offer-signing
            flow yet.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Create eKYC session</CardTitle>
              <CardDescription>
                Request a SigningCloud token, then render a QR code for the phone capture page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="prototype-ekyc-email">Signer email</Label>
                <Input
                  id="prototype-ekyc-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="issuer@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prototype-ekyc-docType">Document type</Label>
                <Select
                  value={docType}
                  onValueChange={(value) => setDocType(value as EkycPrototypeDocType)}
                >
                  <SelectTrigger id="prototype-ekyc-docType">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mykad">MyKad</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                onClick={handleGenerateQr}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Generating QR..." : "Generate QR handoff"}
              </Button>

              <Alert variant={statusTone}>
                <AlertTitle>Desktop status</AlertTitle>
                <AlertDescription>{statusMessage}</AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle>Mobile QR handoff</CardTitle>
                <CardDescription>
                  Open the capture page on a phone, complete the WiseAI flow there, then this page
                  will poll the backend for the final SigningCloud submission result.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessionState ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                      <QRCodeSVG value={sessionState.captureUrl} size={240} includeMargin />
                    </div>
                    <div className="w-full rounded-xl border border-border bg-muted/30 p-4">
                      <p className="text-sm font-medium text-foreground">Capture URL</p>
                      <p className="mt-2 break-all text-sm text-muted-foreground">
                        {sessionState.captureUrl}
                      </p>
                    </div>
                    <div className="grid w-full gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          SigningCloud endpoint
                        </p>
                        <p className="mt-1 break-all text-sm text-foreground">
                          {sessionState.session.url}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Session token
                        </p>
                        <p className="mt-1 break-all text-sm text-foreground">
                          {sessionState.session.token}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
                    <p className="text-[17px] text-muted-foreground">
                      Generate a session to show the QR handoff here.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle>Prototype result</CardTitle>
                <CardDescription>
                  Backend state after the phone submits the encrypted WiseAI payload and the API
                  forwards it to SigningCloud.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {status === "submitted" ? (
                  <Alert variant="attention">
                    <AlertTitle>Ready for signing</AlertTitle>
                    <AlertDescription>
                      In the real flow, a successful result here is where the issuer would proceed
                      into the SigningCloud offer-signing step.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {error ? (
                  <Alert variant="destructive">
                    <AlertTitle>Prototype error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Decrypted WiseAI result</p>
                  <pre className="overflow-auto rounded-xl border border-border bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {JSON.stringify(decryptedResult, null, 2)}
                  </pre>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">SigningCloud submit response</p>
                  <pre className="overflow-auto rounded-xl border border-border bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {JSON.stringify(submitResponse, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
