"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { prospectusReviewErrorMessage } from "./prospectus-review-error-utils";
import type {
  ProspectusReviewDetail,
  ProspectusReviewGetResponse,
  SaveProspectusReviewDraftInput,
} from "@cashsouk/types";
import { notesKeys } from "../query-keys";
// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
import {
  prospectusUiDiag,
  prospectusUiDiagError,
} from "../prospectus-review/prospectus-ui-diagnostics";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type ApiErrorShape = {
  code?: string;
  message?: string;
  details?: unknown;
};

function prospectusReviewKey(noteId: string) {
  return [...notesKeys.detail(noteId), "prospectus-review"] as const;
}

/** Preview cache key — invalidated when the review draft/status changes. */
export function prospectusReviewPreviewKey(noteId: string) {
  return [...prospectusReviewKey(noteId), "preview"] as const;
}

// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
type ProspectusDiagQueryClient = ReturnType<typeof useQueryClient>;

// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
/** Read-only snapshot of both cached queries (no observers, no fetches). */
export function readProspectusDiagCache(qc: ProspectusDiagQueryClient, noteId: string) {
  try {
    return readProspectusDiagCacheUnsafe(qc, noteId);
  } catch {
    // Diagnostics must never affect the page.
    return { review: null, noteDetail: null };
  }
}

// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
function readProspectusDiagCacheUnsafe(qc: ProspectusDiagQueryClient, noteId: string) {
  const reviewState = qc.getQueryState<ProspectusReviewGetResponse>(prospectusReviewKey(noteId));
  const noteState = qc.getQueryState<{
    status?: string;
    publishedAt?: string | null;
    prospectus?: unknown;
  }>(notesKeys.detail(noteId));
  return {
    review: reviewState
      ? {
          status: reviewState.data?.review.status ?? null,
          updatedAt: reviewState.data?.review.updatedAt ?? null,
          contentVersion: reviewState.data?.review.contentVersion ?? null,
          publishBlockedReason: reviewState.data?.publishBlockedReason ?? null,
          queryStatus: reviewState.status,
          fetchStatus: reviewState.fetchStatus,
          isInvalidated: reviewState.isInvalidated,
          dataUpdatedAt: reviewState.dataUpdatedAt,
        }
      : null,
    noteDetail: noteState
      ? {
          noteStatus: noteState.data?.status ?? null,
          publishedAt: noteState.data?.publishedAt ?? null,
          prospectus: noteState.data?.prospectus ?? null,
          queryStatus: noteState.status,
          fetchStatus: noteState.fetchStatus,
          isInvalidated: noteState.isInvalidated,
          dataUpdatedAt: noteState.dataUpdatedAt,
        }
      : null,
  };
}

// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
/**
 * Logs every cache transition of the review and note detail queries in order.
 * A QueryCache subscription adds no observer, so it cannot cause fetches or re-renders.
 * Returns a reader for the current cache snapshot.
 */
export function useProspectusDiagCacheLogger(noteId?: string) {
  const qc = useQueryClient();
  React.useEffect(() => {
    if (!noteId) return;
    const reviewKey = JSON.stringify(prospectusReviewKey(noteId));
    const detailKey = JSON.stringify(notesKeys.detail(noteId));
    prospectusUiDiag("prospectus.ui.initial", {
      noteId,
      cache: readProspectusDiagCache(qc, noteId),
      reviewQueryData: qc.getQueryData(prospectusReviewKey(noteId)) ?? null,
      noteDetailQueryData: qc.getQueryData(notesKeys.detail(noteId)) ?? null,
    });
    return qc.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") return;
      let key: string;
      try {
        key = JSON.stringify(event.query.queryKey);
      } catch {
        return;
      }
      if (key !== reviewKey && key !== detailKey) return;
      const query = key === reviewKey ? "review" : "note_detail";
      const state = event.query.state;
      const action = event.action as { type: string; manual?: boolean };
      if (action.type === "success") {
        const data = state.data as
          | (ProspectusReviewGetResponse & { status?: string; prospectus?: unknown })
          | undefined;
        prospectusUiDiag(
          query === "review" ? "prospectus.ui.review.refetched" : "prospectus.ui.note_detail.refetched",
          {
            noteId,
            // manual = written by setQueryData (approve onSuccess), not by a network response.
            manual: action.manual === true,
            dataUpdatedAt: state.dataUpdatedAt,
            fetchStatus: state.fetchStatus,
            queryStatus: state.status,
            isInvalidated: state.isInvalidated,
            ...(query === "review"
              ? {
                  status: data?.review?.status ?? null,
                  updatedAt: data?.review?.updatedAt ?? null,
                  contentVersion: data?.review?.contentVersion ?? null,
                  publishBlockedReason: data?.publishBlockedReason ?? null,
                  response: data ?? null,
                }
              : {
                  noteStatus: data?.status ?? null,
                  prospectus: data?.prospectus ?? null,
                }),
          }
        );
        return;
      }
      prospectusUiDiag("prospectus.ui.cache.event", {
        noteId,
        query,
        actionType: action.type,
        dataUpdatedAt: state.dataUpdatedAt,
        fetchStatus: state.fetchStatus,
        queryStatus: state.status,
        isInvalidated: state.isInvalidated,
        cache: readProspectusDiagCache(qc, noteId),
      });
    });
  }, [qc, noteId]);
  return React.useCallback(
    () => (noteId ? readProspectusDiagCache(qc, noteId) : null),
    [qc, noteId]
  );
}

