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
  LegalComplianceStatus,
  PendingLegalDocumentResponse,
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

export interface LegalReacceptancePanelProps {
  organizationId: string;
  portalType: PortalType;
  apiUrl: string;
  onComplete?: () => void;
}

type LocalDocState = {
  checked: boolean;
  opened: boolean;
  opening: boolean;
};

function audienceFromPortal(portalType: PortalType): LegalAcceptanceAudience {
  return portalType === "issuer" ? "ISSUER" : "INVESTOR";
}

export function LegalReacceptancePanel({
  organizationId,
  portalType,
  apiUrl,
  onComplete,
}: LegalReacceptancePanelProps) {
  const { getAccessToken } = useAuthToken();
  const { refreshOrganizations } = useOrganization();
  const audience = audienceFromPortal(portalType);

  const [status, setStatus] = useState<LegalComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [localState, setLocalState] = useState<Record<string, LocalDocState>>({});
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient(apiUrl, getAccessToken);
      const query = new URLSearchParams({ audience, organizationId });
      const result = await client.get<LegalComplianceStatus>(
        `/v1/legal-documents/acceptance-status?${query.toString()}`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load pending documents");
      }
      const data = result.data;
      setStatus(data);
      setLocalState((prev) => {
        const next: Record<string, LocalDocState> = {};
        for (const doc of data.pendingDocuments) {
          const opened =
            doc.acceptance_status === "OPENED" ||
            doc.acceptance_status === "ACCEPTED" ||
            !doc.open_before_accept_required;
          next[doc.documentVersionId] = {
            checked: prev[doc.documentVersionId]?.checked === true,
            opened,
            opening: false,
          };
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pending documents");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, audience, getAccessToken, organizationId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const pending = status?.pendingDocuments ?? [];

  const allChecked = useMemo(() => {
    if (pending.length === 0) return false;
    return pending.every((doc) => localState[doc.documentVersionId]?.checked === true);
  }, [localState, pending]);

  const handleOpen = async (doc: PendingLegalDocumentResponse) => {
    setLocalState((prev) => ({
      ...prev,
      [doc.documentVersionId]: { ...prev[doc.documentVersionId], opening: true },
    }));
    try {
      const client = createApiClient(apiUrl, getAccessToken);
      const result = await client.post<{
        downloadUrl: string;
        viewUrl: string;
      }>(`/v1/legal-documents/${doc.documentVersionId}/open`, {
        organizationId,
        audience,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to record document open");
      }
      setLocalState((prev) => ({
        ...prev,
        [doc.documentVersionId]: {
          ...prev[doc.documentVersionId],
          opened: true,
          opening: false,
        },
      }));
      window.open(
        result.data.viewUrl || result.data.downloadUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err) {
      setLocalState((prev) => ({
        ...prev,
        [doc.documentVersionId]: { ...prev[doc.documentVersionId], opening: false },
      }));
      toast.error(err instanceof Error ? err.message : "Failed to open document");
    }
  };

  const handleContinue = async () => {
    if (!allChecked) {
      toast.error("Please open and accept all updated documents");
      return;
    }
    setSubmitting(true);
    try {
      const client = createApiClient(apiUrl, getAccessToken);
      for (const doc of pending) {
        const result = await client.post(`/v1/legal-documents/${doc.documentVersionId}/accept`, {
          organizationId,
          audience,
        });
        if (!result.success) {
          throw new Error(result.error?.message || `Failed to accept ${doc.title}`);
        }
      }
      await refreshOrganizations();
      toast.success("Updated legal documents accepted");
      onComplete?.();
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept documents");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle>Updated legal documents</CardTitle>
          <CardDescription>Checking for documents that need review…</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle>Updated legal documents</CardTitle>
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

  if (!status?.hasPendingReacceptance || pending.length === 0) {
    return null;
  }

  return (
    <Card className="w-full rounded-2xl shadow-lg border-primary/30">
      <CardHeader>
        <CardTitle>Updated legal documents</CardTitle>
        <CardDescription>
          An updated legal document requires your review and acceptance before you can start new
          transactions. Your account stays active. You do not need to repeat onboarding, fee payment,
          or identity checks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {pending.map((doc) => {
          const state = localState[doc.documentVersionId];
          const canCheck = state?.opened === true;
          const checkboxId = `legal-reaccept-${doc.documentVersionId}`;
          return (
            <section
              key={doc.documentVersionId}
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
                  checked={state?.checked === true}
                  disabled={!canCheck || submitting}
                  onCheckedChange={(checked) => {
                    setLocalState((prev) => ({
                      ...prev,
                      [doc.documentVersionId]: {
                        ...prev[doc.documentVersionId],
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
              ) : (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircleIcon className="size-4" aria-hidden />
                  Document opened — you can accept
                </p>
              )}
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
          {submitting ? "Submitting…" : "Accept updated documents"}
        </Button>
      </CardFooter>
    </Card>
  );
}
