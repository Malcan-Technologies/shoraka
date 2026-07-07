"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { createApiClient } from "@cashsouk/config";
import type { ExternalSigningSessionDto } from "@cashsouk/types";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isStarting, setIsStarting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiClient
      .getExternalSigningEnvelope(token)
      .then((response) => {
        if (cancelled) return;
        if (response.success) {
          setSession(response.data);
          setError(null);
        } else {
          setError(getErrorMessage(response, "This signing link is not available."));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load signing package.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiClient, token]);

  const recipient = session?.envelope.recipients.find((item) => item.id === session.recipient_id);
  const documents =
    session?.envelope.documents.filter((document) =>
      session.envelope.assignments.some(
        (assignment) =>
          assignment.recipient_id === session.recipient_id &&
          assignment.document_id === document.id &&
          assignment.action === "SIGN" &&
          assignment.status !== "SIGNED"
      )
    ) ?? [];

  const startSigning = async (documentId: string) => {
    setIsStarting(true);
    try {
      const response = await apiClient.startExternalEnvelopeSigning(token, {
        documentId,
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
      setIsStarting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            CashSouk signing
          </p>
          <h1 className="text-2xl font-bold text-foreground">
            {session?.envelope.title ?? "Signing package"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {recipient
              ? `You are signing as ${recipient.name} (${recipient.email}).`
              : "Loading your signing package..."}
          </p>
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading signing package...</p>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : documents.length === 0 ? (
          <div className="mt-6 rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            There are no pending documents for you to sign. If you just completed signing, you can close this page.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">{document.name}</p>
                  <p className="text-sm text-muted-foreground">Status: {document.status.replace(/_/g, " ")}</p>
                </div>
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={isStarting}
                  onClick={() => {
                    startSigning(document.id).catch(() => undefined);
                  }}
                >
                  {isStarting ? "Opening..." : "Sign document"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
