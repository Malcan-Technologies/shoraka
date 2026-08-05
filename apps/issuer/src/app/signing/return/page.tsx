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

function readPendingSignedDocument(returnSessionId: string): { documentName: string } | null {
  try {
    const raw = sessionStorage.getItem(pendingConfirmStorageKey(returnSessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { documentName?: unknown };
    return typeof parsed.documentName === "string" ? { documentName: parsed.documentName } : null;
  } catch {
    return null;
  }
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

  React.useEffect(() => {
    if (!returnSessionId) {
      setError("Missing signing return reference.");
      return;
    }

    let cancelled = false;

    (async () => {
      const pendingDoc = readPendingSignedDocument(returnSessionId);

      try {
        const response = await apiClient.confirmSigningReturnSession(returnSessionId);
        if (cancelled) return;

        if (!response.success) {
          setError(getErrorMessage(response, "Could not confirm your signature."));
          return;
        }

        const storedToken = sessionStorage.getItem(`${TOKEN_FOR_RETURN_PREFIX}${returnSessionId}`);
        sessionStorage.removeItem(pendingConfirmStorageKey(returnSessionId));
        if (storedToken) {
          sessionStorage.removeItem(`${TOKEN_FOR_RETURN_PREFIX}${returnSessionId}`);
        }

        const data = response.data;
        const hasMoreToSign =
          !data.package_closed &&
          Boolean(findUnsignedSigningAssignmentForRecipient(data.envelope, data.recipient_id));

        if (hasMoreToSign && storedToken) {
          router.replace(`/signing/external/${encodeURIComponent(storedToken)}`);
          return;
        }

        setSignedDocumentName(pendingDoc?.documentName ?? null);
        setSession(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not confirm your signature.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiClient, returnSessionId, router]);

  if (error) {
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
