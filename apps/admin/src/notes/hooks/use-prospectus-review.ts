"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { SaveProspectusReviewDraftInput } from "@cashsouk/types";
import { notesKeys } from "../query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function prospectusReviewKey(noteId: string) {
  return [...notesKeys.detail(noteId), "prospectus-review"] as const;
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
    },
  });
}

export function useSubmitProspectusReview(noteId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.submitAdminProspectusReview(noteId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: prospectusReviewKey(noteId) });
    },
  });
}

export function useApproveProspectusReview(noteId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.approveAdminProspectusReview(noteId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: prospectusReviewKey(noteId) });
      void qc.invalidateQueries({ queryKey: notesKeys.detail(noteId) });
    },
  });
}

export function useReopenProspectusReview(noteId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.reopenAdminProspectusReview(noteId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: prospectusReviewKey(noteId) });
    },
  });
}

export function useProspectusReviewPreview(noteId: string, enabled: boolean) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useQuery({
    queryKey: [...prospectusReviewKey(noteId), "preview"] as const,
    enabled: Boolean(noteId && enabled),
    queryFn: async () => {
      const res = await apiClient.getAdminProspectusReviewPreview(noteId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}