export function useProspectusReview(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: prospectusReviewKey(noteId ?? ""),
    enabled: Boolean(noteId),
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const res = await apiClient.getAdminProspectusReview(noteId);
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      if (!res.success) {
        prospectusUiDiagError("review.fetch", res.error, {
          noteId,
          correlationId: res.correlationId ?? null,
        });
      } else {
        prospectusUiDiag("prospectus.ui.review.response", {
          noteId,
          correlationId: res.correlationId ?? null,
          status: res.data.review.status,
          updatedAt: res.data.review.updatedAt,
          contentVersion: res.data.review.contentVersion,
          publishBlockedReason: res.data.publishBlockedReason,
          response: res.data,
        });
      }
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export class ProspectusReviewConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProspectusReviewConflictError";
  }
}

export function useSaveProspectusReviewDraft(noteId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveProspectusReviewDraftInput) => {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusUiDiag("prospectus.ui.save.request", {
        noteId,
        expectedUpdatedAt: input.expectedUpdatedAt ?? null,
        cachedReview: readProspectusDiagCache(qc, noteId).review,
        request: input,
      });
      const res = await apiClient.saveAdminProspectusReviewDraft(noteId, input);
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      if (!res.success) {
        prospectusUiDiagError("save", res.error, {
          noteId,
          correlationId: res.correlationId ?? null,
          isConflict: res.error.code === "CONFLICT",
          expectedUpdatedAt: input.expectedUpdatedAt ?? null,
        });
      } else {
        prospectusUiDiag("prospectus.ui.save.response", {
          noteId,
          correlationId: res.correlationId ?? null,
          status: res.data.status,
          updatedAt: res.data.updatedAt,
          contentVersion: res.data.contentVersion,
          response: res.data,
        });
      }
      if (!res.success) {
        if (res.error.code === "CONFLICT") {
          throw new ProspectusReviewConflictError(res.error.message);
        }
        throw new Error(prospectusReviewErrorMessage(res.error as ApiErrorShape));
      }
      return res.data;
    },
    onSuccess: () => {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusUiDiag("prospectus.ui.invalidate.start", {
        noteId,
        source: "save",
        queryKeys: [
          prospectusReviewKey(noteId),
          prospectusReviewPreviewKey(noteId),
          notesKeys.detail(noteId),
        ],
        cache: readProspectusDiagCache(qc, noteId),
      });
      void qc.invalidateQueries({ queryKey: prospectusReviewKey(noteId) });
      void qc.invalidateQueries({ queryKey: prospectusReviewPreviewKey(noteId) });
      void qc.invalidateQueries({ queryKey: notesKeys.detail(noteId) });
    },
  });
}

/**
 * Open a signed PDF URL in a new tab without tripping the popup blocker.
 * `window.open` must run before any `await` (same click). Do not pass `noopener` —
 * Chrome then returns `null` even when the tab opened, which looked like a block.
 */
async function openSignedPdfInNewTab(loadUrl: () => Promise<string>) {
  const tab = window.open("about:blank", "_blank");
  if (!tab) {
    throw new Error("Pop-up blocked. Allow pop-ups for this site to view the Prospectus PDF.");
  }
  tab.opener = null;
  try {
    tab.location.href = await loadUrl();
  } catch (error) {
    tab.close();
    throw error;
  }
}

/** Open the frozen approved Prospectus PDF in a new tab. */
export function useOpenAdminProspectusPdf() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useMutation({
    mutationFn: async (noteId: string) => {
      await openSignedPdfInNewTab(async () => {
        const res = await apiClient.getAdminNoteProspectus(noteId);
        if (!res.success) throw new Error(res.error.message);
        if (!res.data.pdfViewUrl) throw new Error("Prospectus PDF is not available");
        return res.data.pdfViewUrl;
      });
    },
  });
}

