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

/** Prefer legalDocumentVersionId; tolerate legacy documentVersionId alias if present. */
function versionIdOf(doc: PendingLegalDocumentResponse): string {
  const legacy = (doc as PendingLegalDocumentResponse & { documentVersionId?: string })
    .documentVersionId;
  return doc.legalDocumentVersionId || legacy || "";
}

function rowStatus(
  doc: PendingLegalDocumentResponse,
  state: LocalDocState | undefined
): LegalChecklistDocStatus {
  if (doc.acceptance_status === "ACCEPTED") return "accepted";
  if (state?.opened || doc.acceptance_status === "OPENED") return "opened";
  return "not_opened";
}

export function LegalReacceptancePanel({
  organizationId,
  portalType,
  apiUrl,
  onComplete,
}: LegalReacceptancePanelProps) {
  const { getAccessToken } = useAuthToken();
  const { refreshOrganizations, activeOrganization } = useOrganization();
  const audience = audienceFromPortal(portalType);

  const [status, setStatus] = useState<LegalComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [localState, setLocalState] = useState<Record<string, LocalDocState>>({});
  const [error, setError] = useState<string | null>(null);

  const isOwner =
    status?.isOrganisationOwner ??
    (activeOrganization?.id === organizationId ? Boolean(activeOrganization.isOwner) : false);

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
          const versionId = versionIdOf(doc);
          const opened =
            doc.acceptance_status === "OPENED" ||
            doc.acceptance_status === "ACCEPTED" ||
            !doc.open_before_accept_required;
          next[versionId] = {
            checked: prev[versionId]?.checked === true,
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
    return pending.every((doc) => localState[versionIdOf(doc)]?.checked === true);
  }, [localState, pending]);

  const rows: LegalChecklistDocRow[] = useMemo(() => {
    return pending.map((doc) => {
      const id = versionIdOf(doc);
      const state = localState[id];
      const statusValue = rowStatus(doc, state);
      return {
        id,
        title: doc.title,
        version: doc.version,
        checkboxWording: doc.checkbox_wording,
        status: statusValue,
        checked: state?.checked === true,
        opening: state?.opening === true,
        canCheck: statusValue === "opened" || statusValue === "accepted",
        showCheckbox: isOwner,
      };
    });
  }, [isOwner, localState, pending]);

  const handleOpen = async (doc: PendingLegalDocumentResponse) => {
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
      window.open(
        result.data.viewUrl || result.data.downloadUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err) {
      setLocalState((prev) => ({
        ...prev,
        [versionId]: { ...prev[versionId], opening: false },
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

  const title = "Updated legal documents";
  const description = isOwner
    ? "Some legal documents have been updated. Please review and accept them before starting new transactions. Your account remains active."
    : "Your organization owner must review and accept the latest legal documents before new transactions can begin.";

  if (loading) {
    return (
      <LegalDocumentChecklistLoading
        title={title}
        description="Checking for documents that need review…"
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

  if (!status?.hasPendingReacceptance || pending.length === 0) {
    return null;
  }

  const docsById = new Map(pending.map((doc) => [versionIdOf(doc), doc]));

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
            {submitting ? "Submitting…" : "Accept updated documents"}
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
