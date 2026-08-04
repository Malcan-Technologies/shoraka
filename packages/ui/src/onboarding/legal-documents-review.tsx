"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createApiClient,
  useAuthToken,
  useOrganization,
  type PortalType,
} from "@cashsouk/config";
import {
  LEGAL_DOCUMENT_CHECKBOX_WORDING,
  LEGAL_DOCUMENT_TYPE_LABELS,
  type LegalAcceptanceAudience,
  type LegalAcceptanceStatusResponse,
  type LegalComplianceStatus,
  type LegalDocumentType,
  type PendingLegalDocumentResponse,
  type RequiredLegalDocumentResponse,
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
import {
  legalDocumentsReviewCopy,
  type LegalDocumentsReviewMode,
} from "./legal-documents-review-copy";

export interface LegalDocumentsReviewProps {
  organizationId: string;
  portalType: PortalType;
  apiUrl: string;
  mode: LegalDocumentsReviewMode;
  onComplete?: () => void;
  /** Onboarding only: shown when no required published PDFs exist. */
  fallback?: React.ReactNode;
  /** Re-acceptance only: called when there is nothing pending (e.g. redirect home). */
  onEmptyReacceptance?: () => void;
  /**
   * When true, PageShell (or parent) owns the page title — checklist renders as a content panel only.
   * Use on /legal-updates; keep false for onboarding steps.
   */
  embedInPageShell?: boolean;
}

type LocalDocState = {
  checked: boolean;
  opened: boolean;
  opening: boolean;
};

type ReviewDoc = {
  versionId: string;
  type: LegalDocumentType;
  title: string;
  checkboxWording: string;
  acceptanceStatus: "NOT_OPENED" | "OPENED" | "ACCEPTED";
  openBeforeAcceptRequired: boolean;
};

function audienceFromPortal(portalType: PortalType): LegalAcceptanceAudience {
  return portalType === "issuer" ? "ISSUER" : "INVESTOR";
}

function wordingFor(type: LegalDocumentType, apiWording?: string): string {
  return LEGAL_DOCUMENT_CHECKBOX_WORDING[type] || apiWording || "I have read and accept this document.";
}

function titleFor(type: LegalDocumentType, apiTitle?: string): string {
  return apiTitle?.trim() || LEGAL_DOCUMENT_TYPE_LABELS[type];
}

function toReviewDocsFromRequired(docs: RequiredLegalDocumentResponse[]): ReviewDoc[] {
  return docs.map((doc) => ({
    versionId: doc.legalDocumentVersionId,
    type: doc.type,
    title: titleFor(doc.type, doc.title),
    checkboxWording: wordingFor(doc.type, doc.checkbox_wording),
    acceptanceStatus: doc.acceptance_status,
    openBeforeAcceptRequired: doc.open_before_accept_required,
  }));
}

function toReviewDocsFromPending(docs: PendingLegalDocumentResponse[]): ReviewDoc[] {
  return docs.map((doc) => {
    const legacy = (doc as PendingLegalDocumentResponse & { documentVersionId?: string })
      .documentVersionId;
    const versionId = doc.legalDocumentVersionId || legacy || "";
    return {
      versionId,
      type: doc.documentType,
      title: titleFor(doc.documentType, doc.title),
      checkboxWording: wordingFor(doc.documentType, doc.checkbox_wording),
      acceptanceStatus: doc.acceptance_status,
      openBeforeAcceptRequired: doc.open_before_accept_required,
    };
  });
}

function rowStatus(doc: ReviewDoc, state: LocalDocState | undefined): LegalChecklistDocStatus {
  if (doc.acceptanceStatus === "ACCEPTED") return "accepted";
  if (state?.opened || doc.acceptanceStatus === "OPENED") return "opened";
  return "not_opened";
}

export function LegalDocumentsReview({
  organizationId,
  portalType,
  apiUrl,
  mode,
  onComplete,
  fallback,
  onEmptyReacceptance,
  embedInPageShell = false,
}: LegalDocumentsReviewProps) {
  const { getAccessToken } = useAuthToken();
  const { acceptTnc, refreshOrganizations, activeOrganization } = useOrganization();
  const audience = audienceFromPortal(portalType);
  const copy = legalDocumentsReviewCopy(mode);

  const [docs, setDocs] = useState<ReviewDoc[]>([]);
  const [isOrganisationOwner, setIsOrganisationOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [localState, setLocalState] = useState<Record<string, LocalDocState>>({});
  const [error, setError] = useState<string | null>(null);
  const [emptyOnboarding, setEmptyOnboarding] = useState(false);

  const isOwner =
    isOrganisationOwner ||
    (activeOrganization?.id === organizationId ? Boolean(activeOrganization.isOwner) : false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEmptyOnboarding(false);
    try {
      const client = createApiClient(apiUrl, getAccessToken);
      const query = new URLSearchParams({ audience, organizationId });

      if (mode === "reacceptance") {
        const result = await client.get<LegalComplianceStatus>(
          `/v1/legal-documents/acceptance-status?${query.toString()}`
        );
        if (!result.success) {
          throw new Error(result.error?.message || "Failed to load pending documents");
        }
        const data = result.data;
        setIsOrganisationOwner(data.isOrganisationOwner);
        const nextDocs = toReviewDocsFromPending(data.pendingDocuments);
        setDocs(nextDocs);
        setLocalState((prev) => {
          const next: Record<string, LocalDocState> = {};
          for (const doc of nextDocs) {
            const opened =
              doc.acceptanceStatus === "OPENED" ||
              doc.acceptanceStatus === "ACCEPTED" ||
              !doc.openBeforeAcceptRequired;
            next[doc.versionId] = {
              checked: prev[doc.versionId]?.checked === true,
              opened,
              opening: false,
            };
          }
          return next;
        });
        if (!data.hasPendingReacceptance || nextDocs.length === 0) {
          onEmptyReacceptance?.();
        }
        return;
      }

      const result = await client.get<LegalAcceptanceStatusResponse>(
        `/v1/legal-documents/required?${query.toString()}`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load legal documents");
      }
      const nextDocs = toReviewDocsFromRequired(result.data.documents);
      setDocs(nextDocs);
      setLocalState((prev) => {
        const next: Record<string, LocalDocState> = {};
        for (const doc of nextDocs) {
          const opened =
            doc.acceptanceStatus === "OPENED" ||
            doc.acceptanceStatus === "ACCEPTED" ||
            !doc.openBeforeAcceptRequired;
          next[doc.versionId] = {
            checked:
              doc.acceptanceStatus === "ACCEPTED" || prev[doc.versionId]?.checked === true,
            opened,
            opening: false,
          };
        }
        return next;
      });
      if (nextDocs.length === 0) {
        setEmptyOnboarding(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load legal documents");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, audience, getAccessToken, mode, onEmptyReacceptance, organizationId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const allChecked = useMemo(() => {
    if (docs.length === 0) return false;
    return docs.every((doc) => {
      if (doc.acceptanceStatus === "ACCEPTED") return true;
      return localState[doc.versionId]?.checked === true;
    });
  }, [docs, localState]);

  const rows: LegalChecklistDocRow[] = useMemo(() => {
    return docs.map((doc) => {
      const state = localState[doc.versionId];
      const status = rowStatus(doc, state);
      return {
        id: doc.versionId,
        title: doc.title,
        checkboxWording: doc.checkboxWording,
        status,
        checked: status === "accepted" || state?.checked === true,
        opening: state?.opening === true,
        canCheck: status === "opened" || status === "accepted",
        showCheckbox: isOwner,
      };
    });
  }, [docs, isOwner, localState]);

  const handleOpen = async (versionId: string) => {
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
      setDocs((prev) =>
        prev.map((doc) =>
          doc.versionId === versionId && doc.acceptanceStatus !== "ACCEPTED"
            ? { ...doc, acceptanceStatus: "OPENED" }
            : doc
        )
      );
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
      toast.error("Please open and accept all required documents");
      return;
    }
    setSubmitting(true);
    try {
      const client = createApiClient(apiUrl, getAccessToken);
      for (const doc of docs) {
        if (doc.acceptanceStatus === "ACCEPTED") continue;
        const result = await client.post(`/v1/legal-documents/versions/${doc.versionId}/accept`, {
          organizationId,
          audience,
        });
        if (!result.success) {
          throw new Error(result.error?.message || `Failed to accept ${doc.title}`);
        }
      }

      if (mode === "onboarding") {
        await acceptTnc(organizationId);
      }
      await refreshOrganizations();
      toast.success(
        mode === "reacceptance"
          ? "Legal documents accepted"
          : "Legal documents accepted"
      );
      onComplete?.();
      if (mode === "reacceptance") {
        await loadStatus();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept legal documents");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <LegalDocumentChecklistLoading
        title={embedInPageShell ? undefined : copy.title}
        description={embedInPageShell ? undefined : "Loading documents…"}
      />
    );
  }

  if (error) {
    return (
      <LegalDocumentChecklistError
        title={embedInPageShell ? undefined : copy.title}
        error={error}
        onRetry={() => void loadStatus()}
      />
    );
  }

  if (mode === "onboarding" && emptyOnboarding) {
    return <>{fallback}</>;
  }

  if (mode === "reacceptance" && docs.length === 0) {
    return null;
  }

  return (
    <LegalDocumentChecklistShell
      title={embedInPageShell ? undefined : copy.title}
      description={
        embedInPageShell ? undefined : isOwner ? copy.description : copy.nonOwnerDescription
      }
      footer={
        isOwner ? (
          <Button
            onClick={() => void handleContinue()}
            disabled={!allChecked || submitting}
            className="h-11 w-full rounded-xl"
          >
            {submitting ? "Submitting…" : copy.buttonLabel}
          </Button>
        ) : undefined
      }
    >
      {embedInPageShell && !isOwner ? (
        <p className="border-b px-5 py-4 text-[17px] leading-7 text-muted-foreground md:px-6">
          {copy.nonOwnerDescription}
        </p>
      ) : null}
      <LegalDocumentChecklistRows
        rows={rows}
        disabled={submitting}
        onOpen={(id) => void handleOpen(id)}
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
