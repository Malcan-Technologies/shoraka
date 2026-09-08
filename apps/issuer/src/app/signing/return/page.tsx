"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createApiClient } from "@cashsouk/config";
import {
  findUnsignedSigningAssignmentForRecipient,
  type ExternalSigningSessionDto,
} from "@cashsouk/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_FOR_RETURN_PREFIX = "signing:tokenForReturn:";
const PROVIDER_CONFIRM_ATTEMPTS = 6;
const PROVIDER_CONFIRM_DELAY_MS = 2500;

function pendingConfirmStorageKey(returnSessionId: string): string {
  return `signing:pendingConfirm:${returnSessionId}`;
}

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

function readPendingSignedDocument(
  returnSessionId: string
): { documentId: string | null; documentName: string } | null {
  try {
    const raw = sessionStorage.getItem(pendingConfirmStorageKey(returnSessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { documentId?: unknown; documentName?: unknown };
    return {
      documentId: typeof parsed.documentId === "string" ? parsed.documentId : null,
      documentName: typeof parsed.documentName === "string" ? parsed.documentName : "Document",
    };
  } catch {
    return null;
  }
}

function assignmentSigned(
  session: ExternalSigningSessionDto,
  documentId: string | null
): boolean {
  if (!documentId) {
    return !findUnsignedSigningAssignmentForRecipient(session.envelope, session.recipient_id);
  }
  const assignment = session.envelope.assignments.find(
    (item) =>
      item.document_id === documentId &&
      item.recipient_id === session.recipient_id &&
      item.action === "SIGN"
  );
  return assignment?.status === "SIGNED";
}

function SigningReturnLoading() {
  return (
    <main className="flex min-h-screen items-start justify-center bg-background px-4 py-10 sm:items-center">
      <Card className="mx-auto w-full max-w-md rounded-2xl shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    </main>
  );
}

function SigningReturnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const returnSessionId = searchParams.get("rs")?.trim() ?? "";
  const apiClient = React.useMemo(() => createApiClient(API_URL), []);
  const [error, setError] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<ExternalSigningSessionDto | null>(null);
  const [signedDocumentName, setSignedDocumentName] = React.useState<string | null>(null);
  const [awaitingProvider, setAwaitingProvider] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);

  const finishConfirmedSession = React.useCallback(
    (data: ExternalSigningSessionDto, pendingDoc: { documentName: string } | null) => {
      const storedToken = sessionStorage.getItem(`${TOKEN_FOR_RETURN_PREFIX}${returnSessionId}`);
      sessionStorage.removeItem(pendingConfirmStorageKey(returnSessionId));
      if (storedToken) {
        sessionStorage.removeItem(`${TOKEN_FOR_RETURN_PREFIX}${returnSessionId}`);
      }

      const hasMoreToSign =
        !data.package_closed &&
        Boolean(findUnsignedSigningAssignmentForRecipient(data.envelope, data.recipient_id));
      if (hasMoreToSign && storedToken) {
        router.replace(`/signing/external/${encodeURIComponent(storedToken)}`);
        return;
      }

      setSignedDocumentName(pendingDoc?.documentName ?? null);
      setAwaitingProvider(false);
      setSession(data);
    },
    [returnSessionId, router]
  );

  const confirmFromProvider = React.useCallback(async () => {
    return apiClient.confirmSigningReturnSession(returnSessionId);
  }, [apiClient, returnSessionId]);

  React.useEffect(() => {
    if (!returnSessionId) {
      setError("Missing signing return reference.");
      return;
    }

    let cancelled = false;

    (async () => {
      const pendingDoc = readPendingSignedDocument(returnSessionId);

      try {
        for (let attempt = 0; attempt < PROVIDER_CONFIRM_ATTEMPTS; attempt += 1) {
          const response = await confirmFromProvider();
          if (cancelled) return;

          if (!response.success) {
            setError(getErrorMessage(response, "Could not confirm your signature."));
            return;
          }

          const data = response.data;
          if (data.package_closed || assignmentSigned(data, pendingDoc?.documentId ?? null)) {
            finishConfirmedSession(data, pendingDoc);
            return;
          }

          setAwaitingProvider(true);
          setSignedDocumentName(pendingDoc?.documentName ?? null);
          setSession(data);
          if (attempt < PROVIDER_CONFIRM_ATTEMPTS - 1) {
            await new Promise((resolve) => setTimeout(resolve, PROVIDER_CONFIRM_DELAY_MS));
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not confirm your signature.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [confirmFromProvider, finishConfirmedSession, returnSessionId]);

  const retryConfirm = async () => {
    setIsRetrying(true);
    setError(null);
    try {
      const pendingDoc = readPendingSignedDocument(returnSessionId);
      const response = await confirmFromProvider();
      if (!response.success) {
        setError(getErrorMessage(response, "Could not confirm your signature."));
        return;
      }
      const data = response.data;
      if (data.package_closed || assignmentSigned(data, pendingDoc?.documentId ?? null)) {
        finishConfirmedSession(data, pendingDoc);
        return;
      }
      setAwaitingProvider(true);
      setSession(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm your signature.");
    } finally {
      setIsRetrying(false);
    }
  };

  if (error && !session) {
    return (
      <main className="flex min-h-screen items-start justify-center bg-background px-4 py-10 sm:items-center">
        <Card className="mx-auto w-full max-w-md rounded-2xl shadow-sm">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (session && awaitingProvider) {
    return (
      <main className="flex min-h-screen items-start justify-center bg-background px-4 py-10 sm:items-center">
        <Card className="mx-auto w-full max-w-md rounded-2xl shadow-sm">
          <CardHeader>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              CashSouk signing
            </p>
            <CardTitle className="pt-2 text-xl">Confirming your signature</CardTitle>
            <CardDescription className="mt-1">
              {signedDocumentName
                ? `Waiting for SigningCloud to confirm ${signedDocumentName}.`
                : "Waiting for SigningCloud to confirm your signature."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                This can take a few seconds. Stay on this page and we will retry automatically.
              </div>
            )}
            <Button
              type="button"
              className="h-11 w-full rounded-xl"
              disabled={isRetrying}
              onClick={() => {
                retryConfirm().catch(() => undefined);
              }}
            >
              {isRetrying ? "Checking..." : "Check again"}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (session) {
    const packageClosed = Boolean(session.package_closed);
    const title = packageClosed ? "Signing package closed" : "You've signed";
    const description = packageClosed
      ? "This signing package is complete or no longer available."
      : signedDocumentName
        ? `${signedDocumentName} has been signed.`
        : "Your signature has been recorded.";

    return (
      <main className="flex min-h-screen items-start justify-center bg-background px-4 py-10 sm:items-center">
        <Card className="mx-auto w-full max-w-md rounded-2xl shadow-sm">
          <CardHeader>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              CashSouk signing
            </p>
            <div className="flex items-start gap-3 pt-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <CheckCircleIcon className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl">{title}</CardTitle>
                <CardDescription className="mt-1">{description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              You can close this page.
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <SigningReturnLoading />;
}

export default function SigningReturnPage() {
  return (
    <Suspense fallback={<SigningReturnLoading />}>
      <SigningReturnContent />
    </Suspense>
  );
}
