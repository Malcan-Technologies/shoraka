"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createApiClient,
  useAuthToken,
  useOrganization,
  type PortalType,
} from "@cashsouk/config";
import type {
  LegalAcceptanceAudience,
  LegalAcceptanceStatusResponse,
  RequiredLegalDocumentResponse,
} from "@cashsouk/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/card";
import { Checkbox } from "../components/checkbox";
import { Label } from "../components/label";
import { Button } from "../components/button";
import { Skeleton } from "../components/skeleton";
import { toast } from "sonner";
import { DocumentArrowDownIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

export interface LegalDocumentsAcceptanceProps {
  organizationId: string;
  portalType: PortalType;
  apiUrl: string;
  onAccepted?: () => void;
  /** Fallback when no published required PDFs exist yet. */
  fallback?: React.ReactNode;
}

type LocalDocState = {
  checked: boolean;
  opened: boolean;
  accepting: boolean;
  opening: boolean;
};

function audienceFromPortal(portalType: PortalType): LegalAcceptanceAudience {
  return portalType === "issuer" ? "ISSUER" : "INVESTOR";
}

export function LegalDocumentsAcceptance({
  organizationId,
  portalType,
  apiUrl,
  onAccepted,
  fallback,
}: LegalDocumentsAcceptanceProps) {
  const { getAccessToken } = useAuthToken();
  const { acceptTnc, refreshOrganizations, activeOrganization } = useOrganization();
  const audience = audienceFromPortal(portalType);
  const isOwner =
    activeOrganization?.id === organizationId ? Boolean(activeOrganization.isOwner) : false;

  const [status, setStatus] = useState<LegalAcceptanceStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [localState, setLocalState] = useState<Record<string, LocalDocState>>({});
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient(apiUrl, getAccessToken);
      const query = new URLSearchParams({
        audience,
        organizationId,
      });
      const result = await client.get<LegalAcceptanceStatusResponse>(
        `/v1/legal-documents/required?${query.toString()}`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load legal documents");
      }

      const data = result.data;
      setStatus(data);
      setLocalState((prev) => {
        const next: Record<string, LocalDocState> = {};
        for (const doc of data.documents) {
          const opened =
            doc.acceptance_status === "OPENED" ||
            doc.acceptance_status === "ACCEPTED" ||
            !doc.open_before_accept_required;
          next[doc.id] = {
            checked: doc.acceptance_status === "ACCEPTED" || prev[doc.id]?.checked === true,
            opened,
            accepting: false,
            opening: false,
          };
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load legal documents");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, audience, getAccessToken, organizationId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const allChecked = useMemo(() => {
    if (!status || status.documents.length === 0) return false;
    return status.documents.every((doc) => {
      if (doc.acceptance_status === "ACCEPTED") return true;
      return localState[doc.id]?.checked === true;
    });
  }, [localState, status]);

  const handleOpen = async (doc: RequiredLegalDocumentResponse) => {
    setLocalState((prev) => ({
      ...prev,
      [doc.id]: { ...prev[doc.id], opening: true },
    }));

    try {
      const client = createApiClient(apiUrl, getAccessToken);
      const result = await client.post<{
        downloadUrl: string;
        viewUrl: string;
        fileName: string;
      }>(`/v1/legal-documents/${doc.id}/open`, {
        organizationId,
        audience,
      });

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to record document open");
      }

      setLocalState((prev) => ({
        ...prev,
        [doc.id]: {
          ...prev[doc.id],
          opened: true,
          opening: false,
        },
      }));

      setStatus((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          documents: prev.documents.map((d) =>
            d.id === doc.id
              ? {
                  ...d,
                  acceptance_status:
                    d.acceptance_status === "ACCEPTED" ? "ACCEPTED" : "OPENED",
                }
              : d
          ),
        };
      });

      const url = result.data.viewUrl || result.data.downloadUrl;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setLocalState((prev) => ({
        ...prev,
        [doc.id]: { ...prev[doc.id], opening: false },
      }));
      toast.error(err instanceof Error ? err.message : "Failed to open document");
    }
  };

  const handleContinue = async () => {
    if (!status || !allChecked) {
      toast.error("Please open and accept all required documents");
      return;
    }

    setSubmitting(true);
    try {
      const client = createApiClient(apiUrl, getAccessToken);

      for (const doc of status.documents) {
        if (doc.acceptance_status === "ACCEPTED") continue;

        const result = await client.post(`/v1/legal-documents/${doc.id}/accept`, {
          organizationId,
          audience,
        });
        if (!result.success) {
          throw new Error(result.error?.message || `Failed to accept ${doc.title}`);
        }
      }

      await acceptTnc(organizationId);
      await refreshOrganizations();
      toast.success("Legal documents accepted");
      onAccepted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept legal documents");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle>Legal documents</CardTitle>
          <CardDescription>Loading required documents…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle>Legal documents</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={() => void loadStatus()} variant="outline">
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!status || status.documents.length === 0) {
    return <>{fallback}</>;
  }

  if (!isOwner) {
    return (
      <Card className="w-full rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle>Legal documents</CardTitle>
          <CardDescription>
            The organisation owner must accept the updated legal document before new transactions can
            continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            You can view the documents below. Only the organisation owner can complete acceptance
            during onboarding.
          </p>
          {status.documents.map((doc) => (
            <section
              key={doc.id}
              className="rounded-xl border border-border bg-muted/30 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-[17px] font-semibold leading-7">{doc.title}</h3>
                  <p className="text-sm text-muted-foreground">Version {doc.version}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2"
                  disabled={localState[doc.id]?.opening}
                  onClick={() => void handleOpen(doc)}
                >
                  <DocumentArrowDownIcon className="size-4" aria-hidden />
                  {localState[doc.id]?.opening ? "Opening…" : "View PDF"}
                </Button>
              </div>
            </section>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full rounded-2xl shadow-lg">
      <CardHeader>
        <CardTitle>Legal documents</CardTitle>
        <CardDescription>
          Open each PDF, then tick its checkbox. Continue stays disabled until every required
          document is accepted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status.documents.map((doc) => {
          const state = localState[doc.id];
          const isAccepted = doc.acceptance_status === "ACCEPTED";
          const canCheck = isAccepted || state?.opened === true;
          const checkboxId = `legal-accept-${doc.id}`;

          return (
            <section
              key={doc.id}
              className="rounded-xl border border-border bg-muted/30 p-4"
              aria-labelledby={`${checkboxId}-title`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 id={`${checkboxId}-title`} className="text-[17px] font-semibold leading-7">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">Version {doc.version}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2"
                  disabled={state?.opening || submitting}
                  onClick={() => void handleOpen(doc)}
                >
                  <DocumentArrowDownIcon className="size-4" aria-hidden />
                  {state?.opening ? "Opening…" : "View PDF"}
                </Button>
              </div>

              <div className="mt-4 flex items-start gap-3">
                <Checkbox
                  id={checkboxId}
                  checked={isAccepted || state?.checked === true}
                  disabled={!canCheck || isAccepted || submitting}
                  onCheckedChange={(checked) => {
                    setLocalState((prev) => ({
                      ...prev,
                      [doc.id]: {
                        ...prev[doc.id],
                        checked: checked === true,
                      },
                    }));
                  }}
                />
                <Label
                  htmlFor={checkboxId}
                  className={`text-sm leading-relaxed ${canCheck ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground"}`}
                >
                  {doc.checkbox_wording}
                </Label>
              </div>

              {!canCheck ? (
                <p className="mt-2 text-sm text-muted-foreground" role="status">
                  Open the PDF before you can accept this document.
                </p>
              ) : null}

              {isAccepted ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-foreground">
                  <CheckCircleIcon className="size-4 text-primary" aria-hidden />
                  Accepted
                </p>
              ) : null}
            </section>
          );
        })}
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => void handleContinue()}
          disabled={!allChecked || submitting}
          className="w-full"
        >
          {submitting ? "Submitting…" : "Accept and Continue"}
        </Button>
      </CardFooter>
    </Card>
  );
}