export function useApproveProspectusReview(noteId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input?: Partial<SaveProspectusReviewDraftInput>) => {
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusUiDiag("prospectus.ui.approve.request", {
        noteId,
        expectedUpdatedAt: input?.expectedUpdatedAt ?? null,
        sendsDraftContent: input?.draftContent != null,
        cache: readProspectusDiagCache(qc, noteId),
      });
      const res = await apiClient.approveAdminProspectusReview(noteId, input as any);
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      if (!res.success) {
        prospectusUiDiagError("approve", res.error, {
          noteId,
          correlationId: res.correlationId ?? null,
          isConflict: res.error.code === "CONFLICT",
          expectedUpdatedAt: input?.expectedUpdatedAt ?? null,
        });
      } else {
        prospectusUiDiag("prospectus.ui.approve.response", {
          noteId,
          correlationId: res.correlationId ?? null,
          status: res.data.status,
          updatedAt: res.data.updatedAt,
          contentVersion: res.data.contentVersion,
          approvedPublicationId: res.data.approvedPublicationId,
          response: res.data,
        });
      }
      if (!res.success) {
        if (res.error.code === "CONFLICT") {
          throw new ProspectusReviewConflictError(res.error.message);
        }
        throw new Error(prospectusReviewErrorMessage(res.error as ApiErrorShape));
      }
      return res.data;
    },
    onSuccess: (review: ProspectusReviewDetail) => {
      // Apply APPROVED status immediately so the action bar drops Approve before refetch settles.
      qc.setQueryData(
        prospectusReviewKey(noteId),
        (previous: ProspectusReviewGetResponse | undefined) =>
          previous ? { ...previous, review } : previous
      );
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      prospectusUiDiag("prospectus.ui.approve.cache_set", {
        noteId,
        mutationResponseStatus: review.status,
        mutationResponseUpdatedAt: review.updatedAt,
        cache: readProspectusDiagCache(qc, noteId),
      });
      prospectusUiDiag("prospectus.ui.invalidate.start", {
        noteId,
        source: "approve",
        // notesKeys.detail is a prefix of the review key, so the review query is invalidated twice.
        queryKeys: [
          prospectusReviewKey(noteId),
          prospectusReviewPreviewKey(noteId),
          notesKeys.detail(noteId),
        ],
        cache: readProspectusDiagCache(qc, noteId),
      });
      void qc.invalidateQueries({ queryKey: prospectusReviewKey(noteId) });
      void qc.invalidateQueries({ queryKey: prospectusReviewPreviewKey(noteId) });
      void qc.invalidateQueries({ queryKey: notesKeys.detail(noteId) });
    },
  });
}

/**
 * Saved-review preview (GET) — used for draft/approved Preview sheet.
 * Does not send unsaved form values.
 */
export function useProspectusReviewPreview(noteId: string, enabled: boolean) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useQuery({
    queryKey: prospectusReviewPreviewKey(noteId),
    enabled: Boolean(noteId && enabled),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await apiClient.getAdminProspectusReviewPreview(noteId);
      if (!res.success) throw new Error(prospectusReviewErrorMessage(res.error as ApiErrorShape));
      return res.data;
    },
  });
}

/**
 * Live preview from current unsaved form values (POST).
 * Does not save, invalidate review queries, or clear dirty state.
 */
export function usePreviewProspectusReview(noteId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useMutation({
    mutationFn: async (input: SaveProspectusReviewDraftInput) => {
      const res = await apiClient.postAdminProspectusReviewPreview(noteId, input);
      if (!res.success) throw new Error(prospectusReviewErrorMessage(res.error as ApiErrorShape));
      return res.data;
    },
  });
}

export function issuerMarcAssessmentKey(issuerOrganizationId: string) {
  return ["admin", "issuer-marc", issuerOrganizationId] as const;
}

/** Live issuer-organization MARC assessment (not a Prospectus Review input). */
export function useIssuerMarcAssessment(issuerOrganizationId?: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const orgId = issuerOrganizationId?.trim() || "";

  return useQuery({
    queryKey: issuerMarcAssessmentKey(orgId),
    enabled: Boolean(orgId),
    queryFn: async () => {
      const res = await apiClient.getIssuerMarcAssessment(orgId);
      if (!res.success) throw new Error(res.error.message);
      return res.data.current;
    },
  });
}

