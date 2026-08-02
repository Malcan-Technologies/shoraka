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
import { Button } from "../components/button";
import { toast } from "sonner";
import {
  LegalDocumentChecklistError,
  LegalDocumentChecklistLoading,
  LegalDocumentChecklistRows,
  LegalDocumentChecklistShell,
  type LegalChecklistDocRow,
  type LegalChecklistDocStatus,
} from "./legal-document-checklist";

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
  opening: boolean;
};

function audienceFromPortal(portalType: PortalType): LegalAcceptanceAudience {
  return portalType === "issuer" ? "ISSUER" : "INVESTOR";
}

function versionIdOf(doc: RequiredLegalDocumentResponse): string {
  return doc.legalDocumentVersionId;
}

function rowStatus(
  doc: RequiredLegalDocumentResponse,
  state: LocalDocState | undefined
): LegalChecklistDocStatus {
  if (doc.acceptance_status === "ACCEPTED") return "accepted";
  if (state?.opened || doc.acceptance_status === "OPENED") return "opened";
  return "not_opened";
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
          const versionId = versionIdOf(doc);
          const opened =
            doc.acceptance_status === "OPENED" ||
            doc.acceptance_status === "ACCEPTED" ||
            !doc.open_before_accept_required;
          next[versionId] = {
            checked: doc.acceptance_status === "ACCEPTED" || prev[versionId]?.checked === true,
            opened,
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
      return localState[versionIdOf(doc)]?.checked === true;
    });
  }, [localState, status]);

  const rows: LegalChecklistDocRow[] = useMemo(() => {
    if (!status) return [];
    return status.documents.map((doc) => {
      const id = versionIdOf(doc);
      const state = localState[id];
      const statusValue = rowStatus(doc, state);
      return {
        id,
        title: doc.title,
        version: doc.version,
        checkboxWording: doc.checkbox_wording,
        status: statusValue,
        checked: statusValue === "accepted" || state?.checked === true,
        opening: state?.opening === true,
        canCheck: statusValue === "opened" || statusValue === "accepted",
        showCheckbox: isOwner,
      };
    });
  }, [isOwner, localState, status]);

  const handleOpen = async (doc: RequiredLegalDocumentResponse) => {
    const versionId = versionIdOf(doc);
    setLocalState((prev) => ({
      ...prev,
      [versionId]: { ...prev[versionId], opening: true },
    }));

    try {
      const client = createApiClient(apiUrl, getAccessToken);
      const result = await client.post<{
        downloadUrl: string;
        viewUrl: string;
        fileName: string;
      }>(`/v1/legal-documents/versions/${versionId}/open`, {
        organizationId,
        audience,
      });

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to record document open");
      }

      setLocalState((prev) => ({
        ...prev,
        [versionId]: {
          ...prev[versionId],
          opened: true,
          opening: false,
        },
      }));

      setStatus((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          documents: prev.documents.map((d) =>
            versionIdOf(d) === versionId
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
        [versionId]: { ...prev[versionId], opening: false },
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

        const result = await client.post(
          `/v1/legal-documents/versions/${versionIdOf(doc)}/accept`,
          {
            organizationId,
            audience,
          }
        );
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

  const title = "Legal documents";
  const description = isOwner
    ? "Please review and accept each required document before continuing. Open each PDF, then tick its checkbox. Continue stays disabled until all required documents are accepted."
    : "Your organization owner must review and accept the required legal documents before onboarding can continue.";

  if (loading) {
    return (
      <LegalDocumentChecklistLoading
        title={title}
        description="Loading required documents…"
      />
    );
  }

  if (error) {
    return (
      <LegalDocumentChecklistError
        title={title}
        error={error}
        onRetry={() => void loadStatus()}
      />
    );
  }

  if (!status || status.documents.length === 0) {
    return <>{fallback}</>;
  }

  const docsById = new Map(status.documents.map((doc) => [versionIdOf(doc), doc]));

  return (
    <LegalDocumentChecklistShell
      title={title}
      description={description}
      footer={
        isOwner ? (
          <Button
            onClick={() => void handleContinue()}
            disabled={!allChecked || submitting}
            className="h-11 w-full rounded-xl"
          >
            {submitting ? "Submitting…" : "Accept and Continue"}
          </Button>
        ) : undefined
      }
    >
      <LegalDocumentChecklistRows
        rows={rows}
        disabled={submitting}
        onOpen={(id) => {
          const doc = docsById.get(id);
          if (doc) void handleOpen(doc);
        }}
        onCheckedChange={(id, checked) => {
          setLocalState((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              checked,
            },
          }));
        }}
      />
    </LegalDocumentChecklistShell>
  );
}
