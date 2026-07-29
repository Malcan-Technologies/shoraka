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
 * Saved-review preview (GET) — used for published View Prospectus.
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
