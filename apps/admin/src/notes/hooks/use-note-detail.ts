import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { notesKeys } from "../query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useNoteDetail(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: notesKeys.detail(noteId),
    enabled: Boolean(noteId),
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getAdminNoteDetail(noteId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useNoteLedger(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: [...notesKeys.detail(noteId), "ledger"],
    enabled: Boolean(noteId),
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getAdminNoteLedger(noteId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

