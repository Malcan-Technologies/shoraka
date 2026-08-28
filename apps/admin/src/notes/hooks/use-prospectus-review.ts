"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  ProspectusReviewDetail,
  ProspectusReviewGetResponse,
  SaveProspectusReviewDraftInput,
} from "@cashsouk/types";
import { notesKeys } from "../query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function prospectusReviewKey(noteId: string) {
  return [...notesKeys.detail(noteId), "prospectus-review"] as const;
}

/** Preview cache key — invalidated when the review draft/status changes. */
export function prospectusReviewPreviewKey(noteId: string) {
  return [...prospectusReviewKey(noteId), "preview"] as const;
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
      const res = await apiClient.saveAdminProspectusReviewDraft(noteId, input);
      if (!res.success) {
        if (res.error.code === "CONFLICT") {
          throw new ProspectusReviewConflictError(res.error.message);
        }
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: () => {
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
    mutationFn: async (input?: SaveProspectusReviewDraftInput) => {
      const res = await apiClient.approveAdminProspectusReview(noteId, input);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (review: ProspectusReviewDetail) => {
      // Apply APPROVED status immediately so the action bar drops Approve before refetch settles.
      qc.setQueryData(
        prospectusReviewKey(noteId),
        (previous: ProspectusReviewGetResponse | undefined) =>
          previous ? { ...previous, review } : previous
      );
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
      if (!res.success) throw new Error(res.error.message);
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
      if (!res.success) throw new Error(res.error.message);
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

